import asyncio
import base64
import hashlib
import os
from datetime import datetime, timedelta
from uuid import uuid4

import aiosqlite
import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from models import RegisterRequest, LoginRequest, TokenResponse

DB_PATH = os.getenv("DB_PATH", "/data/programs.db")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7


def _prepare_password(password: str) -> bytes:
    digest = hashlib.sha256(password.encode()).digest()
    return base64.b64encode(digest)

security = HTTPBearer()
router = APIRouter()


async def init_users_table():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        cursor = await db.execute("PRAGMA table_info(users)")
        columns = {row[1] for row in await cursor.fetchall()}
        if "username" not in columns:
            await db.execute("ALTER TABLE users ADD COLUMN username TEXT")
        await db.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)"
        )
        await db.commit()


def _create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    if "@" not in req.email or len(req.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password must be at least 8 characters",
        )
    if not req.username.strip():
        raise HTTPException(status_code=400, detail="Username is required")

    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT id FROM users WHERE email = ?", (req.email.lower(),)
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ?", (req.username.strip(),)
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username already taken")

        user_id = str(uuid4())
        now = datetime.utcnow().isoformat()
        loop = asyncio.get_event_loop()
        password_hash = await loop.run_in_executor(
            None, _bcrypt.hashpw, _prepare_password(req.password), _bcrypt.gensalt()
        )
        await db.execute(
            "INSERT INTO users (id, email, password_hash, created_at, username) VALUES (?, ?, ?, ?, ?)",
            (user_id, req.email.lower(), password_hash.decode(), now, req.username.strip()),
        )
        await db.commit()

    return TokenResponse(access_token=_create_token(user_id), username=req.username.strip())


@router.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, password_hash, username, email FROM users WHERE email = ?", (req.email.lower(),)
        )
        user = await cursor.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    loop = asyncio.get_event_loop()
    valid = await loop.run_in_executor(
        None, _bcrypt.checkpw, _prepare_password(req.password), user["password_hash"].encode()
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    username = user["username"] or user["email"].split("@")[0]
    return TokenResponse(access_token=_create_token(user["id"]), username=username)
