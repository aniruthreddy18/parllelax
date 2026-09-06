import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Industrial FireWatch API"
    VERSION: str = "2.0.0-beta"
    API_PREFIX: str = "/api"
    
    # Environment & Demo Mode Flags
    DEMO_MODE: bool = True
    
    # Spatial Database (PostgreSQL + PostGIS)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/firewatch_db"
    )
    
    # FCM Credentials
    FCM_PROJECT_ID: str = os.getenv("FCM_PROJECT_ID", "")
    FCM_CREDENTIALS: str = os.getenv("FCM_CREDENTIALS", "")
    
    # Twilio SMS Credentials
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER: str = os.getenv("TWILIO_FROM_NUMBER", "")
    
    # SendGrid Email Credentials
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    SENDGRID_FROM_EMAIL: str = os.getenv("SENDGRID_FROM_EMAIL", "alerts@firewatch.ai")
    
    # Map Provider Tile URL
    MAP_STYLE_URL: str = os.getenv(
        "VITE_MAP_STYLE_URL",
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
    )

    class Config:
        case_sensitive = True

settings = Settings()
