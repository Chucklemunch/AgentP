"""
    main.py is the central file for running the chat bot API.
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
from pydantic_ai.messages import ModelMessage
from pydantic import TypeAdapter
from models import ChatRequest
from utils import (
    get_system_prompt, summarize_messages, create_enriched_prompt
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
SYSTEM_PROMPT_VERSION = '0.0.3'
SYSTEM_PROMPT = get_system_prompt(SYSTEM_PROMPT_VERSION, 'prompt-registry/system-prompts/')


# Get environment variables
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Conect to Qdrant Client
COLLECTION_NAME = "perry_collection"
qdrant_client = QdrantClient(
    url="https://62280a9a-32bb-4d0a-9e6e-99de68406473.us-east-1-1.aws.cloud.qdrant.io",
    api_key=QDRANT_API_KEY,
    timeout=60
)

#### Create PydanticAI Agent ####
agent = Agent(
    MODEL,
    system_prompt=SYSTEM_PROMPT,
    retries=3,
    history_processors=[summarize_messages],
)

# Model for embeddding user query
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

# Define chat endpoint
@app.post("/chat")
async def chat(req: ChatRequest):
    # Get enriched prompt for RAG
    enriched_prompt = create_enriched_prompt(
        query=req.message,
        embeddings=embeddings,
        qdrant_client=qdrant_client,
        collection_name=COLLECTION_NAME
    )
    history = history_adapter.validate_python(req.history) if req.history else []

    print(enriched_prompt)

    # Decide whether to use RAG or standard LLM call


    async def generate():
        #async with agent.run_stream(req.message, message_history=history) as result:
        async with agent.run_stream(enriched_prompt, message_history=history) as result:
            async for text in result.stream_text(delta=True):
                yield f"data: {json.dumps({'type': 'text', 'chunk': text})}\n\n"
            history_data = history_adapter.dump_python(result.all_messages(), mode='json')
            yield f"data: {json.dumps({'type': 'done', 'history': history_data})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


