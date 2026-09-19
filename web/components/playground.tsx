"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
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
const money = (n: number | null) =>
  n === null ? "Unknown" : `$${n.toFixed(6)}`;
function newId() {
  return crypto.randomUUID();
}
export function Playground({ initial }: { initial?: Challenge }) {
  const [c, setC] = useState<Challenge>(initial ?? blank);
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
  function edit(next: Challenge) {
    setC(next);
    setError("");
  }
  function load(t: Challenge) {
    if (busy) return;
    setC({ ...t, id: newId() });
    setMatch(null);
    setError("");
  }
  function switchKind(kind: "judgment" | "comparison") {
    setMatch(null);
    setC(
      kind === "judgment"
        ? { ...blank }
        : {
            schemaVersion: 1,
            id: "custom",
            title: "Compare two answers",
            language: "en",
            kind: "comparison",
            prompt: "",
            answer1: "",
            answer2: "",
          },
    );
  }
  async function run() {
    setError("");
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
    if (!parsed.success) {
      setError(
        "Add the task, a question, and all choices before starting. Each field must contain text.",
      );
      return;
    }
    if (!keys[jp].trim() || !jev) {
      setConnections(true);
      setError("Connect a provider key for Jev.");
      return;
    }
    if (!candidates.length) {
      setConnections(true);
      setError(
        "Connect a provider that offers a model in this tier, or choose another tier.",
      );
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
    <main id="main" className="workspace">
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
      <div className="intro">
        <div>
          <h1>
            Good judgment.
            <br />
            Put it to the test.
          </h1>
          <p>
            Jev meets another model. Bring your own question, compare their
            decisions, and discover where each one shines.
          </p>
        </div>
        <span className="intro-note">
          <span className="dot" /> Open source · Your keys · Your experiments
        </span>
      </div>
      <div className="workspace-grid">
        <section className="editor" aria-label="Set up experiment">
          <div className="section-bar">
            <h2>Your experiment</h2>
            <span className="small">Text in. Judgment out.</span>
          </div>
          <fieldset
            disabled={busy}
            style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
          >
            <div className="editor-body">
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
              {c.kind === "judgment" ? (
                <>
                  <div className="field">
                    <label htmlFor="content">
                      What should the models evaluate?
                    </label>
                    <textarea
                      id="content"
                      rows={5}
                      placeholder="Paste an email, a claim, a policy, or any text to evaluate…"
                      value={c.content}
                      onChange={(e) => edit({ ...c, content: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="question">What’s the judgment?</label>
                    <input
                      id="question"
                      placeholder="Does this claim follow from the evidence?"
                      value={c.question}
                      onChange={(e) => edit({ ...c, question: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Possible answers</label>
                    {c.options.map((o, i) => (
                      <div className="option-row" key={o.id}>
                        <span className="option-index">{i + 1}</span>
                        <input
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
                      rows={3}
                      value={c.prompt}
                      placeholder="What were the answers responding to?"
                      onChange={(e) => edit({ ...c, prompt: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="answer1">Candidate answer 1</label>
                    <textarea
                      id="answer1"
                      rows={3}
                      value={c.answer1}
                      onChange={(e) => edit({ ...c, answer1: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="answer2">Candidate answer 2</label>
                    <textarea
                      id="answer2"
                      rows={3}
                      value={c.answer2}
                      onChange={(e) => edit({ ...c, answer2: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="field">
                <label htmlFor="language">Task language</label>
                <input
                  id="language"
                  value={c.language}
                  placeholder="en, zh, es…"
                  maxLength={40}
                  onChange={(e) => edit({ ...c, language: e.target.value })}
                />
              </div>
              <div className="divider" />
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
                    type="number"
                    min="0.001"
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
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
                        type="password"
                        disabled={p.transport === "relay"}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Paste your API key"
                        value={keys[p.id as Provider]}
                        onChange={(e) =>
                          setKeys({ ...keys, [p.id]: e.target.value })
                        }
                      />
                      <p className="hint">
                        {p.transport === "direct"
                          ? "Browser → provider directly"
                          : "Not available yet: relay awaits distributed rate limiting."}
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
                    OpenRouter is available for testing. Vercel Gateway and
                    TypeSafe adapters are implemented but disabled until relay
                    protection is enabled.
                  </p>
                  <p className="hint">
                    Keys disappear on refresh. Relay keys pass through our
                    server for this request only. Calls use your provider
                    balance.
                  </p>
                </div>
              </details>
              <div className="run-foot">
                <p className="hint" style={{ marginBottom: 12 }}>
                  Experimental adapters: contract-tested; account availability
                  and live calls have not been verified.
                </p>
                <div className="price-note">
                  <ShieldCheck size={14} />
                  <span>
                    2 calls ·{" "}
                    {maximum === null
                      ? "Connect keys to see the estimated upper cost"
                      : `Estimated upper cost ${money(maximum)}`}
                    <br />
                    Estimate uses provider list prices and bounded output. Not a
                    billing cap; actual token accounting can vary.
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
            </div>
          </fieldset>
        </section>
        <div>
          <section className="arena-panel" aria-label="Comparison results">
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
                          </dl>
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
                        setC({
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
                        });
                        setMatch(null);
                      }
                    }}
                  >
                    Prepare swapped-order retest
                  </Button>
                )}
                {share && <ShareTools value={share} />}
              </div>
            ) : (
              <div className="empty-arena">
                <div className="judge-pair" aria-hidden="true">
                  <div className="judge-placeholder">X</div>
                  <span className="versus">vs</span>
                  <div className="judge-placeholder">Y</div>
                </div>
                <h3>Which judgment holds up?</h3>
                <p>
                  One judge is always Jev. Choose the better decision before
                  seeing the names, speed, or price.
                </p>
              </div>
            )}
            <div className="arena-bottom">
              <LockKeyhole size={13} />
              <span>
                No account. No platform credits. Your API keys power the
                experiment.
              </span>
            </div>
          </section>
          <div className="right-note">
            <SlidersHorizontal size={16} />
            <p>
              A faster answer isn’t always a better judgment.
              <br />
              <Link href="/methodology">
                <u>How we compare fairly</u>
              </Link>
            </p>
          </div>
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
      <section className="examples">
        <div className="examples-head">
          <h2>Start with a question worth testing</h2>
          <Link className="small inline" href="/cases">
            All cases
            <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="example-list">
          {templates.slice(0, 6).map((t) => (
            <button
              className="example-item"
              key={t.id}
              disabled={busy}
              onClick={() => load(t)}
            >
              <span>
                {t.title}
                <ArrowUpRight size={14} />
              </span>
              <small>
                Template ·{" "}
                {t.kind === "comparison"
                  ? "Compare answers"
                  : "Make a judgment"}
              </small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
