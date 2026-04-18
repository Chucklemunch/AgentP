"""
    main.py is the central file for running the chat bot API.
    It takes in user input via the terminal, converts it into a query vector,
    probes the vector database, and uses the results to add context to the subsequent
    LLM calls.

    Author: Charlie Kotula
    Created Date: 02/01/2026
"""

import asyncio
import os
from openai import AsyncOpenAI
from qdrant_client import QdrantClient
from langchain_openai.embeddings import OpenAIEmbeddings
from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessage
from pydantic import TypeAdapter
from models import ChatRequest, UseRag
from utils import (
    get_system_prompt, summarize_messages, get_rag_context, create_user_prompt
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json

history_adapter = TypeAdapter(list[ModelMessage])


### Make API ###
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost", "https://agentp.charliekotula.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# Setup for Pydantic Agent
MODEL = "openai:gpt-4o"
SYSTEM_PROMPT_VERSION = "0.0.3"
SYSTEM_PROMPT = get_system_prompt(SYSTEM_PROMPT_VERSION, 'prompt-registry/perry/system-prompts/')


# Get environment variables
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Conect to Qdrant Client
COLLECTION_NAME = "perry_collection"
qdrant_client = QdrantClient(
    url="https://62280a9a-32bb-4d0a-9e6e-99de68406473.us-east-1-1.aws.cloud.qdrant.io",
    api_key=QDRANT_API_KEY,
    timeout=10
)

#### Create PydanticAI Agent ####
agent = Agent(
    MODEL,
    system_prompt=SYSTEM_PROMPT,
    retries=3,
    history_processors=[summarize_messages],
)

### Create async OpenAI Client for Routing ###
client = AsyncOpenAI()
ROUTING_SYSTEM_PROMPT_VERSION = "0.0.0"
routing_system_prompt = get_system_prompt(ROUTING_SYSTEM_PROMPT_VERSION, "prompt-registry/rag-routing/system-prompts/")

# Model for embeddding user query
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

# Define chat endpoint
@app.post("/chat")
async def chat(req: ChatRequest):
    prompt = req.message
    history = history_adapter.validate_python(req.history) if req.history else []

    # Run routing decision and embedding in parallel to minimize latency
    routing_task = client.responses.parse(
        model="gpt-4o-mini-2024-07-18",
        input=[
            {"role": "system", "content": routing_system_prompt},
            {"role": "user", "content": req.message},
        ],
        text_format=UseRag,
    )
    embedding_task = embeddings.aembed_query(req.message)
    routing_response, query_vector = await asyncio.gather(routing_task, embedding_task)

    use_rag = routing_response.output_parsed.use_rag
    print(f'SHOULD USE RAG: {use_rag}')

    if use_rag:
        rag_context = get_rag_context(qdrant_client, query_vector, COLLECTION_NAME, max_docs=6)
        prompt = create_user_prompt(req.message, rag_context)
        print(prompt)

    async def generate():
        #async with agent.run_stream(req.message, message_history=history) as result:
        async with agent.run_stream(prompt, message_history=history) as result:
            async for text in result.stream_text(delta=True):
                yield f"data: {json.dumps({'type': 'text', 'chunk': text})}\n\n"
            history_data = history_adapter.dump_python(result.all_messages(), mode='json')
            yield f"data: {json.dumps({'type': 'done', 'history': history_data})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


