export type QuestionQualityStatus = "ready" | "review" | "blocked";

export type QuestionQualityCheck = {
  id: "context" | "answers" | "decision";
  label: string;
  status: QuestionQualityStatus;
  detail: string;
};

export type QuestionQuality = {
  status: QuestionQualityStatus;
  checks: QuestionQualityCheck[];
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function statusFor(checks: QuestionQualityCheck[]): QuestionQualityStatus {
  if (checks.some((check) => check.status === "blocked")) return "blocked";
  if (checks.some((check) => check.status === "review")) return "review";
  return "ready";
}

export function assessCommunityQuestion(question: string, rawAnswers: string): QuestionQuality {
  const answers = rawAnswers.split(/\r?\n/).map((answer) => answer.trim()).filter(Boolean);
  const uniqueAnswers = new Set(answers.map(normalize));
  const checks: QuestionQualityCheck[] = [
    !question.trim()
      ? { id: "context", label: "Question context", status: "blocked", detail: "Add the question and the context someone needs to answer it." }
      : normalize(question).length < 12
        ? { id: "context", label: "Question context", status: "review", detail: "This is very short. Add enough context for another person to make the same judgment." }
        : { id: "context", label: "Question context", status: "ready", detail: "A reader has a question to evaluate." },
    answers.length < 2
      ? { id: "answers", label: "Possible answers", status: "blocked", detail: "Add at least two possible answers." }
      : answers.length > 10
        ? { id: "answers", label: "Possible answers", status: "blocked", detail: "Keep the answer set to ten choices or fewer." }
        : uniqueAnswers.size !== answers.length
          ? { id: "answers", label: "Possible answers", status: "blocked", detail: "Make every possible answer distinct." }
          : { id: "answers", label: "Possible answers", status: "ready", detail: `${answers.length} distinct choices are ready to compare.` },
  ];

  const genericChoice = /^(?:answer|option|choice)\s*[a-z0-9]*$/i;
  const hasDirectQuestion = /[?？]$/.test(question.trim());
  if (!hasDirectQuestion && answers.length >= 2 && answers.every((answer) => genericChoice.test(answer.trim()))) {
    checks.push({ id: "decision", label: "Decision shape", status: "review", detail: "Say what the reader should decide, and replace placeholder answer labels with the actual choices." });
  } else if (!hasDirectQuestion) {
    checks.push({ id: "decision", label: "Decision shape", status: "review", detail: "Make the decision explicit so a reader knows how to choose between the answers." });
  } else {
    checks.push({ id: "decision", label: "Decision shape", status: "ready", detail: "The question gives readers a clear decision to make." });
  }

  return { status: statusFor(checks), checks };
}
