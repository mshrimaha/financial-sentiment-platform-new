"""ML service: text preprocessing, TF-IDF inference, keyword extraction, ticker extraction, engagement, fusion."""
import re, os, pickle, json
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "models")
_vectorizer = None
_best_model = None
_all_models = None
_model_info = {}


def _load():
    """Load artifacts independently so a missing optional file is not fatal."""
    global _vectorizer, _best_model, _all_models, _model_info
    if _vectorizer is not None:
        return

    def _try(fname, loader):
        path = os.path.join(MODEL_DIR, fname)
        if not os.path.exists(path):
            return None, f"{fname} not found"
        try:
            with open(path, "rb") as f:
                return loader(f), None
        except Exception as e:
            return None, f"{fname}: {e}"

    _vectorizer, err = _try("vectorizer.pkl", pickle.load)
    if err:
        print(f"[ml_service] {err} — run scripts/train_models.py")
        return
    _best_model, err = _try("best_model.pkl", pickle.load)
    if err:
        print(f"[ml_service] {err}")
    _all_models, err = _try("all_models.pkl", pickle.load)   # optional
    if err:
        print(f"[ml_service] optional {err} — model selection falls back to the best model")
    info_path = os.path.join(MODEL_DIR, "model_info.json")
    if os.path.exists(info_path):
        try:
            with open(info_path, "r", encoding="utf-8") as f:
                _model_info = json.load(f)
        except Exception:
            _model_info = {}


_load()


def clean_text(text: str) -> str:
    if not text:
        return ""
    t = text.lower()
    t = re.sub(r"https?://\S+|www\.\S+", " ", t)
    t = re.sub(r"@\w+", " ", t)
    t = re.sub(r"\$([a-z]{1,5})\b", r" ticker_\1 ", t)
    t = re.sub(r"#(\w+)", r" \1 ", t)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


