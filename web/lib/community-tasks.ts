import type { Challenge } from "./contracts";

// Extracted from the author's MIT-licensed evaluation, not JevArena runs.
// Keep author observations separate from Challenge and model input.
export const communityTaskSource = {
  author: "Pooya Parsa",
  account: "https://x.com/_pi0_",
  post: "https://x.com/_pi0_/status/2100890061713617277",
  data: "https://github.com/pithings/advocaat/blob/46ed82661a41c27efd2a1bddf34f8dc1350d9143/eval/data/h6/2026-09-18.jsonl",
  license: "MIT",
};

export const communityTasks: { challenge: Challenge; observation: string; sourceId: string }[] = [
  {
    sourceId: "modexp-1",
    challenge: {
      schemaVersion: 1, id: "community-remainder-6", title: "A surprising remainder", language: "en", kind: "judgment",
      content: "What is 6^3 mod 89?", question: "Which option is the correct value?",
      options: [{ id: "A", label: "38" }, { id: "B", label: "9" }, { id: "C", label: "53" }, { id: "D", label: "39" }],
      source: communityTaskSource.post,
    },
    observation: "The author's native TypeSafe run (jev-1.13.0) chose 53; a separate Vercel run chose 38. The correct remainder is 38. This is an observed disagreement, not proof of a provider effect.",
  },
  {
    sourceId: "modexp-6",
    challenge: {
      schemaVersion: 1, id: "community-remainder-19", title: "A bigger power", language: "en", kind: "judgment",
      content: "What is 19^9 mod 7?", question: "Which option is the correct value?",
      options: [{ id: "A", label: "1" }, { id: "B", label: "0" }, { id: "C", label: "4" }, { id: "D", label: "6" }],
      source: communityTaskSource.post,
    },
    observation: "The author's native TypeSafe run (jev-1.13.0) and Vercel run both chose 6, the correct remainder. The native run assigned its choice probability 0.37.",
  },
];
