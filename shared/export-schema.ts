// Run: cd web && npx tsx ../shared/export-schema.ts
// This emits JSON to stdout; commit its output as shared/contracts.schema.json.
import { z } from "../web/node_modules/zod/index.js";
import { ChallengeSchema, RunRecordSchema, VoteSchema, HumanAnswerSchema, SourceAttributionSchema, CaseContributionSchema } from "../web/lib/contracts.ts";
console.log(JSON.stringify({
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$id":"https://jevarena.org/schemas/contracts-v1.json",
  "$defs": Object.fromEntries(Object.entries({Challenge:ChallengeSchema,RunRecord:RunRecordSchema,Vote:VoteSchema,HumanAnswer:HumanAnswerSchema,SourceAttribution:SourceAttributionSchema,CaseContribution:CaseContributionSchema}).map(([name,schema])=>[name,z.toJSONSchema(schema)])),
},null,2));
