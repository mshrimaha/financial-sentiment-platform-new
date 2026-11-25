"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  Layers,
  LineChart,
  Mic,
  ScanText,
  Smile,
  Video,
  AlertTriangle,
} from "lucide-react";
import { WorkspaceOrPublic } from "@/components/WorkspaceOrPublic";
import { Badge, Notice } from "@/components/ui";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/Motion";
import { apiGet } from "@/lib/api";

type Health = {
  models_loaded: boolean;
  ocr_available: boolean;
  whisper_available: boolean;
  ffmpeg_available: boolean;
};

type FeatureItem = {
  id: string;
  title: string;
  category: "Core Modalities" | "Research & Analytics";
  href: string;
  icon: any;
  summary: string;
  implementation: string;
  runtimeKey?: keyof Health;
  fallbackNote?: string;
};

const FEATURES: FeatureItem[] = [
  {
    id: "text",
    title: "Financial text sentiment",
    category: "Core Modalities",
    href: "/analyze?tab=text",
    icon: FileText,
    summary: "Classifies financial posts, headlines, and comments as positive (bullish), negative (bearish), or neutral.",
    implementation: "TF-IDF (1–2 grams, max 20k features) + 4 trained scikit-learn models with matched keyword weights.",
    runtimeKey: "models_loaded",
  },
  {
    id: "reactions",
    title: "Reaction & emoji analysis",
    category: "Core Modalities",
    href: "/analyze?tab=text",
    icon: Smile,
    summary: "Measures social reaction counts and emoji cues separately from financial sentiment polarity.",
    implementation: "Log-scaled engagement score (0–100) and emotion grouping (positive, negative, amusement, surprise).",
  },
  {
    id: "images",
    title: "Image & sticker analysis",
    category: "Core Modalities",
    href: "/analyze?tab=image",
    icon: ImageIcon,
    summary: "Validates image, meme, and sticker uploads and computes visual metadata without fabricating sentiment.",
    implementation: "Pillow dimension/brightness/RGB extraction; stickers without readable text return honest unknown status.",
  },
  {
    id: "ocr",
    title: "OCR text extraction",
    category: "Core Modalities",
    href: "/analyze?tab=image",
    icon: ScanText,
    summary: "Extracts embedded text from trading charts, screenshots, and financial memes for downstream classification.",
    implementation: "RapidOCR (ONNX runtime) with per-region confidence averaging.",
    runtimeKey: "ocr_available",
  },
  {
    id: "audio",
    title: "Audio transcription",
    category: "Core Modalities",
    href: "/analyze?tab=audio",
    icon: Mic,
    summary: "Converts financial voice clips into text transcripts and classifies spoken opinion without guessing vocal emotion.",
    implementation: "Whisper speech-to-text when installed; manual transcript input always supported.",
    runtimeKey: "whisper_available",
    fallbackNote: "Manual transcript mode ready (Whisper optional)",
  },
  {
    id: "video",
    title: "Video analysis",
    category: "Core Modalities",
    href: "/analyze?tab=video",
    icon: Video,
    summary: "Processes short financial clips and reels by sampling frames, running OCR, and extracting audio tracks.",
    implementation: "OpenCV keyframe sampler + RapidOCR lead-frame scan + ffmpeg audio extraction.",
    runtimeKey: "ffmpeg_available",
    fallbackNote: "OpenCV frames ready; manual transcript available",
  },
  {
    id: "fusion",
    title: "Multimodal late fusion",
    category: "Research & Analytics",
    href: "/methodology#fusion",
    icon: Layers,
    summary: "Combines predictions across available modalities weighted by model confidence.",
    implementation: "Excludes missing or unreadable modalities rather than imputing neutral labels.",
  },
  {
    id: "models",
    title: "Model comparison",
    category: "Research & Analytics",
    href: "/models",
    icon: BarChart3,
    summary: "Benchmarks Multinomial NB, Logistic Regression, Linear SVM, and Random Forest side by side.",
    implementation: "Real 80:20 stratified evaluation metrics, confusion matrices, per-class F1, and cross-domain tests.",
    runtimeKey: "models_loaded",
  },
  {
    id: "datasets",
    title: "Dataset exploration",
    category: "Research & Analytics",
    href: "/datasets",
    icon: Database,
    summary: "Inspects training and cross-domain corpora and lets researchers upload custom CSV/JSON datasets.",
    implementation: "Live class distribution, duplicate/missing-value inspection, search/filter preview, CSV download.",
  },
  {
    id: "stocks",
    title: "Stock & ticker sentiment",
    category: "Research & Analytics",
    href: "/stocks",
    icon: LineChart,
    summary: "Aggregates cashtag sentiment across your saved analyses and historical Twitter corpus mentions.",
    implementation: "No fabricated market prices — strictly displays sentiment counts, confidence, and modality mix.",
  },
  {
    id: "history",
    title: "Analysis history",
    category: "Research & Analytics",
    href: "/history",
    icon: History,
    summary: "Searchable archive of every analysis persisted under your researcher account.",
    implementation: "Filter by keyword, sentiment, modality, ticker, and date; inspect full breakdown or delete records.",
  },
  {
    id: "reports",
    title: "Exportable reports",
    category: "Research & Analytics",
    href: "/reports",
    icon: FileSpreadsheet,
    summary: "Exports structured research summaries and raw analysis logs for academic reporting.",
    implementation: "ReportLab PDF templates (summary, models, ticker, multimodal) and UTF-8 CSV download.",
  },
];

