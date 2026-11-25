"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Image as ImageIcon,
  Info,
  Layers,
  Mic,
  ScanSearch,
  Trash2,
  Type,
  Upload,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, ErrorState, Notice, ProgressBar, SectionTitle } from "@/components/ui";
import { EASE_OUT, FadeIn } from "@/components/Motion";
import { useToast } from "@/components/Toast";
import { RequireAuth } from "@/lib/auth";
import { apiGet, apiPost, apiUploadWithProgress, fmtFullDate, sentimentColor } from "@/lib/api";

type Tab = "text" | "image" | "audio" | "video";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "text", label: "Text & Reactions", icon: Type },
  { id: "image", label: "Image / Sticker / GIF", icon: ImageIcon },
  { id: "audio", label: "Audio / Voice", icon: Mic },
  { id: "video", label: "Video / Reel", icon: Video },
];

const REACTIONS = ["like", "love", "angry", "sad", "laugh", "surprise", "fire", "thumbs_up", "thumbs_down"];
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXT: Record<Exclude<Tab, "text">, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"],
  audio: [".wav", ".mp3", ".m4a", ".ogg", ".flac"],
  video: [".mp4", ".mov", ".avi", ".mkv", ".webm"],
};

const SAMPLES = [
  { label: "Bullish earnings", text: "Apple reported stronger-than-expected earnings and increased its revenue guidance.", ticker: "AAPL" },
  { label: "Cashtag rally", text: "$NVDA breaks out after data-center revenue beat and raised Q4 outlook 🚀", ticker: "NVDA" },
  { label: "Bearish miss", text: "$TSLA deliveries missed consensus estimates and management trimmed margin guidance.", ticker: "TSLA" },
];

