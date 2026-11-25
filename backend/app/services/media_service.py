"""Media service: image OCR, audio transcription, video processing.
All functions degrade gracefully with honest status when optional deps/binaries are missing.
Never fabricates results.
"""
import os, shutil, subprocess

def check_ocr_available():
    if shutil.which("tesseract"):
        return True, "tesseract binary found"
    try:
        import rapidocr_onnxruntime  # noqa
        return True, "RapidOCR (ONNX) available"
    except ImportError:
        pass
    try:
        import pytesseract  # noqa
        return False, "pytesseract installed but tesseract binary missing"
    except ImportError:
        return False, "No OCR engine. Install: pip install rapidocr-onnxruntime  (or apt install tesseract-ocr && pip install pytesseract)"

_rapid_ocr = None

def _get_rapid_ocr():
    global _rapid_ocr
    if _rapid_ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _rapid_ocr = RapidOCR()
    return _rapid_ocr

def ocr_image(image_path: str) -> dict:
    available, reason = check_ocr_available()
    if not available:
        return {"status": "ocr_unavailable", "extracted_text": "", "confidence": None,
                "reason": reason,
                "fallback": "Install an OCR engine (pip install rapidocr-onnxruntime) or provide the text manually. "
                            "Image metadata analysis is still performed."}
    if not shutil.which("tesseract"):
        try:
            engine = _get_rapid_ocr()
            result, _ = engine(image_path)
            if not result:
                return {"status": "completed", "extracted_text": "", "confidence": None,
                        "engine": "rapidocr-onnx",
                        "note": "No text detected in this image. Visual category cannot be inferred reliably."}
            texts = [r[1] for r in result]
            confs = [float(r[2]) for r in result if len(r) > 2]
            return {"status": "completed", "extracted_text": " ".join(texts).strip(),
                    "confidence": round(sum(confs) / len(confs) * 100, 2) if confs else None,
                    "engine": "rapidocr-onnx"}
        except Exception as e:
            return {"status": "failed", "extracted_text": "", "confidence": None, "reason": f"RapidOCR failed: {e}"}
    try:
        import pytesseract
        from PIL import Image
        text = pytesseract.image_to_string(Image.open(image_path))
        data = pytesseract.image_to_data(Image.open(image_path), output_type=pytesseract.Output.DICT)
        confs = [int(c) for c in data.get("conf", []) if int(c) >= 0]
        avg_conf = sum(confs) / len(confs) if confs else None
        return {"status": "completed", "extracted_text": text.strip(),
                "confidence": round(float(avg_conf), 2) if avg_conf is not None else None,
                "engine": "tesseract"}
    except Exception as e:
        return {"status": "failed", "extracted_text": "", "confidence": None, "reason": str(e)}

def analyze_image_basic(image_path: str) -> dict:
    """Metadata + dominant colors via Pillow/OpenCV (always available)."""
    result = {"status": "completed"}
    try:
        from PIL import Image
        import numpy as np
        img = Image.open(image_path).convert("RGB")
        result["width"], result["height"] = img.size
        result["format"] = img.format
        arr = np.array(img.resize((64, 64)))
        result["mean_rgb"] = [round(float(x), 1) for x in arr.mean(axis=(0, 1))]
        result["brightness"] = round(float(arr.mean()), 2)
    except Exception as e:
        result["status"] = "failed"
        result["reason"] = str(e)
    return result

def check_whisper_available():
    try:
        import whisper  # noqa
        return True, "openai-whisper installed"
    except ImportError:
        return False, "openai-whisper not installed. Install: pip install openai-whisper (requires torch, ~1GB). Alternative: provide manual transcript."

def transcribe_audio(audio_path: str, model_size: str = "tiny") -> dict:
    available, reason = check_whisper_available()
    if not available:
        return {"status": "transcription_unavailable", "transcript": "", "confidence": None,
                "reason": reason,
                "fallback": "Provide a manual transcript in the analysis form. "
                            "Audio emotion recognition also requires a trained model (see docs)."}
    try:
        import whisper
        model = whisper.load_model(model_size)
        res = model.transcribe(audio_path)
        return {"status": "completed", "transcript": res.get("text", "").strip(),
                "language": res.get("language"), "engine": f"whisper-{model_size}"}
    except Exception as e:
        return {"status": "failed", "transcript": "", "reason": str(e)}

def extract_video_frames(video_path: str, output_dir: str, interval_sec: int = 2, max_frames: int = 10) -> dict:
    try:
        import cv2
        os.makedirs(output_dir, exist_ok=True)
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"status": "failed", "reason": "OpenCV could not open video.", "frames": []}
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = total / fps if fps else 0
        step = max(1, int(fps * interval_sec))
        frames, idx = [], 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % step == 0 and len(frames) < max_frames:
                fp = os.path.join(output_dir, f"frame_{len(frames):02d}.jpg")
                cv2.imwrite(fp, frame)
                frames.append(fp)
            idx += 1
        cap.release()
        return {"status": "completed", "frames": frames, "duration_sec": round(float(duration), 2),
                "fps": round(float(fps), 2), "total_frames": total}
    except Exception as e:
        return {"status": "failed", "reason": str(e), "frames": []}

def _get_ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
        if ff and os.path.exists(ff):
            return ff
    except Exception:
        pass
    return None

def check_ffmpeg_available():
    return _get_ffmpeg_exe() is not None

def extract_video_audio(video_path: str, output_path: str) -> dict:
    ffmpeg_exe = _get_ffmpeg_exe()
    if not ffmpeg_exe:
        return {"status": "audio_extraction_unavailable", "reason": "ffmpeg not found. Install ffmpeg to extract video audio.",
                "fallback": "Provide transcript manually or install ffmpeg."}
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        subprocess.run([ffmpeg_exe, "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
                        "-ar", "16000", "-ac", "1", output_path],
                       capture_output=True, timeout=120, check=True)
        return {"status": "completed", "audio_path": output_path}
    except subprocess.CalledProcessError as e:
        err = (e.stderr or b"").decode("utf-8", errors="ignore").strip()
        if "does not contain any stream" in err or "Output file does not contain any stream" in err:
            return {"status": "no_audio_track", "reason": "Video file does not contain an audio stream."}
        return {"status": "failed", "reason": err[:300] or str(e)}
    except Exception as e:
        return {"status": "failed", "reason": str(e)}
