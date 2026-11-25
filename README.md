# FinSentinel — Multimodal Financial Social Media Analytics Platform

A working academic research prototype that extends the paper **“Financial Social Media Analytics: A Data Mining and NLP Approach to Sentiment-Based Market Signal Extraction”** from text-only sentiment classification into **multimodal** analysis of financial social media: text, reactions, emojis, stickers/GIFs, images/memes, voice messages and videos.

> Sentiment analysis in this project describes **expressed opinion** in analysed content. It is **not** a stock-price prediction, trading signal, or financial advice.

---

## 1. What actually works (verified in this environment)

| Capability | Status | Evidence |
|---|---|---|
| Text sentiment (TF-IDF + 4 classifiers) | ✅ Working | Trained on 11,931 real tweets; metrics measured, not hardcoded |
| Model comparison + confusion matrices | ✅ Working | `/api/models/results`, 8 real runs (2 datasets × 4 models) |
| JWT auth (register/login/logout/protected routes) | ✅ Working | Verified end-to-end through the UI proxy |
| Multimodal analysis (text/image/audio/video) | ✅ Working | Each modality returns label + confidence + honest status |
| Image OCR → sentiment | ✅ Working | RapidOCR (ONNX): “NVDA earnings beat - price target raised”, 91.26 % OCR conf → positive 0.857 |
| Audio → transcript → sentiment | ✅ Working (manual transcript) | Bearish statement → negative 0.426; Whisper optional |
| Video → frames + audio + sentiment | ✅ Working | 2 frames extracted from 3 s clip; transcript classified negative |
| Late fusion with missing-modality handling | ✅ Working | Missing modalities ignored, never scored neutral |
| Dataset inspection & CSV/JSON upload | ✅ Working | Schema, class distribution, missing values, duplicates |
| Primary collection + live Cohen’s κ | ✅ Working | κ = 0.50 on a 3-record probe (correct arithmetic) |
| Stock/ticker sentiment aggregation | ✅ Working | Corpus + user analyses combined |
| PDF report + CSV export | ✅ Working | 2 KB PDF generated from live data |
| Supabase Postgres schema + RLS + Prisma | ✅ Provided | `database/schema.sql`, `database/prisma/schema.prisma` |
| Whisper transcription | ⚠️ Optional install | Not installed here (~GB, needs torch); manual-transcript fallback used |
| ffmpeg audio extraction from video | ⚠️ Optional install | Reports `audio_extraction_unavailable` when absent |
| Tesseract OCR | ➖ Not needed | RapidOCR is used instead (pure pip install) |
| Visual (meme) classifier / audio-emotion model | ❌ Not implemented | Documented as future work; CMU-MOSEI & RAVDESS referenced, not trained |
| FinBERT | ❌ Not trained | Deliberately not faked; listed as future work |
| Live social-media API collection | ❌ Not configured | Manual/upload workflow only; UI states this explicitly |

---

## 2. Datasets integrated