function AnalyzeInner() {
  const params = useSearchParams();
  const { notify } = useToast();
  const initialTab = (params.get("tab") as Tab) || "text";
  const [tab, setTab] = useState<Tab>(["text", "image", "audio", "video"].includes(initialTab) ? initialTab : "text");

  const [text, setText] = useState("");
  const [ticker, setTicker] = useState("");
  const [platform, setPlatform] = useState("");
  const [modelName, setModelName] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [manualTranscript, setManualTranscript] = useState("");
  const [health, setHealth] = useState<{ ocr_available?: boolean; whisper_available?: boolean; ffmpeg_available?: boolean } | null>(null);

  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGet<{ available_models?: string[]; best_model?: string }>("/api/models/info")
      .then((info) => {
        if (info.available_models?.length) setAvailableModels(info.available_models);
        if (info.best_model) setModelName(info.best_model);
      })
      .catch(() => {});
    apiGet<any>("/api/health").then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = tab === "image" ? ".jpg,.jpeg,.png,.gif,.bmp,.webp" : tab === "audio" ? ".wav,.mp3,.m4a,.ogg,.flac" : tab === "video" ? ".mp4,.mov,.avi,.mkv,.webm" : "";

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function resetAll() {
    setResult(null);
    setError(null);
    setUploadPct(0);
    clearFile();
    setManualTranscript("");
  }

  function onSelectFile(selected: File | null) {
    setError(null);
    if (!selected || tab === "text") return;
    const ext = "." + (selected.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT[tab].includes(ext)) {
      setError(`Unsupported ${tab} file extension '${ext}'. Allowed: ${ALLOWED_EXT[tab].join(", ")}`);
      clearFile();
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setError(`File size (${(selected.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 50 MB limit.`);
      clearFile();
      return;
    }
    if (selected.size === 0) {
      setError("The selected file is empty (0 bytes).");
      clearFile();
      return;
    }
    setFile(selected);
  }

  async function run() {
    setError(null);
    setResult(null);
    setBusy(true);
    setUploadPct(0);
    try {
      if (tab === "text") {
        if (text.trim().length < 3) {
          throw new Error("Please enter at least 3 characters of financial text.");
        }
        setStage("Preprocessing text, extracting tickers, running TF-IDF classifier…");
        const cleanedReactions = Object.fromEntries(Object.entries(reactions).filter(([, v]) => v > 0));
        const r = await apiPost("/api/analyze/text", {
          text,
          ticker: ticker.trim() || null,
          platform: platform || null,
          reactions: cleanedReactions,
          model_name: modelName || null,
        });
        setResult({ kind: "text", data: r });
        notify("Text analysis saved to history.", "success");
      } else {
        if (!file) throw new Error(`Please select a ${tab} file to analyze.`);
        const form = new FormData();
        form.append("file", file);
        if (ticker.trim()) form.append("ticker", ticker.trim());
        if (platform) form.append("platform", platform);
        if (tab === "image") {
          setStage("Uploading image, running RapidOCR text extraction, classifying…");
        } else {
          if (manualTranscript.trim()) form.append("manual_transcript", manualTranscript.trim());
          setStage(tab === "audio" ? "Uploading audio and classifying transcript…" : "Uploading video, sampling frames, extracting audio & OCR…");
        }
        const r = await apiUploadWithProgress(`/api/analyze/${tab}`, form, (pct) => setUploadPct(pct));
        setResult({ kind: tab, data: r });
        notify(`${tab[0].toUpperCase() + tab.slice(1)} analysis completed.`, "success");
      }
    } catch (e: any) {
      setError(e?.message || "Analysis failed. No fabricated result was produced.");
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  const fusion = result?.data?.fusion ?? null;
  const overallSentiment = fusion?.overall_sentiment ?? result?.data?.sentiment?.sentiment ?? null;
  const perModality: { modality: string; sentiment: string; confidence: number | null }[] =
    result?.data?.modality_results ?? [];

  return (
    <AppShell
      title="Multimodal Analyzer"
      subtitle="Run text, image/OCR, audio, and video sentiment analysis with confidence-aware fusion"
    >
      <FadeIn className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
        {/* Input Workspace */}
        <div className="space-y-5">
          <div role="tablist" aria-label="Content modality" className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.1] bg-navy-900 p-1 sm:grid-cols-4">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => {
                    setTab(id);
                    resetAll();
                  }}
                  className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                    active ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="analyzer-tab-pill"
                      className="absolute inset-0 -z-10 rounded-lg bg-accent shadow-sm"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon size={14} />
                  <span className="truncate">{label.split(" / ")[0]}</span>
                </button>
              );
            })}
          </div>

          <Card>
            <SectionTitle
              title={TABS.find((t) => t.id === tab)?.label || "Input"}
              subtitle={tab === "text" ? "Enter financial post, headline, or social commentary" : `Upload validated ${tab} file (max 50 MB)`}
              action={
                tab === "text" && (
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLES.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          setText(s.text);
                          setTicker(s.ticker);
                          setError(null);
                        }}
                        className="rounded-md border border-white/[0.1] bg-navy-900 px-2.5 py-1 text-[11px] text-slate-300 hover:border-accent/50 hover:text-white"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )
              }
            />

            {tab === "text" ? (
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="post-input">
                    Financial text
                  </label>
                  <textarea
                    id="post-input"
                    rows={5}
                    className="input resize-y"
                    placeholder="Apple reported stronger-than-expected earnings and increased its revenue guidance."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="tabular font-mono">{text.length} characters</span>
                    <span>Cashtags like $AAPL or $NVDA are extracted automatically</span>
                  </div>
                </div>

                {availableModels.length > 0 && (
                  <div>
                    <label className="label" htmlFor="model-select">
                      Classifier
                    </label>
                    <select
                      id="model-select"
                      className="input"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <p className="label">
                    Optional reactions{" "}
                    <span className="normal-case text-slate-500">(tracked as engagement &amp; emotion — never sentiment)</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {REACTIONS.map((r) => (
                      <div key={r} className="flex items-center justify-between gap-1.5 rounded-lg border border-white/[0.08] bg-navy-900 px-2.5 py-1.5">
                        <label htmlFor={`rx-${r}`} className="truncate text-[11px] capitalize text-slate-400">
                          {r.replace("_", " ")}
                        </label>
                        <input
                          id={`rx-${r}`}
                          type="number"
                          min={0}
                          value={reactions[r] ?? ""}
                          onChange={(e) => setReactions({ ...reactions, [r]: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })}
                          className="tabular w-12 rounded border border-white/[0.1] bg-canvas px-1.5 py-0.5 text-right font-mono text-[11px] text-slate-200 outline-none focus:border-accent"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                  }}
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/[0.15] bg-navy-900/60 px-4 py-8 text-center transition-colors hover:border-accent/50 hover:bg-white/[0.03]"
                >
                  <Upload size={20} className="text-cyan-light" />
                  <p className="text-sm font-medium text-slate-200">
                    {file ? file.name : `Select a ${tab} file to analyze`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Allowed: {ALLOWED_EXT[tab].join(", ")} · Max 50 MB
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={accept}
                  className="hidden"
                  onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
                />

                {file && (
                  <div className="rounded-lg border border-white/[0.1] bg-navy-900 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-200">
                        {file.name}{" "}
                        <span className="font-mono text-[11px] text-slate-500">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-bear/10 hover:text-red-300"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                    {previewUrl && tab === "image" && (
                      <img src={previewUrl} alt="Selected upload preview" className="mt-2.5 max-h-48 w-full rounded bg-canvas object-contain" />
                    )}
                    {previewUrl && tab === "audio" && (
                      <audio controls src={previewUrl} className="mt-2.5 w-full" />
                    )}
                    {previewUrl && tab === "video" && (
                      <video controls src={previewUrl} className="mt-2.5 max-h-48 w-full rounded bg-canvas" />
                    )}
                  </div>
                )}

                {(tab === "audio" || tab === "video") && (
                  <div>
                    <label className="label" htmlFor="manual-transcript">
                      Manual transcript{" "}
                      <span className="normal-case text-slate-500">
                        ({health?.whisper_available ? "optional override" : "recommended — Whisper not installed"})
                      </span>
                    </label>
                    <textarea
                      id="manual-transcript"
                      rows={3}
                      className="input resize-y"
                      placeholder="Enter spoken financial commentary from the clip…"
                      value={manualTranscript}
                      onChange={(e) => setManualTranscript(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ticker-meta">
                  Ticker symbol <span className="normal-case text-slate-500">(optional)</span>
                </label>
                <input
                  id="ticker-meta"
                  className="input font-mono uppercase"
                  placeholder="AAPL"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="platform-meta">
                  Source / Platform <span className="normal-case text-slate-500">(optional)</span>
                </label>
                <select id="platform-meta" className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="">Not specified</option>
                  {["X / Twitter", "Reddit", "StockTwits", "YouTube", "Earnings Call", "News / Press", "WhatsApp", "Other"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button type="button" onClick={run} disabled={busy} className="btn-primary flex-1 py-2.5">
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    <span>{tab !== "text" && uploadPct > 0 && uploadPct < 100 ? `Uploading (${uploadPct}%)…` : "Analyzing…"}</span>
                  </>
                ) : (
                  <>
                    <ScanSearch size={15} /> Analyze content
                  </>
                )}
              </button>
              {(result || file || text || manualTranscript) && (
                <button
                  type="button"
                  onClick={() => {
                    resetAll();
                    setText("");
                    setTicker("");
                    setPlatform("");
                    setReactions({});
                  }}
                  className="btn-ghost"
                  aria-label="Clear form"
                >
                  <X size={15} /> Clear
                </button>
              )}
            </div>

            {busy && tab !== "text" && uploadPct > 0 && (
              <div className="mt-3">
                <ProgressBar value={uploadPct} color="#22d3ee" />
              </div>
            )}
            {busy && stage && <p className="mt-2 text-center text-[11px] text-slate-400">{stage}</p>}
          </Card>

          <Notice>
            <strong>Live runtime status:</strong> RapidOCR is {health?.ocr_available ? "active" : "unavailable"} ·
            ffmpeg is {health?.ffmpeg_available ? "active" : "unavailable"} ·
            Whisper is {health?.whisper_available ? "active" : "manual transcript fallback"}.
          </Notice>
        </div>

        {/* Report Output Panel */}
        <div className="space-y-5">
          {error && <ErrorState message={error} onRetry={run} />}

          {!result && !error && (
            <div className="flex min-h-[460px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.01] p-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] text-cyan-light">
                <Layers size={20} />
              </div>
              <p className="text-sm font-semibold text-white">Analysis output appears here</p>
              <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                Submit text or media to view predicted sentiment, confidence, class probabilities, matched TF-IDF terms,
                tickers, and fusion breakdown.
              </p>
            </div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div
                key={result.data.id || "result"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
                className="space-y-6"
              >
                {/* Open Summary Header */}
                <div className="border-b border-white/[0.08] pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Combined Financial Sentiment
                      </p>
                      <p className="mt-1 text-3xl font-semibold capitalize" style={{ color: sentimentColor(overallSentiment) }}>
                        {overallSentiment ?? "Not determined"}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">
                        {fmtFullDate(result.data.created_at)} · ID {result.data.id?.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge tone={result.data.status === "completed" ? "green" : "amber"}>
                        {result.data.status === "completed" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {result.data.status}
                      </Badge>
                      {result.data.id && (
                        <Link href={`/history/${result.data.id}`} className="inline-flex items-center gap-1 text-[11px] text-accent-light hover:underline">
                          Open full record <ArrowUpRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>

                  {fusion && (
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>Fusion confidence</span>
                        <span className="tabular font-mono font-semibold text-white">
                          {fusion.overall_confidence != null ? `${(fusion.overall_confidence * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <ProgressBar value={(fusion.overall_confidence ?? 0) * 100} color={sentimentColor(overallSentiment)} />
                      {fusion.weighted_scores && (
                        <div className="grid grid-cols-3 gap-3 pt-1.5">
                          {Object.entries(fusion.weighted_scores).map(([k, v]: any) => (
                            <div key={k} className="border-l-2 border-white/[0.08] pl-2.5">
                              <p className="text-[10px] uppercase text-slate-500">{k}</p>
                              <p className="tabular font-mono text-xs font-semibold" style={{ color: sentimentColor(k) }}>
                                {(v * 100).toFixed(1)}%
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-xs leading-relaxed text-slate-400">{result.data.explanation || fusion?.explanation}</p>
                </div>

                {/* Modality Contributions */}
                <div>
                  <SectionTitle
                    title="Modality Contributions"
                    subtitle={perModality.length ? `${perModality.length} active modality prediction(s)` : "No modality produced a sentiment score"}
                  />
                  {perModality.length === 0 ? (
                    <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3.5 py-2.5 text-xs text-amber-200/90">
                      No readable text or transcript was detected, so no financial sentiment is claimed. Unavailable
                      modalities are excluded rather than scored neutral.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {perModality.map((m, i) => (
                        <div key={i} className="rounded-lg border border-white/[0.08] bg-surface/60 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium capitalize text-slate-200">{m.modality.replace(/_/g, " ")}</span>
                            <span className="font-semibold capitalize" style={{ color: sentimentColor(m.sentiment) }}>
                              {m.sentiment}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2.5">
                            <ProgressBar value={(m.confidence ?? 0) * 100} color={sentimentColor(m.sentiment)} />
                            <span className="tabular w-12 text-right font-mono text-[11px] text-slate-300">
                              {m.confidence != null ? `${(m.confidence * 100).toFixed(1)}%` : "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Extracted Content & Model Signals */}
                <Card>
                  <SectionTitle title="Extracted Content & Signals" subtitle="Actual inputs, tokens, and model metadata" />
                  <div className="space-y-4">
                    {result.kind === "text" && (
                      <>
                        <div>
                          <p className="label">Input text</p>
                          <p className="rounded-lg bg-navy-900 p-3 text-xs leading-relaxed text-slate-200">
                            {result.data.input_text}
                          </p>
                        </div>
                        <div>
                          <p className="label">Preprocessed tokens</p>
                          <p className="rounded-lg bg-navy-900 p-2.5 font-mono text-[11px] text-slate-400">
                            {result.data.cleaned_text}
                          </p>
                        </div>
                      </>
                    )}

                    {result.kind === "image" && (
                      <div className="space-y-3">
                        {result.data.file_url && (
                          <img src={`/be${result.data.file_url}`} alt="Uploaded media" className="max-h-52 w-full rounded bg-navy-900 object-contain" />
                        )}
                        <div>
                          <p className="label">OCR output ({result.data.ocr?.engine || result.data.ocr?.status})</p>
                          {result.data.ocr?.extracted_text ? (
                            <p className="rounded-lg bg-navy-900 p-3 text-xs text-slate-200">
                              {result.data.ocr.extracted_text}
                            </p>
                          ) : (
                            <p className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200/90">
                              No readable text detected. {result.data.ocr?.reason || result.data.ocr?.note || ""}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {(result.kind === "audio" || result.kind === "video") && (
                      <div className="space-y-3">
                        <div>
                          <p className="label">Transcript ({result.data.transcription?.status})</p>
                          {result.data.transcript ? (
                            <p className="rounded-lg bg-navy-900 p-3 text-xs text-slate-200">
                              {result.data.transcript}
                            </p>
                          ) : (
                            <p className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200/90">
                              No transcript available ({result.data.transcription?.reason || "Whisper not installed"}). Provide a manual transcript to classify spoken sentiment.
                            </p>
                          )}
                        </div>
                        {result.kind === "video" && result.data.frames && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="rounded bg-navy-900 p-2">
                                <p className="text-[10px] text-slate-500">Duration</p>
                                <p className="font-mono text-slate-200">{result.data.frames.duration_sec}s</p>
                              </div>
                              <div className="rounded bg-navy-900 p-2">
                                <p className="text-[10px] text-slate-500">Frames sampled</p>
                                <p className="font-mono text-slate-200">{result.data.frames.frames?.length ?? 0}</p>
                              </div>
                              <div className="rounded bg-navy-900 p-2">
                                <p className="text-[10px] text-slate-500">Audio extract</p>
                                <p className="font-mono text-slate-200">{result.data.audio_extraction?.status}</p>
                              </div>
                            </div>
                            {result.data.frame_ocr?.extracted_text && (
                              <div>
                                <p className="label">Lead frame OCR</p>
                                <p className="rounded bg-navy-900 p-2.5 text-xs text-slate-300">{result.data.frame_ocr.extracted_text}</p>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
                          <Info size={13} className="mt-0.5 shrink-0" /> Vocal emotion is not inferred here; spoken opinion is derived strictly from transcript text.
                        </p>
                      </div>
                    )}

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3">
                      <div>
                        <p className="label">Detected tickers</p>
                        {result.data.tickers?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {result.data.tickers.map((t: string) => (
                              <Link key={t} href={`/stocks?ticker=${t}`}>
                                <Badge tone="blue">${t}</Badge>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">None detected</p>
                        )}
                      </div>
                      <div>
                        <p className="label">Model &amp; Source</p>
                        <p className="text-xs text-slate-200">
                          {result.data.model_used || result.data.sentiment?.model_used || "—"}
                          {result.data.platform ? ` · ${result.data.platform}` : ""}
                        </p>
                      </div>
                    </div>

                    {result.data.keywords?.length > 0 && (
                      <div>
                        <p className="label">Matched TF-IDF terms</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.data.keywords.map((kw: { term: string; weight: number }) => (
                            <span key={kw.term} className="rounded border border-white/[0.1] bg-navy-900 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                              {kw.term} <span className="text-slate-500">{kw.weight.toFixed(2)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(result.data.probabilities || result.data.sentiment?.probabilities) &&
                      Object.keys(result.data.probabilities || result.data.sentiment?.probabilities || {}).length > 0 && (
                        <div>
                          <p className="label">Class probability distribution</p>
                          <div className="space-y-1.5">
                            {Object.entries(result.data.probabilities || result.data.sentiment?.probabilities).map(([k, v]: any) => (
                              <div key={k} className="flex items-center gap-2.5">
                                <span className="w-16 text-xs capitalize text-slate-300">{k}</span>
                                <div className="flex-1">
                                  <ProgressBar value={v * 100} color={sentimentColor(k)} />
                                </div>
                                <span className="tabular w-12 text-right font-mono text-xs text-slate-300">{(v * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </Card>

                {/* Engagement & Emoji (separate axis) */}
                {result.data.engagement && (
                  <Card>
                    <SectionTitle title="Engagement & Emotion Signals" subtitle="Reported separately — never counted as financial sentiment" />
                    {result.data.engagement.engagement_score == null ? (
                      <p className="text-xs text-slate-400">{result.data.engagement.note}</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">Log-scaled engagement score</span>
                          <span className="tabular font-mono text-white">
                            {result.data.engagement.engagement_score} / 100 ({result.data.engagement.level})
                          </span>
                        </div>
                        <ProgressBar value={result.data.engagement.engagement_score} color="#22d3ee" />
                        {result.data.engagement.emotion_distribution && (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {Object.entries(result.data.engagement.emotion_distribution).map(([k, v]: any) => (
                              <div key={k} className="rounded bg-navy-900 px-2.5 py-1.5">
                                <p className="text-[10px] capitalize text-slate-500">{k.replace(/_/g, " ")}</p>
                                <p className="tabular font-mono text-xs text-slate-200">{v}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {result.data.emoji_analysis?.emojis_found?.length > 0 && (
                      <div className="mt-3 border-t border-white/[0.07] pt-3">
                        <p className="label">Emoji emotion hints</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.data.emoji_analysis.emojis_found.map((e: any, idx: number) => (
                            <Badge key={idx} tone="cyan">
                              {e.emoji} {e.hint}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeIn>
    </AppShell>
  );
}

export default function AnalyzePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<AppShell title="Multimodal Analyzer"><div className="py-12 text-center text-xs text-slate-400">Loading analyzer…</div></AppShell>}>
        <AnalyzeInner />
      </Suspense>
    </RequireAuth>
  );
}
