# Export manifest

Generated export of the **FinSentinel — Multimodal Financial Social Media Analytics Platform** project.

## Included

| Path | Contents |
|---|---|
| `README.md` | Setup, run, test checklist, API reference, deployment, limitations |
| `backend/app/` | FastAPI app (`main.py`, `auth.py`, `config.py`, `database.py`, `services/ml_service.py`, `services/media_service.py`) |
| `backend/data/` | Genuine datasets + artifacts: `sent_train.csv`, `sent_valid.csv` (Twitter Financial News, MIT), `FinancialPhraseBank-v1.0.zip` + extracted `phrasebank_raw/`, processed `processed_*.csv`, trained `models/{vectorizer,best_model}.pkl` + `evaluation_results.json` |
| `backend/uploads/` | Runtime media storage — intentionally empty (see its README.md) |
| `backend/requirements.txt` | Python dependencies (core + optional modality packages, commented) |
| `backend/.env.example` | Backend environment template |
| `frontend/app/` | All 10 pages (landing, auth, dashboard, analysis, datasets, models, stocks, collection, research, reports) + `globals.css`, `layout.tsx` |
| `frontend/components/` | `AppShell.tsx`, `ui.tsx` |
| `frontend/lib/` | `api.ts` (client), `auth.tsx` (context + route guard) |
| `frontend/*.json|js|ts` | `package.json`, `package-lock.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js` |
| `frontend/.env.example` | Frontend environment template |
| `database/schema.sql` | 16 tables, FKs, indexes, RLS policies, Storage buckets, seeded verified articles |
| `database/prisma/schema.prisma` | Prisma models for the Postgres/Supabase deployment |
| `scripts/train_models.py` | Training + evaluation + artifact export (reproduces every reported metric) |
| `docs/methodology.md` | 21-section documentation tagged [PAPER] / [EXTENSION] / [MEASURED] / [FUTURE] |
| `paper/` | The uploaded research paper draft this project is based on |

## Deliberately excluded

- `node_modules/` — restore with `npm install`
- `.next/` — Next.js build output; regenerate with `npm run build`
- `__pycache__/`, `*.pyc` — Python bytecode caches
- virtualenvs (`.venv/`, `venv/`)
- real secret env files (`.env`, `.env.local`) — only the `.env.example` templates are shipped
- `backend/financial_platform.db` — local SQLite database with throwaway test accounts; **auto-created on first backend start**
- uploaded test media and generated PDF/CSV reports from my smoke tests (empty `backend/uploads/` shipped instead)

## Run it

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
cp .env.example .env            # then set SECRET_KEY
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Models (artifacts are included, but this reproduces every metric from scratch)
cd .. && python3 scripts/train_models.py

# 3. Frontend
cd frontend
npm install
cp .env.example .env.local      # BACKEND_URL=http://localhost:8000
npm run dev                     # http://localhost:3000
```

Optional wheels that unlock extra modalities (the app degrades honestly without them):

```bash
pip install rapidocr-onnxruntime   # OCR for images / video frames
pip install openai-whisper         # audio transcription (needs torch)
sudo apt install ffmpeg            # audio extraction from video
```

Verified state at export time: `models_loaded=true`, `ocr_available=true`,
`whisper_available=false`, `ffmpeg_available=false`.

Sentiment output describes expressed opinion — it is **not** a stock-price prediction or financial advice.
