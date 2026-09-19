from __future__ import annotations

import argparse
import json
from pathlib import Path

from .data import SOURCES, digest, dump, fetch_sources, load_jsonl, prepare
from .providers import validate_config
from .report import build_report
from .runner import plan, run


def main():
    parser = argparse.ArgumentParser(description="JevJudge-Bench: failure-oriented judge evaluation")
    sub = parser.add_subparsers(dest="command", required=True)
    fetch = sub.add_parser("fetch", help="Download pinned public sources; no model calls")
    fetch.add_argument("--root", default="data/raw")
    fetch.add_argument("--datasets", nargs="+", choices=SOURCES, default=list(SOURCES))
    prep = sub.add_parser("prepare", help="Normalize into diagnostic pairs and select prompt groups")
    prep.add_argument("--root", default="data/raw")
    prep.add_argument("--datasets", nargs="+", choices=SOURCES, default=list(SOURCES))
    prep.add_argument("--groups-per-domain", type=int, default=5)
    prep.add_argument("--partition", choices=("dev", "test", "all"), default="test")
    prep.add_argument("--seed", type=int, default=42)
    prep.add_argument("--out", required=True)
    for name in ("plan", "run"):
        p = sub.add_parser(name)
        p.add_argument("--data", required=True)
        p.add_argument("--config", required=True)
        p.add_argument("--repeats", type=int, default=1)
        p.add_argument("--seed", type=int, default=42)
        if name == "run":
            p.add_argument("--out", required=True)
            p.add_argument("--execute", action="store_true")
            p.add_argument("--max-cost-usd", type=float, default=0)
            p.add_argument("--max-calls", type=int, default=0)
    report = sub.add_parser("report")
    report.add_argument("directory")
    args = parser.parse_args()
    if args.command == "fetch":
        value = fetch_sources(args.root, args.datasets)
        print(json.dumps({name: len(spec["files"]) for name, spec in value["sources"].items()}))
    elif args.command == "prepare":
        if args.groups_per_domain < 0:
            parser.error("groups-per-domain must be nonnegative; 0 means all")
        rows = prepare(args.root, args.datasets, args.groups_per_domain, args.partition, args.seed)
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("x") as stream:
            for row in rows:
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
        receipt = {"rows_sha256": digest(rows), "pairs": len(rows),
                   "prompt_groups": len({r["group"] for r in rows}),
                   "sources": json.loads((Path(args.root) / "sources.json").read_text()),
                   "selection": vars(args), "protocol": "diagnostic-pairwise-not-native-leaderboard"}
        dump(str(out) + ".manifest.json", receipt)
        print(json.dumps({key: receipt[key] for key in ("pairs", "prompt_groups", "rows_sha256")}))
    elif args.command in ("plan", "run"):
        rows = load_jsonl(args.data)
        if not rows or len({r["id"] for r in rows}) != len(rows):
            parser.error("Empty data or duplicate IDs")
        config = validate_config(json.loads(Path(args.config).read_text()))
        if args.command == "plan":
            tasks = plan(rows, config, args.repeats, args.seed)
            print(json.dumps({"pairs": len(rows), "prompt_groups": len({r["group"] for r in rows}),
                              "calls": len(tasks), "both_orders": True,
                              "reservation_sum_usd": sum(t[1].get("max_request_usd", 0) for t in tasks),
                              "note": "Reservation is user-configured; not a provider-enforced billing cap."}, indent=2))
        else:
            receipt_path = Path(args.data + ".manifest.json")
            if receipt_path.exists() and json.loads(receipt_path.read_text())["rows_sha256"] != digest(rows):
                parser.error("Prepared data no longer matches its receipt")
            print(json.dumps(run(rows, config, args.out, execute=args.execute,
                                 max_cost=args.max_cost_usd, max_calls=args.max_calls,
                                 repeats=args.repeats, seed=args.seed), indent=2))
    elif args.command == "report":
        result = build_report(args.directory)
        print(json.dumps({"title": result["title"], "report": str(Path(args.directory) / "report.md")}))


if __name__ == "__main__":
    main()
