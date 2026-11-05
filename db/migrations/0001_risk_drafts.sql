CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"transcript" text NOT NULL,
	"extractor" text NOT NULL,
	"recipient_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"amount_source" text NOT NULL,
	"risk" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "approve_url" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "draft_id" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "recipient_id" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "risk_level" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "risk" jsonb;--> statement-breakpoint
CREATE INDEX "transfer_events_transfer_idx" ON "transfer_events" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "transfers_order_idx" ON "transfers" USING btree ("order_id");