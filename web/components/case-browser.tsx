"use client";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { templates } from "@/lib/cases";
export function CaseBrowser() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const filtered = templates.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      `${t.title} ${t.kind === "judgment" ? t.question : t.prompt}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="field-row" style={{ marginTop: 26 }}>
        <div>
          <label htmlFor="case-search" className="inline">
            <Search size={13} />
            Find a challenge
          </label>
          <Input
            id="case-search"
            placeholder="Search questions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="case-kind">Task type</label>
          <NativeSelect
            id="case-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">All tasks</option>
            <option value="judgment">Make a judgment</option>
            <option value="comparison">Compare two answers</option>
          </NativeSelect>
        </div>
      </div>
      <p className="hint" role="status">
        {filtered.length} starter templates · no verified model runs yet
      </p>
      <div className="case-grid">
        {filtered.map((t) => (
          <article className="case-entry" key={t.id}>
            <span className="tag">Template</span>
            <span className="tag">{t.language}</span>
            <h2 style={{ marginTop: 12 }}>
              <Link href={`/cases/${t.id}`}>
                {t.title}{" "}
                <ArrowRight size={17} style={{ display: "inline" }} />
              </Link>
            </h2>
            <p>{t.kind === "judgment" ? t.question : t.prompt}</p>
            <Link href={`/cases/${t.id}`}>Open editable template</Link>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p style={{ marginTop: 20 }}>
          No matching templates. Try a different search or task type.
        </p>
      )}
    </>
  );
}
