CREATE TABLE "case_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "case_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"case_id" text NOT NULL,
	"event" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"actor" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "case_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "case_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"case_id" text NOT NULL,
	"author" text NOT NULL,
	"text" text NOT NULL,
	"lang" text NOT NULL,
	"translated_text" text,
	"translated_lang" text,
	"translator" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"transfer_id" text NOT NULL,
	"state" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_language" text NOT NULL,
	"recipient_contact_id" text,
	"recipient_name" text NOT NULL,
	"recipient_language" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reason" text DEFAULT 'wrong_recipient' NOT NULL,
	"link_sent_at" timestamp with time zone,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"return_transfer_id" text,
	"simulated" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_events_case_idx" ON "case_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_messages_case_idx" ON "case_messages" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "cases_transfer_idx" ON "cases" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "cases_state_idx" ON "cases" USING btree ("state");