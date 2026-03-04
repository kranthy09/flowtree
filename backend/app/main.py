from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.executions import router as executions_router
from app.routes.exports import router as exports_router
from app.routes.imports import router as imports_router
from app.routes.nodes import router as nodes_router
from app.routes.workspaces import router as workspaces_router

app = FastAPI(title="FlowTree API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(workspaces_router)
app.include_router(nodes_router)
app.include_router(exports_router)
app.include_router(imports_router)
app.include_router(executions_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
