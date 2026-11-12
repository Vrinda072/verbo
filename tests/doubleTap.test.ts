import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { understand } from "@/lib/agents/extraction";
import { RulesExtractor } from "@/lib/agents/extraction/rules";
import { createDraft, createTransferFromDraft } from "@/lib/transfers/service";

describe("confirming a payment twice at the same moment", () => {
  it("returns one transfer to both requests", async () => {
    const transcript = "Send 20 dollars to Ana Souza";
    const u = await understand({ transcript, language: "en" }, new RulesExtractor());
    const draft = await createDraft(u, transcript, "en");
    const args = { draftId: draft!.id, nonce: randomUUID() };
    const [a, b] = await Promise.all([createTransferFromDraft(args), createTransferFromDraft(args)]);
    expect(a.id).toBe(b.id);
    expect(a.orderId).toBe(b.orderId);
  });
});
