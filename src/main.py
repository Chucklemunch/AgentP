"""
    main.py is the central file for running the chat bot.
    It takes in user input via the terminal, converts it into a query vector,
    probes the vector database, and uses the results to add context to the subsequent
    LLM calls.

    Author: Charlie Kotula
    Created Date: 02/01/2026
"""

import os
from qdrant_client import QdrantClient
from langchain_openai.embeddings import OpenAIEmbeddings
from pydantic_ai import Agent
from models import PerryResponse
from utils import get_system_prompt, summarize_messages, format_perry_output
import asyncio

def process_user_input(query: str, embedding_model):
    """
        Takes user text input and converts it into a vector query.

        Arg:
            query (str): user prompt for LLM
            embedding_model: model used to embed user input
    """


    query_vector = embedding_model.embed_query(query)
    return query_vector

def get_rag_context(client, query_vector, max_docs=20):
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
        context.append(str(result['payload'])) # Includes metadata

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

async def chat_loop(agent, qdrant_client, embeddings):
    # Start chat bot
    intro = "\n\nHi there :)\n\nI'm Perry, your personal physiotherapy assistant. How can I help you?\n\n"
    print(intro)

    message_history = []
    cumulative_usage = None

    while True:
        try:
            # Retrieval step -- get user input and fetch relevant context
            user_input = input("Ask me something: ")
            query_vector = process_user_input(user_input, embeddings)
            rag_context = get_rag_context(qdrant_client, query_vector)
            enriched_prompt = create_user_prompt(user_input, rag_context)

            # Generation step
            print("\nPerry: ", end="", flush=True)
            result = await agent.run(enriched_prompt, message_history=message_history, usage=cumulative_usage)

            message_history = result.all_messages()
            cumulative_usage = result.usage()

            formatted_response = format_perry_output(result.output)

            print(formatted_response)


        except KeyboardInterrupt:
            print("\n\nGoodbye!\n\n")
            exit(0)
        except EOFError:
            print("\n\nGoodbye!\n\n")
            exit(0)

if __name__ == "__main__":
    # Get environment variables
    QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    # Conect to Qdrant Client
    qdrant_client = QdrantClient(
        url="https://62280a9a-32bb-4d0a-9e6e-99de68406473.us-east-1-1.aws.cloud.qdrant.io",
        api_key=QDRANT_API_KEY,
        timeout=60
    )

    # Setup for Pydantic Agent
    MODEL = "openai:gpt-4o"
    SYSTEM_PROMPT_VERSION = '0.0.2'
    SYSTEM_PROMPT = get_system_prompt(SYSTEM_PROMPT_VERSION, 'prompt-registry/system-prompts/')

    #### Create PydanticAI Agent ####
    agent = Agent(
        MODEL,
        system_prompt=SYSTEM_PROMPT,
        retries=3,
        history_processors=[summarize_messages],
        output_type=PerryResponse
    )

    # Model for embeddding user query
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

    # Run chat
    asyncio.run(chat_loop(agent, qdrant_client, embeddings))
