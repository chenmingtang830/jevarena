import { z } from "zod";

// Editorial references are deliberately not Challenge / RunRecord objects.
// Reading a post verifies its provenance, not its experimental conclusions.
export const CommunityCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  kind: z.enum(["Author-reported test", "Demo", "Discussion"]),
  author: z.string().min(1),
  handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
  postId: z.string().regex(/^\d+$/),
  postedAt: z.iso.datetime(),
  checkedAt: z.iso.date(),
  summary: z.string().min(1),
  limitation: z.string().min(1),
  nextTest: z.string().min(1),
  evidence: z.literal("Source checked · not reproduced"),
  rights: z.literal("Linked source retains its original rights"),
  metrics: z.strictObject({
    views: z.number().int().nonnegative(),
    likes: z.number().int().nonnegative(),
    reposts: z.number().int().nonnegative(),
  }),
});
export type CommunityCase = z.infer<typeof CommunityCaseSchema>;
export const postUrl = (item: CommunityCase) =>
  `https://x.com/${item.handle}/status/${item.postId}`;
export const authorUrl = (item: CommunityCase) => `https://x.com/${item.handle}`;

const provenance = {
  checkedAt: "2026-09-19",
  evidence: "Source checked · not reproduced" as const,
  rights: "Linked source retains its original rights" as const,
};

export const communityCases: CommunityCase[] = z.array(CommunityCaseSchema).parse([
  {
    ...provenance,
    id: "classifier-eval-cramforce",
    title: "A faster classifier — on whose evaluation?",
    kind: "Author-reported test",
    author: "Malte Ubl", handle: "cramforce", postId: "2100269198727602468",
    postedAt: "2026-09-16T17:02:52.000Z",
    summary: "Ubl reports that Jev reached the ceiling of an existing classifier evaluation and ran six times faster than its Gemini 2.5 Flash Lite baseline.",
    limitation: "The retrieved post text does not include the dataset, prompts, sample count or timing procedure. We have not reproduced the comparison or inspected the attached image as experimental evidence.",
    nextTest: "Compare both models on identical labeled inputs, with minimal outputs. Report accuracy and end-to-end latency separately, including errors.",
    metrics: { views: 208184, likes: 1117, reposts: 37 },
  },
  {
    ...provenance,
    id: "command-safety-rauchg",
    title: "Command safety: speed is only half the test",
    kind: "Author-reported test",
    author: "Guillermo Rauch", handle: "rauchg", postId: "2100307962262872105",
    postedAt: "2026-09-16T19:36:54.000Z",
    summary: "Rauch reports improved command-review accuracy and up to an 18-fold p95 speedup over GPT Luna in fx's automatic safety review workflow.",
    limitation: "This is the author's report, not a JevArena result. The retrieved post does not provide the command set, error breakdown or full evaluation configuration.",
    nextTest: "Use a labeled, inert command corpus. Measure unsafe commands incorrectly allowed separately from safe commands incorrectly blocked. Never execute the commands.",
    metrics: { views: 418197, likes: 3926, reposts: 169 },
  },
  {
    ...provenance,
    id: "computer-use-trycua",
    title: "Computer use: a demo is not a success rate",
    kind: "Demo",
    author: "Cua", handle: "trycua", postId: "2100649543079502213",
    postedAt: "2026-09-17T18:14:13.000Z",
    summary: "Cua announces a development preview combining Jev with Cua Driver for desktop computer use, with a link to its public repository.",
    limitation: "The announcement is not a controlled benchmark. This arena accepts text judgments; it cannot replay a full desktop agent trajectory or evaluate the image in this post.",
    nextTest: "Start with a text-only action-selection study on frozen, sanitized UI states. Keep that result distinct from end-to-end task completion.",
    metrics: { views: 375542, likes: 2591, reposts: 218 },
  },
  {
    ...provenance,
    id: "classifier-framing-nathanflurry",
    title: "A decision model, not a chat-model replacement",
    kind: "Discussion",
    author: "Nathan Flurry", handle: "NathanFlurry", postId: "2100036101809619314",
    postedAt: "2026-09-16T01:36:38.000Z",
    summary: "Flurry frames Jev as a classifier-like decision tool rather than a replacement for general-purpose GPT or Claude models.",
    limitation: "This is a conceptual framing, not a measured architecture or performance result. The API returned only the visible post text; we do not reconstruct its missing continuation.",
    nextTest: "Compare Jev against a task-specific classifier and a chat model constrained to the same choices. Evaluate performance on held-out examples, not interface similarity.",
    metrics: { views: 654759, likes: 7460, reposts: 403 },
  },
]);
