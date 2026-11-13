from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Samtalekart API"
    frontend_origin: str = "http://localhost:5173"
    mock_services: bool = True

    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: str = "devkey"
    livekit_api_secret: str = "secret"

    openai_api_key: str | None = None
    openai_model: str = "gpt-6-luna"

    azure_speech_key: str | None = None
    azure_speech_region: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