| Dataset | Source | Licence | Size | Role |
|---|---|---|---|---|
| **Twitter Financial News Sentiment** | [HF: zeroshot](https://huggingface.co/datasets/zeroshot/twitter-financial-news-sentiment) | MIT | 11,931 tweets (train 9,543 + valid 2,388) — labels 0=Bearish, 1=Bullish, 2=Neutral | Main training + in-domain evaluation |
| **Financial PhraseBank v1.0** | [HF: takala](https://huggingface.co/datasets/takala/financial_phrasebank) (Malo et al. 2014) | CC BY-NC-SA 3.0 | 2,264 `Sentences_AllAgree` sentences | Cross-domain evaluation — **news sentences, not social media** |
| **CMU-MOSEI** (CMU Multimodal SDK) | [GitHub](https://github.com/A2Zadeh/CMU-MultimodalSDK) | see repo | not bundled | General **emotion** reference; **not** financial sentiment |
| **RAVDESS** | [Zenodo 1188976](https://zenodo.org/records/1188976) | CC BY-NC-SA 4.0 | not bundled | General **audio emotion** reference; **not** financial voice data |

No synthetic data is substituted for any missing dataset. Uploaded files are tagged `user_upload`.

### Measured results (real runs)

**Twitter Financial News** (9,544 train / 2,387 test, stratified, seed 42, TF-IDF 1–2 grams, min_df=2)

| Model | Accuracy | Macro F1 | Train time |
|---|---|---|---|
| Multinomial NB | 73.94 % | 55.49 % | 0.015 s |
| Logistic Regression | 80.23 % | 69.60 % | 1.162 s |
| **Linear SVM** | **82.95 %** | **75.82 %** | 0.111 s |
| Random Forest | 78.72 % | 66.26 % | 9.961 s |

**Financial PhraseBank** (1,811 / 453): Linear SVM 93.82 % accuracy / 91.94 % macro-F1.
**Cross-domain:** Twitter→PhraseBank macro-F1 56.08 %; PhraseBank→Twitter 32.48 %.

> The draft paper’s ≈90 % figures came from a synthetic 1,000-post set with 12 % label noise. They are **not** reproduced here.

---

## 3. Project structure

```
financial-sentiment-platform/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app: 25+ endpoints
│   │   ├── config.py             # settings / env
│   │   ├── database.py           # SQLite layer (prototype)
│   │   ├── auth.py               # JWT + bcrypt
│   │   └── services/
│   │       ├── ml_service.py     # cleaning, TF-IDF inference, engagement, fusion
│   │       └── media_service.py  # OCR, transcription, video frames, audio extraction
│   ├── data/
│   │   ├── sent_train.csv, sent_valid.csv        # genuine Twitter dataset
│   │   ├── phrasebank_raw/…/Sentences_AllAgree.txt
│   │   ├── processed_twitter.csv, processed_phrasebank.csv
│   │   └── models/                # vectorizer.pkl, best_model.pkl, all_models.pkl, evaluation_results.json
│   ├── uploads/                   # uploaded media + generated reports
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # 1. Landing
│   │   ├── auth/page.tsx          # 2. Auth
│   │   ├── dashboard/page.tsx     # 3. Dashboard
│   │   ├── analysis/page.tsx      # 4. Multimodal Analysis
│   │   ├── datasets/page.tsx      # 5. Dataset Management
│   │   ├── models/page.tsx        # 6. Model Comparison
│   │   ├── stocks/page.tsx        # 7. Stock & Market Sentiment
│   │   ├── collection/page.tsx    # 8. Primary Collection Methodology
│   │   ├── research/page.tsx      # 9. Research Paper Comparison
│   │   └── reports/page.tsx       # 10. Reports
│   ├── components/                # AppShell, UI primitives
│   ├── lib/                       # api client, auth context
│   └── next.config.js             # /be/* → backend proxy
├── database/
│   ├── schema.sql                 # 16 tables, FKs, indexes, RLS, seed articles
│   └── prisma/schema.prisma       # Prisma models
├── scripts/train_models.py        # training + evaluation + artifact export
└── docs/methodology.md            # 21-section documentation
```

---

## 4. Setup

### Prerequisites
- Python 3.11+ (tested on 3.13)
- Node.js 18+ (tested on 20)
- ~200 MB disk for the datasets and model artifacts

### 4.1 Backend

```bash
cd financial-sentiment-platform/backend
python3 -m venv .venv && source .venv/bin/activate     # optional
pip install -r requirements.txt
cp .env.example .env                                    # then edit SECRET_KEY
```

Optional (each unlocks a modality; the app degrades honestly without them):

```bash
pip install rapidocr-onnxruntime     # OCR for images/video frames  (recommended)
pip install openai-whisper           # audio transcription (needs torch, ~1 GB)
sudo apt install ffmpeg              # audio extraction from video
pip install pytesseract              # alternative OCR (also needs tesseract binary)
```

### 4.2 Train the models (required once)

```bash
cd financial-sentiment-platform
python3 scripts/train_models.py
```

This reads `backend/data/sent_train.csv`, `sent_valid.csv` and PhraseBank’s `Sentences_AllAgree.txt`, writes `processed_*.csv`, trains all four classifiers on both datasets, runs the cross-domain experiments, and saves `backend/data/models/{vectorizer,best_model,all_models}.pkl` + `evaluation_results.json`.

Expected runtime: ~20 s on CPU. Expected output includes:

```
Linear SVM: acc=0.8295 P=0.8040 R=0.7274 F1=0.7582 train=0.11s
Best Twitter model: Linear SVM F1=0.7582
```

### 4.3 Run the backend

```bash
cd financial-sentiment-platform/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- API docs (Swagger): http://localhost:8000/docs
- Health: http://localhost:8000/api/health — reports `models_loaded`, `ocr_available`, `whisper_available`, `ffmpeg_available`

### 4.4 Run the frontend

```bash
cd financial-sentiment-platform/frontend
npm install
cp .env.example .env.local        # BACKEND_URL=http://localhost:8000
npm run dev                       # → http://localhost:3000
# production: npm run build && npm start
```

The browser only ever calls **same-origin** `/be/*`; Next.js rewrites those to `BACKEND_URL`. This is what makes the app work behind a preview proxy — do not point the browser at `localhost:8000` directly.

---

## 5. Testing every major feature

Use a fresh account, then walk the list; every step below was executed successfully during development.

1. **Auth** — `http://localhost:3000/auth` → *Register* with an email + 6+ char password. You land on the dashboard. Log out via the sidebar; visiting `/dashboard` redirects to `/auth?next=…`.
2. **Text analysis** — `/analysis` → *Text & reactions*. Paste:
   `$AAPL breaking out! Great earnings, price target raised 🚀` with a few reaction counts (like 50, love 20, angry 2) → **Analyse content**.
   Expect: sentiment *positive* (~0.81 confidence), model *Linear SVM*, ticker `AAPL`, engagement score ≈ 66 (medium), emoji signal 🚀 bullish, and a fusion explanation. → Then paste `$TSLA deliveries miss badly, guidance cut. Terrible quarter.` → *negative*.
3. **Image analysis** — upload any screenshot with text (a trading chart works best). Expect OCR text + sentiment + confidence; if no text is detected the UI says so and shows **no** sentiment.
4. **Audio** — upload a WAV/MP3 and type a manual transcript (e.g. “Apple guidance cut, expecting further downside”) → *negative* + a note that vocal emotion is not inferred.
5. **Video** — upload an MP4; the response includes duration, extracted frames, audio-extraction status and transcript-based sentiment.
6. **Datasets** — `/datasets`: click each dataset card to preview rows, class distribution, missing values, duplicates; download the processed CSV; upload a small CSV (`text,label` columns) and confirm the quality report.
7. **Model comparison** — `/models`: switch datasets, read the metrics table, click *view* on any row for its confusion matrix, inspect the training-time chart and cross-domain cards.
8. **Stocks** — `/stocks`: pick a ticker from the list (e.g. `SPY`, `TSLA`) → user counts, corpus counts, distribution chart, related messages.
9. **Primary collection** — `/collection`: add 3 records with two annotator labels; the κ KPI and badge update live (two agreeing + one disagreeing → κ = 0.50). Save the methodology form.
10. **Research** — `/research`: approach comparison matrix + the verified-articles table with DOI/arXiv links.
11. **Reports** — `/reports`: *Generate & download PDF* (contains real model metrics + your analyses), *Export CSV*, and confirm the report appears in the history table.
12. **Dashboard** — `/dashboard`: KPIs, sentiment donut, corpus distribution, modality bars, daily trend and top tickers all reflect steps 2–5.
13. **Error/empty states** — load `/dashboard` on a brand-new account (empty states appear); stop the backend and retry an action (a clear error appears — never a fake success).

---

## 6. API quick reference

```bash
# register + token
curl -s -X POST localhost:8000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"you@uni.edu","password":"secret123","full_name":"You"}' | jq -r .access_token

TOKEN=<token>

# text analysis
curl -s -X POST localhost:8000/api/analyze/text \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"text":"$NVDA earnings beat, guidance raised","reactions":{"like":120,"angry":3}}' | jq

# image / audio / video
curl -s -X POST localhost:8000/api/analyze/image -H "Authorization: Bearer $TOKEN" -F file=@chart.png -F ticker=NVDA | jq
curl -s -X POST localhost:8000/api/analyze/audio -H "Authorization: Bearer $TOKEN" -F file=@voice.wav -F manual_transcript="Bearish on TSLA" | jq
curl -s -X POST localhost:8000/api/analyze/video -H "Authorization: Bearer $TOKEN" -F file=@clip.mp4 | jq

# data, models, analytics, reports
curl -s localhost:8000/api/datasets/builtin | jq
curl -s localhost:8000/api/models/results | jq '.results[] | {model, dataset, accuracy, f1_macro}'
curl -s localhost:8000/api/stocks | jq '.[0:5]'
curl -s -H "Authorization: Bearer $TOKEN" localhost:8000/api/dashboard/stats | jq
curl -s -X POST -H "Authorization: Bearer $TOKEN" localhost:8000/api/reports/generate-pdf -o report.pdf
```

Full interactive documentation: **http://localhost:8000/docs**

Key endpoints: `/api/health`, `/api/auth/{register,login,me}`, `/api/analyze/{text,image,audio,video,multimodal}`, `/api/analyses`, `/api/datasets/{builtin,preview,upload,user,download-processed}`, `/api/models/{results,info}`, `/api/dashboard/stats`, `/api/stocks`, `/api/stocks/{ticker}`, `/api/collection/{records,methodology,agreement}`, `/api/research/articles`, `/api/reports{,/export-csv,/generate-pdf}`.

---

## 7. Production deployment (Supabase)

1. **Database** — create a Supabase project, then run `database/schema.sql` in the SQL editor (creates 16 tables, foreign keys, indexes, RLS policies, and seeds verified research articles). Create Storage buckets `media` and `reports`.
2. **Prisma (optional)** — `cd database && npm i -D prisma && npm i @prisma/client`, set `DATABASE_URL` (pooled, `?pgbouncer=true`) and `DIRECT_URL` (direct), then `npx prisma migrate dev --name init`.
3. **Auth** — switch `backend/app/auth.py` to verify Supabase JWTs (Supabase Auth issues them; `auth.users` ↔ `public.users` mirror is already in the schema). The local JWT path stays for offline demos.
4. **Storage** — replace `_save_upload()` in `backend/app/main.py` with a Supabase Storage upload; store the returned object path in `media_uploads.storage_path` (never bytes in a row).
5. **Backend** — deploy to Render/Fly/Railway with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; set `SECRET_KEY`, `DATABASE_URL`, `SUPABASE_*`. Runs the training script on first deploy, or commit `data/models/*.pkl`.
6. **Frontend** — deploy to Vercel; set `BACKEND_URL` to the deployed API origin. Keep the `/be/*` rewrite so the browser stays same-origin.
7. **Checklist** — rotate `SECRET_KEY`, disable verbose errors, verify RLS with a second account, cap upload sizes (`MAX_UPLOAD_MB`), and enable API rate limiting.

---

## 8. Remaining limitations

- **No financial multimodal ground truth exists**, so multimodal *accuracy* cannot be measured — only per-modality demonstrations with real confidences.
- **No live social-media API**: collection is manual/upload; the UI says so rather than pretending.
- **No visual-semantic classifier** (memes without text return `unknown`) and **no audio-emotion model** (excited voice is never read as bullish).
- **Whisper / ffmpeg are optional**; without them audio/video rely on manual transcripts, flagged in the UI.
- **FinBERT is not trained** — reported as future work, with no invented numbers.
- Text models are trained on tweets; news-register and sarcastic text transfer imperfectly (measured cross-domain: macro-F1 56.08 % / 32.48 %).
- Engagement score is a transparent heuristic (log-scaled weighted reactions), not a learned model.
- Local prototype uses SQLite + JWT; Supabase Auth/RLS is specified for production but not exercised here.
- Single 80:20 split with one seed — no k-fold cross-validation or significance testing yet.
- Pilot-scale primary data: κ is computed correctly but on small samples, and is **not** equivalent to the paper’s 1,500–3,000/class target.

---

## 9. Documentation

Full 21-section write-up — abstract, introduction, problem statement, objectives, existing vs proposed system, literature review, research gap, architecture, datasets, secondary/primary collection, preprocessing, feature extraction, algorithms, multimodal processing, evaluation, results, limitations, future work, references — with every claim tagged **[PAPER] / [EXTENSION] / [MEASURED] / [FUTURE]**:

**→ [`docs/methodology.md`](docs/methodology.md)**

---

*Academic research prototype. Datasets are used under their original licences (MIT; CC BY-NC-SA 3.0 — PhraseBank is non-commercial). Sentiment output is not financial advice.*
