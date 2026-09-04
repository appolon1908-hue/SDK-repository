from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AdapterRequestContext(BaseModel):
    """Authority and trace context required for consequential provider calls."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    tenant_id: str = Field(min_length=1, max_length=128)
    principal: str = Field(min_length=1, max_length=300)
    request_id: str = Field(min_length=1, max_length=180)
    correlation_id: str = Field(min_length=1, max_length=180)
    operation_id: str = Field(min_length=1, max_length=180)
    idempotency_key: str = Field(min_length=8, max_length=180)
    provider: str = Field(min_length=1, max_length=100)
    release_id: str = Field(min_length=1, max_length=180)
    provider_operation_id: str | None = Field(default=None, max_length=300)
