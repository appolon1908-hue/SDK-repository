# Supply immutable image references, including sha256 digests, at build time.
ARG MAVEN_IMAGE
FROM ${MAVEN_IMAGE} AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn --batch-mode --no-transfer-progress clean package

ARG RUNTIME_IMAGE
FROM ${RUNTIME_IMAGE}
WORKDIR /app
RUN addgroup --system --gid 10001 codestra \
    && adduser --system --uid 10001 --ingroup codestra --home /app codestra
COPY --from=build --chown=codestra:codestra /workspace/target/codestra-camel-protocol-gateway-0.1.0-SNAPSHOT.jar /app/gateway.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-Djava.io.tmpdir=/tmp", "-jar", "/app/gateway.jar"]
