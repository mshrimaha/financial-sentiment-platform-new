"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
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
  RefreshCw,
  ScanText,
  Smile,
  Video,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import {
  AmbientHeroBackdrop,
  AnimatedCounter,
  EASE_OUT,
  FadeIn,
  ScrollReveal,
  StaggerGroup,
  StaggerItem,
} from "@/components/Motion";
import { Skeleton } from "@/components/ui";
import { apiGet } from "@/lib/api";

type EvalResult = {
  model: string;
  dataset: string;
  accuracy: number;
  f1_macro: number;
  precision_macro: number;
  recall_macro: number;
  train_time_s: number;
};

type HealthData = {
  status: string;
  models_loaded: boolean;
  ocr_available: boolean;
  whisper_available: boolean;
  ffmpeg_available: boolean;
};

const PIPELINE_STEPS = [
  {
    step: "01",
    title: "Content ingestion",
    summary:
      "Text posts, cashtags, reaction counters, images/stickers, audio clips, or short videos enter with optional ticker and platform metadata.",
    detail:
      "Uploads are validated by extension and size (up to 50 MB) and persisted with database references rather than binary blobs.",
  },
  {
    step: "02",
    title: "Modality-specific processing",
    summary:
      "Each modality runs through an independent extractor rather than collapsing diverse signals into a single heuristic.",
    detail:
      "Text preserves $TICKER tokens; images run RapidOCR ONNX; audio uses Whisper or manual transcript; video samples OpenCV keyframes and extracts audio via ffmpeg.",
  },
  {
    step: "03",
    title: "Sentiment prediction",
    summary:
      "Extracted text is vectorized using TF-IDF (unigrams + bigrams) and scored by classifiers trained on 11,931 annotated tweets.",
    detail:
      "Reactions and emojis are measured separately on engagement and emotion axes — never treated as bullish or bearish votes.",
  },
  {
    step: "04",
    title: "Confidence-aware fusion",
    summary:
      "Available modality predictions are combined via confidence-weighted late fusion.",
    detail:
      "Missing or unreadable modalities (such as textless stickers) are excluded instead of silently imputed as neutral.",
  },
  {
    step: "05",
    title: "Visualization & reporting",
    summary:
      "Persisted results feed user-scoped dashboards, ticker aggregations, searchable history, and PDF/CSV exports.",
    detail:
      "Every displayed metric traces directly to stored database records or real scikit-learn evaluation runs.",
  },
];

const CAPABILITIES = [
  { title: "Financial text sentiment", href: "/analyze?tab=text", icon: FileText, group: "Core", desc: "TF-IDF (1–2 grams) + 4 trained classifiers predicting bullish, bearish, or neutral stance." },
  { title: "Reaction & emoji analysis", href: "/analyze?tab=text", icon: Smile, group: "Core", desc: "Log-scaled engagement score and emotion groups kept strictly separate from market sentiment." },
  { title: "Image & sticker analysis", href: "/analyze?tab=image", icon: ImageIcon, group: "Core", desc: "Validates memes, charts, and stickers; returns honest unknown status when textless." },
  { title: "OCR text extraction", href: "/analyze?tab=image", icon: ScanText, group: "Core", desc: "RapidOCR (ONNX) extracts embedded screenshot text with per-token confidence." },
  { title: "Audio transcription", href: "/analyze?tab=audio", icon: Mic, group: "Core", desc: "Whisper transcription when installed with manual transcript support; no fake vocal emotion." },
  { title: "Video analysis", href: "/analyze?tab=video", icon: Video, group: "Core", desc: "OpenCV frame sampling, frame OCR, and ffmpeg audio extraction into one unified report." },
  { title: "Multimodal late fusion", href: "/methodology#fusion", icon: Layers, group: "Workspace", desc: "Confidence-weighted voting across active modalities with transparent contribution logs." },
  { title: "Model comparison", href: "/models", icon: BarChart3, group: "Workspace", desc: "Side-by-side metrics and confusion matrices for Naive Bayes, LogReg, Linear SVM, Random Forest." },
  { title: "Dataset exploration", href: "/datasets", icon: Database, group: "Workspace", desc: "Inspect Twitter Financial News, Financial PhraseBank, and upload custom CSV/JSON corpora." },
  { title: "Stock & ticker sentiment", href: "/stocks", icon: LineChart, group: "Workspace", desc: "Aggregate cashtag sentiment across your analyses and labelled corpus mentions." },
  { title: "Analysis history", href: "/history", icon: History, group: "Workspace", desc: "Search, filter by sentiment/modality/ticker/date, inspect details, or delete records." },
  { title: "Exportable reports", href: "/reports", icon: FileSpreadsheet, group: "Workspace", desc: "Generate formatted ReportLab PDFs and UTF-8 CSV exports from persisted records." },
];

