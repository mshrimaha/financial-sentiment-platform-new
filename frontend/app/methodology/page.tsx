"use client";
import Link from "next/link";
import { ArrowRight, AlertTriangle, CheckCircle2, Layers, Cpu, Database, GitCompare, ShieldAlert } from "lucide-react";
import { WorkspaceOrPublic } from "@/components/WorkspaceOrPublic";
import { Badge, Notice } from "@/components/ui";
import { FadeIn, ScrollReveal } from "@/components/Motion";

const SECTIONS = [
  { id: "problem", label: "1. Research Problem" },
  { id: "architecture", label: "2. Pipeline Diagram" },
  { id: "datasets", label: "3. Datasets & Splits" },
  { id: "preprocessing", label: "4. Preprocessing & TF-IDF" },
  { id: "models", label: "5. Classifiers & Evaluation" },
  { id: "multimodal", label: "6. Multimodal Extensions" },
  { id: "fusion", label: "7. Confidence-Aware Fusion" },
  { id: "limitations", label: "8. Limitations & Disclaimer" },
];

export default function MethodologyPage() {
  return (
    <WorkspaceOrPublic
      title="Research Methodology"
      subtitle="Architecture, feature engineering, classical ML evaluation, and confidence-aware multimodal fusion"
    >
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* Sticky section TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-1 border-l border-white/[0.08] pl-3">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Methodology Sections
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                {s.label}
              </a>
            ))}
            <div className="mt-4 space-y-1.5 border-t border-white/[0.07] pt-3">
              <Link href="/collection" className="block px-2.5 py-1 text-xs text-accent-light hover:underline">
                Primary Collection &amp; κ →
              </Link>
              <Link href="/research" className="block px-2.5 py-1 text-xs text-accent-light hover:underline">
                Literature Review →
              </Link>
              <Link href="/models" className="block px-2.5 py-1 text-xs text-accent-light hover:underline">
                Live Model Results →
              </Link>
            </div>
          </div>
        </aside>

        {/* Open editorial flow separated by fine rules */}
        <div className="divide-y divide-white/[0.08]">
          <FadeIn className="pb-8">
            <Notice tone="amber">
              <span className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Research Integrity Policy:</strong> Every reported metric in FinSentinel originates from actual
                  scikit-learn training runs on genuine datasets. Synthetic draft figures are excluded, and FinBERT is
                  documented as future work rather than simulated.
                </span>
              </span>
            </Notice>
          </FadeIn>

          {/* 1. Research Problem */}
          <section id="problem" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <div className="flex items-center gap-2 text-cyan-light">
                <ShieldAlert size={16} />
                <span className="font-mono text-xs uppercase tracking-wider">Section 01</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Research Problem: Modality Gap &amp; Semantic Conflation</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Financial social media posts mix directional market commentary with emojis, reaction counters, chart
                screenshots, memes, voice clips, and short videos. Standard text-only pipelines discard visual and
                spoken evidence, while naive multimodal systems commit <strong>semantic conflation</strong> — treating
                engagement counts (likes, fire reactions) or general emotion (laughter, anger) as bullish or bearish opinion.
              </p>

              <div className="mt-6 grid gap-6 border-t border-white/[0.07] pt-5 sm:grid-cols-3">
                <div className="border-l-2 border-bull/60 pl-3.5">
                  <p className="text-xs font-semibold text-white">Axis 1 · Financial Opinion</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Positive (bullish), negative (bearish), or neutral directional stance inferred strictly from verbal or OCR text.
                  </p>
                </div>
                <div className="border-l-2 border-cyan/60 pl-3.5">
                  <p className="text-xs font-semibold text-white">Axis 2 · Emotional Expression</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Emoji lexicon hints and reaction emotion groups (amusement, anger, surprise), reported independently.
                  </p>
                </div>
                <div className="border-l-2 border-accent/60 pl-3.5">
                  <p className="text-xs font-semibold text-white">Axis 3 · Engagement Volume</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Log-scaled weighted reaction score (0–100), explicitly prevented from voting on market polarity.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </section>

          {/* 2. Data-Flow Diagram */}
          <section id="architecture" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <span className="font-mono text-xs uppercase tracking-wider text-cyan-light">Section 02</span>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Multimodal Processing Data-Flow</h2>
              <p className="mt-2 text-xs text-slate-400">
                Each modality runs independently and emits a verified prediction or honest unavailable status before fusion.
              </p>

              <div className="mt-6 overflow-x-auto rounded-xl border border-white/[0.08] bg-surface/60 p-5">
                <div className="grid min-w-[680px] grid-cols-5 items-center gap-3 text-xs">
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase text-slate-500">1. Ingestion</p>
                    {["Text + $Ticker", "Image / Meme", "Audio Clip", "Video / Reel"].map((item) => (
                      <div key={item} className="rounded-md border border-white/[0.1] bg-navy-900 px-3 py-2 text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center font-mono text-slate-500">───▶</div>
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase text-slate-500">2. Extractors</p>
                    <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-slate-100">clean_text + TF-IDF</div>
                    <div className="rounded-md border border-cyan/30 bg-cyan/10 px-3 py-2 text-slate-100">RapidOCR (ONNX)</div>
                    <div className="rounded-md border border-white/15 bg-navy-900 px-3 py-2 text-slate-200">Whisper / Transcript</div>
                    <div className="rounded-md border border-white/15 bg-navy-900 px-3 py-2 text-slate-200">OpenCV + ffmpeg</div>
                  </div>
                  <div className="flex justify-center font-mono text-slate-500">───▶</div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] uppercase text-slate-500">3. Late Fusion</p>
                    <div className="rounded-md border border-bull/35 bg-bull/10 p-3 text-slate-100">
                      <p className="font-semibold">Confidence-Weighted Vote</p>
                      <p className="mt-1 text-[11px] text-slate-300">Active modalities only; unavailable excluded.</p>
                    </div>
                    <div className="rounded-md border border-white/15 bg-navy-900 p-3 text-[11px] text-slate-400">
                      Separate axis: Reactions &amp; Emojis (Engagement Score)
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </section>

          {/* 3. Datasets */}
          <section id="datasets" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <div className="flex items-center gap-2 text-cyan-light">
                <Database size={16} />
                <span className="font-mono text-xs uppercase tracking-wider">Section 03</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Datasets &amp; Evaluation Splits</h2>
              <div className="mt-5 overflow-x-auto border-y border-white/[0.08]">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-3 pr-4">Corpus</th>
                      <th className="py-3 pr-4">Records</th>
                      <th className="py-3 pr-4">Class Balance</th>
                      <th className="py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-slate-300">
                    <tr>
                      <td className="py-3 pr-4 font-semibold text-white">Twitter Financial News Sentiment (MIT)</td>
                      <td className="tabular py-3 pr-4 font-mono">11,931</td>
                      <td className="tabular py-3 pr-4 font-mono text-[11px]">Neutral 7,744 · Pos 2,398 · Neg 1,789</td>
                      <td className="py-3"><Badge tone="green">Training + In-domain Test (80:20)</Badge></td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-semibold text-white">Financial PhraseBank AllAgree (CC BY-NC-SA 3.0)</td>
                      <td className="tabular py-3 pr-4 font-mono">2,264</td>
                      <td className="tabular py-3 pr-4 font-mono text-[11px]">Neutral 1,391 · Pos 570 · Neg 303</td>
                      <td className="py-3"><Badge tone="cyan">Cross-domain Evaluation Only</Badge></td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-semibold text-white">CMU-MOSEI &amp; RAVDESS</td>
                      <td className="py-3 pr-4 font-mono">—</td>
                      <td className="py-3 pr-4 text-slate-400">General emotion labels</td>
                      <td className="py-3"><Badge tone="slate">Referenced Only (Not Bundled)</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </ScrollReveal>
          </section>

          {/* 4. Preprocessing & TF-IDF */}
          <section id="preprocessing" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <div className="flex items-center gap-2 text-cyan-light">
                <Cpu size={16} />
                <span className="font-mono text-xs uppercase tracking-wider">Section 04</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Preprocessing &amp; TF-IDF Feature Extraction</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Every text input, OCR extract, and audio transcript runs through{" "}
                <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan-light">ml_service.clean_text()</code>{" "}
                mirroring <code className="font-mono text-xs text-slate-200">scripts/train_models.py</code>.
              </p>
              <div className="mt-5 grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Normalization Pipeline</p>
                  <ol className="mt-2.5 list-inside list-decimal space-y-1.5 text-xs leading-relaxed text-slate-400">
                    <li>Lowercase text and strip HTTP/HTTPS and <code className="font-mono">www.</code> URLs.</li>
                    <li>Remove <code className="font-mono">@username</code> mentions.</li>
                    <li>Preserve cashtags <code className="font-mono">$AAPL</code> as <code className="font-mono text-slate-200">ticker_aapl</code>.</li>
                    <li>Strip hashtag <code className="font-mono">#</code> prefixes while keeping topic words.</li>
                    <li>Remove non-alphanumeric punctuation and collapse whitespace.</li>
                  </ol>
                </div>
                <div className="border-l border-white/[0.08] pl-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">TfidfVectorizer Parameters</p>
                  <dl className="mt-2.5 space-y-1.5 font-mono text-xs text-slate-300">
                    <div className="flex justify-between"><dt className="text-slate-500">ngram_range</dt><dd>(1, 2)</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">min_df</dt><dd>2</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">max_features</dt><dd>20,000</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">sublinear_tf</dt><dd>True</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">split / seed</dt><dd>80:20 stratified / 42</dd></div>
                  </dl>
                </div>
              </div>
            </ScrollReveal>
          </section>

          {/* 5. Classifiers */}
          <section id="models" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <div className="flex items-center gap-2 text-cyan-light">
                <GitCompare size={16} />
                <span className="font-mono text-xs uppercase tracking-wider">Section 05</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Classification Models &amp; Evaluation Protocol</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Four classical classifiers — <strong>Multinomial Naive Bayes</strong>, <strong>Logistic Regression</strong>,{" "}
                <strong>Linear SVM (LinearSVC)</strong>, and <strong>Random Forest</strong> (200 trees) — are trained on identical
                TF-IDF matrices. Because the Twitter corpus is 64.9% neutral, evaluation prioritizes <strong>Macro-F1</strong>,{" "}
                <strong>Macro Precision</strong>, and <strong>Macro Recall</strong> alongside accuracy and confusion matrices.
                Linear SVM probabilities are calibrated via softmax over <code className="font-mono text-xs">decision_function</code> margins.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href="/models" className="btn-primary text-xs">
                  Inspect Live Model Benchmarks <ArrowRight size={14} />
                </Link>
                <Link href="/collection" className="btn-ghost text-xs">
                  Primary Collection &amp; Cohen&apos;s κ
                </Link>
              </div>
            </ScrollReveal>
          </section>

          {/* 6. Multimodal */}
          <section id="multimodal" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <div className="flex items-center gap-2 text-cyan-light">
                <Layers size={16} />
                <span className="font-mono text-xs uppercase tracking-wider">Section 06</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Multimodal Extensions</h2>
              <div className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                {[
                  { t: "Images, Memes & Stickers", d: "Pillow measures dimensions, brightness, and RGB averages; RapidOCR (ONNX) extracts embedded text. Textless stickers return an honest unknown status." },
                  { t: "Voice & Audio", d: "Whisper performs speech-to-text when installed; otherwise manual transcript input is supported. Vocal emotion is explicitly omitted without a trained voice-emotion model." },
                  { t: "Video & Reels", d: "OpenCV samples keyframes every 2 seconds (max 10 frames); RapidOCR inspects the lead frame; ffmpeg extracts PCM audio for transcription." },
                  { t: "Reactions & Emojis", d: "Weighted log-scale engagement score (0–100) and emoji emotion hints are logged separately and excluded from sentiment fusion." },
                ].map((m) => (
                  <div key={m.t} className="grid gap-2 py-3.5 sm:grid-cols-[220px_1fr]">
                    <p className="text-xs font-semibold text-white">{m.t}</p>
                    <p className="text-xs leading-relaxed text-slate-400">{m.d}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </section>

          {/* 7. Fusion */}
          <section id="fusion" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <div className="flex items-center gap-2 text-cyan-light">
                <CheckCircle2 size={16} />
                <span className="font-mono text-xs uppercase tracking-wider">Section 07</span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Confidence-Aware Late Fusion</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                In <code className="font-mono text-xs text-slate-200">ml_service.fuse_modalities()</code>, each active modality
                that yields a valid prediction votes proportionally to <code className="font-mono text-xs">weight × confidence</code>{" "}
                (text 0.5, image OCR 0.3, audio transcript 0.3, video transcript 0.3, video OCR 0.2).
              </p>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-white/[0.08] bg-navy-900 p-4 font-mono text-xs text-cyan-light">
{`score(c) = Σ [ w_m · conf_m · I(pred_m == c) ] / Σ [ w_m · conf_m ]
if (top1_score - top2_score) < 0.15 → overall = "mixed"
unavailable modalities → excluded (never imputed as neutral)`}
              </pre>
            </ScrollReveal>
          </section>

          {/* 8. Limitations */}
          <section id="limitations" className="scroll-mt-24 py-8">
            <ScrollReveal>
              <span className="font-mono text-xs uppercase tracking-wider text-amber-300">Section 08</span>
              <h2 className="mt-1.5 text-xl font-semibold text-white">Known Limitations &amp; Disclaimer</h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-xs leading-relaxed text-slate-400">
                <li>No paired multimodal financial ground-truth benchmark exists; multimodal accuracy is not fabricated.</li>
                <li>Cross-domain transfer from tweets to formal financial news drops Macro-F1 from 75.82% to 56.43% (and 32.48% reverse).</li>
                <li>No visual meme-semantics classifier or vocal emotion model is bundled in this prototype.</li>
                <li>Sentiment outputs describe expressed opinion only and do not constitute investment advice or price forecasts.</li>
              </ul>
            </ScrollReveal>
          </section>
        </div>
      </div>
    </WorkspaceOrPublic>
  );
}
