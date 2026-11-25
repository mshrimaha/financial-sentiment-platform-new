# Project Documentation — Multimodal Financial Social Media Analytics Platform

**Base paper:** “Financial Social Media Analytics: A Data Mining and NLP Approach to Sentiment-Based Market Signal Extraction” (draft, target JOIV).

**This project:** implements the paper’s text baseline with genuine data, then extends it into a multimodal prototype covering reactions, emojis, stickers/GIFs, images/memes, audio and video.

> **Provenance legend used throughout this document**
> **[PAPER]** — taken from the uploaded research paper draft.
> **[EXTENSION]** — added by this project, not proven by the paper.
> **[MEASURED]** — an actual result produced by this codebase in this environment.
> **[FUTURE]** — described but not implemented/available here.

---

## 1. Abstract

**[PAPER]** The original study extracts market signals from financial social-media text using TF-IDF features and four classical classifiers (Multinomial Naive Bayes, Logistic Regression, Linear SVM, Random Forest), evaluating with accuracy, precision, recall and macro-F1 on an 80:20 stratified split.

**[EXTENSION]** This project implements that pipeline against **genuine public corpora** and extends it to a **multimodal** platform. Financial sentiment (bullish/bearish/neutral) is treated as a distinct construct from **emotional expression** and **engagement**. Text, reactions/emoji, stickers/GIFs, images/memes, voice messages and videos each pass through their own processing pipeline; a **late-fusion** layer combines only the modalities that actually produced a prediction, weighted by real model confidence, and refuses to treat absent modalities as neutral.

**[MEASURED]** Best classical model in this environment: **Linear SVM**, accuracy **82.95 %**, macro-F1 **75.82 %** on the Twitter Financial News Sentiment corpus (2,387 held-out tweets); on Financial PhraseBank AllAgree, accuracy **93.82 %**, macro-F1 **91.94 %** (453 held-out sentences). Cross-domain transfer degrades sharply (macro-F1 56.08 % Twitter→PhraseBank; 32.48 % PhraseBank→Twitter), quantifying the domain gap.

---

## 2. Introduction

**[PAPER]** Retail investors increasingly express opinions on social platforms before and after market events. Extracting directional sentiment from these posts can produce aggregate market signals.

**[EXTENSION]** Real social posts are rarely text-only. A single post may contain a caption, emoji, a reaction row, a meme, a voice note, or a short video. A text-only system discards most of the signal — and, worse, may mislabel *engagement* (likes, laughter) as *bullishness*. This project therefore:

1. Reproduces the paper’s text baseline faithfully with real data.
2. Adds five further content types, each with its own analyser.
3. Keeps financial opinion, emotion and engagement on **separate axes**.
4. Fuses available modality predictions with confidence-weighted late fusion.
5. Provides primary-collection and annotation tooling (with live Cohen’s κ) plus report export.

---

## 3. Problem statement

**[PAPER]** Given a financial social-media post, classify its sentiment as positive, negative or neutral, and aggregate this to stock-level and market-level signals.

**[EXTENSION]** The problem statement is broadened to: given any social-media artefact (text, reaction set, sticker, image, audio, video), determine (a) the *financial opinion* it expresses, (b) the *emotion* it conveys, and (c) its *engagement* level — and combine (a) across available modalities while reporting (b) and (c) as explicitly separate information.

Two failure modes must be avoided:
- **Semantic conflation** — treating a laughing emoji or an angry reaction as a bullish/bearish label.
- **Fabrication** — reporting a confidence, an accuracy, or a “successful” analysis when the underlying processor did not run.

---

## 4. Objectives

**[PAPER]**
1. Preprocess financial social-media text (lowercasing, URL/mention removal with `$TICKER` retention, stop-word handling, tokenisation).
2. Extract TF-IDF unigram + bigram features.
3. Train and compare four classifiers.
4. Evaluate with accuracy, precision, recall, macro-F1 and confusion matrices.
5. Derive ticker-level sentiment aggregates.

