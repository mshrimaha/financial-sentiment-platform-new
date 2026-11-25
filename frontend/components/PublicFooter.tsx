import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-navy-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandMark />
            <p className="mt-3 max-w-md text-xs leading-relaxed text-slate-400">
              FinSentinel is a multimodal financial sentiment research platform combining TF-IDF classical NLP
              classifiers trained on public financial corpora with RapidOCR, audio/video transcription, and
              confidence-aware late fusion.
            </p>
            <p className="mt-4 border-l-2 border-amber-400/60 pl-3 text-[11px] leading-relaxed text-amber-200/80">
              <strong>Research Disclaimer:</strong> Sentiment outputs describe expressed opinion in analysed media
              only. FinSentinel does not provide live market prices, trading signals, or financial advice.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Workspace</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li><Link href="/features" className="hover:text-white">Platform Features</Link></li>
              <li><Link href="/dashboard" className="hover:text-white">Analytics Dashboard</Link></li>
              <li><Link href="/analyze" className="hover:text-white">Multimodal Analyzer</Link></li>
              <li><Link href="/history" className="hover:text-white">Analysis History</Link></li>
              <li><Link href="/stocks" className="hover:text-white">Ticker Sentiment</Link></li>
              <li><Link href="/reports" className="hover:text-white">PDF &amp; CSV Reports</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Research</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li><Link href="/methodology" className="hover:text-white">Research Methodology</Link></li>
              <li><Link href="/models" className="hover:text-white">Model Results</Link></li>
              <li><Link href="/datasets" className="hover:text-white">Dataset Registry</Link></li>
              <li><Link href="/research" className="hover:text-white">Literature Comparison</Link></li>
              <li><Link href="/about" className="hover:text-white">About &amp; System Health</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-6 text-[11px] text-slate-500 sm:flex-row sm:items-center">
          <p>FinSentinel · Academic Multimodal Financial Sentiment Platform (Next.js · FastAPI · scikit-learn)</p>
          <p>Corpora: Twitter Financial News Sentiment (MIT) · Financial PhraseBank v1.0 (CC BY-NC-SA 3.0)</p>
        </div>
      </div>
    </footer>
  );
}
