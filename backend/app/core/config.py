from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "WebGuard & UX Auditor"
    API_V1_STR: str = "/api/v1"
    REQUEST_TIMEOUT_SECONDS: float = 15.0
    MAX_REDIRECTS: int = 5
    USER_AGENT: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 WebGuardBot/1.0"

    class Config:
        env_file = ".env"

settings = Settings()
