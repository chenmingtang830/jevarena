import type { QuestionQuality } from "@/lib/community-question-quality";
import styles from "./community-question-quality.module.css";

const statusCopy = {
  ready: "Ready for screening",
  review: "Needs a closer review",
  blocked: "Fix before submitting",
} as const;

export function CommunityQuestionQuality({ quality }: { quality: QuestionQuality }) {
  return <section className={styles.quality} aria-labelledby="question-quality-title">
    <div className={styles.heading}>
      <div>
        <h2 id="question-quality-title">Question quality</h2>
        <p>Local checks only. Nothing is sent to Jev or a model while you edit.</p>
      </div>
      <span className={styles.status} data-status={quality.status}>{statusCopy[quality.status]}</span>
    </div>
    <ul className={styles.checks}>
      {quality.checks.map((check) => <li key={check.id} data-status={check.status}>
        <strong>{check.label}</strong>
        <span>{check.detail}</span>
      </li>)}
    </ul>
    {quality.status === "review" && <p className={styles.note}>You can submit this question, but automated screening may hold it for a human publication decision. Screening and human approval do not verify correctness.</p>}
    {quality.status === "blocked" && <p className={styles.note}>Complete the required structure above before submitting. This does not replace the final safety and publication review.</p>}
  </section>;
}
