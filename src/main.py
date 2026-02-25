"""
    main.py is the central file for running the chat bot.
    It takes in user input via the terminal, converts it into a query vector,
    probes the vector database, and uses the results to add context to the subsequent
    LLM calls.

    Author: Charlie Kotula
    Created Date: 02/01/2026
"""

import os
import time
from qdrant_client import QdrantClient
from langchain_openai.embeddings import OpenAIEmbeddings
from openai import OpenAI

def process_user_input(query: str, embedding_model):
    """
        Takes user text input and converts it into a vector query.

        Arg:
            query (str): user prompt for LLM
            embedding_model: model used to embed user input
    """


    query_vector = embedding_model.embed_query(query)
    return query_vector

def get_rag_context(client, query_vector, max_docs=50):
    """
       Queries vector database and returns relevant data

       Args:
            client: Qdrant client used to access vector database
            query_vector: query vector used to probe vector database
            max_docs: maximun pieces of context to be retrieved from vecotr database
    """

    context = []

    # Queries qdrant vector database for relevant context
    results = client.query_points(
        collection_name="rehab_collection",
        query=query_vector,
        with_payload=True,
        limit=max_docs
    ).model_dump()

    results = results['points']

    for result in results:
        context.append(result['payload']['text'])

    return context

def create_user_prompt(query, rag_context):
    """
        Combines user query with retrieved context to make the final prompt
        that will be passed to the LLM

        Args:
            query: user prompt
            rag_context: list of text chunks retrieved from vector database
    """
    context = "\n\n".join(rag_context)

    user_prompt = f"""
    ################################
    Context from medical literature:

    {context}

    ################################
    Question: {query}
    ################################
    """

    return user_prompt

if __name__ == "__main__":
    # Get environment variables
    QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    # Conect to Qdrant Client
    qdrant_client = QdrantClient(
        url="https://62280a9a-32bb-4d0a-9e6e-99de68406473.us-east-1-1.aws.cloud.qdrant.io",
        api_key=QDRANT_API_KEY,
        timeout=10
    )

    # Connect to OpenAI
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    MODEL = "gpt-3.5-turbo"

    SYSTEM_PROMPT = """
    You are Perry, a personal physiotherapy assistant with a knack for making your patients feeling understood.
    You also have a thorough knowledge of the scientific literature on all things related to physiotherapy.
    Use the provided context from medical literautre to provide evidence based suggestions.
    Only provide suggests if the context provided is both related to the question and related to physical therapy and rehabilitation.
    If you do not have context relevant to the user question, remind them that you are only qualified to give suggestions on matters related to physical therapy and rehabilitation.
    Lastly, if you are missing context, and the user question is related to physical therapy and rehabilitation, ask the user follow-up questions that will help you understand their problem more deeply.
    """

    # Maintain conversation history for better context -- initialize with system prompt
    history = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    # Model for embeddding user query
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

    # Start chat bot
    intro = "\n\nHi there :)\n\nI'm Perry, your personal physiotherapy assistant. How can I help you?\n\n"
    print(intro)

    while True:
        try:
            # Retrieval step -- get user input and fetch relevant context
            user_input = input("Ask me something: ")
            query_vector = process_user_input(user_input, embeddings)
            rag_context = get_rag_context(qdrant_client, query_vector)

            print(f'rag_context: {rag_context}')

            enriched_prompt = create_user_prompt(user_input, rag_context)

            # only keep most recent question/response pair so as to not exceed context length
            if len(history) == 5:
                # removes old question/response pair
                history = [history[i] for i in [0, 3, 4]]
                print('history shortened')

            history.append({"role": "user", "content": enriched_prompt})

            # Generation step -- make call to model
            stream = openai_client.chat.completions.create(
                model=MODEL,
                messages=history,
                max_completion_tokens=1000,
                stream=True
            )

            # Stream output and collect full response
            print("\nPerry: ", end="", flush=True)
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    print(content, end="", flush=True)
                    full_response += content
                    time.sleep(0.1)
            print("\n")

            # Add assistant response to history
            history.append({"role": "assistant", "content": full_response})



        except KeyboardInterrupt:
            print("\n\nGoodbye!\n\n")
            exit(0)
        except EOFError:
            print("\n\nGoodbye!\n\n")
            exit(0)


