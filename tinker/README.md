# SEVA.GIS × Tinker — optional fine-tuning kit

**What is Tinker?** Tinker is a training API by Thinking Machines Lab
(thinkingmachines.ai): you write a small Python loop on your own computer, and
Tinker runs the heavy LoRA fine-tuning on their GPUs. You do not need a GPU and
you do not manage servers. Every fine-tune produces a *LoRA adapter* on top of
an open-weight base model (Qwen, Llama and others, 1B to 1T+ parameters).

**Why would SEVA.GIS use it?** To teach a small open model to answer farmer
questions in SEVA.GIS's own honest voice — English, Telugu and Hindi — using
only the advice text this repository already ships (no invented doses, no
weather guesses, "Data unavailable" when unclear). This folder is the whole
kit: dataset builder guidance, training script and an optional local proxy.

**This is a developer tool, not a user feature yet.** The public web app stays
keyless and serverless. Nothing here runs unless *you* run it.

## 0. What the $10 credit covers

Tinker bills per training token and per sampling token. Fine-tuning a small
dataset (a few hundred short pairs, 1-3 epochs) on a 1B–8B base model costs
**cents to low dollars** — the $10 trial credit is plenty for several
experiments. Check current prices in the Model Lineup on the Tinker docs
(tinker-docs.thinkingmachines.ai).

## 1. One-time setup

```bash
uv init tinker-seva-gis
cd tinker-seva-gis
uv add tinker tinker-cookbook transformers torch datasets
uv run tinker auth login    # then paste your Tinker API key when asked
```

The key is stored in your user profile by the Tinker CLI. Never commit it,
never paste it into the app, and never put it in this repository.

## 2. Build the dataset (JSONL)

Each line of `data/advice_sft.example.jsonl` is one training example:

```json
{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```

A good SEVA.GIS dataset has three aims:

1. **Voice** — short, warm, plain sentences; numbers only when the user's
   question contains them; otherwise "Data unavailable".
2. **Languages** — the same intent in English, Telugu and Hindi.
3. **Safety** — never invent fertilizer or spray doses. Point to a soil test
   or an agronomist instead.

Grow the file by adding real questions you have collected (with the person's
consent) and the exact advice the app would give. The seed file here has 12
short examples in all three languages. Around 200–1000 examples is a good
first target.

## 3. Train

```bash
uv run python train_seva_advisor.py
```

Environment variables (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `SEVA_TINKER_MODEL` | `Qwen/Qwen3-8B` | Base model (see Tinker Model Lineup) |
| `SEVA_TINKER_RANK` | `32` | LoRA rank |
| `SEVA_TINKER_EPOCHS` | `2` | Passes over the dataset |
| `SEVA_TINKER_LR` | `2e-4` | Learning rate |
| `TINKER_API_KEY` | — | Falls back to the key saved by `tinker auth login` |

The script prints the loss per step and finishes by saving a checkpoint and a
sampling client. Training a small dataset takes minutes.

> The script follows the minimal supervised-learning loop from the official
> Tinker Cookbook (`tinker_cookbook/recipes/sl_loop.py`). Tinker is a young
> API — if a helper has been renamed in the version you installed, compare the
> two files; the primitives used here (`forward_backward`, `optim_step`,
> `save_state`, `save_weights_and_get_sampling_client`) are the stable core.

## 4. Try the model

The training run prints a **sampling client** and a **checkpoint path**
(`tinker://...`). Then test from Python:

```python
import tinker
sc = tinker.ServiceClient()
client = sc.create_sampling_client(model_path="<checkpoint path printed above>")
out = client.sample(prompt_token_ids=..., num_samples=1, sampling_params=...)
```

Or serve it to your own apps with the optional proxy:

```bash
uv add fastapi uvicorn
set SEVA_TINKER_CHECKPOINT=tinker://...   (PowerShell: $env:SEVA_TINKER_CHECKPOINT="...")
uv run uvicorn proxy:app --port 8788
```

`proxy.py` holds the Tinker key on the server side. The web app must never
receive it. A future SEVA.GIS panel can talk to this proxy only when a
deployment explicitly configures it; when it is not configured the panel must
say "Data unavailable — advisor not configured", never fake an answer.

## 5. Rules this kit follows (and you should too)

- No synthetic training pairs pretending to be real farmer questions.
- No doses, costs or dates in answers unless they came from real data.
- Telemetry stays off; nothing in this folder phones home except Tinker itself
  during training/sampling.
- Commit the scripts and the seed dataset. Never commit keys, checkpoints or
  `.env` files.

## Licence notes

- `tinker` and `tinker-cookbook` are Thinking Machines Lab projects under
  their own licences — check them before redistribution.
- Base model licences (Qwen, Llama, ...) apply to any fine-tuned model you
  create. Record the chosen base model in `CREDITS.md` if SEVA.GIS ever ships
  an advisor built this way.
