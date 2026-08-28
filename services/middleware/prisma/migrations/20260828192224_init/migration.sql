-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('accepted', 'scheduled', 'publishing', 'published', 'partially_published', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "WebhookSubscriptionStatus" AS ENUM ('pending_verification', 'active', 'disabled', 'verification_failed');

-- CreateEnum
CREATE TYPE "WebhookVerificationStatus" AS ENUM ('pending', 'verified', 'failed');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('queued', 'attempting', 'delivered', 'failed', 'dead_lettered', 'rejected');

-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('pending', 'dispatched', 'succeeded', 'failed', 'indeterminate');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'accepted',
    "content" JSONB NOT NULL,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "publish_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "event_types" TEXT[],
    "description" TEXT,
    "status" "WebhookSubscriptionStatus" NOT NULL DEFAULT 'pending_verification',
    "current_secret" TEXT NOT NULL,
    "current_secret_created_at" TIMESTAMP(3) NOT NULL,
    "previous_secret" TEXT,
    "previous_secret_expires_at" TIMESTAMP(3),
    "verification_status" "WebhookVerificationStatus" NOT NULL DEFAULT 'pending',
    "verification_challenge_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "verification_failure_code" TEXT,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "request_body_sha256" TEXT,
    "response_status" INTEGER,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotent_commands" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "command_id" TEXT NOT NULL,
    "state" "IdempotencyState" NOT NULL DEFAULT 'pending',
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3) NOT NULL,
    "result_json" JSONB,
    "outcome_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotent_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "subject" TEXT,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_posts_tenantId_created_at_idx" ON "social_posts"("tenantId", "created_at");

-- CreateIndex
CREATE INDEX "social_posts_tenantId_status_idx" ON "social_posts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "social_posts_tenantId_workspaceId_idx" ON "social_posts"("tenantId", "workspaceId");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_tenantId_idx" ON "webhook_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_subscriptionId_idx" ON "webhook_deliveries"("tenantId", "subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotent_commands_scope_key" ON "idempotent_commands"("scope");

-- CreateIndex
CREATE INDEX "idempotent_commands_tenantId_idx" ON "idempotent_commands"("tenantId");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenantId_created_at_idx" ON "outbox_events"("tenantId", "created_at");

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotent_commands" ADD CONSTRAINT "idempotent_commands_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
