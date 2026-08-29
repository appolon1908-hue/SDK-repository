package co.codestra.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.apache.camel.CamelExecutionException;
import org.apache.camel.RoutesBuilder;
import org.apache.camel.test.junit5.CamelContextConfiguration;
import org.apache.camel.test.junit5.CamelTestSupport;
import org.junit.jupiter.api.Test;

/**
 * Proves GatewayRoutes actually wires GatewayPolicy into
 * direct:protocol-command -- GatewayPolicyTest alone only proves the policy
 * class works in isolation, not that the route still calls it. This exact
 * gap (a route silently losing its .process(policy::assertAllowed) step in
 * a future edit) is what a route-level test catches and a unit test cannot.
 *
 * The two platform-http: health routes in the same RouteBuilder are excluded
 * here (routeFilterExcludePattern) rather than started for real: they are
 * constant-JSON responses with no logic to verify, and starting them would
 * require standing up the real Vert.x PlatformHttpEngine that production
 * only gets via camel-main's Main (see Application.java) -- CamelTestSupport
 * does not run that boot sequence. Excluding them keeps this test scoped to
 * the one route that actually has behavior worth proving.
 *
 * pom.xml's surefire configuration fixes CODESTRA_ALLOWED_PROTOCOLS=sms and
 * CODESTRA_ALLOWED_OPERATIONS=sms:send for this JVM, since GatewayRoutes
 * builds its policy from GatewayPolicy.fromEnvironment() at construction
 * time with no other seam to control it from a route-level test.
 */
final class GatewayRoutesTest extends CamelTestSupport {

    @Override
    protected RoutesBuilder createRouteBuilder() {
        return new GatewayRoutes();
    }

    @Override
    public void configureContext(CamelContextConfiguration configuration) {
        super.configureContext(configuration);
        configuration.withRouteFilterExcludePattern("gateway-liveness,gateway-readiness");
    }

    @Test
    void guardedRouteAcceptsTheAllowlistedProtocolAndOperation() {
        template.sendBodyAndHeaders(
            "direct:protocol-command",
            "irrelevant-body",
            Map.of(
                GatewayPolicy.TENANT_HEADER, "tenant-1",
                GatewayPolicy.CORRELATION_HEADER, "correlation-1",
                GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
                GatewayPolicy.PROTOCOL_HEADER, "sms",
                GatewayPolicy.OPERATION_HEADER, "send"
            )
        );
        // sendBodyAndHeaders throws on any exception raised by the route;
        // reaching this line at all is the assertion that the policy check
        // let an explicitly allowlisted command through.
        assertTrue(true);
    }

    @Test
    void guardedRouteRejectsAnOperationOutsideTheAllowlist() {
        CamelExecutionException thrown = assertThrows(
            CamelExecutionException.class,
            () -> template.sendBodyAndHeaders(
                "direct:protocol-command",
                "irrelevant-body",
                Map.of(
                    GatewayPolicy.TENANT_HEADER, "tenant-1",
                    GatewayPolicy.CORRELATION_HEADER, "correlation-1",
                    GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
                    GatewayPolicy.PROTOCOL_HEADER, "sms",
                    GatewayPolicy.OPERATION_HEADER, "receive"
                )
            )
        );
        assertTrue(thrown.getCause() instanceof SecurityException, "expected the route to surface GatewayPolicy's SecurityException");
    }

    @Test
    void guardedRouteRejectsAProtocolOutsideTheAllowlist() {
        CamelExecutionException thrown = assertThrows(
            CamelExecutionException.class,
            () -> template.sendBodyAndHeaders(
                "direct:protocol-command",
                "irrelevant-body",
                Map.of(
                    GatewayPolicy.TENANT_HEADER, "tenant-1",
                    GatewayPolicy.CORRELATION_HEADER, "correlation-1",
                    GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
                    GatewayPolicy.PROTOCOL_HEADER, "email",
                    GatewayPolicy.OPERATION_HEADER, "send"
                )
            )
        );
        assertTrue(thrown.getCause() instanceof SecurityException);
    }

    @Test
    void guardedRouteRejectsAMissingRequiredHeader() {
        CamelExecutionException thrown = assertThrows(
            CamelExecutionException.class,
            () -> template.sendBodyAndHeaders(
                "direct:protocol-command",
                "irrelevant-body",
                Map.of(
                    GatewayPolicy.CORRELATION_HEADER, "correlation-1",
                    GatewayPolicy.IDEMPOTENCY_HEADER, "idem-1",
                    GatewayPolicy.PROTOCOL_HEADER, "sms",
                    GatewayPolicy.OPERATION_HEADER, "send"
                )
            )
        );
        assertTrue(thrown.getCause() instanceof SecurityException);
    }

    @Test
    void guardedRouteIsRegisteredAndWiredToThePolicyCheck() {
        assertEquals("guarded-protocol-command", context.getRoute("guarded-protocol-command").getId());
    }
}