export default function FeaturesPage() {
  const [filter, setFilter] = useState<"All" | "Core Modalities" | "Research & Analytics">("All");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Health>("/api/health")
      .then((h) => {
        setHealth(h);
        setHealthError(null);
      })
      .catch((e: any) => setHealthError(e?.message || "Backend unavailable"));
  }, []);

  const visible = filter === "All" ? FEATURES : FEATURES.filter((f) => f.category === filter);

  return (
    <WorkspaceOrPublic
      title="Platform Capabilities"
      subtitle="Twelve implemented analytical modules across multimodal ingestion, classical NLP, and research reporting"
    >
      <div className="space-y-8">
        <FadeIn>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div className="flex flex-wrap gap-1.5">
              {(["All", "Core Modalities", "Research & Analytics"] as const).map((tab) => {
                const active = filter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active ? "text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="features-filter-pill"
                        className="absolute inset-0 -z-10 rounded-lg border border-accent/40 bg-accent/15"
                        transition={{ type: "spring", stiffness: 360, damping: 30 }}
                      />
                    )}
                    {tab}
                  </button>
                );
              })}
            </div>

            {healthError ? (
              <Badge tone="red">
                <AlertTriangle size={11} /> Backend offline
              </Badge>
            ) : health ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={health.models_loaded ? "green" : "amber"}>ML {health.models_loaded ? "Active" : "Missing"}</Badge>
                <Badge tone={health.ocr_available ? "green" : "amber"}>OCR {health.ocr_available ? "Active" : "Unavailable"}</Badge>
                <Badge tone={health.ffmpeg_available ? "green" : "amber"}>ffmpeg {health.ffmpeg_available ? "Active" : "Unavailable"}</Badge>
                <Badge tone={health.whisper_available ? "green" : "slate"}>
                  Whisper {health.whisper_available ? "Active" : "Manual Fallback"}
                </Badge>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Checking live processors…</span>
            )}
          </div>
        </FadeIn>

        <Notice>
          <strong>Construct separation rule:</strong> Financial sentiment (bullish / bearish / neutral) is computed strictly
          from verbal or OCR text. Social reactions and emoji signals remain separate engagement and emotion indicators.
        </Notice>

        <StaggerGroup className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {visible.map((f) => {
            const Icon = f.icon;
            const runtimeReady = f.runtimeKey && health ? Boolean(health[f.runtimeKey]) : true;
            return (
              <StaggerItem key={f.id}>
                <div className="grid items-start gap-4 py-6 lg:grid-cols-[260px_1fr_auto]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03] text-accent-light">
                      <Icon size={16} />
                    </span>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{f.category}</p>
                      <h2 className="text-sm font-semibold text-white">{f.title}</h2>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-sm leading-relaxed text-slate-200">{f.summary}</p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      <span className="font-medium text-slate-300">Implementation:</span> {f.implementation}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    {f.runtimeKey && health && (
                      <Badge tone={runtimeReady ? "green" : "amber"}>
                        {runtimeReady ? (
                          <>
                            <CheckCircle2 size={10} /> Active
                          </>
                        ) : (
                          f.fallbackNote || "Optional dependency"
                        )}
                      </Badge>
                    )}
                    <Link href={f.href} className="btn-ghost !py-1.5 text-xs">
                      Open <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </WorkspaceOrPublic>
  );
}
