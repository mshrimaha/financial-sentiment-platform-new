"use client";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "./AppShell";
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";

export function WorkspaceOrPublic({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return (
      <AppShell title={title} subtitle={subtitle}>
        {children}
      </AppShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 border-b border-slate-400/15 pb-4">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
