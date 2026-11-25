import Link from "next/link";

export function BrandMark({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 focus-visible:outline-none">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent/10 text-accent-light">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 17L8.5 11.5L13 14.5L21 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 6.5H21V11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 20.5H21" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-white">FinSentinel</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Sentiment Research
          </span>
        </span>
      )}
    </Link>
  );
}
