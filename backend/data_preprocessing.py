"""
Scrapes PubMed database for relevant article based on user query.
Cleans text from articles and chunks them into smaller documents.
Embeds documents and uploads vectors to Qdrant database
"""

from Bio import Entrez
from lxml import etree
from io import BytesIO
import re
import os
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from collections import defaultdict
from tqdm import tqdm
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import time
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from langchain_openai.embeddings import OpenAIEmbeddings
import uuid
from requests.exceptions import HTTPError
from http.client import IncompleteRead

Entrez.email = os.getenv('NCBI_EMAIL')
Entrez.api_key = os.getenv('NCBI_API_KEY')
QDRANT_API_KEY = os.getenv('QDRANT_API_KEY')

# Configuration
TEST_MODE = True  # Set to False for full run
TEST_ARTICLE_COUNT = 2000  # Number of articles to process in test mode
FULL_ARTICLE_COUNT = 10000  # Number of articles for full run

# Search query for getting relevant research articles
query = """
(
  rehabilitation OR "physical therapy" OR physiotherapy OR
  "return to sport" OR "return to play" OR "return to activity"
) AND (
  injury OR surgery OR postoperative OR post-operative OR musculoskeletal OR
  orthopedic OR orthopaedic OR trauma OR fracture OR sprain OR strain OR
  tendinopathy OR tendinitis OR arthroscopy OR ligament OR
  "rotator cuff" OR meniscus OR cartilage
) AND (
  exercise OR "therapeutic exercise" OR training OR "strength training" OR
  "resistance training" OR mobilization OR mobilisation OR "manual therapy" OR
  stretching OR neuromuscular OR proprioception OR "functional training" OR
  rehabilitation OR "range of motion"
) AND (
  review[pt] OR "systematic review"[pt] OR "meta-analysis"[pt] OR
  "clinical trial"[pt] OR "randomized controlled trial"[pt] OR
  "practice guideline"[pt]
)
"""

def get_total_count(query):
    """
    Gets the total number of articles matching the query without retrieving them

    Args: query (str) - search query used to count PMC articles
    Returns: count (int) - total number of matching articles
    """
    handle = Entrez.esearch(
        db='pmc',
        term=query,
        retmax=0  # Don't retrieve any IDs, just get the count
    )
    result = Entrez.read(handle)
    handle.close()
    return int(result['Count'])

def get_ids_with_metadata(query, max_results=10000):
    """
    Gets PMC article UIDs, PMCIDs, and titles based on search query

    Args:
        query (str) - search query used to retrieve PMC articles
        max_results (int) - maximum number of articles to retrieve
    Returns:
        metadata (list) - list of dicts containing PMCID and titles corresponding
            to the articles UID
    """
    # Get relevant UIDs and titles
    metadata = []
    handle = Entrez.esearch(
        db='pmc',
        term=query,
        retmax=max_results
    )

    # Get relevant articles
    uids = Entrez.read(handle)['IdList']
    handle.close()

    # Get summaries for metadata
    summary = Entrez.esummary(
        db='pmc',
        id=','.join(uids)
    )
    records = Entrez.read(summary)

    # Map UIDs to titles and pmids
    for rec in records:
        title = rec['Title'].lower()
        title = re.sub(r'[^a-z0-9]+', '_', title)

        metadata.append(
            {
                'uid': rec['Id'],
                'pmcid': rec['ArticleIds']['pmcid'],
                'title': title
            }
        )

    return metadata

