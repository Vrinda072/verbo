CREATE TABLE "transfer_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transfer_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transfer_id" text NOT NULL,
	"event" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"state" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"sender_email" text NOT NULL,
	"recipient_email" text NOT NULL,
	"order_id" text,
	"authorization_id" text,
	"capture_id" text,
	"payout_batch_id" text,
	"hold_until" timestamp with time zone,
	"original_transfer_id" text,
	"simulated" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_events_resource_idx" ON "webhook_events" USING btree ("resource_id");