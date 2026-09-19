"use client";
import { useEffect, useState } from "react";
import { CaseContribution } from "@/lib/contracts";
import { decodeShare, importContribution } from "@/lib/sharing";
import { CaseViewer } from "@/components/case-viewer";
export default function Share() {
  const [value, setValue] = useState<CaseContribution | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (location.hash)
      decodeShare(location.hash)
        .then(setValue)
        .catch(() =>
          setError(
            "This link is invalid or too large. Ask the contributor for a JSON export.",
          ),
        );
  }, []);
  async function load(file?: File) {
    if (!file) return;
    if (file.size > 100000) {
      setError("This file is too large. Use a case export under 100 KB.");
      return;
    }
    try {
      setValue(importContribution(await file.text()));
      setError("");
    } catch {
      setError(
        "This file is not a valid JevArena contribution. No model requests were made.",
      );
    }
  }
  if (value)
    return <CaseViewer challenge={value.challenge} contribution={value} />;
  return (
    <main id="main" className="prose-page">
      <h1>Open an experiment.</h1>
      <p>
        Shared links and JSON exports contain community-submitted observations,
        not independently verified results. Opening a case never calls a model.
      </p>
      <section>
        <label htmlFor="case-file">Import a JevArena JSON export</label>
        <input
          id="case-file"
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(e) => load(e.target.files?.[0])}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
