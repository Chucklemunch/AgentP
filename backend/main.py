"""
    main.py is the central file for running the chat bot API.
    It takes in user input via the terminal, converts it into a query vector,
    probes the vector database, and uses the results to add context to the subsequent
    LLM calls.

    Author: Charlie Kotula
    Created Date: 02/01/2026
"""

import asyncio
import json
import os
from datetime import datetime

import aiosqlite
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_openai.embeddings import OpenAIEmbeddings
from openai import AsyncOpenAI
from pydantic import TypeAdapter
from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessage
from qdrant_client import QdrantClient

from models import ChatRequest, UseRag, ExerciseProgram, ExerciseProgramExtraction
from utils import (
    get_system_prompt, summarize_messages, get_rag_context, create_user_prompt
)

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
SYSTEM_PROMPT_VERSION = "0.0.4"
SYSTEM_PROMPT = get_system_prompt(SYSTEM_PROMPT_VERSION, 'prompt-registry/perry/system-prompts/')

# Get environment variables
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Connect to Qdrant Client
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

### Create async OpenAI Client for routing and extraction ###
client = AsyncOpenAI()
ROUTING_SYSTEM_PROMPT_VERSION = "0.0.0"
routing_system_prompt = get_system_prompt(ROUTING_SYSTEM_PROMPT_VERSION, "prompt-registry/rag-routing/system-prompts/")

# Model for embedding user query
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

### Database ###
DB_PATH = os.getenv("DB_PATH", "/data/programs.db")

PROGRAM_EXTRACTION_PROMPT = (
    "You extract structured exercise programs from physical therapy assistant responses. "
    "Set has_program=true ONLY if the response contains a COMPLETE exercise program with multiple "
    "named exercises, specific parameters (sets AND reps, OR duration in seconds), and frequency per week. "
    "Set has_program=false for general advice, single exercise mentions, or vague recommendations. "
    "If has_program=true, extract ALL exercises exactly as described. Infer a concise program title, "
    "goal, and total_weeks from context. Convert any duration given in minutes to seconds."
)


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS programs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                goal TEXT,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.commit()


@app.on_event("startup")
async def startup_event():
    await init_db()


async def extract_program_if_present(response_text: str) -> ExerciseProgram | None:
    try:
        result = await client.responses.parse(
            model="gpt-4o-mini-2024-07-18",
            input=[
                {"role": "system", "content": PROGRAM_EXTRACTION_PROMPT},
                {"role": "user", "content": response_text},
            ],
            text_format=ExerciseProgramExtraction,
        )
        extraction = result.output_parsed
        if extraction.has_program and extraction.program:
            return extraction.program
    except Exception as e:
        print(f"Program extraction error: {e}")
    return None


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
        async with agent.run_stream(prompt, message_history=history) as result:
            full_response = ""
            async for text in result.stream_text(delta=True):
                full_response += text
                yield f"data: {json.dumps({'type': 'text', 'chunk': text})}\n\n"

            program = await extract_program_if_present(full_response)
            if program:
                yield f"data: {json.dumps({'type': 'exercise_program', 'program': program.model_dump()})}\n\n"

            history_data = history_adapter.dump_python(result.all_messages(), mode='json')
            yield f"data: {json.dumps({'type': 'done', 'history': history_data})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


### Programs CRUD ###

@app.get("/programs")
async def list_programs():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT data FROM programs ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]


@app.post("/programs")
async def save_program(program: ExerciseProgram):
    now = datetime.utcnow().isoformat()
    data = program.model_dump()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO programs (id, title, goal, data, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (program.id, program.title, program.goal, json.dumps(data), program.created_at, now),
        )
        await db.commit()
    return data


@app.put("/programs/{program_id}")
async def update_program(program_id: str, program: ExerciseProgram):
    now = datetime.utcnow().isoformat()
    data = program.model_dump()
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT id FROM programs WHERE id = ?", (program_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Program not found")
        await db.execute(
            "UPDATE programs SET title=?, goal=?, data=?, updated_at=? WHERE id=?",
            (program.title, program.goal, json.dumps(data), now, program_id),
        )
        await db.commit()
    return data


@app.delete("/programs/{program_id}")
async def delete_program(program_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM programs WHERE id = ?", (program_id,))
        await db.commit()
    return {"deleted": program_id}
