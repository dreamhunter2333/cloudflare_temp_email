import logging
from pydantic_settings import BaseSettings

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)


class Settings(BaseSettings):
    proxy_url: str = "http://localhost:8787"
    port: int = 8025
    imap_port: int = 11143
    basic_password: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
