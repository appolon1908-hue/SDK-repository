package co.codestra.gateway;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Set;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Direct tests of the fail-closed authorization boundary described in
 * GatewayPolicy's own class doc: this is the second runtime allowlist that
 * has to hold even if Middleware's own authorization decision is somehow
 * bypassed. Before this test class, GatewayPolicy had zero test coverage --
 * the audit that flagged this (docs/API_AUDIT_REPORT.md) was correct.
 */
final class GatewayPolicyTest {

    private static DefaultCamelContext context;

    @BeforeAll
    static void startContext() {
        context = new DefaultCamelContext();
    }

    @AfterAll
    static void stopContext() {
        context.stop();
    }

    private static Exchange exchangeWithHeaders(String... keyValuePairs) {
        Exchange exchange = new DefaultExchange(context);
        for (int i = 0; i < keyValuePairs.length; i += 2) {
            exchange.getMessage().setHeader(keyValuePairs[i], keyValuePairs[i + 1]);
        }
        return exchange;
    }

    private static Exchange validSmsSendExchange() {
        return exchangeWithHeaders(
            GatewayPolicy.TENANT_HEADER, "tenant-1",
            GatewayPolicy.CORRELATION_HEADER, "correlation-1",
            GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
            GatewayPolicy.PROTOCOL_HEADER, "sms",
            GatewayPolicy.OPERATION_HEADER, "send"
        );
    }

    @Test
    void allowsAnExplicitlyEnabledProtocolAndOperation() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:send"));
        assertDoesNotThrow(() -> policy.assertAllowed(validSmsSendExchange()));
    }

    @Test
    void rejectsWhenNoProtocolIsAllowlisted() {
        // The default, unconfigured state: parseCsv(null) -> empty set.
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of(), Set.of());
        assertThrows(SecurityException.class, () -> policy.assertAllowed(validSmsSendExchange()));
    }

    @Test
    void rejectsAProtocolThatIsNotAllowlisted() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("email"), Set.of("sms:send"));
        assertThrows(SecurityException.class, () -> policy.assertAllowed(validSmsSendExchange()));
    }

    @Test
    void rejectsAnOperationNotScopedToItsProtocol() {
        // Protocol itself is allowed, but "sms:send" specifically is not --
        // enabling a protocol must not implicitly enable every operation on it.
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:receive"));
        assertThrows(SecurityException.class, () -> policy.assertAllowed(validSmsSendExchange()));
    }

    @Test
    void allowlistMatchingIsCaseInsensitive() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("SMS"), Set.of("SMS:SEND"));
        Exchange exchange = exchangeWithHeaders(
            GatewayPolicy.TENANT_HEADER, "tenant-1",
            GatewayPolicy.CORRELATION_HEADER, "correlation-1",
            GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
            GatewayPolicy.PROTOCOL_HEADER, "SmS",
            GatewayPolicy.OPERATION_HEADER, "SeNd"
        );
        assertDoesNotThrow(() -> policy.assertAllowed(exchange));
    }

    @Test
    void rejectsMissingTenantHeader() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:send"));
        Exchange exchange = exchangeWithHeaders(
            GatewayPolicy.CORRELATION_HEADER, "correlation-1",
            GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
            GatewayPolicy.PROTOCOL_HEADER, "sms",
            GatewayPolicy.OPERATION_HEADER, "send"
        );
        assertThrows(SecurityException.class, () -> policy.assertAllowed(exchange));
    }

    @Test
    void rejectsMissingCorrelationHeader() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:send"));
        Exchange exchange = exchangeWithHeaders(
            GatewayPolicy.TENANT_HEADER, "tenant-1",
            GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
            GatewayPolicy.PROTOCOL_HEADER, "sms",
            GatewayPolicy.OPERATION_HEADER, "send"
        );
        assertThrows(SecurityException.class, () -> policy.assertAllowed(exchange));
    }

    @Test
    void rejectsMissingIdempotencyHeader() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:send"));
        Exchange exchange = exchangeWithHeaders(
            GatewayPolicy.TENANT_HEADER, "tenant-1",
            GatewayPolicy.CORRELATION_HEADER, "correlation-1",
            GatewayPolicy.PROTOCOL_HEADER, "sms",
            GatewayPolicy.OPERATION_HEADER, "send"
        );
        assertThrows(SecurityException.class, () -> policy.assertAllowed(exchange));
    }

    @Test
    void rejectsBlankHeaderValue() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:send"));
        Exchange exchange = exchangeWithHeaders(
            GatewayPolicy.TENANT_HEADER, "   ",
            GatewayPolicy.CORRELATION_HEADER, "correlation-1",
            GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
            GatewayPolicy.PROTOCOL_HEADER, "sms",
            GatewayPolicy.OPERATION_HEADER, "send"
        );
        assertThrows(SecurityException.class, () -> policy.assertAllowed(exchange));
    }

    @Test
    void rejectsAHeaderContainingAControlCharacter() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:send"));
        Exchange exchange = exchangeWithHeaders(
            GatewayPolicy.TENANT_HEADER, "tenant-1\r\nX-Injected: true",
            GatewayPolicy.CORRELATION_HEADER, "correlation-1",
            GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
            GatewayPolicy.PROTOCOL_HEADER, "sms",
            GatewayPolicy.OPERATION_HEADER, "send"
        );
        assertThrows(SecurityException.class, () -> policy.assertAllowed(exchange));
    }

    @Test
    void rejectsATenantHeaderLongerThanTheDocumentedLimit() {
        GatewayPolicy policy = GatewayPolicy.withAllowlistsForTests(Set.of("sms"), Set.of("sms:send"));
        Exchange exchange = exchangeWithHeaders(
            GatewayPolicy.TENANT_HEADER, "t".repeat(129),
            GatewayPolicy.CORRELATION_HEADER, "correlation-1",
            GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
            GatewayPolicy.PROTOCOL_HEADER, "sms",
            GatewayPolicy.OPERATION_HEADER, "send"
        );
        assertThrows(SecurityException.class, () -> policy.assertAllowed(exchange));
    }
}
