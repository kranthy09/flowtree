from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database (async driver — used by FastAPI routes)
    DATABASE_URL: str = "postgresql+asyncpg://flowtree:flowtree@db:5432/flowtree"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # App
    SECRET_KEY: str = "change-me-in-production"
    ENVIRONMENT: str = "development"

    # Frontend
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"


settings = Settings()
