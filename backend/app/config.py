import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Multimodal Financial Social Media Analytics Platform"
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./financial_platform.db")
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    upload_dir: str = os.getenv("UPLOAD_DIR", "./uploads")
    max_upload_mb: int = 50

    class Config:
        env_file = ".env"

settings = Settings()
