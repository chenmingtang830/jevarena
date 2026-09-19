"""Pinned public sources, label-free requests, prompt-grouped sampling."""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

import httpx

SOURCES = {
    "judgebench": {
        "revision": "e2c52c284e735e139b3daa61c206ee208f36c461",
        "root": "https://raw.githubusercontent.com/ScalerLab/JudgeBench/{revision}/data/",
        "files": ["dataset=judgebench,response_model=gpt-4o-2024-05-13.jsonl",
                  "dataset=judgebench,response_model=claude-3-5-sonnet-20240620.jsonl"],
        "license": "MIT per Hugging Face dataset card; retain upstream attribution",
        "citation": "https://arxiv.org/abs/2410.12784",
        "labels": "Upstream objective correctness labels; not all independently reverified here",
    },
    "rmbench": {
        "revision": "73c52d7b27b361621361ec959ac6c0eb9bb7a689",
        "root": "https://raw.githubusercontent.com/THU-KEG/RM-Bench/{revision}/data/",
        "files": ["chat_filtered.json", "code_filtered.json", "math_filtered.json",
                  "safety-refuse_filtered.json", "safety-response_filtered.json"],
        "license": "ODC-BY per Hugging Face dataset card; upstream source terms also apply",
        "citation": "https://github.com/THU-KEG/RM-Bench",
        "labels": "Upstream subtle-error preferences and style-controlled variants",
    },
    "rewardbench2": {
        "revision": "7ff08853b0d5686e79b13fda8677024f566a104a",
        "root": "https://huggingface.co/datasets/allenai/reward-bench-2/resolve/{revision}/data/",
        "files": ["test-00000-of-00001.parquet"],
        "license": "ODC-BY; generated outputs also subject to originating model terms",
        "citation": "https://huggingface.co/datasets/allenai/reward-bench-2",
        "labels": "Mixed: verifiers, model judges, majority votes, manual checks; see dataset card",
    },
}


def digest(value):
    if not isinstance(value, bytes):
        value = json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(value).hexdigest()


def dump(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def load_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]


def fetch_sources(root, names):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    manifest = {"schema": "jevjudge-sources/v1", "sources": {}}
    # Existing pinned files must match their original receipt, not silently acquire a new digest.
    receipt = root / "sources.json"
    if receipt.exists():
        manifest = json.loads(receipt.read_text())
    with httpx.Client(follow_redirects=True, timeout=90) as client:
        for name in names:
            spec = SOURCES[name]
            directory = root / name
            directory.mkdir(exist_ok=True)
            entries = []
            old = manifest["sources"].get(name, {})
            for filename in spec["files"]:
                url = spec["root"].format(revision=spec["revision"]) + filename
                path = directory / filename
                if path.exists():
                    previous = next((e for e in old.get("files", []) if e["filename"] == filename), None)
                    if previous is None or digest(path.read_bytes()) != previous["sha256"]:
                        raise ValueError(f"Unreceipted or changed source file: {path}")
                else:
                    response = client.get(url)
                    response.raise_for_status()
                    path.write_bytes(response.content)
                entries.append({"filename": filename, "url": url,
                                "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size})
                # Persist each downloaded file so an interrupted download is resumable.
                manifest["sources"][name] = {**spec, "files": entries}
                dump(receipt, manifest)
    return manifest


def pair(dataset, source_id, prompt, a, b, gold, domain, **meta):
    if not all(isinstance(x, str) and x.strip() for x in (prompt, a, b)):
        raise ValueError("Empty or non-text prompt/answer")
    if gold not in ("A", "B", "TIE"):
        raise ValueError("Unknown label")
    # Same prompt groups across response generators, styles and datasets never straddle partitions.
    group = digest(" ".join(prompt.split()))[:24]
    return {"id": f"{dataset}:{source_id}", "dataset": dataset, "group": group,
            "prompt": prompt, "a": a, "b": b, "gold": gold, "domain": domain,
            "meta": meta, "partition": "dev" if int(group[:8], 16) % 5 == 0 else "test"}


def normalize(name, filename, rows):
    result = []
    for row in rows:
        if name == "judgebench":
            domain = row["source"]
            result.append(pair(name, row["pair_id"], row["question"], row["response_A"],
                               row["response_B"], {"A>B": "A", "B>A": "B"}[row["label"]],
                               domain, response_model=row.get("response_model")))
        elif name == "rmbench":
            domain = filename.removesuffix("_filtered.json")
            if len(row["chosen"]) != 3 or len(row["rejected"]) != 3:
                raise ValueError("RM-Bench requires the original three styles")
            for i, a in enumerate(row["chosen"]):
                for j, b in enumerate(row["rejected"]):
                    result.append(pair(name, f"{domain}:{row['id']}:{i}:{j}", row["prompt"],
                                       a, b, "A", domain, chosen_style=i, rejected_style=j,
                                       difficulty="hard" if i < j else "easy" if i > j else "normal"))
        elif name == "rewardbench2":
            for i, a in enumerate(row["chosen"]):
                for j, b in enumerate(row["rejected"]):
                    result.append(pair(name, f"{row['id']}:{i}:{j}", row["prompt"], a, b,
                                       "A", row["subset"], original_id=row["id"],
                                       comparison="chosen-rejected", native_protocol=False))
            # Tie preference is an explicit diagnostic, not RewardBench 2's reward-margin score.
            for i, a in enumerate(row["chosen"]):
                for j in range(i + 1, len(row["chosen"])):
                    result.append(pair(name, f"{row['id']}:tie:{i}:{j}", row["prompt"],
                                       a, row["chosen"][j], "TIE", row["subset"],
                                       original_id=row["id"], comparison="chosen-chosen",
                                       native_protocol=False))
    return result


def prepare(root, names, groups_per_domain=0, partition="test", seed=42):
    root = Path(root)
    manifest = json.loads((root / "sources.json").read_text())
    rows = []
    for name in names:
        for entry in manifest["sources"][name]["files"]:
            path = root / name / entry["filename"]
            if digest(path.read_bytes()) != entry["sha256"]:
                raise ValueError(f"Source digest mismatch: {path}")
            if path.suffix == ".parquet":
                import pyarrow.parquet as pq
                raw = pq.read_table(path).to_pylist()
            else:
                raw = load_jsonl(path) if path.suffix == ".jsonl" else json.loads(path.read_text())
            rows.extend(normalize(name, entry["filename"], raw))
    buckets = defaultdict(lambda: defaultdict(list))
    for row in rows:
        if partition == "all" or row["partition"] == partition:
            buckets[(row["dataset"], row["domain"])][row["group"]].append(row)
    selected = []
    for groups in buckets.values():
        keys = sorted(groups, key=lambda g: digest([seed, g]))
        for key in keys[:groups_per_domain or None]:
            selected.extend(groups[key])
    ids = [r["id"] for r in selected]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate example IDs")
    if not selected:
        raise ValueError("Empty selection")
    return sorted(selected, key=lambda r: r["id"])


def state(row, swapped=False):
    # Explicit allowlist. Gold, IDs, source model, source domain and error explanations never sent.
    return {"user_prompt": row["prompt"], "response_A": row["b"] if swapped else row["a"],
            "response_B": row["a"] if swapped else row["b"]}


def canonical(label, swapped):
    return {"A": "B", "B": "A"}.get(label, label) if swapped else label
