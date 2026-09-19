"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  KeyRound,
  LoaderCircle,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Challenge,
  ChallengeSchema,
  CaseContribution,
  RunRecord,
  Vote,
  modelInput,
} from "@/lib/contracts";
import { MODELS, PROVIDERS, getJevModel, estimateCost, type Model } from "@/lib/catalog";
import { fetchOpenRouterCatalog } from "@/lib/openrouter-catalog";
import { executeJudge } from "@/lib/providers";
import { POLICY_VERSION } from "@/lib/policies";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { NativeSelect } from "./ui/native-select";
import { Suggestion } from "./ai-elements/suggestion";
import { ShareTools } from "./share-tools";
import { SaveHistory } from "./save-history";
import { OpenRouterConnect } from "./openrouter-connect";
import { ContributionSubmit } from "./contribution-submit";
import { PUBLIC_COLLECTION, PublicContributionChoice } from "./public-contribution-choice";
import { communityTasks, communityTaskSource } from "@/lib/community-tasks";
type Provider = "openrouter" | "vercel" | "typesafe";
type Tier = "low-cost" | "strong" | "reasoning";
type Match = { challenge: Challenge; runs: RunRecord[]; vote?: Vote };
const blank: Extract<Challenge, { kind: "judgment" }> = {
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
const simpleBlank: Extract<Challenge, { kind: "judgment" }> = {
  ...blank,
  question: "Answer the question in the provided text using one of the possible answers.",
};
const simpleExamples: { label: string; text: string; answers: string[]; source?: string }[] = [
  ...communityTasks.map(({ challenge }) => ({ label: challenge.title, text: challenge.kind === "judgment" ? `${challenge.question}\n\n${challenge.content}` : "", answers: challenge.kind === "judgment" ? challenge.options.map((o) => o.label) : [], source: challenge.source })),
];
const money = (n: number | null) =>
  n === null ? "Unknown" : `$${n.toFixed(6)}`;
function newId() {
  return crypto.randomUUID();
}
export function Playground({ initial }: { initial?: Challenge }) {
  const pathname = usePathname();
  const battleView = pathname === "/battle";
  const editorUrl = useRef("/");
  function editQuestion() {
    window.history.pushState(null, "", editorUrl.current);
    setFocusTarget(c.kind === "judgment" ? "content" : "prompt");
  }
  const [c, setC] = useState<Challenge>(initial ?? simpleBlank);
  const advanced = c.kind === "comparison";
  const [modelSettings, setModelSettings] = useState(false);
  const [settings, setSettings] = useState(false);
  const settingsDialog = useRef<HTMLDialogElement | null>(null);
  const settingsReturnFocus = useRef<HTMLElement | null>(null);
  const [pendingSimple, setPendingSimple] = useState<(typeof simpleExamples)[number] | null>(null);
  const [selectedExample, setSelectedExample] = useState<(typeof simpleExamples)[number] | null>(null);
  const [clearedDraft, setClearedDraft] = useState<{ challenge: Challenge; example: (typeof simpleExamples)[number] | null } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [exampleNotice, setExampleNotice] = useState("");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [mode, setMode] = useState<"arena" | "compare">("compare");
  const [tier, setTier] = useState<Tier>("low-cost");
  const [keys, setKeys] = useState<Record<Provider, string>>({
    openrouter: "",
    vercel: "",
    typesafe: "",
  });
  const [jp, setJp] = useState<Provider>("openrouter");
  const [opponent, setOpponent] = useState("");
  const [catalog, setCatalog] = useState<Model[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelSearch, setModelSearch] = useState("");
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const connectedOpenRouter = jp === "openrouter" && Boolean(keys.openrouter.trim());
  useEffect(() => {
    if (!settings || !connectedOpenRouter) return;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    let active = true;
    setCatalogState("loading");
    fetchOpenRouterCatalog(abort.signal).then(models => {
      if (active) { setCatalog(models); setCatalogState("ready"); }
    }).catch(() => { if (active) setCatalogState("error"); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); abort.abort(); };
  }, [settings, connectedOpenRouter, catalogRefresh]);
  const [busy, setBusy] = useState(false);
  const [acceptedPolicyVersion, setAcceptedPolicyVersion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [history, setHistory] = useState<Match[]>([]);
  const [publicMode, setPublicMode] = useState(true);
  const [publicSubmissions, setPublicSubmissions] = useState<CaseContribution[]>([]);
  const [budget, setBudget] = useState("0.05");
  const [connections, setConnections] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (advanced) return;
    const input = document.getElementById("content") as HTMLTextAreaElement | null;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(360, Math.max(104, input.scrollHeight))}px`;
  }, [c, advanced]);
  useLayoutEffect(() => {
    const dialog = settingsDialog.current;
    if (!dialog) return;
    if (settings) {
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = previousOverflow; };
    }
    if (dialog.open) {
      dialog.close();
      const previous = settingsReturnFocus.current;
      (previous?.isConnected ? previous : document.getElementById("start-judging-open"))?.focus();
    }
  }, [settings]);
  useLayoutEffect(() => {
    if (focusTarget) {
      document.getElementById(focusTarget)?.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, connections, c.kind, advanced, settings, modelSettings]);
  useEffect(() => {
    if (!busy && match) {
      setAnnouncement(
        match.runs.every((r) => r.status === "success")
          ? "Both judgments are ready. Compare them and vote to reveal the models."
          : "This comparison is incomplete. Review the results; no winner was selected.",
      );
      resultHeading.current?.focus({ preventScroll: true });
      (document.querySelector(".battle-question") ?? resultHeading.current)?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }
  }, [busy, match?.runs[0]?.id]);
  const presets = MODELS.filter(
    (m) => m.kind === "chat" && m.provider === jp && keys[jp].trim(),
  );
  const available = jp === "openrouter" && catalog.length ? catalog : presets;
  const providerLabel = PROVIDERS.find((p) => p.id === jp)!.label;
  const pool = presets.filter((m) => m.tier === tier && !m.compareOnly).map(m => available.find(live => live.id === m.id) ?? m);
  const selected =
    opponent ? available.find((m) => `${m.provider}:${m.id}` === opponent) : available.find((m) => m.id === "google/gemini-2.5-flash") ?? available[0];
  const matchingModels = available.filter(m => `${m.label} ${m.id}`.toLowerCase().includes(modelSearch.trim().toLowerCase()));
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
    setC(next);
    setMatch(null);
    setError("");
    setFieldErrors({});
    setExampleNotice("");
    if (!advanced) setClearedDraft(null);
  }
  function clearSimple() {
    const previous = { challenge: c, example: selectedExample };
    edit({ ...simpleBlank });
    setSelectedExample(null);
    setClearedDraft(previous);
    setPendingSimple(null);
    setFocusTarget("content");
  }
  function undoClear() {
    if (!clearedDraft) return;
    edit(clearedDraft.challenge);
    setSelectedExample(clearedDraft.example);
    setClearedDraft(null);
    setFocusTarget("content");
    setExampleNotice("Your previous text has been restored.");
  }
  function loadSimple(example: (typeof simpleExamples)[number], confirmed = false) {
    if (busy) return;
    const unchangedExample = selectedExample && c.kind === "judgment" && c.content === selectedExample.text &&
      c.options.length === selectedExample.answers.length && c.options.every((option, i) => option.label === selectedExample.answers[i]);
    if (c.kind === "judgment" && (c.content.trim() || JSON.stringify(c.options) !== JSON.stringify(blank.options)) && !unchangedExample && !confirmed) {
      setPendingSimple(example);
      setFocusTarget("confirm-simple-example");
      return;
    }
    edit({ ...simpleBlank, id: newId(), source: example.source, content: example.text, options: example.answers.map((label, i) => ({ id: `option${i + 1}`, label })) });
    setSelectedExample(example);
    setPendingSimple(null);
    setExampleNotice(`Example filled in. You can edit the text.`);
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
    settingsReturnFocus.current = document.activeElement as HTMLElement | null;
    setSettings(true);
    setFocusTarget("preflight-heading");
  }
  function fieldProps(id: string) {
    return { "aria-invalid": Boolean(fieldErrors[id]), "aria-describedby": fieldErrors[id] ? `${id}-error` : undefined };
  }
  function fieldError(id: string) {
    return fieldErrors[id] ? <p className="error field-error" id={`${id}-error`}>{fieldErrors[id]}</p> : null;
  }
  async function run() {
    if (busy) return;
    setError("");
    setFieldErrors({});
    setAnnouncement("");
    if (acceptedPolicyVersion !== POLICY_VERSION) {
      setSettings(true);
      setFieldErrors({ "run-consent": "Agree to Terms and acknowledge Privacy before running the models." });
      setFocusTarget("run-consent");
      return;
    }
    const parsed = ChallengeSchema.safeParse({
      ...c,
      id: newId(),
      title:
        c.title === "Untitled judgment"
          ? (c.kind === "judgment" ? c.content : c.prompt).slice(0, 120) ||
            "Untitled judgment"
          : c.title,
    });
    const errors: Record<string, string> = {};
    const fields = c.kind === "judgment"
      ? [["content", c.content], ["question", c.question], ...c.options.map((o, i) => [`option-${i}`, o.label]), ["language", c.language]]
      : [["prompt", c.prompt], ["answer1", c.answer1], ["answer2", c.answer2], ["language", c.language]];
    for (const [id, value] of fields) {
      if (!value.trim()) errors[id === "question" ? "content" : id] = id === "question"
        ? "The imported question is blank. Edit the question and context before starting."
        : "Enter text in this field before starting.";
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const id = issue.path[0] === "options" ? `option-${typeof issue.path[1] === "number" ? issue.path[1] : 0}` : issue.path[0] === "question" ? "content" : String(issue.path[0]);
        errors[id] ??= issue.message;
      }
    }
    if (Object.keys(errors).length || !parsed.success) {
      setFieldErrors(errors);
      const first = fields.find(([id]) => errors[id]);
      if (first?.[0] === "language") setModelSettings(true);
      else setSettings(false);
      setFocusTarget(first?.[0] ?? (c.kind === "judgment" ? "content" : "prompt"));
      setError(first ? "Check the highlighted fields before starting." : "This imported task has invalid metadata. Load an example or correct the original task before running.");
      return;
    }
    if (!keys[jp].trim() || !jev) {
      setConnections(true);
      setFieldErrors({ [`key-${jp}`]: `Paste your ${providerLabel} API key to run both judges.` });
      setFocusTarget(`key-${jp}`);
      setError(`Add a ${providerLabel} key in the dialog, then start again. Calls use your provider balance.`);
      return;
    }
    if (!candidates.length) {
      setModelSettings(true);
      setConnections(true);
      setError(
        "Connect a provider that offers a model in this tier, or choose another tier.",
      );
      setFocusTarget("rival");
      return;
    }
    if (!known || maximum === null) {
      setModelSettings(true);
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
      setModelSettings(true);
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
    setSettings(false);
    setBusy(true);
    setMatch(null);
    if (!battleView) {
      editorUrl.current = window.location.pathname + window.location.search;
      window.history.pushState(null, "", "/battle");
      window.scrollTo(0, 0);
    }
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
    if (!match || match.vote) return;
    const next = {
      ...match,
      vote: {
        runIds: match.runs.map((r) => r.id),
        value,
        revealedBeforeVote: false,
      },
    };
    setMatch(next);
    if (PUBLIC_COLLECTION && publicMode && value !== "skip") {
      setPublicSubmissions(current => [...current, {
        schemaVersion: 1, id: crypto.randomUUID(), challenge: next.challenge, runs: next.runs,
        vote: next.vote, license: "CC-BY-4.0", status: "community-submitted",
        ...(next.challenge.source === communityTaskSource.post ? { sourceAttributions: [{url: communityTaskSource.data, author: communityTaskSource.author, license: communityTaskSource.license, notice: "Original task from pithings/advocaat; MIT source copyright notice retained at https://github.com/pithings/advocaat/blob/46ed82661a41c27efd2a1bddf34f8dc1350d9143/LICENSE"}] } : {}),
      }]);
    }
    setHistory((h) => h.map((m) => (m === match ? next : m)));
  }
  const success = match?.runs.every((r) => r.status === "success");
  const hasTaskInput = c.kind === "comparison"
    ? Boolean(c.prompt.length || c.answer1.length || c.answer2.length || c.language !== "en")
    : Boolean(c.content.length || c.language !== "en" || JSON.stringify(c.options) !== JSON.stringify(blank.options));
  const revealed = Boolean(match?.vote) || Boolean(match && !success);
  const battleChallenge = match?.challenge ?? c;
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
      <div className="composer-intro" hidden={battleView}>
        <h1>Ask a question.</h1>
        <p>One question. Two model judgments.</p>
      </div>
      <div className="composer-flow">
        <section className="editor composer" aria-label="Set up experiment" hidden={battleView}>
          <fieldset
            disabled={busy}
            style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
          >
            <div className="editor-body">
              {c.kind === "judgment" ? <div className="simple-input">
                <label htmlFor="content">Question and context</label>
                <Textarea id="content" {...fieldProps("content")} rows={3}
                  aria-describedby={fieldErrors.content ? "content-error simple-task-hint" : "simple-task-hint"}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  placeholder="Ask a question and include anything the judges need to decide…"
                  value={c.question === simpleBlank.question ? c.content : [c.question, c.content].filter(Boolean).join("\n\n")}
                  onChange={(e) => edit({ ...c, question: simpleBlank.question, content: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); review(); } }}
                />
                {fieldError("content")}
                <p className="sr-only" id="simple-task-hint">Both judges choose from your possible answers below.</p>
                {!busy && !match && <div className="starter-chips" aria-label="Example tasks">
                  {simpleExamples.map((example) => <Suggestion className="quick-start-suggestion" key={example.label} suggestion={example.label} onClick={() => loadSimple(example)} />)}
                </div>}
                {c.source === communityTaskSource.post && <p className="hint">From <a href={communityTaskSource.post} target="_blank" rel="noreferrer">@_pi0_’s public test</a> · Adapted to our judging format. Not rerun here.</p>}
                <fieldset className="simple-options">
                  <legend>Possible answers</legend>
                  {c.options.map((option, i) => <div key={option.id}>
                    <div className="option-row">
                      <span className="option-index">{i + 1}</span>
                      <Input id={`option-${i}`} {...fieldProps(`option-${i}`)} aria-label={`Option ${i + 1}`} value={option.label}
                        onChange={(e) => edit({ ...c, options: c.options.map((o, j) => i === j ? { ...o, label: e.target.value } : o) })} />
                      <Button variant="ghost" aria-label={`Remove option ${i + 1}`} disabled={c.options.length <= 2}
                        onClick={() => edit({ ...c, options: c.options.filter((_, j) => i !== j) })}><X size={14} /></Button>
                    </div>
                    {fieldError(`option-${i}`)}
                  </div>)}
                  <Button variant="ghost" disabled={c.options.length >= 10} onClick={() => edit({ ...c, options: [...c.options, { id: newId(), label: "" }] })}><Plus size={13} />Add option</Button>
                </fieldset>
              </div> : <div className="advanced-task">
                <p className="hint">Imported answer comparison. Edit the original question or either answer.</p>
                <div className="field"><label htmlFor="prompt">Original question</label><Textarea id="prompt" {...fieldProps("prompt")} value={c.prompt} onChange={(e) => edit({ ...c, prompt: e.target.value })} />{fieldError("prompt")}</div>
                <div className="field"><label htmlFor="answer1">Candidate answer 1</label><Textarea id="answer1" {...fieldProps("answer1")} value={c.answer1} onChange={(e) => edit({ ...c, answer1: e.target.value })} />{fieldError("answer1")}</div>
                <div className="field"><label htmlFor="answer2">Candidate answer 2</label><Textarea id="answer2" {...fieldProps("answer2")} value={c.answer2} onChange={(e) => edit({ ...c, answer2: e.target.value })} />{fieldError("answer2")}</div>
              </div>}
              <div className="composer-toolbar">
                {!advanced && (hasTaskInput || selectedExample) && <Button variant="ghost" onClick={clearSimple}>Clear</Button>}
                {!settings && <Button id="start-judging-open" className="composer-submit" onClick={review}>Start judging <ArrowRight size={16} /></Button>}
              </div>
              {!advanced && clearedDraft && <div className="clear-notice" role="status">
                <span>Text cleared.</span><Button variant="ghost" onClick={undoClear}>Undo clear</Button>
              </div>}
              {pendingSimple && (
                <div className="example-confirm" role="group" aria-label="Replace draft with example">
                  <p>Replace your text with “{pendingSimple.label}”?</p>
                  <Button id="confirm-simple-example" variant="secondary" onClick={() => loadSimple(pendingSimple, true)}>Replace draft</Button>
                  <Button variant="ghost" onClick={() => { setPendingSimple(null); setFocusTarget("content"); }}>Keep draft</Button>
                </div>
              )}
              {!advanced && <p className="sr-only" role="status">{exampleNotice}</p>}
              {hasTaskInput && <section className="privacy-note" aria-label="Privacy before you run">
                <details>
                  <summary>Privacy: your text goes to model providers</summary>
                  <p>When you run, your task goes to the selected model providers. Don’t include secrets or sensitive personal information.</p>
                  <p>Providers receive your prompt, context and any candidate answers needed to judge the task. Their own data and retention policies apply.</p>
                  <p>Your API keys stay in this tab’s memory and disappear on refresh. OpenRouter requests go directly to OpenRouter. When enabled, Vercel AI Gateway requests pass through our fixed server relay; the key is used in request memory, not saved.</p>
                  <p>{PUBLIC_COLLECTION ? "Public contribution is on by default: voting submits your task, results and vote for research and publication after review. Uncheck Contribute publicly before voting to keep them in this tab. API keys are never included." : "JevArena does not upload or publish your task automatically. Research submission requires a separate action and consent."} Saving private account history, when available, is a separate action.</p>
                </details>
              </section>}
              <dialog ref={settingsDialog} className="model-settings settings-dialog" id="model-settings" aria-labelledby="preflight-heading"
                onCancel={(event) => { event.preventDefault(); setSettings(false); }}
                onClose={(event) => { if (!event.currentTarget.open) setSettings(false); }}>
              <Button variant="ghost" className="dialog-close" aria-label="Close model setup" onClick={() => setSettings(false)}><X size={18} /></Button>
              <h2 id="preflight-heading" tabIndex={-1}>{keys[jp].trim() ? "Ready to compare" : connections ? "Use your API key" : "Connect OpenRouter"}</h2>
              <p className="hint preflight-intro">{keys[jp].trim() ? "Connected · Key stays in this tab only." : "We do not save your API key. It stays in this tab and clears on refresh."}</p>
              {!keys[jp].trim() && !connections && <>
                <OpenRouterConnect disabled={!settings} onConnected={(key: string) => {
                  setKeys((current) => ({ ...current, openrouter: key }));
                  setJp("openrouter"); setConnections(false); setError("");
                  setAcceptedPolicyVersion(null); setFocusTarget("preflight-heading");
                }} />
                <p className="hint">Set a small credit limit on OpenRouter. The authorized key stays in this tab.</p>
                <div className="connection-alternatives" aria-label="Other ways to try JevArena">
                  <Button asChild variant="secondary"><Link href="/try">Try without a key <ArrowRight size={16} aria-hidden="true" /></Link></Button>
                  <Button asChild variant="secondary"><Link href="/run-locally">Run locally <ArrowRight size={16} aria-hidden="true" /></Link></Button>
                </div>
              </>}
              {keys[jp].trim() && <div className="connected-matchup">
                <span className="fixed-judge">Jev <span>vs</span></span>
                <div><label htmlFor="rival">Opponent</label>
                  {jp === "openrouter" && <>
                    <Input aria-label="Search models or paste model ID" placeholder="Search models or paste model ID" value={modelSearch} maxLength={160} onChange={event => setModelSearch(event.target.value)} />
                    <p className="hint catalog-status" role="status">{catalogState === "loading" ? "Loading OpenRouter models…" : catalogState === "error" ? "Couldn’t refresh. Showing the last available list." : catalogState === "ready" ? `${matchingModels.length} text models · Newest listed first` : "Saved model list"} <Button variant="ghost" disabled={catalogState === "loading"} onClick={() => setCatalogRefresh(value => value + 1)}>Refresh</Button></p>
                  </>}
                  <NativeSelect id="rival" value={mode === "arena" ? `auto:${tier}` : selected ? `${selected.provider}:${selected.id}` : ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value.startsWith("auto:")) { setMode("arena"); setTier(value.slice(5) as Tier); }
                      else { setMode("compare"); setOpponent(value); }
                    }}>
                    {selected && !matchingModels.some(m => m.id === selected.id) && <option value={`${selected.provider}:${selected.id}`}>Selected: {selected.label}</option>}
                    <optgroup label={jp === "openrouter" && catalog.length ? "OpenRouter · newest listed first" : "Saved models"}>
                      {matchingModels.map((m) => <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>{m.label} — {m.id}</option>)}
                    </optgroup>
                    {!modelSearch && <optgroup label="Let Arena choose · curated pool">
                      {(["low-cost", "strong", "reasoning"] as Tier[]).map((value) => <option key={value} value={`auto:${value}`} disabled={!presets.some((m) => m.tier === value && !m.compareOnly)}>Random · {value === "low-cost" ? "low cost" : value === "strong" ? "strong generalist" : "reasoning"}</option>)}
                    </optgroup>}
                  </NativeSelect>
                  {modelSearch && !matchingModels.length && <p className="hint">No match. Check the provider/model ID or refresh the list. Your selection has not changed.</p>}
                  {mode === "compare" && selected && <p className="hint model-price">{selected.inputPerMillion === null || selected.outputPerMillion === null ? "Price unavailable — cannot run" : `$${selected.inputPerMillion.toLocaleString("en-US")} input / $${selected.outputPerMillion.toLocaleString("en-US")} output per 1M tokens`}{selected.compareOnly ? " · Not live-tested here" : ""}</p>}
                </div>
              </div>}
              {keys[jp].trim() && <details className="advanced-model-settings" open={modelSettings} onToggle={(event) => setModelSettings(event.currentTarget.open)}>
              <summary>Advanced settings</summary>
              <p className="hint">Judge X and Y first. Names, speed and cost appear after your vote.</p>
              <p className="hint">Cost estimates are not billing caps. <a href={jev.priceSource} target="_blank" rel="noreferrer">Price source</a> · rates checked {jev.verifiedAt}. Use a limited-budget key. The page can read your key while you use it; it clears on refresh. <Link href="/privacy" target="_blank">Privacy details</Link>.</p>
              <div className="field"><label htmlFor="language">Task language</label><Input id="language" {...fieldProps("language")} value={c.language} maxLength={40} onChange={(e) => edit({ ...c, language: e.target.value })} />{fieldError("language")}</div>
              <div className="field-row">
                <div>
                  <label htmlFor="budget">Estimate threshold (USD)</label>
                  <Input
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
              {keys[jp].trim() && <Button variant="ghost" onClick={() => {
                setKeys((current) => ({ ...current, [jp]: "" }));
                setAcceptedPolicyVersion(null); setConnections(false);
              }}>Disconnect this tab</Button>}
              </details>}
              <details
                className="connection-box"
                hidden={Boolean(keys[jp].trim()) && !connections}
                open={connections}
                onToggle={(e) => setConnections(e.currentTarget.open)}
              >
                <summary>
                  <KeyRound size={15} />
                  {connections ? "Back to connection options" : keys[jp].trim() ? "Manage connection" : "Use an API key instead"}
                </summary>
                <div className="field" hidden={process.env.NEXT_PUBLIC_VERCEL_BYOK_ENABLED !== "true"}>
                  <label htmlFor="jev-provider">API provider</label>
                  <NativeSelect id="jev-provider" value={jp} onChange={(e) => {
                    setJp(e.target.value as Provider); setOpponent(""); setTier("low-cost");
                    setFieldErrors({}); setError(""); setAcceptedPolicyVersion(null);
                  }}>
                    {PROVIDERS.filter((p) => p.id !== "typesafe").map((p) => <option key={p.id} value={p.id} disabled={p.id === "vercel" && process.env.NEXT_PUBLIC_VERCEL_BYOK_ENABLED !== "true"}>{p.label}{p.id === "vercel" && process.env.NEXT_PUBLIC_VERCEL_BYOK_ENABLED !== "true" ? " · setup pending" : ""}</option>)}
                  </NativeSelect>
                </div>
                <div className="connection-grid">
                  {PROVIDERS.filter((p) => p.id === jp).map((p) => (
                    <div key={p.id}>
                      <label htmlFor={`key-${p.id}`}>{p.label}</label>
                      <Input
                        id={`key-${p.id}`}
                        {...fieldProps(`key-${p.id}`)}
                        type="password"
                        disabled={p.id === "vercel" && process.env.NEXT_PUBLIC_VERCEL_BYOK_ENABLED !== "true"}
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
                        {p.id === "openrouter"
                          ? <><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">Get a key</a>{" · "}<Link href="/run-locally">Use Vercel locally</Link></>
                          : <>Use an <a href="https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys" target="_blank" rel="noreferrer">AI Gateway API key</a>, not a Vercel account token. Sent through JevArena’s fixed relay to ai-gateway.vercel.sh. Our server handles your key in request memory without saving it.</>}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
              {(keys[jp].trim() || connections) && <div className="run-foot">
                <div className="price-note">
                  <ShieldCheck size={14} />
                  <span>
                    2 calls ·{" "}
                    {maximum === null
                      ? "Enter a key to see estimated cost"
                      : `Estimated ${money(minimum)}–${money(maximum)}`}
                  </span>
                </div>
                <div data-policy-version={POLICY_VERSION}>
                  <p className="hint">Running sends your task to the model providers. Do not include sensitive data.</p>
                  <label className="check-label" htmlFor="run-consent">
                    <Input id="run-consent" type="checkbox" {...fieldProps("run-consent")}
                      checked={acceptedPolicyVersion === POLICY_VERSION}
                      onChange={(event) => {
                        setAcceptedPolicyVersion(event.target.checked ? POLICY_VERSION : null);
                        setFieldErrors((current) => ({ ...current, "run-consent": "" }));
                      }} />
                    I agree to Terms and acknowledge Privacy
                  </label>
                  <p className="hint"><Link href="/terms" target="_blank" rel="noreferrer">Read Terms</Link>{" · "}<Link href="/privacy" target="_blank" rel="noreferrer">Read Privacy</Link></p>
                  {fieldError("run-consent")}
                </div>
                <PublicContributionChoice checked={publicMode} onChange={setPublicMode} live />
                <Button className="full-width" disabled={!keys[jp].trim() || acceptedPolicyVersion !== POLICY_VERSION} onClick={run}>
                  <span>Start judging</span>
                  <ArrowRight size={16} />
                </Button>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
              </div>}
              </dialog>
            </div>
          </fieldset>
        </section>
        <div className="composer-context" hidden={battleView}>Compare anonymously. Vote to reveal. <Button asChild variant="secondary"><Link href="/try">Try without a key <ArrowRight size={12} /></Link></Button></div>
        <div hidden={!battleView}>
          <Button variant="ghost" disabled={busy} onClick={editQuestion}>Edit question</Button>
          {error && <p className="error" role="alert">{error}</p>}
          <section className="battle-question" aria-label="Your question">
            <h2>Your question</h2>
            <p>{battleChallenge.kind === "judgment" ? battleChallenge.content : battleChallenge.prompt}</p>
            <ul aria-label="Possible answers">{(battleChallenge.kind === "judgment" ? battleChallenge.options : [{id:"answer1",label:battleChallenge.answer1},{id:"answer2",label:battleChallenge.answer2}]).map(option => <li key={option.id}>{option.label}</li>)}</ul>
          </section>
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
                              modelInput(match.challenge).options.map(option => (
                                <div key={option.id}>
                                  <dt>{option.label} probability</dt>
                                  <dd>{((r.probabilities![option.id] ?? 0) * 100).toFixed(1)}%</dd>
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
                    <PublicContributionChoice checked={publicMode} onChange={setPublicMode} live />
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
                    One experiment, not a leaderboard. A community vote is a preference, not a verified correctness label.
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
                        setC(swapped);
                        setFocusTarget("prompt");
                        setMatch(null);
                        editQuestion();
                      }
                    }}
                  >
                    Prepare swapped-order retest
                  </Button>
                )}
                {share && <ShareTools value={share} />}
                {match.vote && <SaveHistory key={match.runs.map((run) => run.id).join(":")} challenge={match.challenge} runs={match.runs} vote={match.vote} />}
              </div>
            ) : null}
          </section>}
          {publicSubmissions.map(value => <ContributionSubmit key={value.id} value={value} publicCandidate />)}
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
