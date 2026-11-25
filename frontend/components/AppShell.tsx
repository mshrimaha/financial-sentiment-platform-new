"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ScanSearch,
  History,
  LineChart,
  BarChart3,
  Database,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  BookOpen,
  Compass,
  Plus,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "./BrandMark";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/analyze", label: "Analyze", icon: ScanSearch, matchAlt: ["/analysis"] },
  { href: "/history", label: "History", icon: History },
  { href: "/stocks", label: "Stocks", icon: LineChart },
  { href: "/models", label: "Model Results", icon: BarChart3 },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/reports", label: "Reports", icon: FileText },
];

const RESEARCH_NAV = [
  { href: "/features", label: "Capabilities", icon: Layers },
  { href: "/collection", label: "Primary Collection", icon: ClipboardList },
  { href: "/research", label: "Literature Review", icon: BookOpen },
  { href: "/methodology", label: "Methodology", icon: Compass },
];

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fs_sidebar_collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("fs_sidebar_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const doLogout = () => {
    logout();
    router.push("/login");
  };

  const initials = (user?.full_name || user?.email || "FS")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  const renderItem = ({
    href,
    label,
    icon: Icon,
    matchAlt = [],
  }: {
    href: string;
    label: string;
    icon: any;
    matchAlt?: string[];
  }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`) || matchAlt.some((a) => pathname === a);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? label : undefined}
        className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 ${
          active ? "text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
        } ${collapsed ? "justify-center" : ""}`}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active-pill"
            className="absolute inset-0 rounded-lg border border-accent/35 bg-accent/15"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}
        <Icon size={16} className={`relative z-10 shrink-0 ${active ? "text-accent-light" : ""}`} />
        {!collapsed && <span className="relative z-10 truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sidebar */}
      <aside
        aria-label="Workspace navigation"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/[0.07] bg-navy-900/95 backdrop-blur-xl transition-all duration-200 lg:translate-x-0 ${
          collapsed ? "w-[68px]" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`flex h-14 items-center border-b border-white/[0.07] ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <BrandMark compact={collapsed} href="/" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded p-1 text-slate-400 hover:text-white lg:hidden"
            aria-label="Close navigation drawer"
          >
            <X size={18} />
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 lg:inline-flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="hidden justify-center border-b border-white/[0.05] py-2 lg:flex">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2.5 py-3">
          {!collapsed && (
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Analytics
            </p>
          )}
          <nav className="flex flex-col gap-0.5">{PRIMARY_NAV.map(renderItem)}</nav>

          {!collapsed && (
            <p className="mb-1.5 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Research
            </p>
          )}
          {collapsed && <div className="my-3 border-t border-white/[0.06]" />}
          <nav className="flex flex-col gap-0.5">{RESEARCH_NAV.map(renderItem)}</nav>
        </div>

        <div className="border-t border-white/[0.07] p-2.5">
          <nav className="mb-2 flex flex-col gap-0.5">
            {renderItem({ href: "/settings", label: "Settings", icon: Settings })}
          </nav>

          <div
            className={`flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.025] p-2 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/15 font-mono text-[11px] font-semibold text-accent-light">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-200">{user?.full_name || "Researcher"}</p>
                <p className="truncate text-[10px] text-slate-500">{user?.email}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={doLogout}
            title={collapsed ? "Log out" : undefined}
            className={`mt-1.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-bear/10 hover:text-red-300 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut size={15} />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <div className={`transition-all duration-200 ${collapsed ? "lg:pl-[68px]" : "lg:pl-60"}`}>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/[0.07] bg-canvas/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-white/[0.12] p-1.5 text-slate-300 hover:bg-white/[0.06] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-white sm:text-base">{title}</h1>
              {subtitle && <p className="hidden truncate text-[11px] text-slate-400 sm:block">{subtitle}</p>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {actions}
            <Link href="/analyze" className="btn-primary !px-3 !py-1.5 text-xs">
              <Plus size={14} /> <span className="hidden sm:inline">New analysis</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
