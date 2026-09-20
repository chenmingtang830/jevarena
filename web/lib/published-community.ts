import { z } from "zod";
import { ChallengeSchema, SourceAttributionSchema, modelInput, type CaseContribution, type Challenge } from "./contracts";

// Only the server's public projection belongs here, never the intake envelope.
export const PublicCommunityItemSchema = z.strictObject({
  id: z.string().min(1).max(160),
  challenge: ChallengeSchema,
  sourceAttributions: z.array(SourceAttributionSchema).max(10).optional(),
  license: z.literal("CC-BY-4.0"),
  submittedAt: z.iso.datetime({ offset: true }),
  moderation: z.strictObject({
    decision: z.literal("publish"),
    reason: z.string().min(1).max(2000),
    model: z.string().min(1).max(160),
    humanReviewed: z.literal(true).optional(),
  }),
}).superRefine((value, ctx) => {
  const options = modelInput(value.challenge).options;
  if (value.challenge.expected && !options.some((option) => option.id === value.challenge.expected))
    ctx.addIssue({ code: "custom", message: "Reference answer is not a possible answer" });
});
export type PublishedQuestion = z.infer<typeof PublicCommunityItemSchema>;
export const PublicCommunityResponseSchema = z.strictObject({ items: z.array(PublicCommunityItemSchema).max(1000).refine(
  (items) => new Set(items.map((item) => item.id)).size === items.length,
  "Duplicate public question IDs",
) });

export function questionPrompt(challenge: Challenge): string {
  const input = modelInput(challenge);
  return `${input.content}\n\n${input.question}\n\nPossible answers:\n${input.options.map((option) => option.label).join("\n")}`;
}

export function questionForReplay(item: PublishedQuestion): CaseContribution {
  // Screening is not proof of correctness or model performance.
  return {
    schemaVersion: 1, id: item.id, challenge: item.challenge, runs: [],
    sourceAttributions: item.sourceAttributions, license: item.license,
    status: "community-submitted",
  };
}
