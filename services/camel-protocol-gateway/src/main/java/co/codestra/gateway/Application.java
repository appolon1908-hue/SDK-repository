package co.codestra.gateway;

import org.apache.camel.main.Main;

/**
 * Starts the optional protocol gateway only after an operator explicitly
 * enables it. Installing or deploying the image is not activation.
 */
public final class Application {
    private static final String ENABLE_FLAG = "CODESTRA_CAMEL_ENABLED";

    private Application() {
    }

    public static void main(String[] args) throws Exception {
        if (!"true".equals(System.getenv(ENABLE_FLAG))) {
            throw new IllegalStateException(
                ENABLE_FLAG + " must be exactly 'true'; the protocol gateway is disabled by default"
            );
        }

        Main main = new Main(Application.class);
        main.run(args);
    }
}
