import logging
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

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
    imap_tls_cert: str = ""
    imap_tls_key: str = ""
    imap_cache_size: int = 500
    imap_http_timeout: float = 30.0

    model_config = SettingsConfigDict(env_file=".env")

    @field_validator("imap_cache_size")
    @classmethod
    def cache_size_positive(cls, v):
        if v <= 0:
            raise ValueError("imap_cache_size must be > 0")
        return v

    @field_validator("imap_http_timeout")
    @classmethod
    def timeout_positive(cls, v):
        if v <= 0:
            raise ValueError("imap_http_timeout must be > 0")
        return v


settings = Settings()
