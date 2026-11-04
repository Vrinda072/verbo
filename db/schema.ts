import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** One platform-mediated transfer (send or return). State mirrors lib/paypal/money.ts TransferState. */
export const transfers = pgTable("transfers", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["send", "return"] }).notNull(),
  state: text("state").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  senderEmail: text("sender_email").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  orderId: text("order_id"),
  authorizationId: text("authorization_id"),
  captureId: text("capture_id"),
  payoutBatchId: text("payout_batch_id"),
  holdUntil: timestamp("hold_until", { withTimezone: true }),
  originalTransferId: text("original_transfer_id"),
  simulated: integer("simulated").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable append-only log of transfer state changes. */
export const transferEvents = pgTable("transfer_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  transferId: text("transfer_id").notNull().references(() => transfers.id),
  event: text("event").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  data: jsonb("data"),
});

/** Verified PayPal webhook deliveries, de-duplicated by PayPal event id. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [index("webhook_events_resource_idx").on(t.resourceId)],
);
