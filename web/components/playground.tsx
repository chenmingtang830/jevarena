"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  KeyRound,
  LoaderCircle,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  Challenge,
  ChallengeSchema,
  CaseContribution,
  RunRecord,
  Vote,
  modelInput,
} from "@/lib/contracts";
import { templates } from "@/lib/cases";
import { MODELS, PROVIDERS, getJevModel, estimateCost } from "@/lib/catalog";
import { executeJudge } from "@/lib/providers";
import { Button } from "./ui/button";
import { ShareTools } from "./share-tools";
type Provider = "openrouter" | "vercel" | "typesafe";
type Tier = "low-cost" | "strong" | "reasoning";
type Match = { challenge: Challenge; runs: RunRecord[]; vote?: Vote };
const blank: Challenge = {
  schemaVersion: 1,
  id: "custom",
  title: "Untitled judgment",
  language: "en",
  kind: "judgment",
  content: "",
  question: "",
  options: [
    { id: "option1", label: "Yes" },
    { id: "option2", label: "No" },
  ],
};
const blankComparison: Challenge = {
  schemaVersion: 1, id: "custom", title: "Compare two answers", language: "en",
  kind: "comparison", prompt: "", answer1: "", answer2: "",
};
const simpleBlank: Extract<Challenge, { kind: "judgment" }> = {
  ...blank,
  question: "Is the statement supported by the provided context or established facts?",
  options: [
    { id: "option1", label: "Yes" },
    { id: "option2", label: "No" },
    { id: "option3", label: "Unsure" },
  ],
};
const simpleExamples = [
  { label: "Check a claim", text: "Claim: A 20% increase followed by a 20% decrease returns a price to its original value." },
  { label: "Weigh the evidence", text: "Claim: The new onboarding caused higher retention.\nContext: Retention rose from 40% to 55% after the change. There was no control group, and the customer mix also changed." },
  { label: "Spot a contradiction", text: "Claim: This refund request meets the policy.\nPolicy: Refunds are available within 30 days of purchase.\nRequest: The customer purchased the item 45 days ago." },
];
const money = (n: number | null) =>
  n === null ? "Unknown" : `$${n.toFixed(6)}`;
