package co.codestra.gateway;

import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

/**
 * Safe gateway shell. No external protocol producer is present in this stage.
 * Future protocol-specific branches must terminate in direct:protocol-command
 * so the policy check cannot be bypassed.
 */
public final class GatewayRoutes extends RouteBuilder {
    private final GatewayPolicy policy = GatewayPolicy.fromEnvironment();

    @Override
    public void configure() {
        from("platform-http:/health/live?httpMethodRestrict=GET")
            .routeId("gateway-liveness")
            .setHeader(Exchange.CONTENT_TYPE).constant("application/json")
            .setHeader(Exchange.HTTP_RESPONSE_CODE).constant(200)
            .setBody().constant("{\"status\":\"live\"}");

        from("platform-http:/health/ready?httpMethodRestrict=GET")
            .routeId("gateway-readiness")
            .setHeader(Exchange.CONTENT_TYPE).constant("application/json")
            .setHeader(Exchange.HTTP_RESPONSE_CODE).constant(200)
            .setBody().constant("{\"status\":\"ready\",\"protocols\":\"disabled-unless-allowlisted\"}");

        from("direct:protocol-command")
            .routeId("guarded-protocol-command")
            .process(policy::assertAllowed)
            .stop();
    }
}
