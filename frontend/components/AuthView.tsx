"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Mail,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { AmbientHeroBackdrop, EASE_OUT, FadeIn } from "@/components/Motion";
import { BrandMark } from "./BrandMark";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function evaluatePassword(pw: string) {
  const checks = [
    { id: "len", label: "At least 8 characters", ok: pw.length >= 8 },
    { id: "upper", label: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(pw) },
    { id: "lower", label: "One lowercase letter (a–z)", ok: /[a-z]/.test(pw) },
    { id: "num", label: "One number (0–9)", ok: /[0-9]/.test(pw) },
    { id: "sym", label: "One special character (!@#$…)", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const strength: "Weak" | "Fair" | "Strong" =
    score <= 2 ? "Weak" : score <= 4 ? "Fair" : "Strong";
  return { checks, score, strength, valid: score === 5 };
}

function AuthInner({ initialMode }: { initialMode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, login, register } = useAuth();
  const { notify } = useToast();

  const urlMode = params.get("mode");
  const mode: "login" | "register" =
    urlMode === "register" ? "register" : urlMode === "login" ? "login" : initialMode;

  const next = params.get("next") || "/dashboard";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const pwEval = evaluatePassword(password);
  const emailValid = EMAIL_RE.test(email.trim());
  const passwordsMatch = password === confirmPassword;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address (for example, name@domain.com).");
      return;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (!pwEval.valid) {
        setError("Please meet all password strength requirements before creating your account.");
        return;
      }
      if (!passwordsMatch) {
        setError("Password and confirm password do not match.");
        return;
      }
      if (!acceptedTerms) {
        setError("Please acknowledge the academic research terms and privacy notice.");
        return;
      }
    } else {
      if (!password) {
        setError("Please enter your password.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "register") {
        await register(trimmedEmail, password, confirmPassword, fullName);
        notify("Account created. Welcome to FinSentinel.", "success");
      } else {
        await login(trimmedEmail, password, rememberMe);
        notify("Signed in successfully.", "success");
      }
      router.replace(next);
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* Left ambient editorial brief */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.08] bg-navy-900 p-10 lg:flex">
        <AmbientHeroBackdrop />
        <div className="relative flex items-center justify-between">
          <BrandMark />
          <span className="rounded-md border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-slate-300">
            RESEARCH WORKSPACE
          </span>
        </div>

        <div className="relative max-w-md space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-light">
              Multimodal Sentiment Intelligence
            </p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-white">
              Structured financial sentiment analysis across text and media.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Trained on 11,931 annotated tweets and evaluated cross-domain on Financial PhraseBank.
              Every modality outputs verifiable confidence scores while keeping engagement and emotion separate
              from directional opinion.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 border-t border-white/[0.08] pt-6">
            {[
              { k: "82.95%", v: "Linear SVM accuracy (Twitter)" },
              { k: "75.82%", v: "Macro-F1 score (in-domain)" },
              { k: "4 models", v: "NB · LogReg · SVM · RF" },
              { k: "Late fusion", v: "Confidence-weighted voting" },
            ].map((item) => (
              <div key={item.k} className="border-l-2 border-accent/50 pl-3">
                <p className="tabular font-mono text-base font-semibold text-white">{item.k}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{item.v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/[0.08] pt-5 text-[11px] text-slate-500">
          <span>Academic research prototype · Not financial advice</span>
          <Link href="/methodology" className="text-slate-300 hover:text-white">
            Read methodology →
          </Link>
        </div>
      </aside>

      {/* Right form */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <FadeIn className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
            >
              <ArrowLeft size={14} /> Back to homepage
            </Link>
            <div className="lg:hidden">
              <BrandMark compact />
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {mode === "login" ? "Sign in to FinSentinel" : "Create a researcher account"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {mode === "login"
              ? "Access your saved analyses, ticker trends, and generated reports."
              : "Register to run multimodal analyses and persist results to your workspace."}
          </p>

          {/* Animated Switcher */}
          <div className="relative mt-6 grid grid-cols-2 rounded-lg border border-white/[0.12] bg-navy-900 p-1">
            <Link
              href={next !== "/dashboard" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className={`relative z-10 rounded-md py-2 text-center text-xs font-medium transition-colors ${
                mode === "login" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {mode === "login" && (
                <motion.span
                  layoutId="auth-mode-pill"
                  className="absolute inset-0 -z-10 rounded-md bg-accent"
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                />
              )}
              Log in
            </Link>
            <Link
              href={next !== "/dashboard" ? `/register?next=${encodeURIComponent(next)}` : "/register"}
              className={`relative z-10 rounded-md py-2 text-center text-xs font-medium transition-colors ${
                mode === "register" ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {mode === "register" && (
                <motion.span
                  layoutId="auth-mode-pill"
                  className="absolute inset-0 -z-10 rounded-md bg-accent"
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                />
              )}
              Create account
            </Link>
          </div>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <label className="label" htmlFor="full-name">
                  Full name
                </label>
                <div className="relative">
                  <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="full-name"
                    type="text"
                    autoComplete="name"
                    required
                    className="input pl-9"
                    placeholder="Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input pl-9"
                  placeholder="researcher@institution.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {email.length > 0 && !emailValid && (
                <p className="mt-1 text-[11px] text-amber-300">Enter a valid email address.</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">
                  Password
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setShowForgot((v) => !v)}
                    className="mb-1.5 text-[11px] text-accent-light hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  className="input pl-9 pr-10"
                  placeholder={mode === "register" ? "Create a strong password" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {mode === "register" && password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="mt-2.5 rounded-lg border border-white/[0.1] bg-navy-900 p-3"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Password strength</span>
                    <span
                      className={`font-semibold ${
                        pwEval.strength === "Strong"
                          ? "text-bull"
                          : pwEval.strength === "Fair"
                          ? "text-amber-300"
                          : "text-bear"
                      }`}
                    >
                      {pwEval.strength}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((step) => {
                      const active =
                        (step === 1 && pwEval.score >= 1) ||
                        (step === 2 && pwEval.score >= 3) ||
                        (step === 3 && pwEval.score === 5);
                      const bg =
                        pwEval.strength === "Strong"
                          ? "bg-bull"
                          : pwEval.strength === "Fair"
                          ? "bg-amber-400"
                          : "bg-bear";
                      return (
                        <div
                          key={step}
                          className={`h-1 rounded-sm transition-colors ${active ? bg : "bg-slate-800"}`}
                        />
                      );
                    })}
                  </div>
                  <ul className="mt-2.5 space-y-1">
                    {pwEval.checks.map((c) => (
                      <li
                        key={c.id}
                        className={`flex items-center gap-1.5 text-[11px] ${
                          c.ok ? "text-emerald-300" : "text-slate-500"
                        }`}
                      >
                        {c.ok ? <Check size={12} className="shrink-0" /> : <X size={12} className="shrink-0" />}
                        <span>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>

            {mode === "register" && (
              <>
                <div>
                  <label className="label" htmlFor="confirm-password">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      className="input pl-9 pr-10"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
                      aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="mt-1 text-[11px] text-bear">Passwords do not match.</p>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.1] bg-navy-900/70 p-3 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-navy-900 accent-accent"
                  />
                  <span className="leading-relaxed text-slate-400">
                    I understand FinSentinel is an academic sentiment research tool and does not provide
                    financial advice or market price predictions.
                  </span>
                </label>
              </>
            )}

            {mode === "login" && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-500 bg-navy-900 accent-accent"
                />
                <span>Keep me signed in for 7 days</span>
              </label>
            )}

            {showForgot && mode === "login" && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs leading-relaxed text-slate-300">
                <div className="flex items-start gap-2">
                  <HelpCircle size={15} className="mt-0.5 shrink-0 text-accent-light" />
                  <div>
                    <p className="font-medium text-white">Local prototype authentication</p>
                    <p className="mt-1 text-slate-400">
                      This local build stores accounts in SQLite without an outbound SMTP mail server, so email
                      reset links are not dispatched automatically. Once signed in, you can change your password
                      anytime in <span className="text-slate-200">Settings</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-bear/35 bg-bear/10 px-3 py-2.5 text-xs text-red-200"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-bear" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  <span>{mode === "login" ? "Signing in…" : "Creating account…"}</span>
                </>
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={13} className="text-slate-400" />
            Passwords are salted &amp; hashed with bcrypt; sessions use signed JWTs.
          </p>
        </FadeIn>
      </main>
    </div>
  );
}

export function AuthView({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas text-xs text-slate-400">
          Loading authentication…
        </div>
      }
    >
      <AuthInner initialMode={initialMode} />
    </Suspense>
  );
}
