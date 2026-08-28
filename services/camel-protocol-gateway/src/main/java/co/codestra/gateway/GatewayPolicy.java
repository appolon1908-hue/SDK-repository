package co.codestra.gateway;

import java.util.Arrays;
import java.util.Collections;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.camel.Exchange;

/**
 * Fail-closed authorization boundary for any future protocol route.
 *
 * <p>The gateway does not decide business authorization. Middleware must make
 * that decision first and provide scoped command metadata. This class adds a
 * second runtime allowlist and rejects malformed or unscoped commands.</p>
 */
final class GatewayPolicy {
    static final String TENANT_HEADER = "X-Codestra-Tenant-Id";
    static final String CORRELATION_HEADER = "X-Correlation-Id";
    static final String IDEMPOTENCY_HEADER = "Idempotency-Key";
    static final String PROTOCOL_HEADER = "Codestra-Protocol";
    static final String OPERATION_HEADER = "Codestra-Operation";

    private final Set<String> allowedProtocols;
    private final Set<String> allowedOperations;

    private GatewayPolicy(Set<String> allowedProtocols, Set<String> allowedOperations) {
        this.allowedProtocols = allowedProtocols;
        this.allowedOperations = allowedOperations;
    }

    static GatewayPolicy fromEnvironment() {
        return new GatewayPolicy(
            parseCsv(System.getenv("CODESTRA_ALLOWED_PROTOCOLS")),
            parseCsv(System.getenv("CODESTRA_ALLOWED_OPERATIONS"))
        );
    }

    void assertAllowed(Exchange exchange) {
        requireHeader(exchange, TENANT_HEADER, 128);
        requireHeader(exchange, CORRELATION_HEADER, 128);
        requireHeader(exchange, IDEMPOTENCY_HEADER, 255);

        String protocol = normalize(requireHeader(exchange, PROTOCOL_HEADER, 64));
        String operation = normalize(requireHeader(exchange, OPERATION_HEADER, 128));

        if (!allowedProtocols.contains(protocol)) {
            throw new SecurityException("Protocol is not enabled: " + protocol);
        }

        String scopedOperation = protocol + ":" + operation;
        if (!allowedOperations.contains(scopedOperation)) {
            throw new SecurityException("Operation is not enabled: " + scopedOperation);
        }
    }

    private static String requireHeader(Exchange exchange, String name, int maxLength) {
        String value = exchange.getMessage().getHeader(name, String.class);
        if (value == null || value.isBlank()) {
            throw new SecurityException("Missing required command header: " + name);
        }
        if (value.length() > maxLength || containsControlCharacter(value)) {
            throw new SecurityException("Invalid command header: " + name);
        }
        return value;
    }

    private static boolean containsControlCharacter(String value) {
        return value.chars().anyMatch(character -> Character.isISOControl(character));
    }

    private static Set<String> parseCsv(String value) {
        if (value == null || value.isBlank()) {
            return Collections.emptySet();
        }
        return Collections.unmodifiableSet(
            Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .map(GatewayPolicy::normalize)
                .collect(Collectors.toSet())
        );
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
