"""Direct TypeSafe and configurable OpenAI-compatible HTTP transports; no implicit retries."""
from __future__ import annotations

import json
import math
import os
from urllib.parse import urlparse

import httpx

from .data import digest
from .contracts import SHARED

LABELS = ("A", "B", "TIE")
_SHARED_RUBRIC = json.loads((SHARED / "rubric.json").read_text())
PROMPT_VERSION = _SHARED_RUBRIC["version"]
RUBRIC = (
    "The original question is user_prompt; the candidate answers are response_A and response_B. "
    + _SHARED_RUBRIC["comparison"]
    + " Map Answer 1 to A, Answer 2 to B, and an equal-quality judgment to TIE."
)
CRITERIA = {"A": "Response A is better under the evaluation rubric.",
            "B": "Response B is better under the evaluation rubric.",
            "TIE": "Both responses have equivalent quality under the evaluation rubric."}


def validate_config(config):
    if not isinstance(config, dict) or not config.get("models"):
        raise ValueError("Config requires models")
    names = set()
    allowed = {"id", "kind", "model", "endpoint", "api_key_env", "timeout_seconds",
               "input_usd_per_million", "output_usd_per_million", "max_request_usd",
               "max_output_tokens", "output_token_field", "extra_body", "probability_mode",
               "pricing_source", "pricing_checked_at"}
    for model in config["models"]:
        if set(model) - allowed:
            raise ValueError("Unknown model config fields (credentials must be environment variables)")
        if model["id"] in names:
            raise ValueError("Duplicate model id")
        names.add(model["id"])
        if model["kind"] not in ("typesafe", "chat", "mock"):
            raise ValueError("Unsupported provider kind")
        if model.get("probability_mode", "none") not in ("none", "self_reported"):
            raise ValueError("Unknown probability mode")
        if model["kind"] == "mock":
            continue
        url = urlparse(model["endpoint"])
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("Use an HTTPS endpoint without credentials, query or fragment")
        if model["kind"] == "typesafe" and model["endpoint"] != "https://api.typesafe.ai/v1/systemone":
            raise ValueError("Direct TypeSafe adapter requires its official endpoint")
        if not model.get("model") or not model.get("api_key_env"):
            raise ValueError("Model and API key environment variable name required")
        for field in ("max_request_usd", "input_usd_per_million", "output_usd_per_million"):
            value = model.get(field)
            if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
                raise ValueError(f"Set an explicit non-negative {field} for {model['id']}")
        if model["max_request_usd"] <= 0:
            raise ValueError("Per-request USD reservation must be positive")
        if model.get("timeout_seconds", 90) <= 0:
            raise ValueError("Timeout must be positive")
        if model["kind"] == "chat" and model.get("max_output_tokens", 256) <= 0:
            raise ValueError("Output token cap must be positive")
        extras = model.get("extra_body", {})
        if set(extras) - {"temperature", "reasoning_effort", "provider"}:
            raise ValueError("extra_body supports temperature, reasoning_effort and provider only")
    return config


def request_body(model, state):
    if model["kind"] == "typesafe":
        return {"model": model["model"], "state": state,
                "questions": {"verdict": {"type": "choice", "instructions": RUBRIC,
                                            "criteria": CRITERIA}}}
    instruction = RUBRIC + '\nReturn only a JSON object: {"choice":"A"|"B"|"TIE"}.'
    if model.get("probability_mode") == "self_reported":
        instruction += (' Also include "probabilities": {"A":number,"B":number,"TIE":number}, '
                        'nonnegative and summing to 1. These are your estimated probabilities.')
    token_field = model.get("output_token_field", "max_tokens")
    if token_field not in ("max_tokens", "max_completion_tokens"):
        raise ValueError("Invalid output token field")
    return {"model": model.get("model", "mock"),
            "messages": [{"role": "system", "content": instruction},
                         {"role": "user", "content": json.dumps(state, ensure_ascii=False)}],
            "response_format": {"type": "json_object"},
            token_field: model.get("max_output_tokens", 256), **model.get("extra_body", {})}


def probability(value):
    if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1:
        raise ValueError("Invalid probability")
    return float(value)


def parse_prediction(raw, kind, mode="none"):
    answer = raw["answers"]["verdict"] if kind == "typesafe" else json.loads(
        raw["choices"][0]["message"]["content"])
    if not isinstance(answer, dict) or answer.get("choice") not in LABELS:
        raise ValueError("Invalid choice")
    probs = answer.get("probabilities") if kind == "typesafe" or mode == "self_reported" else None
    if kind == "typesafe" or mode == "self_reported":
        if not isinstance(probs, dict) or set(probs) != set(LABELS):
            raise ValueError("Expected full probability distribution")
        probs = {key: probability(value) for key, value in probs.items()}
        if abs(sum(probs.values()) - 1) > 0.001:
            raise ValueError("Probabilities do not sum to one")
        if probs[answer["choice"]] < max(probs.values()) - 1e-6:
            raise ValueError("Choice contradicts probability argmax")
    confidence = answer.get("confidence") if kind == "typesafe" else None
    if confidence is not None:
        confidence = probability(confidence)
    return {"choice": answer["choice"], "probabilities": probs, "provider_confidence": confidence,
            "probability_source": "native" if kind == "typesafe" else mode}


def accounting(raw, model):
    usage = raw.get("usage", {})
    input_tokens = usage.get("input_tokens", usage.get("prompt_tokens"))
    output_tokens = usage.get("output_tokens", usage.get("completion_tokens"))
    for value in (input_tokens, output_tokens):
        if value is not None and (type(value) is not int or value < 0):
            raise ValueError("Invalid token accounting")
    reported = usage.get("cost")
    if reported is not None and (type(reported) not in (int, float) or not math.isfinite(reported) or reported < 0):
        raise ValueError("Invalid reported cost")
    estimate = None
    if input_tokens is not None and output_tokens is not None:
        estimate = (input_tokens * model["input_usd_per_million"] +
                    output_tokens * model["output_usd_per_million"]) / 1_000_000
    return {"input_tokens": input_tokens, "output_tokens": output_tokens,
            "reported_cost_usd": reported, "estimated_cost_usd": estimate,
            "cost_usd": reported if reported is not None else estimate,
            "cost_basis": "provider_reported" if reported is not None else "list_price_estimate",
            "cached_input_tokens": usage.get("prompt_tokens_details", {}).get("cached_tokens"),
            "reasoning_tokens": usage.get("completion_tokens_details", {}).get("reasoning_tokens")}


def call(client, model, state):
    if model["kind"] == "mock":
        # Deliberately uses only the label-free input. Not a model, never evidence of capability.
        choice = LABELS[int(digest(state)[:8], 16) % 3]
        probs = {label: 0.8 if label == choice else 0.1 for label in LABELS}
        raw = {"model": "MOCK-NOT-A-MODEL", "answers": {"verdict":
               {"choice": choice, "probabilities": probs, "confidence": 0.7}},
               "usage": {"input_tokens": 0, "output_tokens": 0, "cost": 0}}
        return raw
    key = os.environ.get(model["api_key_env"], "")
    if not key:
        raise ValueError(f"Missing environment variable {model['api_key_env']}")
    response = client.post(model["endpoint"], json=request_body(model, state),
                           headers={"Authorization": "Bearer " + key},
                           timeout=model.get("timeout_seconds", 90))
    response.raise_for_status()
    return response.json()
