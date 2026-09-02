from __future__ import annotations

from typing import Any


class ConnectorError(RuntimeError):
    code = "CONNECTOR_ERROR"

    def __init__(self, message: str, *, retryable: bool = False, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.details = details or {}


class AuthenticationError(ConnectorError):
    code = "AUTHENTICATION_ERROR"


class AuthorizationError(ConnectorError):
    code = "AUTHORIZATION_ERROR"


class ValidationError(ConnectorError):
    code = "VALIDATION_ERROR"


class TenantAccessError(ConnectorError):
    code = "TENANT_ACCESS_ERROR"


class IdempotencyConflictError(ConnectorError):
    code = "IDEMPOTENCY_CONFLICT"


class RateLimitError(ConnectorError):
    code = "RATE_LIMIT"


class DependencyUnavailableError(ConnectorError):
    code = "DEPENDENCY_UNAVAILABLE"


class ProviderRejectedError(ConnectorError):
    code = "PROVIDER_REJECTED"


class ProviderTimeoutError(ConnectorError):
    code = "PROVIDER_TIMEOUT"


class UnknownOutcomeError(ConnectorError):
    code = "UNKNOWN_OUTCOME"


class CapabilityDisabledError(ConnectorError):
    code = "CAPABILITY_DISABLED"