######################################################
# Functions to extract, clean, and chunk text from PMC
def get_xml(pmc_id, max_retries=5):
    """
    Returns the xml tree representation of the PMC article corresponding to
    the input UID. Includes retry logic for rate limiting.
    """
    for attempt in range(max_retries):
        try:
            # Add delay to respect rate limits (0.1s = max 10 requests/second)
            time.sleep(0.1)

            handle = Entrez.efetch(
                db='pmc',
                id=pmc_id,
                retmode='xml',
            )

            xml_dat = handle.read()
            handle.close()

            # Converts xml bytes to tree
            xml_tree = etree.parse(BytesIO(xml_dat))

            return xml_tree

        except HTTPError as e:
            if e.code == 429:  # Too Many Requests
                wait_time = (2 ** attempt) * 0.5  # Exponential backoff: 0.5s, 1s, 2s, 4s, 8s
                print(f"Rate limit hit for {pmc_id}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                raise
        except (IncompleteRead, IOError) as e:
            if attempt < max_retries - 1:
                wait_time = 1
                print(f"Connection error for {pmc_id}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                raise

    raise Exception(f"Failed to fetch XML for {pmc_id} after {max_retries} attempts")

def get_text(xml):
    """
    Returns a dictionary of {section title: content} for the xml tree root.
    """
    text = []

    root = xml.getroot()

    # Remove references
    for xref in root.xpath('.//xref'):
        parent = xref.getparent()
        if parent is None:
            continue

        # removes punction surrounding references
        prev = xref.getprevious()

        # Handles punctuation before ref
        if prev is not None and prev.tail is not None:
            prev.tail = re.sub(r'[\[\(]\s*$', ' ', prev.tail)
        else:
            # xref is the first child → clean parent.text
            if parent.text:
                parent.text = re.sub(r'[\[\(]\s*$', ' ', parent.text)

        # Handles punctuation after ref
        if xref.tail:
            xref.tail = re.sub(r'^\s*[\]\)]*', ' ', xref.tail)

        parent.remove(xref)


    for sec in root.xpath('.//body//sec'):
        title = sec.findtext('title')
        if not title:
            continue
        title = title.lower()

        # Gets paragraphs from each section
        paragraphs = [
            ''.join(p.itertext()) for p in sec.findall('p')
        ]

        # Add sections to sections list
        if paragraphs: # ignores empty sections
            text.append((title , ' '.join(paragraph for paragraph in paragraphs)))

    return text

def clean_text(text):
    """
    Cleans article text, removing extra spaces, etc.
    """
    cleaned_text = []
    for section, words in text:
        words = re.sub(r'\s+', ' ', words)
        words = words.replace('\xa0', ' ').strip()
        cleaned_text.append((section, words))

    return cleaned_text

def chunk_text(cleaned_text, uid, pmcid, title,):
    """
    Takes cleaned article text and chunks it into LangChain Documents
    """
    docs = []

    for section, text in cleaned_text:
        # Create section label for metadata
        section = section.lower()
        section = re.sub(r'[^a-z0-9]+', '_', section)

        # Chunk text
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=['\n\n', '\n', '. ', ' ', '']
        )
        chunks = splitter.split_text(text)

        # Clean lines that begin with periods
        cleaned_chunks = [chunk.lstrip(". ") for chunk in chunks]

        # Create langchain Documents
        for i, chunk in enumerate(cleaned_chunks):
            doc=Document(
                page_content=chunk,
                metadata={
                    "uid": uid,
                    "pmcid": pmcid,
                    "article": title,
                    "section": section,
                    "chunk_id": f'{uid}-{section}-{i}'
                }
            )

            docs.append(doc)

    return docs

def process_article(article):
    # get metadata for Document creation
    uid = article['uid']
    pmcid = article['pmcid']
    title = article['title']

    # makes API call to Entrez
    xml = get_xml(uid)
    xml_string = get_text(xml)

    # add xml to article data
    article_dict = {
        'xml_text': xml_string,
        'uid': uid,
        'pmcid': pmcid,
        'title': title
    }

    return article_dict

def process_article_text(article_dict):
    """
    Processes article XML into chunked documents (CPU-bound operations only).
    Separated from API calls to allow better parallelization.
    """

    # extract data from article_dict
    xml_text = article_dict['xml_text']
    uid = article_dict['uid']
    pmcid = article_dict['pmcid']
    title = article_dict['title']

    # extract sections
    # text = get_text(xml)

    # clean sections
    cleaned_text = clean_text(xml_text)

    # chunk text and create LangChain Documents with metadata
    docs = chunk_text(cleaned_text, uid, pmcid, title)
    return docs

def embed_and_upsert(client, embed_model, document_batch):
    """
    Embeds text chunks and uploads vectors and their associated metadata to Qdrant
    """
    points = []
    RETRIES = 5

    # extract text and metadata
    texts = [doc.page_content for doc in document_batch]
    metadatas = [doc.metadata for doc in document_batch]


    # Embed text with retries
    for attempt in range(RETRIES):
        try:
            print(f'embedding attempt {attempt+1}/{RETRIES}')
            vectors = embed_model.embed_documents(texts)
            # create points containing embeddings and metadata
            for vec, doc in zip(vectors, document_batch):
                # create deterministic identifier for each point
                point_id = uuid.uuid5(uuid.NAMESPACE_DNS, doc.metadata['chunk_id'])
                points.append(
                    PointStruct(
                        id=point_id,
                        vector=vec,
                        payload={
                            **doc.metadata,
                            'text': doc.page_content
                        }
                    )
                )

            break
        except Exception as e:
            print(f'Embedding Failed: {e}')


            # upsert points in batches with retries
    for attempt in range(RETRIES):
        try:
            print(f'qdrant upsert attempt {attempt+1}/{RETRIES}')

            # upsert points to qdrant
            operation_info = client.upsert(
                collection_name="rehab_collection",
                wait=True,
                points=points
        )
            break
        except Exception as e:
            print(f'batch upsert failed: {e}')


def batched(iterable, batch_size):
    for i in range(0, len(iterable), batch_size):
        yield iterable[i : i + batch_size]

if __name__ == "__main__":
    print('in main function')
    # check total articles matching query
    total_count = get_total_count(query)
    print(f'total articles matching query: {total_count:,}')

    # determine how many articles to retrieve
    max_results = TEST_ARTICLE_COUNT if TEST_MODE else FULL_ARTICLE_COUNT
    max_results = min(max_results, total_count)  # don't exceed available articles

    mode = "test" if TEST_MODE else "full"
    print(f'running in {mode} mode: retrieving {max_results:,} articles')

    # create metadata list to be used in multiprocessing
    metadata = get_ids_with_metadata(query, max_results=max_results)
    print(f'Retrieved {len(metadata)} articles')

    documents = []
    article_dicts = [] # contains article xml + metadata

    start_time = time.time()

    # Makes the API calls to get the full texts
    print('getting xmls: process_article')
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(
                process_article,
                article
            )
            for article in metadata
        ]

        for future in as_completed(futures):
            try:
                article_dicts.append(future.result())
            except Exception as e:
                print("fetching xml failed: ", e)

    end_time = time.time()
    print(f'fetched xml for {len(article_dicts)} documents in {end_time - start_time} seconds')

    ### Processes multiple articles in parallel
    print('processing xml: process_article_text')
    with ProcessPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(
                process_article_text,
                article_dict,
            )
            for article_dict in article_dicts
        ]

        for future in as_completed(futures):
            documents.extend(future.result())

        end_time = time.time()
        print(f'processed {len(documents)} documents in {end_time - start_time} seconds')


    #### Batching, embedding, and upserting of chunks
    batched_docs = [batch for batch in batched(documents, 32)]

    # Connect to Qdrant -- LOCALLY
    # client = QdrantClient(url="http://localhost:6333")

    client = QdrantClient(
        url="https://62280a9a-32bb-4d0a-9e6e-99de68406473.us-east-1-1.aws.cloud.qdrant.io",
        api_key=QDRANT_API_KEY,
        timeout=30
    )

    collection_name = "rehab_collection"

    # Create collection if it doesn't already exist
    if not client.collection_exists(collection_name):
        client.create_collection(
            collection_name="rehab_collection",
            vectors_config=VectorParams(
                size=3072,
                distance=Distance.COSINE
            )
        )

    # Instantiate embedding model
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

    # Embed and upsert
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(
                embed_and_upsert,
                document_batch=batch,
                client=client,
                embed_model=embeddings
            )
            for batch in batched_docs
        ]

        for future in as_completed(futures):
            try:
                future.result()
#                print('point upsert batch complete!')
            except Exception as e:
                print("batch failed: ", e)

    end_time = time.time()

    print(f'processed {len(documents)} embedded and upserted in {end_time - start_time} seconds')

    # checking db
    count = client.count(collection_name='rehab_collection', exact=True)
    print('count: ', count)

    # wipe db
    # client.delete_collection('rehab_collection')
