"use client";
import { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  accent = "text-accent-light",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="border-l-2 border-white/[0.1] pl-4 py-1 transition-colors hover:border-accent/60">
      <div className="flex items-center gap-2">
        {icon && <span className={accent}>{icon}</span>}
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "red" | "violet" | "blue" | "amber" | "cyan";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-400/10 text-slate-300 border border-slate-400/20",
    green: "bg-bull/10 text-bull border border-bull/30",
    red: "bg-bear/10 text-bear border border-bear/30",
    violet: "bg-violet/10 text-violet-light border border-violet/30",
    blue: "bg-accent/10 text-accent-light border border-accent/30",
    cyan: "bg-cyan/10 text-cyan-light border border-cyan/30",
    amber: "bg-amber-400/10 text-amber-300 border border-amber-400/30",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12 text-xs font-medium text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      <span>{label || "Loading…"}</span>
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-bear/30 bg-bear/[0.06] px-6 py-8 text-center"
    >
      <AlertCircle className="h-5 w-5 text-bear" />
      <p className="max-w-lg text-sm text-slate-200">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost mt-1 text-xs">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] px-6 py-10 text-center">
      <span className="text-slate-500">{icon || <Inbox className="h-6 w-6" />}</span>
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, color = "#3b82f6" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function Notice({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "amber" }) {
  const cls =
    tone === "amber"
      ? "border-l-2 border-amber-400/70 bg-amber-400/[0.04] text-amber-200/90"
      : "border-l-2 border-accent/60 bg-white/[0.025] text-slate-300";
  return <div className={`rounded-r-lg px-4 py-2.5 text-xs leading-relaxed ${cls}`}>{children}</div>;
}
