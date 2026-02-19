import logging
import subprocess
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.routes import nodes as nodes_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Running database migrations...")
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    logger.info("Migrations complete.")
    yield


app = FastAPI(title="Flow Tree API", lifespan=lifespan, redirect_slashes=False)


# Workspace middleware — inner (request side: runs after CORS)
@app.middleware("http")
async def workspace_middleware(request: Request, call_next):
    workspace_id = request.cookies.get("workspace_id") or str(uuid4())
    request.state.workspace_id = workspace_id
    response = await call_next(request)
    response.set_cookie(
        key="workspace_id",
        value=workspace_id,
        httponly=True,
        samesite="lax",
        max_age=31536000,
        path="/",
    )
    return response


# CORS middleware — outer (request side: runs first; allow_credentials required for cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nodes_router.router, prefix="/api/nodes")