const DATASETS_SUMMARY = [
  {
    name: "Twitter Financial News Sentiment",
    role: "Training & In-Domain Evaluation",
    tone: "text-bull border-bull/30 bg-bull/10",
    records: "11,931 tweets",
    license: "MIT",
    split: "9,544 train / 2,387 test",
    notes: "Primary social-media corpus. Labels: Bearish (1,789), Bullish (2,398), Neutral (7,744).",
  },
  {
    name: "Financial PhraseBank v1.0 (AllAgree)",
    role: "Cross-Domain Evaluation Only",
    tone: "text-cyan-light border-cyan/30 bg-cyan/10",
    records: "2,264 sentences",
    license: "CC BY-NC-SA 3.0",
    split: "1,811 train / 453 test",
    notes: "Formal financial news sentences (Malo et al., 2014). Quantifies social-vs-news domain shift.",
  },
  {
    name: "CMU-MOSEI & RAVDESS",
    role: "Referenced Only (Not Bundled)",
    tone: "text-slate-300 border-white/15 bg-white/[0.04]",
    records: "External references",
    license: "Upstream repositories",
    split: "Not integrated",
    notes: "General emotion datasets referenced for multimodal architecture; never substituted as financial sentiment.",
  },
];

export default function HomePage() {
  const [results, setResults] = useState<EvalResult[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [evalLoading, setEvalLoading] = useState(true);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [previewDs, setPreviewDs] = useState<"twitter_financial_news" | "financial_phrasebank">("twitter_financial_news");
  const [activeStep, setActiveStep] = useState(0);

  const loadLivePreview = useCallback(async () => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const [evalRes, healthRes] = await Promise.all([
        apiGet<{ results: EvalResult[] }>("/api/models/results"),
        apiGet<HealthData>("/api/health").catch(() => null),
      ]);
      setResults(evalRes.results || []);
      if (healthRes) setHealth(healthRes);
    } catch (err: any) {
      setEvalError(err?.message || "Unable to retrieve live evaluation metrics.");
    } finally {
      setEvalLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLivePreview();
  }, [loadLivePreview]);

  const dsRows = results.filter((r) => r.dataset === previewDs);
  const bestRow = dsRows.length ? dsRows.reduce((a, b) => (b.f1_macro > a.f1_macro ? b : a)) : null;

  const chartRows = dsRows.map((r) => ({
    name: r.model
      .replace("Multinomial Naive Bayes", "Naive Bayes")
      .replace("Logistic Regression", "LogReg")
      .replace("Random Forest", "RandForest"),
    f1: +(r.f1_macro * 100).toFixed(2),
    acc: +(r.accuracy * 100).toFixed(2),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicNav />

      <main className="flex-1">
        {/* HERO: Open, asymmetric editorial + floating glass data visualization */}
        <section className="relative overflow-hidden border-b border-white/[0.07]">
          <AmbientHeroBackdrop />

          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
              {/* Left Hero Narrative */}
              <FadeIn>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-300 backdrop-blur-sm">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      health?.models_loaded ? "bg-bull" : evalError ? "bg-bear" : "bg-cyan-light animate-pulse"
                    }`}
                  />
                  <span>
                    {health?.models_loaded
                      ? "Live ML Pipeline Ready · RapidOCR Active"
                      : evalError
                      ? "Backend offline — start FastAPI on port 8000"
                      : "Connecting to FinSentinel evaluation engine…"}
                  </span>
                </div>

                <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
                  Financial social media analytics,{" "}
                  <span className="bg-gradient-to-r from-accent-light via-cyan-light to-slate-100 bg-clip-text text-transparent">
                    beyond text.
                  </span>
                </h1>

                <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-[17px]">
                  FinSentinel analyzes financial sentiment across text, reactions, emojis, stickers, images, audio, and
                  video — processing each modality independently and combining them through confidence-aware late fusion.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm">
                    Explore Analytics <ArrowRight size={15} />
                  </Link>
                  <Link href="/methodology" className="btn-ghost px-5 py-2.5 text-sm">
                    View Methodology
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                  >
                    Create Account <ArrowUpRight size={14} />
                  </Link>
                </div>

                {/* Open inline statistics (no boxes) */}
                <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-white/[0.08] pt-7 sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-slate-500">Training Tweets</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-white">
                      <AnimatedCounter value={11931} />
                    </dd>
                  </div>
                  <div className="border-l border-white/[0.07] pl-4">
                    <dt className="text-[11px] uppercase tracking-wider text-slate-500">PhraseBank</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-white">
                      <AnimatedCounter value={2264} />
                    </dd>
                  </div>
                  <div className="sm:border-l sm:border-white/[0.07] sm:pl-4">
                    <dt className="text-[11px] uppercase tracking-wider text-slate-500">Top Accuracy</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-cyan-light">
                      <AnimatedCounter value={82.95} decimals={2} suffix="%" />
                    </dd>
                  </div>
                  <div className="border-l border-white/[0.07] pl-4">
                    <dt className="text-[11px] uppercase tracking-wider text-slate-500">Classifiers</dt>
                    <dd className="mt-1 font-mono text-xl font-semibold text-white">
                      <AnimatedCounter value={4} suffix=" ML" />
                    </dd>
                  </div>
                </dl>
              </FadeIn>

              {/* Right Interactive Live Benchmark Composition */}
              <FadeIn delay={0.12}>
                <div className="relative rounded-2xl border border-white/[0.09] bg-surface/75 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-light">
                        Live Evaluation Stream
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {previewDs === "twitter_financial_news"
                          ? "Twitter Financial News (80:20)"
                          : "Financial PhraseBank (80:20)"}
                      </p>
                    </div>

                    {/* Smooth segmented switcher */}
                    <div className="relative flex rounded-lg border border-white/[0.1] bg-canvas/80 p-0.5 text-[11px]">
                      {(
                        [
                          { id: "twitter_financial_news", label: "Twitter" },
                          { id: "financial_phrasebank", label: "PhraseBank" },
                        ] as const
                      ).map((tab) => {
                        const active = previewDs === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setPreviewDs(tab.id)}
                            className={`relative z-10 rounded-md px-3 py-1 font-medium transition-colors ${
                              active ? "text-white" : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="hero-ds-pill"
                                className="absolute inset-0 -z-10 rounded-md bg-accent shadow-sm"
                                transition={{ type: "spring", stiffness: 360, damping: 30 }}
                              />
                            )}
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4">
                    {evalLoading ? (
                      <div className="space-y-3 py-6">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-44 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : evalError ? (
                      <div className="py-10 text-center">
                        <p className="text-xs text-red-300">{evalError}</p>
                        <button type="button" onClick={loadLivePreview} className="btn-ghost mt-3 !py-1.5 text-xs">
                          <RefreshCw size={12} /> Retry connection
                        </button>
                      </div>
                    ) : (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={previewDs}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: EASE_OUT }}
                        >
                          {bestRow && (
                            <div className="mb-3 flex items-baseline justify-between text-xs">
                              <span className="text-slate-400">
                                Top Macro-F1: <strong className="text-white">{bestRow.model}</strong>
                              </span>
                              <span className="tabular font-mono font-semibold text-bull">
                                {(bestRow.f1_macro * 100).toFixed(2)}% F1 · {(bestRow.accuracy * 100).toFixed(2)}% Acc
                              </span>
                            </div>
                          )}

                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 18, left: 4, bottom: 0 }}>
                                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" width={88} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                  contentStyle={{
                                    background: "#0c121e",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    borderRadius: 8,
                                    fontSize: 12,
                                  }}
                                  formatter={(val: any) => [`${val}%`, "Macro F1"]}
                                />
                                <Bar dataKey="f1" radius={[0, 6, 6, 0]} barSize={15}>
                                  {chartRows.map((entry) => (
                                    <Cell
                                      key={entry.name}
                                      fill={entry.name === "Linear SVM" ? "#22d3ee" : "#3b82f6"}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="mt-3 border-t border-white/[0.07] pt-3">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                                  <th className="pb-1.5 font-medium">Model</th>
                                  <th className="pb-1.5 text-right font-medium">Accuracy</th>
                                  <th className="pb-1.5 text-right font-medium">Macro F1</th>
                                  <th className="pb-1.5 text-right font-medium">Fit Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.05]">
                                {dsRows.map((r) => (
                                  <tr key={r.model} className="hover:bg-white/[0.02]">
                                    <td className="py-1.5 font-medium text-slate-200">{r.model}</td>
                                    <td className="tabular py-1.5 text-right font-mono text-slate-300">
                                      {(r.accuracy * 100).toFixed(2)}%
                                    </td>
                                    <td className="tabular py-1.5 text-right font-mono font-semibold text-white">
                                      {(r.f1_macro * 100).toFixed(2)}%
                                    </td>
                                    <td className="tabular py-1.5 text-right font-mono text-slate-400">
                                      {r.train_time_s.toFixed(2)}s
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3 text-[11px] text-slate-400">
                    <span>
                      Processors: OCR {health?.ocr_available ? "active" : "—"} · ffmpeg{" "}
                      {health?.ffmpeg_available ? "active" : "—"} · Whisper{" "}
                      {health?.whisper_available ? "active" : "manual fallback"}
                    </span>
                    <Link href="/models" className="font-medium text-accent-light hover:underline">
                      Inspect confusion matrices →
                    </Link>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* PRODUCT & 12 CAPABILITIES: Asymmetric editorial layout (no boxed grid!) */}
        <section id="product" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-light">
                  Platform Scope
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Twelve analytical modules, cleanly separated.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Every item links to an active workspace route powered by the FastAPI backend. Engagement counters
                  and emotion hints never vote on financial polarity.
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <Link href="/features" className="btn-primary text-xs">
                    Explore all features <ArrowRight size={13} />
                  </Link>
                  <Link href="/analyze" className="btn-ghost text-xs">
                    Open Analyzer
                  </Link>
                </div>
              </div>

              <StaggerGroup className="grid gap-x-8 divide-y divide-white/[0.07] border-t border-white/[0.07] sm:grid-cols-2 sm:divide-y-0">
                {CAPABILITIES.map(({ title, href, icon: Icon, group, desc }) => (
                  <StaggerItem key={title}>
                    <Link
                      href={href}
                      className="group flex flex-col justify-between border-b border-white/[0.07] py-5 transition-colors hover:border-accent/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className="shrink-0 text-accent-light transition-transform duration-200 group-hover:scale-110" />
                          <span className="text-sm font-semibold text-white group-hover:text-accent-light transition-colors">
                            {title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                          {group}
                        </span>
                      </div>
                      <p className="mt-2 pl-6 text-xs leading-relaxed text-slate-400">{desc}</p>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          </ScrollReveal>
        </section>

        {/* PIPELINE: Interactive horizontal step selector + open architectural detail */}
        <section className="section-rule bg-navy-900/50">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-light">
                    Architecture Flow
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Five-stage multimodal pipeline
                  </h2>
                </div>
                <Link href="/methodology" className="text-xs font-medium text-accent-light hover:underline">
                  Read complete research methodology →
                </Link>
              </div>

              {/* Horizontal step tabs */}
              <div className="mt-8 grid gap-2 border-b border-white/[0.08] pb-4 sm:grid-cols-5">
                {PIPELINE_STEPS.map((s, idx) => {
                  const active = activeStep === idx;
                  return (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setActiveStep(idx)}
                      className={`relative rounded-lg px-3 py-3 text-left transition-colors ${
                        active ? "bg-white/[0.05] text-white" : "text-slate-400 hover:bg-white/[0.02] hover:text-slate-200"
                      }`}
                    >
                      <span className={`font-mono text-xs font-semibold ${active ? "text-cyan-light" : "text-slate-500"}`}>
                        {s.step}
                      </span>
                      <p className="mt-1 text-xs font-semibold">{s.title}</p>
                      {active && (
                        <motion.span
                          layoutId="pipeline-tab-bar"
                          className="absolute inset-x-3 -bottom-[17px] h-[2px] bg-cyan-light"
                          transition={{ type: "spring", stiffness: 360, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]"
                >
                  <div>
                    <span className="font-mono text-xs text-cyan-light">
                      STAGE {PIPELINE_STEPS[activeStep].step} OF 05
                    </span>
                    <h3 className="mt-2 text-xl font-semibold text-white">{PIPELINE_STEPS[activeStep].title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                      {PIPELINE_STEPS[activeStep].summary}
                    </p>
                  </div>
                  <div className="border-l-2 border-accent/50 pl-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Implementation Detail
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {PIPELINE_STEPS[activeStep].detail}
                    </p>
                    <div className="mt-4">
                      <Link href="/analyze" className="text-xs font-medium text-accent-light hover:underline">
                        Run live pipeline in Analyzer →
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </ScrollReveal>
          </div>
        </section>

        {/* RESEARCH & DATASETS: Clean full-width structured table */}
        <section className="section-rule mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-light">
                  Corpus Provenance
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Integrated vs. referenced datasets
                </h2>
                <p className="mt-1.5 text-sm text-slate-400">
                  Training, cross-domain evaluation, and external reference corpora are kept strictly distinct.
                </p>
              </div>
              <Link href="/datasets" className="btn-ghost text-xs">
                Open Dataset Registry <ArrowRight size={14} />
              </Link>
            </div>

            <div className="mt-8 overflow-x-auto border-y border-white/[0.08]">
              <table className="w-full min-w-[780px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 pr-4 font-semibold">Dataset</th>
                    <th className="py-3 pr-4 font-semibold">Role</th>
                    <th className="py-3 pr-4 font-semibold">Size / Split</th>
                    <th className="py-3 pr-4 font-semibold">Licence</th>
                    <th className="py-3 font-semibold">Provenance Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {DATASETS_SUMMARY.map((d) => (
                    <tr key={d.name} className="hover:bg-white/[0.02]">
                      <td className="py-4 pr-4 font-semibold text-white">{d.name}</td>
                      <td className="py-4 pr-4">
                        <span className={`badge border ${d.tone}`}>
                          <CheckCircle2 size={11} /> {d.role}
                        </span>
                      </td>
                      <td className="tabular py-4 pr-4 font-mono text-slate-300">
                        <div>{d.records}</div>
                        <div className="text-[11px] text-slate-500">{d.split}</div>
                      </td>
                      <td className="py-4 pr-4 text-slate-400">{d.license}</td>
                      <td className="py-4 text-slate-400">{d.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </section>

        {/* Closing Editorial CTA */}
        <section className="section-rule bg-gradient-to-b from-navy-900/70 to-canvas">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Ready to run multimodal sentiment experiments?
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Create an account to save analyses, track ticker sentiment, and export PDF or CSV research reports.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary text-sm">
                Get Started <ArrowRight size={15} />
              </Link>
              <Link href="/models" className="btn-ghost text-sm">
                View Model Results
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
