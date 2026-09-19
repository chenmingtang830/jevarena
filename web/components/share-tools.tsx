"use client";
import { useState } from "react";
import {
  Download,
  Link as LinkIcon,
  Image as ImageIcon,
  Share2,
} from "lucide-react";
import { CaseContribution } from "@/lib/contracts";
import { encodeShare, contributionJson } from "@/lib/sharing";
import { Button } from "./ui/button";
function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function ShareTools({ value }: { value: CaseContribution }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  async function share() {
    try {
      const f = await encodeShare(value);
      const url = `${location.origin}/share#${f}`;
      await navigator.clipboard.writeText(url);
      setMessage(
        "Link copied. Anyone with this link can read the shared content.",
      );
    } catch {
      setMessage(
        "Could not create or copy the link. Download the JSON instead.",
      );
    }
  }
  function png() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 680;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.fillStyle = "#f6f5f0";
    c.fillRect(0, 0, 1200, 680);
    c.fillStyle = "#38664c";
    c.font = "bold 32px sans-serif";
    c.fillText("JevArena", 55, 70);
    c.fillStyle = "#1e2822";
    c.font = "32px sans-serif";
    c.fillText(value.challenge.title.slice(0, 65), 55, 140);
    c.font = "18px sans-serif";
    c.fillText("Community-submitted run · not independently verified", 55, 182);
    value.runs.slice(0, 2).forEach((r, i) => {
      const x = 55 + i * 575;
      c.fillStyle = "#1e2822";
      c.font = "bold 21px sans-serif";
      c.fillText(r.model.slice(0, 40), x, 270);
      c.font = "20px sans-serif";
      c.fillText(`Judgment: ${r.choice ?? r.status}`, x, 325);
      c.fillText(`${(r.latencyMs / 1000).toFixed(2)} seconds`, x, 380);
      c.fillText(
        r.cost.usd === null
          ? "Cost unknown"
          : `$${r.cost.usd.toFixed(6)} (${r.cost.basis})`,
        x,
        420,
      );
      c.font = "15px sans-serif";
      c.fillText(
        `Version: ${r.resolvedModel ?? "unknown"}`.slice(0, 56),
        x,
        465,
      );
    });
    c.fillStyle = "#626b63";
    c.font = "18px sans-serif";
    c.fillText("One case is not a benchmark. Explore the boundaries.", 55, 610);
    canvas.toBlob((b) => {
      if (b) download(b, "jevarena-result.png");
    }, "image/png");
  }
  return (
    <div className="share-panel">
      <Button variant="secondary" onClick={() => setOpen(!open)}>
        <Share2 size={15} />
        Share this experiment
      </Button>
      {open && (
        <>
          <p className="hint">
            Review everything below. Sharing is optional. Remove private content
            before contributing. Keys are never included.
          </p>
          <pre className="share-preview">{contributionJson(value)}</pre>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have reviewed this content and am comfortable sharing it. Public
            contributions use CC BY 4.0.
          </label>
          <div className="inline">
            <Button variant="secondary" disabled={!confirmed} onClick={share}>
              <LinkIcon size={14} />
              Copy link
            </Button>
            <Button
              variant="secondary"
              disabled={!confirmed}
              onClick={() =>
                download(
                  new Blob([contributionJson(value)], {
                    type: "application/json",
                  }),
                  "jevarena-case.json",
                )
              }
            >
              <Download size={14} />
              JSON
            </Button>
            <Button
              variant="secondary"
              disabled={!confirmed || !value.runs.length}
              onClick={png}
            >
              <ImageIcon size={14} />
              Image
            </Button>
          </div>
          <p role="status" className="hint">
            {message}
          </p>
        </>
      )}
    </div>
  );
}
