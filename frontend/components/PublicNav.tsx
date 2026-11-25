"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { useAuth } from "@/lib/auth";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/methodology", label: "Methodology" },
  { href: "/models", label: "Model Results" },
  { href: "/datasets", label: "Datasets" },
  { href: "/about", label: "About" },
];

export function PublicNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <BrandMark />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((item) => {
            const active =
              item.href === "/#product"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "text-white" : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {item.label}
                {active && item.href !== "/#product" && (
                  <motion.span
                    layoutId="public-nav-underline"
                    className="absolute inset-x-3 -bottom-[17px] h-[2px] bg-gradient-to-r from-accent to-cyan-light"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          {user ? (
            <>
              <Link href="/analyze" className="btn-ghost !py-1.5 text-xs">
                Analyze
              </Link>
              <Link href="/dashboard" className="btn-primary !py-1.5 text-xs">
                Dashboard <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost !py-1.5 text-xs">
                Login
              </Link>
              <Link href="/register" className="btn-primary !py-1.5 text-xs">
                Get Started <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg border border-white/[0.12] p-2 text-slate-300 hover:bg-white/[0.06] md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.07] bg-surface px-4 py-4 md:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.07] pt-4">
              {user ? (
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-xs">
                  Open Dashboard <ArrowRight size={14} />
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-ghost w-full text-xs">
                    Login
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-xs">
                    Get Started <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
