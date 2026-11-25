"""FastAPI application — Multimodal Financial Social Media Analytics Platform."""
import os, json, csv, io, re, sqlite3
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field

from .config import settings
from .database import init_db, get_conn, now_iso, uid
from .auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    validate_password_strength,
)
from .services import ml_service, media_service

app = FastAPI(
    title=settings.app_name,
    version="1.1.0",
    description=(
        "Multimodal financial sentiment analysis: text, reactions, images, audio, video. "
        "Text models trained on genuine Twitter Financial News Sentiment + Financial PhraseBank."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Never expose raw stack traces or sensitive internals to clients."""
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    print(f"[unhandled_error] {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again shortly."},
    )


os.makedirs(settings.upload_dir, exist_ok=True)
init_db()

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "models")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")


# ---------- Schemas ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: Optional[str] = None
    full_name: Optional[str] = Field(default=None, max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = False


class UpdateProfileIn(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[EmailStr] = None


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: Optional[str] = None


class AnalyzeTextIn(BaseModel):
    model_config = {"protected_namespaces": ()}
    text: str
    ticker: Optional[str] = None
    platform: Optional[str] = None
    reactions: Optional[dict] = None
    model_name: Optional[str] = None


class ReportGenerateIn(BaseModel):
    report_type: Optional[str] = "summary"  # summary | ticker | models | multimodal
    ticker: Optional[str] = None


class CollectionIn(BaseModel):
    platform: str
    text: str
    ticker: Optional[str] = None
    timestamp: Optional[str] = None
    media_type: Optional[str] = "text"
    annotator1_label: Optional[str] = None
    annotator2_label: Optional[str] = None
    final_label: Optional[str] = None
    notes: Optional[str] = None


class MethodologyIn(BaseModel):
    platform: str
    method: str
    date_range: str
    keywords: str
    tickers: str
    sampling: str
    inclusion: str
    exclusion: str
    annotation_guidelines: str
    annotators: str
    kappa: Optional[float] = None
    ethics: str
    storage: str


# ---------- Health / info ----------
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "1.1.0",
        "models_loaded": ml_service._vectorizer is not None,
        "ocr_available": media_service.check_ocr_available()[0],
        "whisper_available": media_service.check_whisper_available()[0],
        "ffmpeg_available": media_service.check_ffmpeg_available(),
    }


@app.get("/api/info")
def info():
    return {
        "title": settings.app_name,
        "description": (
            "Multimodal financial social media analytics. Text sentiment via TF-IDF + classical ML "
            "trained on genuine public datasets. Image/audio/video pipelines with honest fallbacks."
        ),
        "datasets": [
            {
                "name": "Twitter Financial News Sentiment",
                "source": "https://huggingface.co/datasets/zeroshot/twitter-financial-news-sentiment",
                "license": "MIT",
                "n": 11931,
                "role": "training_and_eval",
                "labels": {"0": "Bearish/negative", "1": "Bullish/positive", "2": "Neutral"},
                "note": "Main financial social-media text dataset. Collected via Twitter API.",
            },
            {
                "name": "Financial PhraseBank (AllAgree)",
                "source": "https://huggingface.co/datasets/takala/financial_phrasebank",
                "license": "CC BY-NC-SA 3.0",
                "n": 2264,
                "role": "cross_domain_eval",
                "labels": ["positive", "negative", "neutral"],
                "note": "Financial NEWS sentences (Malo et al. 2014). NOT social media, NOT reactions/images/voice. Cross-domain eval only.",
            },
            {
                "name": "CMU-MOSEI (via CMU Multimodal SDK)",
                "source": "https://github.com/A2Zadeh/CMU-MultimodalSDK",
                "role": "referenced_only",
                "note": "General multimodal emotion resource. NOT financial sentiment. Referenced only — not bundled.",
            },
            {
                "name": "RAVDESS",
                "source": "https://zenodo.org/records/1188976",
                "role": "referenced_only",
                "note": "General audio emotion dataset. NOT financial voice messages. Referenced only — not bundled.",
            },
        ],
        "disclaimer": "Sentiment analysis is NOT stock-price prediction or financial advice.",
    }


# ---------- Auth ----------
@app.post("/api/auth/register")
def register(payload: RegisterIn):
    email = str(payload.email).strip().lower()
    full_name = payload.full_name.strip() if payload.full_name else None
    if payload.confirm_password is not None and payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    pw_errors = validate_password_strength(payload.password)
    if pw_errors:
        raise HTTPException(status_code=400, detail=" ".join(pw_errors))

    conn = get_conn()
    try:
        existing = conn.execute("SELECT id FROM users WHERE lower(email)=?", (email,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email is already registered.")
        user_id = uid()
        created = now_iso()
        conn.execute(
            "INSERT INTO users (id, email, hashed_password, full_name, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (user_id, email, hash_password(payload.password), full_name, created, created),
        )
        conn.commit()
    except HTTPException:
        raise
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email is already registered.")
    except Exception as exc:
        print(f"[auth/register] DB error: {exc}")
        raise HTTPException(status_code=500, detail="Unable to complete registration right now. Please try again.")
    finally:
        conn.close()

    token = create_access_token({"sub": user_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": email, "full_name": full_name, "created_at": created},
    }


@app.post("/api/auth/login")
def login(payload: LoginIn):
    email = str(payload.email).strip().lower()
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
    finally:
        conn.close()
    if not row or not verify_password(payload.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token({"sub": row["id"]}, remember_me=payload.remember_me)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "created_at": row["created_at"],
        },
    }


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return user


@app.put("/api/auth/profile")
def update_profile(payload: UpdateProfileIn, user=Depends(get_current_user)):
    new_name = payload.full_name.strip() if payload.full_name is not None else user.get("full_name")
    new_email = str(payload.email).strip().lower() if payload.email is not None else user["email"]
    if not new_email:
        raise HTTPException(status_code=400, detail="Email address cannot be empty.")

    conn = get_conn()
    try:
        if new_email != user["email"].lower():
            dup = conn.execute(
                "SELECT id FROM users WHERE lower(email)=? AND id!=?",
                (new_email, user["id"]),
            ).fetchone()
            if dup:
                raise HTTPException(status_code=409, detail="That email address is already in use by another account.")
        updated = now_iso()
        conn.execute(
            "UPDATE users SET full_name=?, email=?, updated_at=? WHERE id=?",
            (new_name, new_email, updated, user["id"]),
        )
        conn.commit()
        row = conn.execute("SELECT id, email, full_name, created_at FROM users WHERE id=?", (user["id"],)).fetchone()
    except HTTPException:
        raise
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="That email address is already in use.")
    finally:
        conn.close()
    return {"user": dict(row), "message": "Profile updated successfully."}


@app.post("/api/auth/change-password")
def change_password(payload: ChangePasswordIn, user=Depends(get_current_user)):
    if payload.confirm_password is not None and payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match.")
    pw_errors = validate_password_strength(payload.new_password)
    if pw_errors:
        raise HTTPException(status_code=400, detail=" ".join(pw_errors))

    conn = get_conn()
    try:
        row = conn.execute("SELECT hashed_password FROM users WHERE id=?", (user["id"],)).fetchone()
        if not row or not verify_password(payload.current_password, row["hashed_password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        if verify_password(payload.new_password, row["hashed_password"]):
            raise HTTPException(status_code=400, detail="New password must be different from your current password.")
        conn.execute(
            "UPDATE users SET hashed_password=?, updated_at=? WHERE id=?",
            (hash_password(payload.new_password), now_iso(), user["id"]),
        )
        conn.commit()
    finally:
        conn.close()
    return {"message": "Password changed successfully."}


# ---------- Text analysis ----------
@app.post("/api/analyze/text")
def analyze_text(payload: AnalyzeTextIn, user=Depends(get_current_user)):
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Enter financial text to analyze.")
    result = ml_service.predict_sentiment(payload.text, payload.model_name)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    eng = ml_service.engagement_score(payload.reactions or {})
    emo = ml_service.emoji_analysis(payload.text)
    tickers = list(result.get("tickers", []))
    if payload.ticker and payload.ticker.strip():
        t_clean = payload.ticker.strip().upper().lstrip("$")
        if t_clean and t_clean not in tickers:
            tickers.append(t_clean)
    modality_results = [
        {"modality": "text", "sentiment": result["sentiment"], "confidence": result["confidence"]}
    ]
    fusion = ml_service.fuse_modalities(modality_results)
    explanation = (
        f"Text classified as {result['sentiment']} ({result['sentiment_label']}) with confidence "
        f"{result['confidence']:.3f} using {result['model_used']} (TF-IDF unigram+bigram, "
        f"trained on Twitter Financial News Sentiment). "
        f"Engagement level: {eng['level']} (score {eng['engagement_score']}). "
        f"Reactions are engagement/emotion signals, not sentiment labels."
    )
    aid = uid()
    created = now_iso()
    raw_meta = {
        "probabilities": result["probabilities"],
        "keywords": result.get("keywords", []),
        "cleaned_text": result["cleaned_text"],
        "engagement": eng,
        "emoji_analysis": emo,
        "fusion": fusion,
        "platform": payload.platform,
    }
    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO analyses (id, user_id, modality, input_text, extracted_text, sentiment, confidence,
            emotion, engagement_score, tickers, modality_results, explanation, status, created_at,
            platform, model_used, keywords, probabilities, raw_metadata)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                aid,
                user["id"],
                "text",
                payload.text,
                payload.text,
                result["sentiment"],
                result["confidence"],
                emo.get("emotion_hint"),
                eng.get("engagement_score"),
                json.dumps(tickers),
                json.dumps(modality_results),
                explanation,
                "completed",
                created,
                payload.platform,
                result["model_used"],
                json.dumps(result.get("keywords", [])),
                json.dumps(result["probabilities"]),
                json.dumps(raw_meta),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": aid,
        "modality": "text",
        "input_text": payload.text,
        "platform": payload.platform,
        "sentiment": result["sentiment"],
        "sentiment_label": result["sentiment_label"],
        "confidence": result["confidence"],
        "probabilities": result["probabilities"],
        "model_used": result["model_used"],
        "available_models": result.get("available_models", []),
        "cleaned_text": result["cleaned_text"],
        "keywords": result.get("keywords", []),
        "tickers": tickers,
        "engagement": eng,
        "emoji_analysis": emo,
        "modality_results": modality_results,
        "fusion": fusion,
        "explanation": explanation,
        "status": "completed",
        "created_at": created,
    }


# ---------- Image / sticker / GIF / Audio / Video ----------
ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
ALLOWED_AUDIO = {".wav", ".mp3", ".m4a", ".ogg", ".flac"}
ALLOWED_VIDEO = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def _sanitize_filename(name: Optional[str]) -> str:
    base = os.path.basename(name or "upload")
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:100] or "upload"


def _save_upload(file: UploadFile, subdir: str) -> tuple:
    safe_name = _sanitize_filename(file.filename)
    ext = os.path.splitext(safe_name)[1].lower()
    fname = f"{uid()}_{safe_name}"
    dest = os.path.join(settings.upload_dir, subdir)
    os.makedirs(dest, exist_ok=True)
    path = os.path.join(dest, fname)
    max_bytes = settings.max_upload_mb * 1024 * 1024
    total_read = 0
    try:
        with open(path, "wb") as f:
            while chunk := file.file.read(1024 * 1024):
                total_read += len(chunk)
                if total_read > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size of {settings.max_upload_mb} MB.",
                    )
                f.write(chunk)
    except HTTPException:
        if os.path.exists(path):
            os.remove(path)
        raise
    if total_read == 0:
        if os.path.exists(path):
            os.remove(path)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return path, ext


@app.post("/api/analyze/image")
async def analyze_image(
    file: UploadFile = File(...),
    ticker: Optional[str] = Form(None),
    platform: Optional[str] = Form(None),
    user=Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE:
        raise HTTPException(status_code=400, detail=f"Unsupported image type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE))}")
    path, _ = _save_upload(file, "images")
    basic = media_service.analyze_image_basic(path)
    ocr = media_service.ocr_image(path)
    modality_results = []
    sentiment_result = None
    extracted = ocr.get("extracted_text", "")
    if extracted:
        sentiment_result = ml_service.predict_sentiment(extracted)
        if not sentiment_result.get("error"):
            modality_results.append(
                {
                    "modality": "image_ocr_text",
                    "sentiment": sentiment_result["sentiment"],
                    "confidence": sentiment_result["confidence"],
                }
            )
    tickers = list(sentiment_result.get("tickers", [])) if sentiment_result and not sentiment_result.get("error") else []
    if ticker and ticker.strip():
        t_clean = ticker.strip().upper().lstrip("$")
        if t_clean and t_clean not in tickers:
            tickers.append(t_clean)
    fusion = ml_service.fuse_modalities(modality_results)
    status = "completed" if ocr.get("status") == "completed" else ocr.get("status", "completed_with_warnings")
    explanation = (
        f"Image analysed. OCR status: {ocr.get('status')}. "
        + (
            f"Extracted text sentiment: {sentiment_result['sentiment']} "
            f"(confidence {sentiment_result['confidence']:.3f})."
            if sentiment_result and not sentiment_result.get("error")
            else "No OCR text available for sentiment classification — no sentiment fabricated."
        )
        + f" Image size: {basic.get('width')}x{basic.get('height')}."
    )
    aid = uid()
    created = now_iso()
    raw_meta = {"image_info": basic, "ocr": ocr, "fusion": fusion, "platform": platform, "file_url": f"/uploads/images/{os.path.basename(path)}"}
    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO analyses (id, user_id, modality, input_text, extracted_text, sentiment, confidence,
            emotion, engagement_score, tickers, modality_results, explanation, status, created_at,
            platform, model_used, keywords, probabilities, raw_metadata)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                aid,
                user["id"],
                "image",
                file.filename,
                extracted,
                sentiment_result.get("sentiment") if sentiment_result and not sentiment_result.get("error") else None,
                sentiment_result.get("confidence") if sentiment_result and not sentiment_result.get("error") else None,
                None,
                None,
                json.dumps(tickers),
                json.dumps(modality_results),
                explanation,
                status,
                created,
                platform,
                sentiment_result.get("model_used") if sentiment_result else None,
                json.dumps(sentiment_result.get("keywords", []) if sentiment_result else []),
                json.dumps(sentiment_result.get("probabilities", {}) if sentiment_result else {}),
                json.dumps(raw_meta),
            ),
        )
        conn.execute(
            "INSERT INTO media_uploads (id, user_id, filename, file_path, media_type, mime_type, file_size, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (uid(), user["id"], file.filename, path, "image", file.content_type, os.path.getsize(path), created),
        )
        conn.commit()
    finally:
        conn.close()
    file_url = f"/uploads/images/{os.path.basename(path)}"
    return {
        "id": aid,
        "modality": "image",
        "input_text": file.filename,
        "platform": platform,
        "file_path": path,
        "file_url": file_url,
        "image_info": basic,
        "ocr": ocr,
        "tickers": tickers,
        "keywords": sentiment_result.get("keywords", []) if sentiment_result else [],
        "sentiment": sentiment_result,
        "modality_results": modality_results,
        "fusion": fusion,
        "explanation": explanation,
        "status": status,
        "created_at": created,
    }


@app.post("/api/analyze/audio")
async def analyze_audio(
    file: UploadFile = File(...),
    manual_transcript: Optional[str] = Form(None),
    ticker: Optional[str] = Form(None),
    platform: Optional[str] = Form(None),
    user=Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO:
        raise HTTPException(status_code=400, detail=f"Unsupported audio type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_AUDIO))}")
    path, _ = _save_upload(file, "audio")
    transcription = media_service.transcribe_audio(path)
    transcript = (manual_transcript or transcription.get("transcript", "")).strip()
    modality_results, sentiment_result = [], None
    if transcript:
        sentiment_result = ml_service.predict_sentiment(transcript)
        if not sentiment_result.get("error"):
            modality_results.append(
                {
                    "modality": "audio_transcript",
                    "sentiment": sentiment_result["sentiment"],
                    "confidence": sentiment_result["confidence"],
                }
            )
    tickers = list(sentiment_result.get("tickers", [])) if sentiment_result and not sentiment_result.get("error") else []
    if ticker and ticker.strip():
        t_clean = ticker.strip().upper().lstrip("$")
        if t_clean and t_clean not in tickers:
            tickers.append(t_clean)
    fusion = ml_service.fuse_modalities(modality_results)
    status = "completed" if transcript else transcription.get("status", "completed_with_warnings")
    explanation = (
        f"Audio transcription status: {transcription.get('status')}. "
        + (
            f"Transcript sentiment: {sentiment_result['sentiment']} (confidence {sentiment_result['confidence']:.3f}). "
            if sentiment_result and not sentiment_result.get("error")
            else "No transcript available — no sentiment fabricated. "
        )
        + "Vocal emotion is NOT analysed (no trained audio-emotion model bundled); spoken opinion kept separate from emotion."
    )
    aid = uid()
    created = now_iso()
    raw_meta = {"transcription": transcription, "fusion": fusion, "platform": platform, "file_url": f"/uploads/audio/{os.path.basename(path)}"}
    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO analyses (id, user_id, modality, input_text, extracted_text, sentiment, confidence,
            emotion, engagement_score, tickers, modality_results, explanation, status, created_at,
            platform, model_used, keywords, probabilities, raw_metadata)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                aid,
                user["id"],
                "audio",
                file.filename,
                transcript,
                sentiment_result.get("sentiment") if sentiment_result and not sentiment_result.get("error") else None,
                sentiment_result.get("confidence") if sentiment_result and not sentiment_result.get("error") else None,
                None,
                None,
                json.dumps(tickers),
                json.dumps(modality_results),
                explanation,
                status,
                created,
                platform,
                sentiment_result.get("model_used") if sentiment_result else None,
                json.dumps(sentiment_result.get("keywords", []) if sentiment_result else []),
                json.dumps(sentiment_result.get("probabilities", {}) if sentiment_result else {}),
                json.dumps(raw_meta),
            ),
        )
        conn.execute(
            "INSERT INTO media_uploads (id, user_id, filename, file_path, media_type, mime_type, file_size, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (uid(), user["id"], file.filename, path, "audio", file.content_type, os.path.getsize(path), created),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": aid,
        "modality": "audio",
        "input_text": file.filename,
        "platform": platform,
        "file_path": path,
        "file_url": f"/uploads/audio/{os.path.basename(path)}",
        "transcription": transcription,
        "transcript": transcript,
        "tickers": tickers,
        "keywords": sentiment_result.get("keywords", []) if sentiment_result else [],
        "sentiment": sentiment_result,
        "modality_results": modality_results,
        "fusion": fusion,
        "explanation": explanation,
        "status": status,
        "created_at": created,
        "note": "Audio emotion recognition requires a trained model (e.g. RAVDESS-trained). Not bundled — see methodology.",
    }


@app.post("/api/analyze/video")
async def analyze_video(
    file: UploadFile = File(...),
    manual_transcript: Optional[str] = Form(None),
    ticker: Optional[str] = Form(None),
    platform: Optional[str] = Form(None),
    user=Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_VIDEO:
        raise HTTPException(status_code=400, detail=f"Unsupported video type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_VIDEO))}")
    path, _ = _save_upload(file, "video")
    frame_sub = uid()
    frame_dir = os.path.join(settings.upload_dir, "frames", frame_sub)
    frames_res = media_service.extract_video_frames(path, frame_dir)
    audio_res = media_service.extract_video_audio(path, os.path.join(frame_dir, "audio.wav"))
    transcript = (manual_transcript or "").strip()
    transcription = {"status": "manual" if transcript else "not_attempted"}
    if audio_res.get("status") == "completed" and not transcript:
        transcription = media_service.transcribe_audio(audio_res["audio_path"])
        transcript = transcription.get("transcript", "").strip()
    frame_ocr = {}
    if frames_res.get("frames"):
        frame_ocr = media_service.ocr_image(frames_res["frames"][0])
    modality_results, sentiment_result = [], None
    if transcript:
        t_res = ml_service.predict_sentiment(transcript)
        if not t_res.get("error"):
            sentiment_result = t_res
            modality_results.append({"modality": "video_transcript", "sentiment": t_res["sentiment"], "confidence": t_res["confidence"]})
    ocr_text = frame_ocr.get("extracted_text", "").strip()
    if ocr_text:
        o_res = ml_service.predict_sentiment(ocr_text)
        if not o_res.get("error"):
            if sentiment_result is None:
                sentiment_result = o_res
            modality_results.append({"modality": "video_ocr", "sentiment": o_res["sentiment"], "confidence": o_res["confidence"]})
    combined_text = (transcript + " " + ocr_text).strip()
    if combined_text and sentiment_result is None:
        sentiment_result = ml_service.predict_sentiment(combined_text)
    tickers = list(sentiment_result.get("tickers", [])) if sentiment_result and not sentiment_result.get("error") else []
    if ticker and ticker.strip():
        t_clean = ticker.strip().upper().lstrip("$")
        if t_clean and t_clean not in tickers:
            tickers.append(t_clean)
    fusion = ml_service.fuse_modalities(modality_results)
    status = "completed" if combined_text else "completed_with_warnings"
    explanation = (
        f"Video: {frames_res.get('duration_sec')}s, {len(frames_res.get('frames', []))} frames extracted. "
        f"Audio extraction: {audio_res.get('status')}. Transcription: {transcription.get('status')}. "
        + (
            f"Combined sentiment: {fusion.get('overall_sentiment') or sentiment_result['sentiment']} "
            f"(confidence {(fusion.get('overall_confidence') or sentiment_result['confidence']):.3f})."
            if sentiment_result and not sentiment_result.get("error")
            else "No speech/OCR text available — no sentiment fabricated."
        )
    )
    frame_urls = [f"/uploads/frames/{frame_sub}/{os.path.basename(fp)}" for fp in frames_res.get("frames", [])]
    aid = uid()
    created = now_iso()
    raw_meta = {
        "frames": {**frames_res, "frame_urls": frame_urls},
        "audio_extraction": audio_res,
        "transcription": transcription,
        "frame_ocr": frame_ocr,
        "fusion": fusion,
        "platform": platform,
        "file_url": f"/uploads/video/{os.path.basename(path)}",
    }
    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO analyses (id, user_id, modality, input_text, extracted_text, sentiment, confidence,
            emotion, engagement_score, tickers, modality_results, explanation, status, created_at,
            platform, model_used, keywords, probabilities, raw_metadata)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                aid,
                user["id"],
                "video",
                file.filename,
                combined_text,
                fusion.get("overall_sentiment") or (sentiment_result.get("sentiment") if sentiment_result and not sentiment_result.get("error") else None),
                fusion.get("overall_confidence") or (sentiment_result.get("confidence") if sentiment_result and not sentiment_result.get("error") else None),
                None,
                None,
                json.dumps(tickers),
                json.dumps(modality_results),
                explanation,
                status,
                created,
                platform,
                sentiment_result.get("model_used") if sentiment_result else None,
                json.dumps(sentiment_result.get("keywords", []) if sentiment_result else []),
                json.dumps(sentiment_result.get("probabilities", {}) if sentiment_result else {}),
                json.dumps(raw_meta),
            ),
        )
        conn.execute(
            "INSERT INTO media_uploads (id, user_id, filename, file_path, media_type, mime_type, file_size, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (uid(), user["id"], file.filename, path, "video", file.content_type, os.path.getsize(path), created),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": aid,
        "modality": "video",
        "input_text": file.filename,
        "platform": platform,
        "file_path": path,
        "file_url": f"/uploads/video/{os.path.basename(path)}",
        "frames": {**frames_res, "frame_urls": frame_urls},
        "audio_extraction": audio_res,
        "transcription": transcription,
        "frame_ocr": frame_ocr,
        "transcript": transcript,
        "tickers": tickers,
        "keywords": sentiment_result.get("keywords", []) if sentiment_result else [],
        "sentiment": sentiment_result,
        "modality_results": modality_results,
        "fusion": fusion,
        "explanation": explanation,
        "status": status,
        "created_at": created,
    }


@app.post("/api/analyze/multimodal")
def analyze_multimodal(payload: AnalyzeTextIn, user=Depends(get_current_user)):
    """Text + reactions + emoji fused. For image/audio/video use dedicated endpoints."""
    text_res = ml_service.predict_sentiment(payload.text, payload.model_name)
    if text_res.get("error"):
        raise HTTPException(status_code=400, detail=text_res["error"])
    eng = ml_service.engagement_score(payload.reactions or {})
    emo = ml_service.emoji_analysis(payload.text)
    modality_results = [{"modality": "text", "sentiment": text_res["sentiment"], "confidence": text_res["confidence"]}]
    fusion = ml_service.fuse_modalities(modality_results)
    return {
        "text": text_res,
        "engagement": eng,
        "emoji": emo,
        "fusion": fusion,
        "note": "Engagement/emoji inform the report but do NOT vote on bullish/bearish sentiment.",
    }


# ---------- History ----------
def _hydrate_analysis(row) -> dict:
    d = dict(row)
    for col, default in [
        ("tickers", []),
        ("modality_results", []),
        ("keywords", []),
        ("probabilities", {}),
        ("raw_metadata", {}),
    ]:
        raw = d.get(col)
        if isinstance(raw, str) and raw:
            try:
                d[col] = json.loads(raw)
            except Exception:
                d[col] = default
        elif raw is None:
            d[col] = default
    return d


@app.get("/api/analyses")
def list_analyses(
    user=Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    modality: Optional[str] = None,
    ticker: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: str = "newest",
):
    clauses = ["user_id=?"]
    params: list = [user["id"]]
    if search and search.strip():
        q = f"%{search.strip()}%"
        clauses.append("(input_text LIKE ? OR extracted_text LIKE ? OR tickers LIKE ? OR explanation LIKE ?)")
        params.extend([q, q, q, q])
    if sentiment and sentiment != "all":
        if sentiment == "unclassified":
            clauses.append("sentiment IS NULL")
        else:
            clauses.append("sentiment=?")
            params.append(sentiment)
    if modality and modality != "all":
        clauses.append("modality=?")
        params.append(modality)
    if ticker and ticker.strip():
        clauses.append("tickers LIKE ?")
        params.append(f"%{ticker.strip().upper()}%")
    if date_from:
        clauses.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("created_at <= ?")
        params.append(f"{date_to}T23:59:59")

    order_map = {
        "newest": "created_at DESC",
        "oldest": "created_at ASC",
        "confidence_desc": "COALESCE(confidence, -1) DESC, created_at DESC",
    }
    order_sql = order_map.get(sort, "created_at DESC")
    sql = f"SELECT * FROM analyses WHERE {' AND '.join(clauses)} ORDER BY {order_sql} LIMIT ?"
    params.append(limit)

    conn = get_conn()
    try:
        rows = conn.execute(sql, tuple(params)).fetchall()
    finally:
        conn.close()
    return [_hydrate_analysis(r) for r in rows]


@app.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: str, user=Depends(get_current_user)):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM analyses WHERE id=? AND user_id=?",
            (analysis_id, user["id"]),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis record not found.")
    return _hydrate_analysis(row)


@app.delete("/api/analyses/{analysis_id}")
def delete_analysis(analysis_id: str, user=Depends(get_current_user)):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id FROM analyses WHERE id=? AND user_id=?",
            (analysis_id, user["id"]),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Analysis record not found.")
        conn.execute("DELETE FROM analyses WHERE id=? AND user_id=?", (analysis_id, user["id"]))
        conn.commit()
    finally:
        conn.close()
    return {"deleted": True, "id": analysis_id}


# ---------- Datasets ----------
@app.get("/api/datasets/builtin")
def builtin_datasets():
    eval_path = os.path.join(MODEL_DIR, "evaluation_results.json")
    info = {}
    if os.path.exists(eval_path):
        with open(eval_path, encoding="utf-8") as f:
            info = json.load(f).get("dataset_info", {})
    return [
        {
            "id": "twitter_financial_news",
            "name": "Twitter Financial News Sentiment",
            "source": "https://huggingface.co/datasets/zeroshot/twitter-financial-news-sentiment",
            "license": "MIT",
            "role": "training_and_eval",
            "n": info.get("twitter_financial_news", {}).get("n", 11931),
            "class_distribution": info.get("twitter_financial_news", {}).get("dist", {}),
            "columns": ["text", "label"],
            "label_mapping": {"0": "Bearish/negative", "1": "Bullish/positive", "2": "Neutral"},
            "description": "Finance-related tweets annotated for sentiment. Main training and in-domain evaluation corpus.",
        },
        {
            "id": "financial_phrasebank",
            "name": "Financial PhraseBank (AllAgree)",
            "source": "https://huggingface.co/datasets/takala/financial_phrasebank",
            "license": "CC BY-NC-SA 3.0",
            "role": "evaluation",
            "n": info.get("financial_phrasebank", {}).get("n", 2264),
            "class_distribution": info.get("financial_phrasebank", {}).get("dist", {}),
            "columns": ["sentence", "label"],
            "label_mapping": {"positive": "positive", "negative": "negative", "neutral": "neutral"},
            "description": "Financial NEWS sentences (Malo et al. 2014). NOT social media. Cross-domain evaluation only.",
        },
    ]


@app.get("/api/datasets/preview")
def dataset_preview(
    dataset: str = "twitter_financial_news",
    limit: int = 20,
    search: Optional[str] = None,
    label: Optional[str] = None,
):
    fname = "processed_twitter.csv" if dataset == "twitter_financial_news" else "processed_phrasebank.csv"
    path = os.path.join(DATA_DIR, fname)
    if not os.path.exists(path):
        raise HTTPException(404, "Processed dataset not found. Run scripts/train_models.py.")
    import pandas as pd

    df = pd.read_csv(path)
    total = int(len(df))
    dist = {str(k): int(v) for k, v in df["label_str"].value_counts().to_dict().items()}
    missing = {str(k): int(v) for k, v in df.isna().sum().to_dict().items()}
    duplicates = int(df.duplicated(subset=["text"]).sum())

    filtered = df
    if label and label != "all":
        filtered = filtered[filtered["label_str"].astype(str).str.lower() == label.lower()]
    if search and search.strip():
        q = search.strip()
        filtered = filtered[filtered["text"].astype(str).str.contains(q, case=False, na=False, regex=False)]

    return {
        "dataset": dataset,
        "total": total,
        "filtered_total": int(len(filtered)),
        "class_distribution": dist,
        "missing": missing,
        "duplicates": duplicates,
        "preview": filtered.head(limit).fillna("").to_dict("records"),
    }


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".csv", ".json"):
        raise HTTPException(400, "Only CSV/JSON supported for dataset upload.")
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Dataset file exceeds {settings.max_upload_mb} MB limit.")
    try:
        import pandas as pd

        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_json(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")
    if df.empty:
        raise HTTPException(400, "Uploaded file is empty.")
    text_col = next((c for c in df.columns if c.lower() in ("text", "sentence", "tweet", "content", "message")), df.columns[0])
    label_col = next((c for c in df.columns if c.lower() in ("label", "sentiment", "target", "class")), None)
    missing = {str(k): int(v) for k, v in df.isna().sum().to_dict().items()}
    dupes = int(df.duplicated().sum())
    did = uid()
    created = now_iso()
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO datasets (id, name, source, license, record_count, class_distribution, columns, missing_report, duplicate_count, created_at, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                did,
                file.filename,
                "user_upload",
                "user-provided",
                int(len(df)),
                json.dumps({str(k): int(v) for k, v in df[label_col].value_counts().to_dict().items()}) if label_col else "{}",
                json.dumps(list(df.columns)),
                json.dumps(missing),
                dupes,
                created,
                user["id"],
            ),
        )
        for _, row in df.head(5000).iterrows():
            conn.execute(
                "INSERT INTO dataset_records (id, dataset_id, text, label, created_at) VALUES (?,?,?,?,?)",
                (uid(), did, str(row[text_col]), str(row[label_col]) if label_col else None, created),
            )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": did,
        "name": file.filename,
        "records": int(len(df)),
        "columns": list(df.columns),
        "text_column": text_col,
        "label_column": label_col,
        "missing": missing,
        "duplicates": dupes,
        "class_distribution": {str(k): int(v) for k, v in df[label_col].value_counts().to_dict().items()} if label_col else {},
        "preview": df.head(10).fillna("").to_dict("records"),
    }


@app.get("/api/datasets/user")
def user_datasets(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM datasets WHERE user_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


@app.get("/api/datasets/download-processed")
def download_processed(dataset: str = "twitter_financial_news"):
    fname = "processed_twitter.csv" if dataset == "twitter_financial_news" else "processed_phrasebank.csv"
    path = os.path.join(DATA_DIR, fname)
    if not os.path.exists(path):
        raise HTTPException(404, "Processed dataset not found.")
    return FileResponse(path, filename=fname, media_type="text/csv")


# ---------- Models ----------
@app.get("/api/models/results")
def model_results():
    path = os.path.join(MODEL_DIR, "evaluation_results.json")
    if not os.path.exists(path):
        raise HTTPException(404, "Evaluation results not found. Run scripts/train_models.py.")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/models/info")
def model_info():
    path = os.path.join(MODEL_DIR, "model_info.json")
    info_data = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            info_data = json.load(f)
    info_data["available_models"] = list(ml_service._all_models.keys()) if ml_service._all_models else [info_data.get("best_model", "Linear SVM")]
    return info_data


# ---------- Dashboard / stocks ----------
@app.get("/api/dashboard/stats")
def dashboard_stats(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        analyses = conn.execute("SELECT * FROM analyses WHERE user_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
        uploads = conn.execute("SELECT media_type, COUNT(*) c FROM media_uploads WHERE user_id=? GROUP BY media_type", (user["id"],)).fetchall()
    finally:
        conn.close()
    from collections import Counter

    sentiments = Counter(a["sentiment"] for a in analyses if a["sentiment"])
    modalities = Counter(a["modality"] for a in analyses)
    tickers = Counter()
    confs = []
    for a in analyses:
        if a["confidence"] is not None:
            confs.append(float(a["confidence"]))
        try:
            for t in json.loads(a["tickers"] or "[]"):
                tickers[t] += 1
        except Exception:
            pass
    dataset_dist = {}
    try:
        import pandas as pd

        df = pd.read_csv(os.path.join(DATA_DIR, "processed_twitter.csv"))
        dataset_dist = df["label_str"].value_counts().to_dict()
    except Exception:
        pass
    return {
        "total_analyses": len(analyses),
        "average_confidence": round(sum(confs) / len(confs), 4) if confs else None,
        "sentiment_counts": dict(sentiments),
        "modality_counts": dict(modalities),
        "media_counts": {r["media_type"]: r["c"] for r in uploads},
        "top_tickers": tickers.most_common(10),
        "dataset_sentiment_distribution": dataset_dist,
        "note": "User analysis counts reflect YOUR persisted analyses. Dataset distribution is from genuine Twitter Financial News Sentiment (11,931 tweets).",
    }


@app.get("/api/stocks/{ticker}")
def stock_sentiment(ticker: str, user=Depends(get_current_user)):
    ticker = ticker.strip().upper().lstrip("$")
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM analyses WHERE user_id=? AND tickers LIKE ? ORDER BY created_at DESC",
            (user["id"], f"%{ticker}%"),
        ).fetchall()
    finally:
        conn.close()
    from collections import Counter

    hydrated = []
    for r in rows:
        item = _hydrate_analysis(r)
        if ticker in item.get("tickers", []):
            hydrated.append(item)

    sentiments = Counter(r["sentiment"] for r in hydrated if r["sentiment"])
    modalities = Counter(r["modality"] for r in hydrated)
    confs = [float(r["confidence"]) for r in hydrated if r["confidence"] is not None]

    builtin_count = 0
    builtin_samples = []
    try:
        import pandas as pd

        df = pd.read_csv(os.path.join(DATA_DIR, "processed_twitter.csv"))
        mask = df["text"].str.contains(rf"\${re.escape(ticker)}\b", case=False, na=False)
        builtin_count = int(mask.sum())
        builtin_dist = df[mask]["label_str"].value_counts().to_dict() if builtin_count else {}
        if builtin_count:
            builtin_samples = df[mask][["text", "label_str"]].head(8).to_dict("records")
    except Exception:
        builtin_dist = {}
    return {
        "ticker": ticker,
        "user_posts": len(hydrated),
        "user_sentiment": dict(sentiments),
        "user_modalities": dict(modalities),
        "average_confidence": round(sum(confs) / len(confs), 4) if confs else None,
        "builtin_dataset_posts": builtin_count,
        "builtin_sentiment": builtin_dist,
        "builtin_samples": builtin_samples,
        "related": hydrated[:30],
        "disclaimer": "Sentiment is NOT a stock-price prediction, market price feed, or financial advice.",
    }


@app.get("/api/stocks")
def list_stocks():
    try:
        import pandas as pd
        from collections import Counter

        df = pd.read_csv(os.path.join(DATA_DIR, "processed_twitter.csv"))
        tickers = Counter()
        for t in df["text"].dropna():
            for m in re.findall(r"\$([A-Za-z]{1,5})\b", str(t)):
                tickers[m.upper()] += 1
        return [{"ticker": k, "mentions": v} for k, v in tickers.most_common(60)]
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------- Collection ----------
@app.post("/api/collection/records")
def add_collection_record(payload: CollectionIn, user=Depends(get_current_user)):
    rid = uid()
    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO collection_records (id, user_id, platform, text, ticker, timestamp, media_type,
            annotator1_label, annotator2_label, final_label, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                rid,
                user["id"],
                payload.platform,
                payload.text,
                payload.ticker,
                payload.timestamp,
                payload.media_type,
                payload.annotator1_label,
                payload.annotator2_label,
                payload.final_label,
                payload.notes,
                now_iso(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": rid, "status": "saved"}


@app.get("/api/collection/records")
def list_collection_records(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM collection_records WHERE user_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


@app.post("/api/collection/methodology")
def save_methodology(payload: MethodologyIn, user=Depends(get_current_user)):
    mid = uid()
    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO collection_methodology (id, user_id, platform, method, date_range, keywords, tickers,
            sampling, inclusion, exclusion, annotation_guidelines, annotators, kappa, ethics, storage, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                mid,
                user["id"],
                payload.platform,
                payload.method,
                payload.date_range,
                payload.keywords,
                payload.tickers,
                payload.sampling,
                payload.inclusion,
                payload.exclusion,
                payload.annotation_guidelines,
                payload.annotators,
                payload.kappa,
                payload.ethics,
                payload.storage,
                now_iso(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": mid, "status": "saved"}


@app.get("/api/collection/methodology")
def get_methodology(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM collection_methodology WHERE user_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


@app.get("/api/collection/agreement")
def agreement(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT annotator1_label, annotator2_label FROM collection_records WHERE user_id=? AND annotator1_label IS NOT NULL AND annotator2_label IS NOT NULL",
            (user["id"],),
        ).fetchall()
    finally:
        conn.close()
    if len(rows) < 2:
        return {"kappa": None, "n": len(rows), "note": "Need at least 2 doubly-annotated records to compute Cohen's kappa."}
    from sklearn.metrics import cohen_kappa_score

    y1 = [r["annotator1_label"] for r in rows]
    y2 = [r["annotator2_label"] for r in rows]
    kappa = float(cohen_kappa_score(y1, y2))
    return {"kappa": round(kappa, 4), "n": len(rows), "note": "Cohen's kappa on annotator1 vs annotator2 labels."}


# ---------- Research ----------
RESEARCH_ARTICLES = [
    {
        "title": "Twitter mood predicts the stock market",
        "authors": "J. Bollen, H. Mao, X. Zeng",
        "year": 2011,
        "venue": "Journal of Computational Science",
        "dataset": "Twitter mood (OpinionFinder + Google-Profile of Mood States)",
        "modality": "Text (Twitter)",
        "methodology": "Lexicon-based mood classification aggregated to predict DJIA direction",
        "algorithms": "OpinionFinder, GPOMS",
        "metrics": "Directional accuracy (not directly comparable)",
        "findings": "Aggregated Twitter mood showed predictive signal for DJIA movements.",
        "limitations": "Mood states are general, not finance-specific; lexicon-based.",
        "differs": "Our platform uses finance-specific supervised classifiers + multimodal fusion.",
        "link": "https://doi.org/10.1016/j.jocs.2011.02.001",
        "verified": True,
    },
    {
        "title": "When is a liability not a liability? Textual analysis, dictionaries, and 10-Ks",
        "authors": "T. Loughran, B. McDonald",
        "year": 2011,
        "venue": "The Journal of Finance",
        "dataset": "10-K filings (finance lexicon)",
        "modality": "Text (financial disclosures)",
        "methodology": "Finance-specific sentiment dictionary",
        "algorithms": "Loughran-McDonald lexicon",
        "metrics": "Lexicon validation",
        "findings": "General dictionaries misclassify finance words (e.g. liability, tax).",
        "limitations": "Lexicon only; no contextual understanding.",
        "differs": "We use learned TF-IDF classifiers trained on social-media finance text.",
        "link": "https://doi.org/10.1111/j.1540-6261.2010.00395.x",
        "verified": True,
    },
    {
        "title": "FinBERT: Financial sentiment analysis with pre-trained language models",
        "authors": "D. Araci",
        "year": 2019,
        "venue": "arXiv:1908.10063",
        "dataset": "Financial PhraseBank + other finance corpora",
        "modality": "Text (financial news/phrases)",
        "methodology": "BERT pre-trained/fine-tuned on financial text",
        "algorithms": "BERT (transformer)",
        "metrics": "Accuracy / F1 (dataset-dependent)",
        "findings": "Transformer fine-tuning outperforms lexicon and classical bag-of-words on finance benchmarks.",
        "limitations": "Higher compute cost; benchmark-dependent.",
        "differs": "We benchmark classical TF-IDF models as a lightweight baseline; FinBERT is a future comparison (not bundled).",
        "link": "https://arxiv.org/abs/1908.10063",
        "verified": True,
    },
    {
        "title": "Good debt or bad debt: Detecting semantic orientations in economic texts",
        "authors": "P. Malo, A. Sinha, P. Korhonen, J. Wallenius, P. Takala",
        "year": 2014,
        "venue": "Journal of the Association for Information Science and Technology",
        "dataset": "Financial PhraseBank (4,840 sentences)",
        "modality": "Text (financial news sentences)",
        "methodology": "Human-annotated benchmark (16 annotators)",
        "algorithms": "Multiple (benchmark)",
        "metrics": "Accuracy",
        "findings": "Established a high-quality finance sentiment benchmark.",
        "limitations": "News sentences, not social media; small scale.",
        "differs": "We use PhraseBank for cross-domain evaluation, Twitter data for main training.",
        "link": "https://doi.org/10.1002/asi.23258",
        "verified": True,
    },
    {
        "title": "Attention is all you need",
        "authors": "A. Vaswani et al.",
        "year": 2017,
        "venue": "NeurIPS",
        "dataset": "General (machine translation)",
        "modality": "Text (general)",
        "methodology": "Transformer architecture",
        "algorithms": "Transformer",
        "metrics": "BLEU etc.",
        "findings": "Foundation for BERT/FinBERT.",
        "limitations": "Not finance-specific.",
        "differs": "Background only.",
        "link": "https://arxiv.org/abs/1706.03762",
        "verified": True,
    },
    {
        "title": "BERT: Pre-training of deep bidirectional transformers for language understanding",
        "authors": "J. Devlin, M.-W. Chang, K. Lee, K. Toutanova",
        "year": 2019,
        "venue": "NAACL-HLT",
        "dataset": "General corpora",
        "modality": "Text (general)",
        "methodology": "Pre-trained transformer",
        "algorithms": "BERT",
        "metrics": "GLUE etc.",
        "findings": "Contextual embeddings foundation.",
        "limitations": "Not finance-specific.",
        "differs": "Background for FinBERT comparison.",
        "link": "https://arxiv.org/abs/1810.04805",
        "verified": True,
    },
]


@app.get("/api/research/articles")
def research_articles():
    return RESEARCH_ARTICLES


# ---------- Reports ----------
@app.get("/api/reports/export-csv")
def export_csv(user=Depends(get_current_user), ticker: Optional[str] = None, modality: Optional[str] = None):
    clauses = ["user_id=?"]
    params: list = [user["id"]]
    if ticker and ticker.strip():
        clauses.append("tickers LIKE ?")
        params.append(f"%{ticker.strip().upper()}%")
    if modality and modality != "all":
        clauses.append("modality=?")
        params.append(modality)

    conn = get_conn()
    try:
        rows = conn.execute(
            f"SELECT * FROM analyses WHERE {' AND '.join(clauses)} ORDER BY created_at DESC",
            tuple(params),
        ).fetchall()
    finally:
        conn.close()

    out = io.StringIO()
    w = csv.writer(out)
    w.writerow([
        "id", "modality", "model_used", "platform", "input_text", "extracted_text",
        "sentiment", "confidence", "emotion", "engagement_score", "tickers", "status", "created_at",
    ])
    for r in rows:
        d = dict(r)
        w.writerow([
            d.get("id"), d.get("modality"), d.get("model_used"), d.get("platform"),
            d.get("input_text"), d.get("extracted_text"), d.get("sentiment"), d.get("confidence"),
            d.get("emotion"), d.get("engagement_score"), d.get("tickers"), d.get("status"), d.get("created_at"),
        ])
    path = os.path.join(settings.upload_dir, f"export_{user['id']}.csv")
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        f.write(out.getvalue())
    return FileResponse(path, filename="finsentinel_analyses.csv", media_type="text/csv")


@app.post("/api/reports/generate-pdf")
def generate_pdf(payload: Optional[ReportGenerateIn] = None, user=Depends(get_current_user)):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from textwrap import wrap

    rtype = (payload.report_type if payload and payload.report_type else "summary").lower()
    ticker_filter = payload.ticker.strip().upper().lstrip("$") if payload and payload.ticker else None

    conn = get_conn()
    try:
        if ticker_filter:
            analyses = conn.execute(
                "SELECT * FROM analyses WHERE user_id=? AND tickers LIKE ? ORDER BY created_at DESC LIMIT 60",
                (user["id"], f"%{ticker_filter}%"),
            ).fetchall()
        elif rtype == "multimodal":
            analyses = conn.execute(
                "SELECT * FROM analyses WHERE user_id=? AND modality IN ('image','audio','video') ORDER BY created_at DESC LIMIT 60",
                (user["id"],),
            ).fetchall()
        else:
            analyses = conn.execute(
                "SELECT * FROM analyses WHERE user_id=? ORDER BY created_at DESC LIMIT 60",
                (user["id"],),
            ).fetchall()
    finally:
        conn.close()

    eval_path = os.path.join(MODEL_DIR, "evaluation_results.json")
    eval_data = {}
    if os.path.exists(eval_path):
        with open(eval_path, encoding="utf-8") as f:
            eval_data = json.load(f)

    rid = uid()
    path = os.path.join(settings.upload_dir, f"report_{rid}.pdf")
    c = canvas.Canvas(path, pagesize=A4)
    width, height = A4
    y = height - 50

    def ensure_space(need: int = 20):
        nonlocal y
        if y < 60 + need:
            c.showPage()
            y = height - 50

    def draw_wrapped(text: str, font="Helvetica", size=9, leading=13, indent=50, max_chars=96):
        nonlocal y
        c.setFont(font, size)
        for line in wrap(text, max_chars) or [""]:
            ensure_space(leading)
            c.drawString(indent, y, line)
            y -= leading

    title_map = {
        "summary": "FinSentinel — Financial Sentiment Analysis Summary",
        "models": "FinSentinel — Model Evaluation & Benchmark Report",
        "ticker": f"FinSentinel — Ticker Sentiment Report (${ticker_filter or 'ALL'})",
        "multimodal": "FinSentinel — Multimodal Analysis Report",
    }
    report_title = title_map.get(rtype, title_map["summary"])

    c.setFont("Helvetica-Bold", 15)
    c.drawString(50, y, report_title)
    y -= 22
    c.setFont("Helvetica", 9)
    c.drawString(50, y, f"Generated: {now_iso()} | Researcher: {user.get('full_name') or user['email']} ({user['email']})")
    y -= 14
    draw_wrapped(
        "Research Disclaimer: Sentiment analysis describes expressed opinion in analysed content. "
        "It is NOT stock-price prediction, a trading signal, or financial advice.",
        font="Helvetica-Oblique",
        size=8.5,
    )
    y -= 10

    if rtype in ("summary", "models"):
        ensure_space(40)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Measured Model Evaluation (Twitter Financial News, 80:20 stratified split)")
        y -= 16
        for r in eval_data.get("results", []):
            if r["dataset"] == "twitter_financial_news":
                draw_wrapped(
                    f"{r['model']}: Acc={r['accuracy']:.4f} | Macro-P={r['precision_macro']:.4f} | "
                    f"Macro-R={r['recall_macro']:.4f} | Macro-F1={r['f1_macro']:.4f} | Train={r['train_time_s']}s",
                    size=8.5,
                )
        y -= 10

    if rtype != "models":
        ensure_space(40)
        c.setFont("Helvetica-Bold", 11)
        section_label = f"Included Analyses ({len(analyses)})"
        if ticker_filter:
            section_label += f" — Ticker ${ticker_filter}"
        c.drawString(50, y, section_label)
        y -= 16
        if not analyses:
            draw_wrapped("No persisted analyses matched this report filter.", size=9)
        else:
            for a in analyses:
                conf_txt = f"{a['confidence']:.3f}" if a["confidence"] is not None else "n/a"
                sent_txt = a["sentiment"] or "unclassified"
                snippet = (a["input_text"] or a["extracted_text"] or "").replace("\n", " ").strip()
                draw_wrapped(
                    f"[{a['created_at'][:19]}] {a['modality'].upper()} | {sent_txt} (conf: {conf_txt}) — {snippet[:140]}",
                    size=8.5,
                    leading=11.5,
                )
                y -= 2

    c.save()
    created = now_iso()
    summary = f"{len(analyses)} analyses included" + (f" (${ticker_filter})" if ticker_filter else "")
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO reports (id, user_id, title, report_type, file_path, summary, created_at) VALUES (?,?,?,?,?,?,?)",
            (rid, user["id"], report_title, rtype, path, summary, created),
        )
        conn.commit()
    finally:
        conn.close()
    return FileResponse(path, filename=f"finsentinel_{rtype}_report.pdf", media_type="application/pdf")


@app.get("/api/reports/{report_id}/download")
def download_report(report_id: str, user=Depends(get_current_user)):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM reports WHERE id=? AND user_id=?",
            (report_id, user["id"]),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found.")
    path = row["file_path"]
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Generated report file is no longer available on disk.")
    return FileResponse(path, filename=f"finsentinel_{row['report_type']}_report.pdf", media_type="application/pdf")


@app.get("/api/reports")
def list_reports(user=Depends(get_current_user)):
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM reports WHERE user_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


# Serve uploads (for previewing uploaded media in frontend)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
