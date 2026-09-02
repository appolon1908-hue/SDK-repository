"""Server-only connector contracts for MoneyBee."""

from .context import AdapterRequestContext
from .errors import (
    AuthenticationError,
    AuthorizationError,
    CapabilityDisabledError,
    DependencyUnavailableError,
    IdempotencyConflictError,
    ProviderRejectedError,
    ProviderTimeoutError,
    RateLimitError,
    TenantAccessError,
    UnknownOutcomeError,
    ValidationError,
)
from .middleware import CodestraMiddlewareClient, MiddlewareClientConfig, Operation
from .webhooks import InMemoryReplayStore, VerifiedWebhook, WebhookVerifier

__all__ = [
    "AdapterRequestContext",
    "AuthenticationError",
    "AuthorizationError",
    "CapabilityDisabledError",
    "CodestraMiddlewareClient",
    "DependencyUnavailableError",
    "IdempotencyConflictError",
    "InMemoryReplayStore",
    "MiddlewareClientConfig",
    "Operation",
    "ProviderRejectedError",
    "ProviderTimeoutError",
    "RateLimitError",
    "TenantAccessError",
    "UnknownOutcomeError",
    "ValidationError",
    "VerifiedWebhook",
    "WebhookVerifier",
]
