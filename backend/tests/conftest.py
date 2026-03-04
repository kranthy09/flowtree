import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.database import get_db
from app.main import app

# NullPool creates a brand-new connection on every acquire, so setup and
# teardown each get a fresh connection bound to the current running loop.
# This avoids "Future attached to a different loop" errors that occur when
# pooled connections outlive the event loop that created them.
_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """Yield a real DB session; truncate all test tables on teardown."""
    async with _Session() as session:
        yield session

    async with _Session() as cleanup:
        await cleanup.execute(
            text("TRUNCATE workspaces RESTART IDENTITY CASCADE")
        )
        await cleanup.commit()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncClient:
    """AsyncClient wired to the FastAPI app with the test DB session injected."""

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
