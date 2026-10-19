"""SEVA.GIS x Tinker - fine-tune a small honest farm-advice model.

Adapted from the minimal supervised-learning loop in the official Tinker
Cookbook (``tinker_cookbook/recipes/sl_loop.py``). Tinker is a young API: if a
helper has been renamed in the version you installed, compare the two files.
The primitives used here are the stable core:

    ServiceClient -> create_lora_training_client -> forward_backward
    -> optim_step -> save_state -> save_weights_and_get_sampling_client

Usage:
    uv run python train_seva_advisor.py

Environment (all optional):
    SEVA_TINKER_MODEL   base model id            (default Qwen/Qwen3-8B)
    SEVA_TINKER_RANK    LoRA rank                (default 32)
    SEVA_TINKER_EPOCHS  passes over the dataset  (default 2)
    SEVA_TINKER_LR      learning rate            (default 2e-4)
    SEVA_TINKER_BATCH   examples per step        (default 4)
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import tinker
from tinker import types

DATA_FILE = Path(__file__).parent / "data" / "advice_sft.example.jsonl"
BASE_MODEL = os.environ.get("SEVA_TINKER_MODEL", "Qwen/Qwen3-8B")
LORA_RANK = int(os.environ.get("SEVA_TINKER_RANK", "32"))
EPOCHS = int(os.environ.get("SEVA_TINKER_EPOCHS", "2"))
LEARNING_RATE = float(os.environ.get("SEVA_TINKER_LR", "2e-4"))
BATCH_SIZE = int(os.environ.get("SEVA_TINKER_BATCH", "4"))

SYSTEM = (
    "You are the SEVA.GIS farm advisor. Answer in the same language the farmer "
    "used (English, Telugu or Hindi). Be honest: if data is missing, say what "
    "is missing instead of guessing. Never invent fertilizer or pesticide "
    "doses, prices or dates. Satellite findings are 'likely', not confirmed."
)


def load_examples() -> list[dict]:
    rows: list[dict] = []
    with DATA_FILE.open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            msgs = row.get("messages")
            if not msgs or len(msgs) < 2:
                raise SystemExit(f"{DATA_FILE}:{line_no}: needs at least two messages")
            rows.append(row)
    if not rows:
        raise SystemExit(f"{DATA_FILE} is empty - add a few seed examples first.")
    return rows


def encode(tokenizer, text: str, add_special_tokens: bool) -> list[int]:
    out = tokenizer(text, add_special_tokens=add_special_tokens)["input_ids"]
    if out and isinstance(out[0], list):  # some tokenizers return [[...]]
        out = out[0]
    return list(out)


def build_datum(tokenizer, example: dict) -> "types.Datum":
    """One training example: loss applies to the assistant answer only."""
    convo = [{"role": "system", "content": SYSTEM}, *example["messages"]]
    prompt = convo[-2]["content"]
    answer = convo[-1]["content"]

    prompt_ids = encode(tokenizer, prompt, add_special_tokens=True)
    answer_ids = encode(tokenizer, answer, add_special_tokens=False)
    eos = getattr(tokenizer, "eos_token_id", None)
    if eos is not None:
        answer_ids = answer_ids + [eos]

    full_ids = prompt_ids + answer_ids
    input_tokens = full_ids[:-1]
    target_tokens = full_ids[1:]
    # -1 elsewhere means "this token does not contribute to the loss"
    weights = [-1.0] * (len(prompt_ids) - 1) + [1.0] * len(answer_ids)

    return types.Datum(
        model_input=types.ModelInput.from_ints(tokens=input_tokens),
        loss_fn_inputs=dict(target_tokens=target_tokens, weights=weights),
    )


def main() -> None:
    examples = load_examples()
    print(f"Loaded {len(examples)} examples from {DATA_FILE.name}")

    service_client = tinker.ServiceClient()
    training_client = service_client.create_lora_training_client(
        base_model=BASE_MODEL, rank=LORA_RANK
    )
    tokenizer = training_client.get_tokenizer()
    data = [build_datum(tokenizer, ex) for ex in examples]

    step = 0
    for epoch in range(EPOCHS):
        for start in range(0, len(data), BATCH_SIZE):
            batch = data[start : start + BATCH_SIZE]
            fwd = training_client.forward_backward(batch, loss_fn="cross_entropy")
            opt = training_client.optim_step(types.AdamParams(learning_rate=LEARNING_RATE))
            fwd_result = fwd.result()   # waits for gradients
            opt.result()                # waits for the update
            step += 1
            loss = getattr(fwd_result, "loss", None)
            shown = f"{float(loss):.4f}" if loss is not None else "n/a"
            print(f"epoch {epoch + 1}/{EPOCHS}  step {step}  loss {shown}")

    saved = training_client.save_state(name="seva-advisor")
    try:
        path = saved.result().path
        print(f"Checkpoint saved: {path}")
    except Exception as exc:  # keep going - the sampling client below still works
        print(f"Checkpoint saved (path not readable here: {exc})")

    sampling_client = training_client.save_weights_and_get_sampling_client(name="seva-advisor")
    print("Sampling client ready for this session.")

    # Quick smoke test in English; remove or extend as you like.
    prompt = "My paddy leaves are turning yellow in patches. What should I check?"
    try:
        out = sampling_client.sample(
            prompt_token_ids=encode(tokenizer, prompt, add_special_tokens=True),
            num_samples=1,
            sampling_params=types.SamplingParams(max_tokens=200, temperature=0.7),
        ).result()
        text = tokenizer.decode(out.sequences[0].tokens)
        print("\nSample answer:\n" + text)
    except Exception as exc:
        print(f"Smoke-test sampling skipped: {exc}")

    print(
        "\nDone. Re-create this client later with "
        "tinker.ServiceClient().create_sampling_client(model_path='<checkpoint path>') "
        "or serve it through proxy.py."
    )


if __name__ == "__main__":
    main()
