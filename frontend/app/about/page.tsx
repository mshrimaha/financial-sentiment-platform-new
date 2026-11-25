"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { WorkspaceOrPublic } from "@/components/WorkspaceOrPublic";
import { Badge, ErrorState, Notice, SectionTitle, Skeleton } from "@/components/ui";
import { FadeIn } from "@/components/Motion";
import { apiGet } from "@/lib/api";

type Health = {
  status: string;
  version: string;
  models_loaded: boolean;
  ocr_available: boolean;
  whisper_available: boolean;
  ffmpeg_available: boolean;
};

export default function AboutPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const h = await apiGet<Health>("/api/health");
      setHealth(h);
    } catch (e: any) {
      setHealth(null);
      setHealthError(e?.message || "Unable to reach backend /api/health.");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const capabilities = [
    {
      name: "TF-IDF + 4 Classical Classifiers",
      status: healthLoading ? "Checking" : health?.models_loaded ? "Active" : "Unavailable",
      tone: healthLoading ? ("slate" as const) : health?.models_loaded ? ("green" as const) : ("red" as const),
      ok: Boolean(health?.models_loaded),
      detail: "Linear SVM, Logistic Regression, Multinomial NB, and Random Forest trained on 11,931 financial tweets.",
    },
    {
      name: "JWT Authentication & User Scoping",
      status: healthLoading ? "Checking" : health ? "Active" : "Unavailable",
      tone: healthLoading ? ("slate" as const) : health ? ("green" as const) : ("red" as const),
      ok: Boolean(health),
      detail: "Bcrypt password hashing, signed JWT tokens, and per-user SQLite ownership.",
    },
    {
      name: "Image OCR (RapidOCR ONNX)",
      status: healthLoading ? "Checking" : health?.ocr_available ? "Active" : "Unavailable",
      tone: healthLoading ? ("slate" as const) : health?.ocr_available ? ("green" as const) : ("amber" as const),
      ok: Boolean(health?.ocr_available),
      detail: "Extracts text from financial screenshots, charts, and memes without requiring a system Tesseract binary.",
    },
    {
      name: "Video Audio Extraction (ffmpeg)",
      status: healthLoading ? "Checking" : health?.ffmpeg_available ? "Active" : "Unavailable",
      tone: healthLoading ? ("slate" as const) : health?.ffmpeg_available ? ("green" as const) : ("amber" as const),
      ok: Boolean(health?.ffmpeg_available),
      detail: "Extracts 16 kHz PCM audio from uploaded video files alongside OpenCV keyframe sampling.",
    },
    {
      name: "Whisper Speech Transcription",
      status: healthLoading ? "Checking" : health?.whisper_available ? "Active" : "Manual Fallback",
      tone: healthLoading ? ("slate" as const) : health?.whisper_available ? ("green" as const) : ("amber" as const),
      ok: Boolean(health?.whisper_available),
      detail: "Optional (~1 GB PyTorch install). Manual transcript input works natively when Whisper is absent.",
    },
    {
      name: "FinBERT / Audio Emotion Models",
      status: "Not Bundled",
      tone: "slate" as const,
      ok: false,
      detail: "Documented as future work; FinSentinel never simulates unimplemented neural outputs.",
    },
  ];

  return (
    <WorkspaceOrPublic
      title="About FinSentinel"
      subtitle="Research architecture, technology stack, and live runtime capability diagnostics"
    >
      <FadeIn className="space-y-10">
        <div className="grid gap-10 border-b border-white/[0.08] pb-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-light">Project Overview</p>
            <h2 className="text-xl font-semibold text-white">Honest, reproducible multimodal sentiment research</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              <strong>FinSentinel</strong> extends text-based financial social media sentiment analysis into a unified
              multimodal research workspace covering text, reactions, emojis, images/memes, audio clips, and short
              videos.
            </p>
            <p className="text-sm leading-relaxed text-slate-400">
              Engagement signals and emotional expression are explicitly separated from bullish/bearish market opinion,
              unavailable processors report their exact state instead of fabricating results, and all evaluation metrics
              come from measured scikit-learn runs.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link href="/methodology" className="btn-primary text-xs">
                Read Methodology <ArrowRight size={14} />
              </Link>
              <Link href="/models" className="btn-ghost text-xs">
                Model Results
              </Link>
              <Link href="/datasets" className="btn-ghost text-xs">
                Dataset Registry
              </Link>
            </div>
          </div>

          <div className="border-l border-white/[0.08] pl-0 lg:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Technology Stack</p>
            <dl className="mt-3 divide-y divide-white/[0.06] text-xs">
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-400">Frontend</dt>
                <dd className="font-mono text-slate-200">Next.js 14 · React 18 · Framer Motion</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-400">Backend API</dt>
                <dd className="font-mono text-slate-200">FastAPI · Pydantic v2 · Uvicorn</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-400">ML &amp; Vision</dt>
                <dd className="font-mono text-slate-200">scikit-learn · OpenCV · RapidOCR</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-400">Media Audio</dt>
                <dd className="font-mono text-slate-200">imageio-ffmpeg · Whisper (optional)</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-400">Persistence</dt>
                <dd className="font-mono text-slate-200">SQLite (local) · Postgres RLS schema</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-400">Reporting</dt>
                <dd className="font-mono text-slate-200">ReportLab PDF · UTF-8 CSV</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Live Runtime Capability Check */}
        <div>
          <SectionTitle
            title="Live runtime capability diagnostics"
            subtitle="Verified directly from GET /api/health"
            action={
              <div className="flex items-center gap-2">
                {healthLoading ? (
                  <Badge tone="slate">Checking…</Badge>
                ) : healthError ? (
                  <Badge tone="red">Backend offline</Badge>
                ) : (
                  <Badge tone="green">API v{health?.version} online</Badge>
                )}
                <button type="button" onClick={checkHealth} disabled={healthLoading} className="btn-ghost !py-1 text-xs">
                  <RefreshCw size={12} className={healthLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            }
          />

          {healthError && (
            <div className="mb-4">
              <ErrorState message={healthError} onRetry={checkHealth} />
            </div>
          )}

          {healthLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {capabilities.map((c) => (
                <div key={c.name} className="flex flex-col justify-between gap-2 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    {c.ok ? (
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-bull" />
                    ) : c.status === "Not Bundled" ? (
                      <XCircle size={15} className="mt-0.5 shrink-0 text-slate-500" />
                    ) : (
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.detail}</p>
                    </div>
                  </div>
                  <Badge tone={c.tone}>{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <Notice tone="amber">
          <span className="flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Academic Disclaimer:</strong> Datasets are used under their original licences (MIT for Twitter
              Financial News Sentiment; CC BY-NC-SA 3.0 non-commercial for Financial PhraseBank). FinSentinel does not
              provide financial advice or trading recommendations.
            </span>
          </span>
        </Notice>
      </FadeIn>
    </WorkspaceOrPublic>
  );
}
