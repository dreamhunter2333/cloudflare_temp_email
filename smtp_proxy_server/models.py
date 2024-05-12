from typing import Dict, List
from pydantic import BaseModel


class EmailModel(BaseModel):
    headers: Dict[str, str]
    body: str
    content_type: str
    subparts: List["EmailModel"]
    size: int