TICKER_RE = re.compile(r"\$([A-Za-z]{1,5})\b")
KNOWN_TICKERS = {"AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "AMD", "NFLX", "JPM", "BYND", "CCL", "RCL", "DELL", "HPE", "ALLY", "SAN", "CX", "ESS", "PRTY"}


def extract_tickers(text: str):
    if not text:
        return []
    found = [m.upper() for m in TICKER_RE.findall(text)]
    for tok in KNOWN_TICKERS:
        if re.search(rf"\b{tok}\b", text) and tok not in found:
            found.append(tok)
    return sorted(set(found))


def extract_tfidf_keywords(X, top_n: int = 8) -> list[dict]:
    """Extract highest-weighted TF-IDF terms actually matched in the input vector."""
    if _vectorizer is None or X is None:
        return []
    try:
        names = _vectorizer.get_feature_names_out()
        row = X.tocoo()
        pairs = sorted(zip(row.col, row.data), key=lambda p: p[1], reverse=True)
        out = []
        for idx, weight in pairs[:top_n]:
            term = str(names[idx])
            out.append({"term": term, "weight": round(float(weight), 4)})
        return out
    except Exception:
        return []


EMOJI_SENTIMENT_HINT = {
    "🚀": "bullish", "📈": "bullish", "💰": "bullish", "🔥": "bullish", "🤑": "bullish",
    "📉": "bearish", "💀": "bearish", "😱": "bearish", "🔻": "bearish",
    "😂": "amusement", "🤣": "amusement", "😍": "positive_emotion", "❤️": "positive_emotion",
    "😡": "anger", "👎": "negative_emotion", "👍": "positive_emotion", "😢": "sadness",
    "😮": "surprise", "🤔": "uncertainty",
}


def emoji_analysis(text: str):
    if not text:
        return {"emojis_found": [], "emotion_hint": None, "note": "No text provided."}
    emojis = []
    for ch in text:
        if ch in EMOJI_SENTIMENT_HINT:
            emojis.append({"emoji": ch, "hint": EMOJI_SENTIMENT_HINT[ch]})
    return {
        "emojis_found": emojis,
        "emotion_hint": emojis[0]["hint"] if emojis else None,
        "note": "Emoji hints are engagement/emotion signals only — NOT financial sentiment labels.",
    }


def predict_sentiment(text: str, model_name: str = None):
    """Returns dict with sentiment, confidence, probabilities, keywords. Uses real trained model."""
    if _vectorizer is None or _best_model is None:
        return {"error": "Model not loaded. Run scripts/train_models.py first.", "sentiment": None}
    cleaned = clean_text(text)
    if not cleaned.strip():
        return {"error": "No analyzable text remains after preprocessing.", "sentiment": None}
    X = _vectorizer.transform([cleaned])
    model = _best_model
    used = _model_info.get("best_model", "Linear SVM")
    if model_name and _all_models and model_name in _all_models:
        model = _all_models[model_name]
        used = model_name
    pred = model.predict(X)[0]
    probs = {}
    try:
        if hasattr(model, "predict_proba"):
            p = model.predict_proba(X)[0]
            classes = list(model.classes_)
            probs = {str(c): float(v) for c, v in zip(classes, p)}
        elif hasattr(model, "decision_function"):
            d = model.decision_function(X)[0]
            classes = list(model.classes_)
            e = np.exp(d - d.max())
            p = e / e.sum()
            probs = {str(c): float(v) for c, v in zip(classes, p)}
    except Exception:
        probs = {}
    conf = float(probs.get(str(pred), 0.0)) if probs else None
    mapping = {"positive": "bullish (positive)", "negative": "bearish (negative)", "neutral": "neutral"}
    available_models = list(_all_models.keys()) if _all_models else [used]
    return {
        "sentiment": str(pred),
        "sentiment_label": mapping.get(str(pred), str(pred)),
        "confidence": conf,
        "probabilities": probs,
        "model_used": used,
        "available_models": available_models,
        "cleaned_text": cleaned,
        "keywords": extract_tfidf_keywords(X),
        "tickers": extract_tickers(text),
    }


def engagement_score(reactions: dict) -> dict:
    """reactions: {like, love, angry, sad, laugh, surprise, thumbs_up, ...} -> engagement score 0-100.
    Engagement is SEPARATE from sentiment."""
    if not reactions:
        return {"engagement_score": None, "total_reactions": 0, "level": "unknown",
                "note": "No reaction data supplied."}
    weights = {"like": 1, "thumbs_up": 1, "love": 2, "heart": 2, "fire": 2, "laugh": 1,
               "angry": 1, "sad": 1, "dislike": 1, "thumbs_down": 1, "surprise": 1}
    total = sum(int(v or 0) for v in reactions.values())
    weighted = sum(int(v or 0) * weights.get(k.lower(), 1) for k, v in reactions.items())
    import math
    score = min(100.0, (math.log1p(weighted) / math.log1p(1000)) * 100) if weighted > 0 else 0.0
    level = "high" if score >= 66 else ("medium" if score >= 33 else "low")
    emotion_groups = {
        "positive_emotion": sum(int(reactions.get(k, 0) or 0) for k in ["like", "love", "heart", "fire", "thumbs_up"]),
        "negative_emotion": sum(int(reactions.get(k, 0) or 0) for k in ["dislike", "angry", "sad", "thumbs_down"]),
        "amusement": int(reactions.get("laugh", 0) or 0),
        "surprise": int(reactions.get("surprise", 0) or 0),
    }
    return {"engagement_score": round(float(score), 2), "total_reactions": total,
            "level": level, "emotion_distribution": emotion_groups,
            "note": "Reactions measure engagement/emotion, not bullish/bearish opinion."}


def fuse_modalities(modality_results: list) -> dict:
    """Late fusion: weighted vote by confidence. Missing modalities are ignored (not treated as neutral)."""
    valid = [m for m in modality_results if m.get("sentiment") in ("positive", "negative", "neutral") and m.get("confidence") is not None]
    if not valid:
        return {"overall_sentiment": None, "overall_confidence": None, "contributors": [],
                "explanation": "No modality produced a usable sentiment prediction."}
    weights = {"text": 0.5, "image_ocr_text": 0.3, "audio_transcript": 0.3, "video_transcript": 0.3, "video_ocr": 0.2}
    scores = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    conf_sum = 0.0
    w_sum = 0.0
    for m in valid:
        w = weights.get(m["modality"], 0.25)
        scores[m["sentiment"]] += w * float(m["confidence"])
        conf_sum += float(m["confidence"]) * w
        w_sum += w
    total = sum(scores.values()) or 1.0
    for k in scores:
        scores[k] /= total
    mean_conf = conf_sum / w_sum if w_sum else None
    overall = max(scores, key=scores.get)
    sorted_scores = sorted(scores.values(), reverse=True)
    is_mixed = len(sorted_scores) >= 2 and (sorted_scores[0] - sorted_scores[1]) < 0.15
    label = "mixed" if is_mixed else overall
    return {
        "overall_sentiment": label,
        "overall_confidence": round(float(mean_conf), 4) if mean_conf is not None else None,
        "vote_share": round(float(scores[overall]), 4),
        "weighted_scores": {k: round(float(v), 4) for k, v in scores.items()},
        "contributors": [m["modality"] for m in valid],
        "explanation": f"Fused {len(valid)} modality prediction(s) via confidence-weighted late fusion. "
                       f"Unavailable modalities ignored (never counted as neutral).",
    }
