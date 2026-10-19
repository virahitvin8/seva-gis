"""Optional local proxy: serve a fine-tuned SEVA.GIS advisor to your own apps.

The Tinker API key stays on this machine/server. No SEVA.GIS deployment may
ship the key to a browser.

Run:
    uv add fastapi uvicorn transformers
    $env:SEVA_TINKER_CHECKPOINT = "tinker://..."   # printed by train_seva_advisor.py
    uv run uvicorn proxy:app --port 8788

Then POST http://127.0.0.1:8788/advice with {"question": "...", "language": "en"}.

When SEVA_TINKER_CHECKPOINT is not set, every /advice call returns 503 with a
plain reason. A future app panel must display that reason - never fake an answer.
"""

from __future__ import annotations

import os

import tinker
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from tinker import types

CHECKPOINT = os.environ.get("SEVA_TINKER_CHECKPOINT", "")
BASE_MODEL = os.environ.get("SEVA_TINKER_MODEL", "Qwen/Qwen3-8B")

SYSTEM = (
    "You are the SEVA.GIS farm advisor. Answer in the same language the farmer "
    "used (English, Telugu or Hindi). Be honest: if data is missing, say what "
    "is missing instead of guessing. Never invent fertilizer or pesticide "
    "doses, prices or dates. Satellite findings are 'likely', not confirmed."
)

app = FastAPI(title="SEVA.GIS Tinker advisor proxy")

_sampling_client = None
_tokenizer = None


class Ask(BaseModel):
    question: str
    language: str = "en"


def _get_clients():
    global _sampling_client, _tokenizer
    if not CHECKPOINT:
        raise HTTPException(
            status_code=503,
            detail="Advisor not configured. Set SEVA_TINKER_CHECKPOINT to the checkpoint path printed by train_seva_advisor.py.",
        )
    if _sampling_client is None:
        service_client = tinker.ServiceClient()
        _sampling_client = service_client.create_sampling_client(model_path=CHECKPOINT)
    if _tokenizer is None:
        from transformers import AutoTokenizer

        _tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    return _sampling_client, _tokenizer


@app.get("/health")
def health() -> dict:
    return {"ok": True, "configured": bool(CHECKPOINT), "base_model": BASE_MODEL}


@app.post("/advice")
def advice(req: Ask) -> dict:
    client, tokenizer = _get_clients()
    prompt_ids = tokenizer(f"{SYSTEM}\n\nFarmer ({req.language}): {req.question}\nAdvisor ({req.language}):", add_special_tokens=True)["input_ids"]
    result = client.sample(
        prompt_token_ids=list(prompt_ids),
        num_samples=1,
        sampling_params=types.SamplingParams(max_tokens=300, temperature=0.7),
    ).result()
    text = tokenizer.decode(result.sequences[0].tokens)
    return {"answer": text, "source": "SEVA.GIS advisor (Tinker checkpoint)", "checkpoint": CHECKPOINT}