**[EXTENSION]**
6. Accept and analyse images, stickers/GIFs, audio and video alongside text.
7. Separate financial sentiment, emotion and engagement in both computation and presentation.
8. Implement late fusion that handles missing modalities without imputing neutrality.
9. Integrate genuine secondary datasets with verified licences and inspect their real schemas.
10. Provide a documented primary-data collection workflow with two-annotator labelling and κ.
11. Persist everything in a relational schema with ownership and RLS policies; export PDF/CSV.

---

## 5. Existing system

**[PAPER]** A single-modality pipeline: cleaned text → TF-IDF → one of four classifiers → label + metrics. Evaluation used a **synthetic** 1,000-post corpus (349/335/316 class split) with **12 % injected label noise**; the reported ≈0.90 accuracy in the draft is **illustrative and not a real-world result**.

**[EXTENSION — stated limitation]** Any system that reports only text sentiment cannot distinguish “this stock is going down” (bearish opinion) from “😡” (anger at a company) from “1.2k likes” (engagement). It also cannot ingest the media that dominate social feeds. Finally, the existing design had no storage layer, no per-modality provenance, and no primary-collection tooling.

---

## 6. Proposed system

**[EXTENSION]** A full-stack platform:

| Layer | Implementation |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS + Recharts + Lucide, 10 pages, responsive |
| Backend | FastAPI (Python 3.13), REST, JWT auth (bcrypt), Pydantic validation |
| Database | SQLite for the local prototype; Supabase PostgreSQL schema + Prisma models + RLS for production |
| ML | scikit-learn TF-IDF + 4 classifiers; joblib/pickle artifacts; real metrics persisted |
| Vision | OpenCV (frames, basic image statistics) + RapidOCR (ONNX) or Tesseract for text-in-image |
| Audio | Whisper (optional install) with manual-transcript fallback; ffmpeg for video audio |
| Fusion | Confidence-weighted late fusion, modality-availability aware |

Data flow: **ingest → per-modality processors → per-modality result (label, confidence, status) → fusion → persistence → dashboards/reports**.

---

## 7. Literature review

Only verified sources are used. Unverified entries are excluded; anything missing is marked *Not reported*.