function newId() {
  return crypto.randomUUID();
}
export function Playground({ initial }: { initial?: Challenge }) {
  const [c, setC] = useState<Challenge>(initial ?? simpleBlank);
  const [advanced, setAdvanced] = useState(Boolean(initial));
  const simpleDraft = useRef<Challenge>(simpleBlank);
  const advancedKind = useRef<Challenge["kind"]>(initial?.kind ?? "judgment");
  const [settings, setSettings] = useState(false);
  const [pendingSimple, setPendingSimple] = useState<(typeof simpleExamples)[number] | null>(null);
  const drafts = useRef<Record<Challenge["kind"], Challenge>>({
    judgment: initial?.kind === "judgment" ? initial : blank,
    comparison: initial?.kind === "comparison" ? initial : blankComparison,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingExample, setPendingExample] = useState<Challenge | null>(null);
  const [exampleNotice, setExampleNotice] = useState("");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [mode, setMode] = useState<"arena" | "compare">("arena");
  const [tier, setTier] = useState<Tier>("low-cost");
  const [keys, setKeys] = useState<Record<Provider, string>>({
    openrouter: "",
    vercel: "",
    typesafe: "",
  });
  const [jp, setJp] = useState<Provider>("openrouter");
  const [opponent, setOpponent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [history, setHistory] = useState<Match[]>([]);
  const [budget, setBudget] = useState("0.05");
  const [connections, setConnections] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (focusTarget) {
      document.getElementById(focusTarget)?.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, connections, c.kind, advanced, settings]);
  useEffect(() => {
    if (!busy && match) {
      setAnnouncement(
        match.runs.every((r) => r.status === "success")
          ? "Both judgments are ready. Compare them and vote to reveal the models."
          : "This comparison is incomplete. Review the results; no winner was selected.",
      );
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }, [busy, match?.runs[0]?.id]);
  const available = MODELS.filter(
    (m) => m.kind === "chat" && keys[m.provider as Provider].trim(),
  );
  const pool = available.filter((m) => m.tier === tier);
  const selected =
    available.find((m) => `${m.provider}:${m.id}` === opponent) ?? available[0];
  const candidates = mode === "arena" ? pool : selected ? [selected] : [];
  const jev = getJevModel(jp);
  const estimates = jev
    ? [estimateCost(jev, c), ...candidates.map((m) => estimateCost(m, c))]
    : [];
  const known =
    estimates.length > 1 && estimates.every((e) => e.maxUsd !== null);
  const maximum = known
    ? (estimates[0].maxUsd ?? 0) +
      Math.max(...estimates.slice(1).map((e) => e.maxUsd ?? 0))
    : null;
  const minimum = known
    ? (estimates[0].minUsd ?? 0) +
      Math.min(...estimates.slice(1).map((e) => e.minUsd ?? 0))
    : null;
  function edit(next: Challenge) {
    if (advanced) drafts.current[next.kind] = next;
    else simpleDraft.current = next;
    setC(next);
    setMatch(null);
    setError("");
    setFieldErrors({});
    setExampleNotice("");
  }
  function toggleAdvanced() {
    const next = !advanced;
    setAdvanced(next);
    setC(next ? drafts.current[advancedKind.current] : simpleDraft.current);
    setMatch(null);
    setError("");
    setFieldErrors({});
    setPendingExample(null);
    setPendingSimple(null);
    setExampleNotice("");
  }
  function loadSimple(example: (typeof simpleExamples)[number], confirmed = false) {
    if (busy) return;
    if (c.kind === "judgment" && c.content.trim() && !confirmed) {
      setPendingSimple(example);
      setFocusTarget("confirm-simple-example");
      return;
    }
    edit({ ...simpleBlank, id: newId(), content: example.text });
    setPendingSimple(null);
    setExampleNotice(`Loaded “${example.label}”. Edit it or review the models and cost.`);
    setFocusTarget("content");
  }
  function review() {
    const id = c.kind === "judgment" ? "content" : "prompt";
    const value = c.kind === "judgment" ? c.content : c.prompt;
    if (!value.trim()) {
      setFieldErrors({ [id]: "Enter a task or choose an example first." });
      setFocusTarget(id);
      return;
    }
    setSettings(true);
    setFocusTarget("preflight-heading");
  }
  function load(t: Challenge, confirmed = false) {
    if (busy) return;
    const draft = drafts.current[t.kind];
    const empty = t.kind === "judgment" ? blank : blankComparison;
    if (!confirmed && JSON.stringify(draft) !== JSON.stringify(empty)) {
      setPendingExample(t);
      setFocusTarget("confirm-example");
      return;
    }
    const next = { ...t, id: newId() };
    drafts.current[t.kind] = next;
    advancedKind.current = t.kind;
    setAdvanced(true);
    setC(next);
    setMatch(null);
    setError("");
    setFieldErrors({});
    setPendingExample(null);
    setExampleNotice(`Loaded “${t.title}”. Review or edit the fields, then connect your key to run.`);
    setFocusTarget(t.kind === "judgment" ? "content" : "prompt");
  }
  function switchKind(kind: "judgment" | "comparison") {
    if (kind === c.kind) return;
    setMatch(null);
    setC(drafts.current[kind]);
    advancedKind.current = kind;
    setError("");
    setFieldErrors({});
    setPendingExample(null);
    setExampleNotice("");
  }
  function fieldProps(id: string) {
    return { "aria-invalid": Boolean(fieldErrors[id]), "aria-describedby": fieldErrors[id] ? `${id}-error` : undefined };
  }
  function fieldError(id: string) {
    return fieldErrors[id] ? <p className="error field-error" id={`${id}-error`}>{fieldErrors[id]}</p> : null;
  }
  async function run() {
    setError("");
    setFieldErrors({});
    setAnnouncement("");
    const parsed = ChallengeSchema.safeParse({
      ...c,
      id: newId(),
      title:
        c.title === "Untitled judgment"
          ? (c.kind === "judgment" ? c.question : c.prompt).slice(0, 120) ||
            "Untitled judgment"
          : c.title,
    });
    const errors: Record<string, string> = {};
    const fields = c.kind === "judgment"
      ? [["content", c.content], ["question", c.question], ...c.options.map((o, i) => [`option-${i}`, o.label]), ["language", c.language]]
      : [["prompt", c.prompt], ["answer1", c.answer1], ["answer2", c.answer2], ["language", c.language]];
    for (const [id, value] of fields) {
      if (!value.trim()) errors[id] = "Enter text in this field before starting.";
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const id = issue.path[0] === "options" ? `option-${typeof issue.path[1] === "number" ? issue.path[1] : 0}` : String(issue.path[0]);
        errors[id] ??= issue.message;
      }
    }
    if (Object.keys(errors).length || !parsed.success) {
      setFieldErrors(errors);
      const first = fields.find(([id]) => errors[id]);
      setFocusTarget(first?.[0] ?? (c.kind === "judgment" ? "content" : "prompt"));
      setError(first ? "Check the highlighted fields before starting." : "This imported task has invalid metadata. Load an example or correct the original task before running.");
      return;
    }
    if (!keys[jp].trim() || !jev) {
      setConnections(true);
      setFieldErrors({ "key-openrouter": "Paste your OpenRouter API key to run both judges." });
      setFocusTarget("key-openrouter");
      setError("Add an OpenRouter key below, then start again. Calls use your provider balance.");
      return;
    }
    if (!candidates.length) {
      setConnections(true);
      setError(
        "Connect a provider that offers a model in this tier, or choose another tier.",
      );
      setFocusTarget("rival");
      return;
    }
    if (!known || maximum === null) {
      setError(
        "A price estimate is unavailable for this pairing. Choose a model with known pricing before running.",
      );
      return;
    }
    if (
      !Number.isFinite(Number(budget)) ||
      Number(budget) <= 0 ||
      maximum > Number(budget)
    ) {
      setError(
        "The estimated upper cost exceeds your estimate threshold. Increase the threshold or choose a lower-cost tier.",
      );
      setFieldErrors({ budget: "Enter a positive threshold above the estimated upper cost, or choose a lower-cost tier." });
      setFocusTarget("budget");
      return;
    }
    const rival =
      candidates[
        crypto.getRandomValues(new Uint32Array(1))[0] % candidates.length
      ];
    const specs = [
      { provider: jp, model: jev.id, apiKey: keys[jp] },
      {
        provider: rival.provider as Provider,
        model: rival.id,
        apiKey: keys[rival.provider as Provider],
      },
    ];
    if (crypto.getRandomValues(new Uint32Array(1))[0] % 2) specs.reverse();
    controller.current = new AbortController();
    setBusy(true);
    setMatch(null);
    try {
      const runs = await Promise.all(
        specs.map((s) =>
          executeJudge({
            ...s,
            challenge: parsed.data,
            signal: controller.current!.signal,
          }),
        ),
      );
      const next = { challenge: parsed.data, runs };
      setMatch(next);
      setHistory((h) => [...h, next]);
    } catch {
      setError(
        "The match could not finish. No automatic retry was made; an upstream request may still have incurred a charge.",
      );
    } finally {
      setBusy(false);
    }
  }
  function vote(value: Vote["value"]) {
    if (!match) return;
    const next = {
      ...match,
      vote: {
        runIds: match.runs.map((r) => r.id),
        value,
        revealedBeforeVote: false,
      },
    };
    setMatch(next);
    setHistory((h) => h.map((m) => (m === match ? next : m)));
  }
  const success = match?.runs.every((r) => r.status === "success");
  const revealed = Boolean(match?.vote) || Boolean(match && !success);
  const share: CaseContribution | null =
    match && revealed
      ? {
          schemaVersion: 1,
          id: match.runs[0]?.id ?? "case",
          challenge: match.challenge,
          runs: match.runs,
          ...(match.vote ? { vote: match.vote } : {}),
          license: "CC-BY-4.0",
          status: "community-submitted",
        }
      : null;
  return (
    <main id="main" className="workspace simple-workspace">
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
      <div className="composer-intro">
        <h1>Put a judgment to the test.</h1>
        <p>Jev meets another model. You decide which judgment holds up.</p>
      </div>
      <div className="composer-flow">
        <section className="editor composer" aria-label="Set up experiment">
          <fieldset
            disabled={busy}
            style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
          >
            <div className="editor-body">
              {!advanced && c.kind === "judgment" && (
                <div className="simple-input">
                  <label htmlFor="content" className="sr-only">Your claim or question</label>
                  <textarea
                    id="content"
                    {...fieldProps("content")}
                    aria-describedby={fieldErrors.content ? "content-error simple-task-hint" : "simple-task-hint"}
                    rows={5}
                    placeholder="Enter a claim to judge. Add any context the judges should consider…"
                    value={c.content}
                    onChange={(e) => edit({ ...c, content: e.target.value })}
                  />
                  {fieldError("content")}
                  <p className="hint" id="simple-task-hint">Is the statement supported? Judges choose Yes, No, or Unsure.</p>
                </div>
              )}
              {advanced && <div id="advanced-task" className="advanced-task">
              <div className="tabs" aria-label="Task type">
                <button
                  aria-pressed={c.kind === "judgment"}
                  onClick={() => switchKind("judgment")}
                >
                  Make a judgment
                </button>
                <button
                  aria-pressed={c.kind === "comparison"}
                  onClick={() => switchKind("comparison")}
                >
                  Compare two answers
                </button>
              </div>
              <div className="quick-start">
                <Button variant="secondary" onClick={() => {
                  const example = templates.find((t) => t.kind === c.kind);
                  if (example) load(example);
                }}>
                  Try an example
                </Button>
                <Link href="/cases">Browse cases · no key needed</Link>
                <p className="hint">Set a task → Compare anonymous judgments → Vote to reveal</p>
              </div>
              {pendingExample && (
                <div className="example-confirm" role="group" aria-label="Replace draft with example">
                  <p>Load “{pendingExample.title}” and replace your {pendingExample.kind === "judgment" ? "judgment" : "comparison"} draft? Your other task draft stays in this tab.</p>
                  <Button id="confirm-example" variant="secondary" onClick={() => load(pendingExample, true)}>Replace draft</Button>
                  <Button variant="ghost" onClick={() => setPendingExample(null)}>Keep draft</Button>
                </div>
              )}
              <p className={exampleNotice ? "hint" : "sr-only"} role="status">{exampleNotice}</p>
              {c.kind === "judgment" ? (
                <>
                  <div className="field">
                    <label htmlFor="content">
                      What should the models evaluate?
                    </label>
                    <textarea
                      id="content"
                      {...fieldProps("content")}
                      rows={5}
                      placeholder="Paste an email, a claim, a policy, or any text to evaluate…"
                      value={c.content}
                      onChange={(e) => edit({ ...c, content: e.target.value })}
                    />
                    {fieldError("content")}
                  </div>
                  <div className="field">
                    <label htmlFor="question">What’s the judgment?</label>
                    <input
                      id="question"
                      {...fieldProps("question")}
                      placeholder="Does this claim follow from the evidence?"
                      value={c.question}
                      onChange={(e) => edit({ ...c, question: e.target.value })}
                    />
                    {fieldError("question")}
                  </div>
                  <div className="field">
                    <label>Possible answers</label>
                    {c.options.map((o, i) => (
                      <div key={o.id}>
                      <div className="option-row">
                        <span className="option-index">{i + 1}</span>
                        <input
                          id={`option-${i}`}
                          {...fieldProps(`option-${i}`)}
                          aria-label={`Option ${i + 1}`}
                          value={o.label}
                          onChange={(e) =>
                            edit({
                              ...c,
                              options: c.options.map((p, j) =>
                                j === i ? { ...p, label: e.target.value } : p,
                              ),
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          aria-label={`Remove option ${i + 1}`}
                          disabled={c.options.length <= 2}
                          onClick={() =>
                            edit({
                              ...c,
                              options: c.options.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      {fieldError(`option-${i}`)}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      disabled={c.options.length >= 10}
                      onClick={() =>
                        edit({
                          ...c,
                          options: [...c.options, { id: newId(), label: "" }],
                        })
                      }
                    >
                      <Plus size={13} />
                      Add option
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="prompt">Original question</label>
                    <textarea
                      id="prompt"
                      {...fieldProps("prompt")}
                      rows={3}
                      value={c.prompt}
                      placeholder="What were the answers responding to?"
                      onChange={(e) => edit({ ...c, prompt: e.target.value })}
                    />
                    {fieldError("prompt")}
                  </div>
                  <div className="field">
                    <label htmlFor="answer1">Candidate answer 1</label>
                    <textarea
                      id="answer1"
                      {...fieldProps("answer1")}
                      rows={3}
                      value={c.answer1}
                      onChange={(e) => edit({ ...c, answer1: e.target.value })}
                    />
                    {fieldError("answer1")}
                  </div>
                  <div className="field">
                    <label htmlFor="answer2">Candidate answer 2</label>
                    <textarea
                      id="answer2"
                      {...fieldProps("answer2")}
                      rows={3}
                      value={c.answer2}
                      onChange={(e) => edit({ ...c, answer2: e.target.value })}
                    />
                    {fieldError("answer2")}
                  </div>
                </>
              )}
              <div className="field">
                <label htmlFor="language">Task language</label>
                <input
                  id="language"
                  {...fieldProps("language")}
                  value={c.language}
                  placeholder="en, zh, es…"
                  maxLength={40}
                  onChange={(e) => edit({ ...c, language: e.target.value })}
                />
                {fieldError("language")}
              </div>
              </div>}
              <div className="composer-toolbar">
                <Button variant="ghost" aria-expanded={advanced} aria-controls="advanced-task" onClick={toggleAdvanced}>
                  <Plus size={16} /> Advanced
                </Button>
                <Button variant="ghost" aria-expanded={settings} aria-controls="model-settings" onClick={() => setSettings(!settings)}>
                  <SlidersHorizontal size={16} /> Models &amp; keys
                </Button>
                <Button className="composer-submit" onClick={review}>Review &amp; compare <ArrowRight size={16} /></Button>
              </div>
              {pendingSimple && (
                <div className="example-confirm" role="group" aria-label="Replace draft with example">
                  <p>Replace your text with “{pendingSimple.label}”?</p>
                  <Button id="confirm-simple-example" variant="secondary" onClick={() => loadSimple(pendingSimple, true)}>Replace draft</Button>
                  <Button variant="ghost" onClick={() => { setPendingSimple(null); setFocusTarget("content"); }}>Keep draft</Button>
                </div>
              )}
              {!advanced && <p className={exampleNotice ? "hint" : "sr-only"} role="status">{exampleNotice}</p>}
              {settings && <div className="model-settings" id="model-settings">
              <h2 id="preflight-heading" tabIndex={-1}>Review models &amp; cost</h2>
              <p className="hint preflight-intro">Two paid calls using your key. Review the estimate before starting.</p>
              <div className="tabs" aria-label="Match mode">
                <button
                  aria-pressed={mode === "arena"}
                  onClick={() => setMode("arena")}
                >
                  Arena · hidden opponent
                </button>
                <button
                  aria-pressed={mode === "compare"}
                  onClick={() => setMode("compare")}
                >
                  Compare · pick a model
                </button>
              </div>
              <div className="field-row">
                <div>
                  <label htmlFor="rival">
                    {mode === "arena" ? "Opponent tier" : "Opponent"}
                  </label>
                  {mode === "arena" ? (
                    <select
                      id="rival"
                      value={tier}
                      onChange={(e) => setTier(e.target.value as Tier)}
                    >
                      <option value="low-cost">Low cost</option>
                      <option
                        value="strong"
                        disabled={!available.some((m) => m.tier === "strong")}
                      >
                        Strong generalist
                        {!available.some((m) => m.tier === "strong")
                          ? " · connect key"
                          : ""}
                      </option>
                      <option
                        value="reasoning"
                        disabled={
                          !available.some((m) => m.tier === "reasoning")
                        }
                      >
                        Reasoning
                        {!available.some((m) => m.tier === "reasoning")
                          ? " · connect key"
                          : ""}
                      </option>
                    </select>
                  ) : (
                    <select
                      id="rival"
                      value={
                        selected ? `${selected.provider}:${selected.id}` : ""
                      }
                      onChange={(e) => setOpponent(e.target.value)}
                    >
                      {!available.length && (
                        <option value="">Connect a provider first</option>
                      )}
                      {available.map((m) => (
                        <option
                          key={`${m.provider}:${m.id}`}
                          value={`${m.provider}:${m.id}`}
                        >
                          {m.label} · {m.provider}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label htmlFor="budget">Estimate threshold (USD)</label>
                  <input
                    id="budget"
                    {...fieldProps("budget")}
                    type="number"
                    min="0.001"
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                  {fieldError("budget")}
                </div>
              </div>
              <details
                className="connection-box"
                open={connections}
                onToggle={(e) => setConnections(e.currentTarget.open)}
              >
                <summary>
                  <KeyRound size={15} />
                  {Object.values(keys).some(Boolean)
                    ? "Manage connected keys"
                    : "Connect your API keys"}
                  <span className="small">Memory only</span>
                </summary>
                <div className="connection-grid">
                  {PROVIDERS.map((p) => (
                    <div key={p.id}>
                      <label htmlFor={`key-${p.id}`}>{p.label}</label>
                      <input
                        id={`key-${p.id}`}
                        {...fieldProps(`key-${p.id}`)}
                        type="password"
                        disabled={p.transport === "relay"}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Paste your API key"
                        value={keys[p.id as Provider]}
                        onChange={(e) => {
                          setKeys({ ...keys, [p.id]: e.target.value });
                          setFieldErrors((errors) => ({ ...errors, [`key-${p.id}`]: "" }));
                          setError("");
                        }}
                      />
                      {fieldError(`key-${p.id}`)}
                      <p className="hint">
                        {p.transport === "direct"
                          ? <>Get a key from <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">OpenRouter settings</a>, then paste it here. Sent directly to OpenRouter.</>
                          : "Not available yet. Use OpenRouter for now."}
                      </p>
                    </div>
                  ))}
                  <div>
                    <label htmlFor="jev-provider">Use Jev through</label>
                    <select
                      id="jev-provider"
                      value={jp}
                      onChange={(e) => setJp(e.target.value as Provider)}
                    >
                      {PROVIDERS.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={p.transport === "relay"}
                        >
                          {p.label}
                          {p.transport === "relay" ? " · coming soon" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="hint">
                    One OpenRouter key runs Jev and its opponent. Your provider account needs access to both models.
                  </p>
                  <p className="hint">
                    Keys stay in this tab’s memory and disappear on refresh. Calls use your OpenRouter balance.
                  </p>
                </div>
              </details>
              <div className="run-foot">
                <p className="hint" style={{ marginBottom: 12 }}>
                  Experimental browser integration. Local API canaries do not
                  verify browser access or your account’s model availability.
                </p>
                <div className="price-note">
                  <ShieldCheck size={14} />
                  <span>
                    2 calls ·{" "}
                    {maximum === null
                      ? "Connect keys to see the estimated cost range"
                      : `Estimated ${money(minimum)}–${money(maximum)}`}
                    <br />
                    Estimate uses provider list prices and bounded output. Not a
                    billing cap; actual token accounting can vary.
                    <br />
                    Public standard rates checked {jev.verifiedAt}.{" "}
                    <a href="https://openrouter.ai/api/v1/models" target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>Price source</a>
                    {mode === 'compare' && selected && <> · <a href={selected.priceSource} target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>Selected model rates</a></>}
                  </span>
                </div>
                <Button className="full-width" onClick={run}>
                  <span>Start blind comparison</span>
                  <ArrowRight size={16} />
                </Button>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
              </div>
              </div>}
            </div>
          </fieldset>
        </section>
        {!advanced && !busy && !match && <div className="starter-chips" aria-label="Example tasks">
          {simpleExamples.map((example) => <button key={example.label} onClick={() => loadSimple(example)}>{example.label}</button>)}
        </div>}
        <p className="composer-context">Compare anonymously. Vote to reveal. <Link href="/cases">Browse cases without a key <ArrowRight size={12} /></Link></p>
        <div>
          {(busy || match) && <section className="arena-panel" aria-label="Comparison results">
            <div className="section-bar">
              <h2 ref={resultHeading} tabIndex={-1}>
                The arena
              </h2>
              <span className="small">
                {busy
                  ? "Judges are working"
                  : match
                    ? revealed
                      ? "Results revealed"
                      : "Identities hidden"
                    : "Waiting for your experiment"}
              </span>
            </div>
            {busy ? (
              <div className="running" aria-live="polite">
                <LoaderCircle className="spinner" size={32} />
                <h3>Two judges. One question.</h3>
                <p>
                  We’ll show both judgments together.
                  <br />
                  Speed and identities stay hidden until you vote.
                </p>
                <Button
                  variant="secondary"
                  style={{ marginTop: 22 }}
                  onClick={() => controller.current?.abort()}
                >
                  Cancel requests
                </Button>
                <p className="hint">
                  Cancellation may not stop provider-side billing.
                </p>
              </div>
            ) : match ? (
              <div className="results-body">
                {!success && (
                  <p className="notice" role="status">
                    This match is incomplete. Neither model wins by default. Any
                    known charges are shown below.
                  </p>
                )}
                <div className="judge-results">
                  {match.runs.map((r, i) => (
                    <article className="judge-result" key={r.id}>
                      <span className="judge-letter">
                        JUDGE {i === 0 ? "X" : "Y"}
                      </span>
                      <h3>
                        {r.status === "success"
                          ? (modelInput(match.challenge).options.find(
                              (o) => o.id === r.choice,
                            )?.label ?? r.choice)
                          : r.status === "cancelled"
                            ? "Cancelled"
                            : "Could not judge"}
                      </h3>
                      {revealed && (
                        <>
                          <p className="small">{r.model}</p>
                          <dl>
                            <div>
                              <dt>Version</dt>
                              <dd>{r.resolvedModel ?? "Unknown"}</dd>
                            </div>
                            <div>
                              <dt>Time</dt>
                              <dd>{(r.latencyMs / 1000).toFixed(2)} s</dd>
                            </div>
                            <div>
                              <dt>Cost</dt>
                              <dd>
                                {money(r.cost.usd)}{" "}
                                {r.cost.basis !== "unknown" &&
                                  `(${r.cost.basis})`}
                              </dd>
                            </div>
                            {r.probabilities &&
                              Object.entries(r.probabilities).map(([k, v]) => (
                                <div key={k}>
                                  <dt>{k} probability</dt>
                                  <dd>{(v * 100).toFixed(1)}%</dd>
                                </div>
                              ))}
                            {r.confidence !== undefined && <div><dt>Vendor confidence</dt><dd>{(r.confidence * 100).toFixed(1)}%</dd></div>}
                          </dl>
                          {r.confidence !== undefined && <p className="hint">Vendor confidence is separate from choice probability and verified correctness.</p>}
                          {r.error && <p className="error">{r.error}</p>}
                        </>
                      )}
                    </article>
                  ))}
                </div>
                {success && !revealed && (
                  <div className="vote-section">
                    <p>Which judgment is better?</p>
                    <p className="hint">
                      Judge the decision first. We’ll reveal the tradeoffs next.
                    </p>
                    <div className="vote-buttons">
                      {(
                        [
                          ["x", "X is better"],
                          ["y", "Y is better"],
                          ["both", "Both good"],
                          ["neither", "Neither good"],
                          ["skip", "Unsure / reveal"],
                        ] as const
                      ).map(([v, l]) => (
                        <Button
                          key={v}
                          variant="secondary"
                          onClick={() => vote(v)}
                        >
                          {l}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {revealed && (
                  <p className="notice">
                    <Check
                      size={13}
                      style={{ display: "inline", marginRight: 6 }}
                    />
                    One experiment, not a leaderboard. Your vote stays in this
                    tab unless you share it.
                  </p>
                )}
                {revealed && match.challenge.kind === "comparison" && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const original = match.challenge;
                      if (original.kind === "comparison") {
                        const swapped: Challenge = {
                          ...original,
                          id: newId(),
                          answer1: original.answer2,
                          answer2: original.answer1,
                          expected:
                            original.expected === "answer1"
                              ? "answer2"
                              : original.expected === "answer2"
                                ? "answer1"
                                : original.expected,
                        };
                        drafts.current.comparison = swapped;
                        advancedKind.current = "comparison";
                        setAdvanced(true);
                        setC(swapped);
                        setFocusTarget("prompt");
                        setMatch(null);
                      }
                    }}
                  >
                    Prepare swapped-order retest
                  </Button>
                )}
                {share && <ShareTools value={share} />}
              </div>
            ) : null}
          </section>}
          {history.length > 0 && (
            <details className="attempt-list">
              <summary>
                {history.length} attempt{history.length !== 1 ? "s" : ""} in
                this session
              </summary>
              {history.map((h, i) => (
                <p key={h.runs[0]?.id ?? i}>
                  Attempt {i + 1}:{" "}
                  {h.runs.every((r) => r.status === "success")
                    ? "Complete"
                    : "Incomplete"}{" "}
                  · {h.vote ? "Voted" : "Not voted"}{" "}
                  <Button variant="ghost" onClick={() => setMatch(h)}>
                    View
                  </Button>
                </p>
              ))}
            </details>
          )}
        </div>
      </div>
    </main>
  );
}
