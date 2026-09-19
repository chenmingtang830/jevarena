"""Serial, interleaved measurement with durable attempts and a conservative spending reservation."""
from __future__ import annotations

import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from .data import canonical, digest, dump, load_jsonl, state
from .providers import RUBRIC, CRITERIA, accounting, call, parse_prediction, validate_config


def now():
    return datetime.now(timezone.utc).isoformat()


def plan(rows, config, repeats=1, seed=42):
    validate_config(config)
    if repeats < 1:
        raise ValueError("repeats must be positive")
    tasks = [(row, model, swapped, repeat) for row in rows for model in config["models"]
             for swapped in (False, True) for repeat in range(repeats)]
    random.Random(seed).shuffle(tasks)
    return tasks


def run(rows, config, directory, *, execute=False, max_cost=0, max_calls=0, repeats=1, seed=42):
    tasks = plan(rows, config, repeats, seed)
    real = any(m["kind"] != "mock" for m in config["models"])
    if real and any(m["kind"] == "mock" for m in config["models"]):
        raise ValueError("Mock and real models must have separate run directories")
    if real and (not execute or max_cost <= 0 or max_calls <= 0):
        raise ValueError("Live runs require --execute, --max-cost-usd and --max-calls")
    if real:
        for model in config["models"]:
            if not os.environ.get(model["api_key_env"]):
                raise ValueError(f"Missing environment variable {model['api_key_env']}")
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    # Never retry automatically after a crash; an in-flight request could have been billed.
    lock = directory / "RUNNING.lock"
    with lock.open("x") as handle:
        handle.write(str(os.getpid()))
    try:
        return _run(tasks, rows, config, directory, real, max_cost, max_calls, repeats, seed)
    finally:
        lock.unlink()


def _run(tasks, rows, config, directory, real, max_cost, max_calls, repeats, seed):
    identity = {"rows_sha256": digest(rows), "config": config, "repeats": repeats, "seed": seed,
                "rubric": RUBRIC, "criteria": CRITERIA, "protocol": "pairwise-three-way/v1",
                "implementation_sha256": digest(b"".join(p.read_bytes() for p in
                   sorted(Path(__file__).parent.glob("*.py"))))}
    fingerprint = digest(identity)
    manifest_path = directory / "manifest.json"
    if manifest_path.exists():
        if json.loads(manifest_path.read_text())["fingerprint"] != fingerprint:
            raise ValueError("Resume rejected: data, code, model config or prompt changed")
    else:
        dump(manifest_path, {"fingerprint": fingerprint, "created_at": now(), "mock": not real,
                             "planned_calls": len(tasks), **identity})
        with (directory / "examples.jsonl").open("x") as stream:
            for row in rows:
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    attempts_path = directory / "attempts.jsonl"
    previous = load_jsonl(attempts_path) if attempts_path.exists() else []
    started = {a["request_id"] for a in previous if a["event"] == "started"}
    finished = {a["request_id"]: a for a in previous if a["event"] == "finished"}
    if started - finished.keys():
        raise ValueError("Unresolved in-flight attempt: reconcile provider billing before another run")
    if any(a.get("status") != "ok" or a.get("cost_usd") is None for a in finished.values()):
        raise ValueError("Failed/unknown-cost attempts: review billing and use a new run directory")
    spent = sum(a["cost_usd"] for a in finished.values())
    calls = len(started)
    status = "complete"
    with attempts_path.open("a") as stream, httpx.Client(follow_redirects=False) as client:
        def append(record):
            stream.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n")
            stream.flush()
            os.fsync(stream.fileno())

        for row, model, swapped, repeat in tasks:
            request_id = digest([fingerprint, row["id"], model["id"], swapped, repeat])
            if request_id in finished:
                continue
            reserve = model.get("max_request_usd", 0)
            if (max_calls and calls >= max_calls) or (real and spent + reserve > max_cost):
                status = "budget_or_call_limit"
                break
            payload = state(row, swapped)
            common = {"request_id": request_id, "example_id": row["id"], "model_id": model["id"],
                      "swapped": swapped, "repeat": repeat, "mock": not real}
            append({**common, "event": "started", "at": now(), "reserved_usd": reserve,
                    "input_sha256": digest(payload)})
            start = time.perf_counter()
            result = {**common, "event": "finished", "at": now(), "status": "error", "cost_usd": None}
            raw = None
            try:
                raw = call(client, model, payload)
                result["latency_ms"] = (time.perf_counter() - start) * 1000
                result.update(accounting(raw, {"input_usd_per_million": 0,
                                              "output_usd_per_million": 0, **model}))
                result["resolved_model"] = raw.get("model")
                result["response_sha256"] = digest(raw)
                prediction = parse_prediction(raw, "typesafe" if model["kind"] == "mock" else model["kind"],
                                              model.get("probability_mode", "none"))
                result.update(prediction)
                result["canonical_choice"] = canonical(prediction["choice"], swapped)
                if prediction["probabilities"] is not None:
                    result["canonical_probabilities"] = {canonical(k, swapped): v
                                                           for k, v in prediction["probabilities"].items()}
                result["status"] = "ok"
            except Exception as exc:
                result.setdefault("latency_ms", (time.perf_counter() - start) * 1000)
                # Never persist provider error text, headers or credentials.
                result["error_type"] = type(exc).__name__
                if isinstance(exc, httpx.HTTPStatusError):
                    result["http_status"] = exc.response.status_code
            append(result)
            calls += 1
            if result["cost_usd"] is not None:
                spent += result["cost_usd"]
            if result["status"] != "ok" or result["cost_usd"] is None:
                status = "stopped_on_error_or_unknown_cost"
                break
            if real and result["cost_usd"] > reserve:
                status = "stopped_reservation_exceeded"
                break
    summary = {"status": status, "finished_at": now(), "calls": calls,
               "known_cost_usd": spent, "max_cost_usd": max_cost, "max_calls": max_calls,
               "mock": not real}
    dump(directory / "status.json", summary)
    return summary
