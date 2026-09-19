# Protocol v0.1 — diagnostic pairwise track

## Unit, sampling and leakage

The source prompt is the statistical cluster. Style variants, different response generators,
order swaps and repeats are correlated. Prompt-normalized hashes assign approximately 20%
to development and 80% to test across datasets. Sampling is deterministic within
dataset/domain and retains all pairs from selected prompt groups. The group cap is per
domain, not a requested total sample size; always run `plan` before paid evaluation.

Development/test here are local partitions of already public evaluation data. They do not
prevent training contamination or detect semantically duplicated prompts. Never tune prompts,
thresholds or failure taxonomies on the test subset and then describe it as untouched.

Provider inputs are an explicit allowlist: user prompt, answer A, answer B. No gold label,
chosen/rejected tags, source model, dataset ID, error explanation or scoring metadata is sent.
Every case runs in both orders; outputs are mapped back to canonical A/B before scoring.
No truncation is performed. Oversized inputs fail rather than silently receiving a different task.

## Fair comparison

Use the same semantic rubric and examples. Jev gets native Choice; generative models get a
JSON verdict. This is a comparison of usable judge configurations, not a controlled isolation
of architecture. Freeze all prompts and inference settings. Evaluate reasoning-enabled judges
as distinct configurations, with enough total output/reasoning tokens to finish a verdict.
Do not quietly disable their reasoning to make a latency comparison favorable to Jev.

Run decision-only chat judgments as the primary track. Eliciting numeric probabilities changes
their workload and can affect quality, latency and cost; use separately named calibration runs.
Native log-probability extraction is not implemented. Do not present self-reported numbers as
token likelihoods or trained calibration. Test thresholds on development, then freeze for test.

Use one provider route consistently per model and record it. Direct TypeSafe versus a gateway
baseline includes routing overhead: report deployment conditions, not intrinsic model speed.
Record location, network conditions and time window externally for published measurements.

## Metrics and denominators

1. Primary diagnostic: mean correctness across both orders/repeats, per source and domain,
   on complete cases; show complete-case coverage next to it. A TIE against an A/B gold is wrong.
2. Also show successful/planned calls, attempted accuracy counting failures as wrong, and
   planned accuracy counting missing work as wrong. Partial runs must not masquerade as full runs.
3. Prompt-cluster bootstrap intervals (1,000 draws, fixed seed). Slice intervals are exploratory,
   with no correction for testing many slices. Fewer than 30 prompt groups is explicitly flagged.
4. Paired accuracy differences use common fully completed cases, resampling their prompt groups.
   Compare source-specific differences. Never declare superiority from disjoint evaluated subsets.
5. Order consistency is canonical-label agreement after swapping responses. Displayed-A rate is
   descriptive; interpret with both-order coverage and the number of ties.
6. Calibration: multiclass Brier (sum over A/B/TIE), clipped NLL, 10 equal-width ECE bins;
   risk/coverage uses fixed selected-label probability thresholds. These observations repeat
   across orders; counts do not imply independent samples. Vendor confidence is separate.
7. Cost: provider-reported cost when present, otherwise list-price estimate from actual usage.
   Show unknown-cost attempts. Unknown is not zero. Full attempts include failed calls.
8. Latency: client-observed full response, p50/p95, successful and all finished calls separately;
   no streaming, retries or queue concurrency. This first implementation is an operational
   smoke harness, not a sustained-throughput or time-to-first-token benchmark.

The aggregate `all` row is only a micro diagnostic. RM-Bench expansions and RewardBench tie
expansions create unequal weights; do not use it as the headline ranking. Published conclusions
must focus on dataset/domain results and paired differences. A future native-score track should
reproduce each upstream scorer and macro weighting before comparisons with published tables.

## Failure atlas

The exporter prioritizes label disagreements where another judge gets every order/repeat right,
then high selected-label probability. A disagreement is not a verified model failure until review.
Reviewers inspect the original prompt and both answers, adjudicate questionable labels, and
assign one or more tags: numerical precision, multi-hop reasoning, subtle factual error,
instruction constraint, style bias, long-context distraction, prompt injection, inappropriate
refusal/compliance, tie discrimination, order sensitivity, or unresolved label ambiguity.

Dataset domain and length are slice labels, not causal explanations. E.g. a long example failing
does not by itself prove context rot. Controlled perturbations require label-preservation checks
and must be reported separately from untouched source benchmarks. Do not auto-assign causal tags
with the same model being evaluated. Preserve both original and adjudicated labels.

## Scope limits

No live model result, verified weakness, architecture claim or official benchmark score has been
produced by the initial implementation. Labels come from upstream and vary in provenance:
RewardBench 2 includes verifier, model-judge, majority-vote and manual construction methods.
No claim is made that every item is human-labelled. Public availability does not imply public-domain
licensing. Preserve source attribution and model-output terms; keep downloads out of source control.
