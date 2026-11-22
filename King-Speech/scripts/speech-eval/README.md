# Speech analysis: speed settings and model comparison

## What the server does now
- Transcribes the upload as it arrives (m4a / webm / mp3 / wav / ogg) — no
  WAV conversion; falls back to converting if the API refuses a file.
- Measures loudness in parallel with transcription, as mono 16 kHz — the same
  numbers the old convert-then-measure path gave.
- Interview levels: `/api/transcribe` with `{ interview: true }` also returns
  the logic/eloquence judgement (one request instead of two).
- Logs one `[timing]` line per request: `stt`, `loud`, `llm`, `total`.

## Environment switches (all optional — unset = previous behaviour)
| Variable | Effect |
|---|---|
| `ANALYSIS_MODEL` | Model for Show Time feedback and interview scoring (e.g. `claude-haiku-5-5`). |
| `ANALYSIS_EFFORT` | `low` / `medium` / `high`; defaults to `low` when `ANALYSIS_MODEL` is set. |
| `STT_MODEL` | Transcription model (default `gpt-4o-transcribe`). |
| `SAVE_EVAL_AUDIO=1` | Save every analysed attempt to `eval-audio/` (git-ignored) for comparison. |

## Comparing models on real attempts
1. Run the API server with `SAVE_EVAL_AUDIO=1` and play some levels (ru and kk).
2. `node scripts/speech-eval/compare.js` (or name candidates: `haiku sonnet mini-stt`).
3. Read `eval-audio/reports/compare-*.md`: `baseline-again` is the current
   setup run twice — its difference is the natural wobble. A candidate whose
   difference is about the same, with feedback that reads as well, is safe.

Every run makes paid API calls: attempts × (2 + candidates).