| Work | Year | Contribution | Relevance / limitation |
|---|---|---|---|
| Bollen, Mao & Zeng, *Twitter mood predicts the stock market*, J. Computational Science ([DOI](https://doi.org/10.1016/j.jocs.2011.02.001)) | 2011 | Aggregated Twitter mood (OpinionFinder, GPOMS) showed directional signal for DJIA | General mood, not finance-specific opinion; lexicon-based |
| Loughran & McDonald, *When is a liability not a liability?*, Journal of Finance ([DOI](https://doi.org/10.1111/j.1540-6261.2010.00395.x)) | 2011 | Finance-specific sentiment lexicon | Shows general lexicons misclassify finance vocabulary; lexicon only |
| Malo et al., *Good debt or bad debt*, JASIST ([DOI](https://doi.org/10.1002/asi.23258)) | 2014 | Financial PhraseBank benchmark, 16 annotators | News sentences, not social media; small |
| Vaswani et al., *Attention is all you need*, NeurIPS ([arXiv](https://arxiv.org/abs/1706.03762)) | 2017 | Transformer architecture | Background only |
| Devlin et al., *BERT*, NAACL-HLT ([arXiv](https://arxiv.org/abs/1810.04805)) | 2019 | Pre-trained bidirectional transformer | Background for FinBERT |
| Araci, *FinBERT*, ([arXiv:1908.10063](https://arxiv.org/abs/1908.10063)) | 2019 | Financial domain transformer fine-tuning outperforms bag-of-words baselines | Compute-heavy; **not trained in this prototype** |

**[PAPER — correction]** The draft’s reference list contained placeholders ([2], [3], [8]–[20]). Those are **not** reproduced as real publications. The comparison page marks verification status explicitly.

---

## 8. Research gap

**[PAPER + EXTENSION]** Four gaps motivate the extension:

1. **Modality gap** — financial sentiment literature is overwhelmingly text-only (tweets, filings, news), while actual social content is multimodal.
2. **Construct conflation** — engagement (likes, laughs) and emotion (anger, excitement) are frequently folded into “sentiment”, which is invalid for financial decisions.
3. **Evaluation authenticity** — illustrative synthetic results are common; reproducible runs against public corpora with licences and split details are rarer.
4. **Primary-data rigour** — annotation guidelines, two-annotator labelling and κ are often asserted but not implemented.

**[MEASURED gap evidence]** The cross-domain experiment in this project (macro-F1 dropping from 75.82 % in-domain to 56.08 % out-of-domain) shows that even *within* text, domain transfer is fragile — reinforcing the need for explicit modality and domain reporting.

---

## 9. System architecture

```
                 ┌───────────────────────────────────────────────┐
 Browser         │ Next.js 14 (App Router, TS, Tailwind, Recharts)│
 (same-origin)   │  10 pages · auth context · /be/* proxy        │
                 └───────────────────┬───────────────────────────┘
                                     │  HTTP (JSON / multipart)
                 ┌───────────────────▼───────────────────────────┐
                 │ FastAPI  app/main.py                          │
                 │  auth · datasets · analyze · models · stocks   │
                 │  collection · research · reports               │
                 └───┬─────────────┬──────────────┬──────────────┘
                     │             │              │
        ┌────────────▼───┐  ┌──────▼───────┐  ┌───▼─────────────┐
        │ ml_service     │  │ media_service│  │ database (SQLite │
        │ TF-IDF + 4 clf │  │ OCR / audio  │  │ → Supabase PG)   │
        │ fusion engine  │  │ / video      │  │ 16 tables + RLS  │
        └────────┬───────┘  └──────┬───────┘  └─────────────────┘
                 │                 │
        ┌────────▼───────┐  ┌──────▼──────────────────────────┐
        │ data/models/*  │  │ uploads/  (+ Supabase Storage   │
        │ vectorizer,pkl │  │  in production)                 │
        └────────────────┘  └─────────────────────────────────┘
```

**[EXTENSION]** Key architectural decisions: (a) the browser never calls `localhost` — Next rewrites `/be/*` to the backend; (b) media files are stored on disk/Storage with DB references only; (c) every processor returns an explicit `status`, and failures propagate to the UI instead of being hidden.

---

## 10. Dataset description

**[MEASURED — inspected from the actual files]**

### 10.1 Twitter Financial News Sentiment (main corpus)
- **Source:** https://huggingface.co/datasets/zeroshot/twitter-financial-news-sentiment
- **License:** MIT (verified via Hugging Face API)
- **Files used:** `sent_train.csv` (9,543 rows), `sent_valid.csv` (2,388 rows) → combined **11,931**
- **Columns:** `text` (string), `label` (int)
- **Labels:** `0 = Bearish` (negative), `1 = Bullish` (positive), `2 = Neutral`
- **Distribution:** neutral 7,744 (64.9 %), positive 2,398 (20.1 %), negative 1,789 (15.0 %)
- **Role:** main training and in-domain evaluation corpus.

### 10.2 Financial PhraseBank v1.0 (cross-domain corpus)
- **Source:** https://huggingface.co/datasets/takala/financial_phrasebank · **Original archive** `FinancialPhraseBank-v1.0.zip` (downloaded from the HF file listing)
- **License:** CC BY-NC-SA 3.0
- **File used:** `Sentences_AllAgree.txt` (100 % annotator agreement)
- **Format:** `sentence@label` (`positive` / `negative` / `neutral`)
- **Rows:** **2,264** — neutral 1,391, positive 570, negative 303
- **⚠️ Important:** these are **financial news sentences**, not social-media posts, reactions, images or voice. Used only for cross-domain evaluation; never described as social media.

### 10.3 CMU-MOSEI (via CMU Multimodal SDK) — referenced, not bundled
- **Source:** https://github.com/A2Zadeh/CMU-MultimodalSDK
- **Nature:** general **multimodal emotion** corpus (language + visual + acoustic).
- **⚠️ Constraint:** its labels are *not* bullish/bearish financial sentiment. Not downloaded here (large); reserved for clearly-labelled modality demonstrations. **[FUTURE]**

### 10.4 RAVDESS — referenced, not bundled
- **Source:** https://zenodo.org/records/1188976
- **Nature:** general **audio emotion** dataset (acted emotional speech).
- **⚠️ Constraint:** it is **not** a financial voice-message dataset. Would support an audio-emotion classifier only as a general emotion model. **[FUTURE]**

### 10.5 User uploads (fallback)
CSV/JSON datasets, and image/audio/video media, can be uploaded through the UI. Uploaded datasets are inspected (text/label column detection, class distribution, missing values, duplicates) and stored with provenance `user_upload` / `user-provided`. Sample rows are never relabelled as real research data.

---

## 11. Secondary-data collection

**[EXTENSION — procedure actually followed]**

1. Locate candidate datasets via Hugging Face Hub / Zenodo / official project pages.
2. Verify availability and licence through the Hugging Face API or the archive’s `License.txt` **before** integration.
3. Download original files (CSV splits for Twitter; the official ZIP for PhraseBank — the parquet/`datasets` route failed because PhraseBank still ships a loader script).
4. Parse and validate: row counts, column names, label vocabularies, class balance, encoding errors.
5. Record source URL, licence, row count and label mapping in `datasets` metadata (surfaced in the UI).
6. Remove/flag duplicates and missing values; save processed artefacts as `backend/data/processed_*.csv`.
7. Log which models were trained on which dataset (`model_training_runs` ↔ `datasets`).

No synthetic data was substituted for any missing source. Nothing was scraped.

---

## 12. Primary-data collection procedure

**[PAPER]** Target 1,500–3,000 labelled posts *per class*; at least two annotators; inter-annotator agreement; ethics/IRB; platform Terms-of-Service compliance.

**[EXTENSION — implemented workflow]** The application provides a **manual / upload-based** collection workspace (no live API is configured — the UI states this explicitly):

| Step | Implementation |
|---|---|
| 1. Choose topics/tickers | Ticker field + keyword list in the methodology form |
| 2. Define period & sampling | Date range, sampling description, target-size field |
| 3. Collect only permitted content | Platform selector includes “permitted access”; ethics field is mandatory in the form |
| 4. Store content + metadata | `collection_records`: platform, text, ticker, timestamp, media type, source identifier |
| 5. Consent for participant media | `consent_obtained` flag in the schema; consent statement in ethics field |
| 6. Anonymise | `is_anonymised` default true; guidance to strip handles/URLs |
| 7. Two independent annotators | Two label fields (A1/A2) per record |
| 8. Cohen’s κ | Computed live from doubly-labelled records via `sklearn.metrics.cohen_kappa_score` |
| 9. Resolve disagreements | Notes field records the adjudication; final label stored separately |
| 10. Save & evaluate | Records persist; final labels become the pilot gold standard |

**[MEASURED behaviour]** With three doubly-labelled records (A1 = positive/negative/neutral, A2 = positive/neutral/neutral), the API returned **κ = 0.50 (n = 3)** — correct arithmetic on a deliberately tiny pilot.

**Pilot honesty rule:** a college-scale pilot is permitted by the interface but must be reported as a pilot. It is **not** statistically equivalent to the 1,500–3,000/class research target, and the UI says so.

---

## 13. Data preprocessing

**[PAPER + MEASURED]** Text pipeline (`clean_text`, shared by training and inference so there is no train/serve skew):

1. Lowercase.
2. Remove URLs (`http(s)://…`, `www.…`).
3. Remove `@mentions`.
4. Convert cashtags: `$aapl` → `ticker_aapl` (preserves ticker identity instead of destroying it).
5. Expand hashtags: `#earnings` → `earnings`.
6. Strip non-alphanumeric punctuation, collapse whitespace.

Emoji are **retained in the original text** for the emoji-signal analyser, and excluded from the bag-of-words model (TF-IDF cannot use them meaningfully). No lemmatisation or stop-word removal is applied in the shipped configuration — TF-IDF’s IDF weighting already down-weights ubiquitous terms, and early stopping/negation words must not be deleted. (The paper mentions stop-word removal; removing it is a deliberate, documented deviation, and both are reproducible from `scripts/train_models.py`.)

**[MEASURED]** Preprocessing is applied identically at training and inference time; the processed artefacts (`processed_twitter.csv`, `processed_phrasebank.csv`) are downloadable from the Dataset page.

---

## 14. Feature extraction

- **Classical:** TF-IDF, `ngram_range=(1,2)`, `min_df=2`, `max_features=20,000`, `sublinear_tf=True`. **[MEASURED]** 18,725 features on the Twitter corpus; 5,918 on PhraseBank.
- **Ticker features:** cashtag extraction into `ticker_xxx` tokens, plus an explicit ticker list per analysis.
- **Emoji/reaction features:** counted separately as engagement/emotion signals (never as sentiment features).
- **Image:** OCR text → same TF-IDF pipeline; plus basic visual statistics (dimensions, mean RGB, brightness) from OpenCV/Pillow.
- **Audio/video:** transcript (Whisper or manual) → same TF-IDF pipeline; video frame sampling at 2 s intervals, first-frame OCR.
- **Transformer embeddings:** FinBERT contextual embeddings **[FUTURE]** — not implemented here.

---

## 15. Machine-learning algorithms

**[PAPER]** Four classifiers, implemented exactly as specified:

| Model | Configuration |
|---|---|
| Multinomial Naive Bayes | `MultinomialNB()` |
| Logistic Regression | `max_iter=1000`, multinomial |
| Linear SVM | `LinearSVC(max_iter=2000)` |
| Random Forest | `n_estimators=200`, `random_state=42` |

**[EXTENSION]** Reproducibility controls: stratified 80:20 split, `random_state=42` everywhere, a single fitted vectorizer reused for train and test, per-run wall-clock timing for training and inference, and persisted metrics (`backend/data/models/evaluation_results.json`) rather than hardcoded numbers.

**[EXTENSION]** Confidence: `predict_proba` where available; for `LinearSVC` (no native probabilities) a softmax over decision values is used and labelled as such.

**[FUTURE]** FinBERT fine-tuning: not trained — no GPU-class resources in this environment. The UI and docs state this rather than reporting invented numbers.

---

## 16. Multimodal processing

| Modality | Processor | Real capability in this build | Honest limitation |
|---|---|---|---|
| **Text** | TF-IDF + classical clf | Fully working, real confidence | Trained on tweets; news-register text transfers weakly |
| **Reactions/emoji** | Counting + log-scaled engagement score, emotion grouping | Fully working | **Never** converted into sentiment |
| **Sticker/GIF** | Frame extraction (OpenCV) + OCR | Works when text is legible | Without readable text → **`unknown`**, no invented meaning |
| **Image/meme/screenshot** | RapidOCR (ONNX) or Tesseract + image statistics → text sentiment | **Verified working**: OCR “NVDA earnings beat - price target raised” (confidence 91.26) → positive (0.857) | No visual-semantic classifier; sentiment derives from OCR text only |
| **Audio/voice** | Whisper (optional) + manual transcript → text sentiment | Working via manual transcript (verified: bearish statement → negative 0.426) | Whisper not installed here (~GB, needs torch); **no vocal emotion model** — excited ≠ bullish |
| **Video/reel** | OpenCV frames + ffmpeg audio + transcription + frame OCR | Verified: 2 frames from a 3 s clip, transcript → negative | ffmpeg absent here, so audio extraction reports `audio_extraction_unavailable`; no video classification model |

**Speaker/author separation:** the platform analyses *content*, and the explanation text explicitly warns against inferring opinion from vocal delivery.

---

## 17. Model evaluation

**[MEASURED — actual runs, `python scripts/train_models.py`]**

### Twitter Financial News Sentiment (11,931 → 9,544 train / 2,387 test)
| Model | Accuracy | Macro precision | Macro recall | Macro F1 | Train time |
|---|---|---|---|---|---|
| Multinomial Naive Bayes | 0.7394 | 0.8295 | 0.5140 | 0.5549 | 0.015 s |
| Logistic Regression | 0.8023 | 0.8257 | 0.6448 | 0.6960 | 1.162 s |
| **Linear SVM** | **0.8295** | 0.8040 | **0.7274** | **0.7582** | 0.111 s |
| Random Forest | 0.7872 | 0.8240 | 0.6120 | 0.6626 | 9.961 s |

### Financial PhraseBank AllAgree (2,264 → 1,811 / 453)
| Model | Accuracy | Macro precision | Macro recall | Macro F1 | Train time |
|---|---|---|---|---|---|
| Multinomial Naive Bayes | 0.8013 | 0.8329 | 0.6407 | 0.6591 | 0.004 s |
| Logistic Regression | 0.8786 | 0.8795 | 0.7902 | 0.8246 | 0.821 s |
| **Linear SVM** | **0.9382** | **0.9332** | **0.9072** | **0.9194** | 0.012 s |
| Random Forest | 0.8631 | 0.8599 | 0.7596 | 0.7960 | 0.884 s |

### Cross-domain (Logistic Regression)
| Direction | Accuracy | Macro F1 |
|---|---|---|
| Twitter → PhraseBank | 0.7200 | 0.5608 |
| PhraseBank → Twitter | 0.6549 | 0.3248 |

Confusion matrices, per-class precision/recall and inference timings for every run are available from `/api/models/results` and rendered on the Model Comparison page.

**Comparison with the draft:** the draft’s ≈0.90 accuracy across NB/LR/SVM came from a **synthetic** 1,000-post set with 12 % label noise. It is **superseded** by the figures above. The honest observation is that SVM/LR dominate, NB collapses on macro-recall because it over-predicts the majority (neutral) class, and Random Forest buys the least per second of training time.

---

## 18. Results and discussion

**[MEASURED + interpretation]**

1. **Linear SVM is the best classical model on both corpora.** Fast (0.01–0.11 s) and strong on macro-F1.
2. **Neutral dominance is the central difficulty.** With ~65 % neutral, accuracy flatters every model (NB: 73.9 % accuracy yet only 51.4 % macro-recall). Macro-F1 is the metric that matters — which is why the paper’s choice of macro-averaging is retained and emphasised.
3. **PhraseBank is much easier than tweets** (91.94 % vs 75.82 % macro-F1). Clean financial news sentences follow formulaic patterns (“operating profit rose to…”), whereas tweets use slang, sarcasm, hashtags and emoji.
4. **Cross-domain degradation is severe** (macro-F1 56.08 % / 32.48 %). Any claim that a financial sentiment model “generalises across the web” must be tested, not assumed.
5. **Multimodal fusion behaves conservatively.** With only text available, the fused result equals the text result and the confidence equals the model’s own confidence (no inflation). With multiple modalities, contributions are weighted by (modality prior × model confidence); if no modality produces a usable prediction, the system returns “not determined” rather than “neutral”.
6. **OCR adds genuine signal.** A synthetic chart image was read correctly (“NVDA earnings beat - price target raised”, 91.26 % OCR confidence) and classified positive at 0.857 confidence — an end-to-end image→sentiment path with no manual intervention.

**[Limitations of the evidence]** Model results come from one split seed; no repeated cross-validation or significance testing has been performed yet **[FUTURE]**. Multimodal performance cannot be benchmarked quantitatively because no financial multimodal labelled corpus exists in this project.

---

## 19. Limitations

1. **No financial multimodal ground truth.** No public dataset labels *financial sentiment* for images/audio/video. Multimodal accuracy therefore cannot be measured, only demonstrated per modality.
2. **OCR/text-only image understanding.** Memes without text, or visual sarcasm, are not interpreted — they return `unknown`.
3. **No visual classifier or audio-emotion model bundled.** CMU-MOSEI/RAVDESS are referenced as the correct sources for such models but are not trained here.
4. **Whisper/ffmpeg optional.** Without them, audio/video rely on manual transcripts (clearly signalled in the UI).
5. **FinBERT not trained.** Reported as future work; no invented scores.
6. **No live social-media API.** Collection is manual/upload only; the interface says so.
7. **Text model domain.** Trained on financial tweets; news-style or sarcastic text transfers imperfectly (measured in §17).
8. **Engagement scoring is a heuristic** (log-scaled weighted reaction counts), not a learned model.
9. **Local prototype auth.** JWT + bcrypt on SQLite; Supabase Auth/RLS is the production path and is specified but not exercised in this environment.
10. **Single split, single seed.** No cross-validation or confidence intervals yet.
11. **Pilot-scale primary data.** κ is computed correctly but on tiny samples.
12. **Not financial advice.** Sentiment reflects expressed opinion; it is not a price prediction.

---

## 20. Future enhancements

**[FUTURE]**
1. Fine-tune FinBERT (and a finance-tuned RoBERTa) for a real transformer comparison, with GPU timing.
2. Train CMU-MOSEI-based trimodal emotion models and a RAVDESS-based audio-emotion classifier; wire them into `modality_results` as `audio_emotion` with domain caveats.
3. Add a CLIP/ViT visual-semantic classifier for memes and charts, plus chart-pattern detection for trading screenshots.
4. Replace late fusion with learned stacking (logistic meta-learner over modality predictions) once multimodal ground truth exists.
5. Repeated stratified k-fold cross-validation with confidence intervals and paired significance tests.
6. Live collection through authorised X/Reddit/StockTwits APIs with rate-limit and ToS compliance, replacing manual entry.
7. Supabase Auth + Storage + RLS in a deployed instance; object-level signed URLs for media.
8. Streaming ingestion with background workers (Celery/RQ) for large media batches.
9. Longitudinal market-signal evaluation: correlate daily ticker sentiment with realised returns, with strict causal disclaimers.
10. Multilingual support (Hindi/Kannada financial social media) using multilingual transformers.

---

## 21. References

Verified only. Placeholder references from the draft ([2], [3], [8]–[20]) are **not** reproduced.

1. Bollen, J., Mao, H., Zeng, X. (2011). Twitter mood predicts the stock market. *Journal of Computational Science*, 2(1), 1–8. https://doi.org/10.1016/j.jocs.2011.02.001
2. Loughran, T., McDonald, B. (2011). When is a liability not a liability? Textual analysis, dictionaries, and 10-Ks. *The Journal of Finance*, 66(1), 35–65. https://doi.org/10.1111/j.1540-6261.2010.00395.x
3. Malo, P., Sinha, A., Korhonen, P., Wallenius, J., Takala, P. (2014). Good debt or bad debt: Detecting semantic orientations in economic texts. *JASIST*, 65(4), 782–796. https://doi.org/10.1002/asi.23258
4. Araci, D. (2019). FinBERT: Financial sentiment analysis with pre-trained language models. arXiv:1908.10063. https://arxiv.org/abs/1908.10063
5. Vaswani, A. et al. (2017). Attention is all you need. *NeurIPS 30*. https://arxiv.org/abs/1706.03762
6. Devlin, J., Chang, M.-W., Lee, K., Toutanova, K. (2019). BERT: Pre-training of deep bidirectional transformers for language understanding. *NAACL-HLT 2019*. https://arxiv.org/abs/1810.04805
7. Zeroshot. *Twitter Financial News Sentiment* dataset (MIT). https://huggingface.co/datasets/zeroshot/twitter-financial-news-sentiment
8. Takala. *Financial PhraseBank* dataset mirror (CC BY-NC-SA 3.0); original corpus: Malo et al. (2014). https://huggingface.co/datasets/takala/financial_phrasebank
9. Zadeh, A. et al. *CMU MultimodalSDK* (CMU-MOSEI). https://github.com/A2Zadeh/CMU-MultimodalSDK
10. Livingstone, S. R., Russo, F. A. *RAVDESS* (Zenodo record 1188976). https://zenodo.org/records/1188976

*Status of the base paper: draft, not yet published. Its illustrative synthetic results are not cited as findings.*
