from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
