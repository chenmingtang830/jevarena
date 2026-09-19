import { z } from "zod";
import rubric from "../../shared/rubric.json";

const text = z.string().min(1).max(40000);
const id = z.string().min(1).max(160);
const common = {
  schemaVersion: z.literal(1),
  id,
  title: z.string().min(1).max(160),
  language: z.string().min(2).max(40),
  expected: z.string().max(160).optional(),
  basis: z.string().max(10000).optional(),
  source: z.string().max(2000).optional(),
};
const option = z.strictObject({ id, label: z.string().min(1).max(2000) });
export const ChallengeSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("judgment"),
    content: text,
    question: text,
    options: z
      .array(option)
      .min(2)
      .max(10)
      .refine(
        (a) => new Set(a.map((o) => o.id)).size === a.length,
        "Duplicate option IDs",
      ),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("comparison"),
    prompt: text,
    answer1: text,
    answer2: text,
  }),
]);
export type Challenge = z.infer<typeof ChallengeSchema>;
export const RunRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id,
    challengeId: id,
    challengeHash: z.string().min(1).max(160),
    provider: z.enum(["openrouter", "vercel", "typesafe"]),
    model: id,
    resolvedModel: id.nullable(),
    promptVersion: id,
    createdAt: z.iso.datetime(),
    choice: id.nullable(),
    probabilities: z
      .record(z.string().max(160), z.number().min(0).max(1))
      .refine(
        (p) =>
          Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - 1) < 0.001,
        "Probabilities must sum to one",
      )
      .optional(),
    confidence: z.number().min(0).max(1).optional(),
    usage: z.strictObject({
      inputTokens: z.number().int().nonnegative().nullable(),
      outputTokens: z.number().int().nonnegative().nullable(),
    }),
    cost: z.strictObject({
      usd: z.number().nonnegative().nullable(),
      basis: z.enum(["provider", "estimate", "unknown"]),
    }),
    latencyMs: z.number().nonnegative(),
    status: z.enum(["success", "error", "cancelled"]),
    error: z.string().max(500).optional(),
    settings: z
      .strictObject({
        maxOutputTokens: z.number().int().positive().optional(),
        transport: z.enum(["direct", "relay"]).optional(),
        reasoning: z.string().max(40).optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
      .optional(),
  })
  .superRefine((r, ctx) => {
    if ((r.cost.usd === null) !== (r.cost.basis === "unknown"))
      ctx.addIssue({ code: "custom", message: "Unknown cost must be null" });
    if (r.status === "success" && r.choice === null)
      ctx.addIssue({ code: "custom", message: "Success requires a choice" });
  });
export type RunRecord = z.infer<typeof RunRecordSchema>;
export const VoteSchema = z.strictObject({
  runIds: z.array(id).length(2),
  value: z.enum(["x", "y", "both", "neither", "skip"]),
  revealedBeforeVote: z.boolean(),
});
export type Vote = z.infer<typeof VoteSchema>;
export const HumanAnswerSchema = z.strictObject({
  optionId: id,
  revealedBeforeAnswer: z.boolean(),
  rationale: z.string().max(2000).optional(),
});
export type HumanAnswer = z.infer<typeof HumanAnswerSchema>;
export const SourceAttributionSchema = z.strictObject({
  url: z.url().max(2000).refine((value) => value.startsWith("https://"), "HTTPS source required"),
  author: z.string().min(1).max(200),
  license: z.string().min(1).max(200),
  notice: z.string().max(10000).optional(),
});
export const CaseContributionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  challenge: ChallengeSchema,
  runs: z.array(RunRecordSchema).max(20),
  vote: VoteSchema.optional(),
  humanAnswer: HumanAnswerSchema.optional(),
  // The contribution license covers original additions, not imported sources.
  sourceAttributions: z.array(SourceAttributionSchema).max(10).optional(),
  license: z.literal("CC-BY-4.0"),
  status: z.enum(["community-submitted", "reproduced", "reviewed", "disputed"]),
  notes: z.string().max(10000).optional(),
});
export type CaseContribution = z.infer<typeof CaseContributionSchema>;
export const PROMPT_VERSION = rubric.version;
export function modelInput(value: Challenge) {
  const c = ChallengeSchema.parse(value);
  if (c.kind === "judgment")
    return { content: c.content, question: c.question, options: c.options };
  return {
    content: JSON.stringify({
      prompt: c.prompt,
      answer1: c.answer1,
      answer2: c.answer2,
    }),
    question: rubric.comparison,
    options: [
      { id: "answer1", label: "Answer 1 is better" },
      { id: "answer2", label: "Answer 2 is better" },
      { id: "tie", label: "Both answers are equally good" },
    ],
  };
}
