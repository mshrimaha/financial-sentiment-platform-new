"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, LogOut, Shield, User as UserIcon, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, Notice, SectionTitle } from "@/components/ui";
import { evaluatePassword } from "@/components/AuthView";
import { useToast } from "@/components/Toast";
import { RequireAuth, useAuth } from "@/lib/auth";
import { apiPost, apiPut, fmtFullDate } from "@/lib/api";

export default function SettingsPage() {
  const { user, setUserState, logout } = useAuth();
  const { notify } = useToast();
  const router = useRouter();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const pwEval = evaluatePassword(newPassword);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    if (!email.trim() || !email.includes("@")) {
      setProfileError("Enter a valid email address.");
      return;
    }
    setProfileBusy(true);
    try {
      const res = await apiPut<{ user: any; message: string }>("/api/auth/profile", {
        full_name: fullName.trim() || null,
        email: email.trim(),
      });
      setUserState(res.user);
      notify(res.message || "Profile updated.", "success");
    } catch (err: any) {
      setProfileError(err?.message || "Could not update profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (!currentPassword) {
      setPwError("Enter your current password.");
      return;
    }
    if (!pwEval.valid) {
      setPwError("New password must meet all strength requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await apiPost<{ message: string }>("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify(res.message || "Password updated.", "success");
    } catch (err: any) {
      setPwError(err?.message || "Could not change password.");
    } finally {
      setPwBusy(false);
    }
  }

  function handleLogout() {
    logout();
    notify("You have been signed out.", "info");
    router.push("/login");
  }

  return (
    <RequireAuth>
      <AppShell title="Settings" subtitle="Manage your researcher profile, password, and session">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            {/* Profile */}
            <Card>
              <SectionTitle
                title="Profile information"
                subtitle="Updates your display name and login email"
                action={<UserIcon size={16} className="text-slate-400" />}
              />
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="label" htmlFor="settings-name">
                    Full name
                  </label>
                  <input
                    id="settings-name"
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Researcher name"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="settings-email">
                    Email address
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    required
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {profileError && (
                  <p className="rounded border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-red-200">
                    {profileError}
                  </p>
                )}
                <button type="submit" disabled={profileBusy} className="btn-primary text-xs">
                  {profileBusy ? "Saving changes…" : "Save profile"}
                </button>
              </form>
            </Card>

            {/* Change password */}
            <Card>
              <SectionTitle
                title="Change password"
                subtitle="Passwords are hashed with bcrypt before storage"
                action={<KeyRound size={16} className="text-slate-400" />}
              />
              <form onSubmit={savePassword} className="space-y-4">
                <div>
                  <label className="label" htmlFor="curr-pw">
                    Current password
                  </label>
                  <input
                    id="curr-pw"
                    type="password"
                    className="input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="new-pw">
                    New password
                  </label>
                  <input
                    id="new-pw"
                    type="password"
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  {newPassword.length > 0 && (
                    <div className="mt-2 rounded border border-slate-400/15 bg-navy-900 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Strength</span>
                        <span
                          className={
                            pwEval.strength === "Strong"
                              ? "text-bull"
                              : pwEval.strength === "Fair"
                              ? "text-amber-300"
                              : "text-bear"
                          }
                        >
                          {pwEval.strength}
                        </span>
                      </div>
                      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {pwEval.checks.map((c) => (
                          <li
                            key={c.id}
                            className={`flex items-center gap-1.5 text-[11px] ${
                              c.ok ? "text-emerald-300" : "text-slate-500"
                            }`}
                          >
                            {c.ok ? <Check size={12} /> : <X size={12} />}
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="conf-pw">
                    Confirm new password
                  </label>
                  <input
                    id="conf-pw"
                    type="password"
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {pwError && (
                  <p className="rounded border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-red-200">
                    {pwError}
                  </p>
                )}
                <button type="submit" disabled={pwBusy} className="btn-ghost text-xs">
                  {pwBusy ? "Updating password…" : "Update password"}
                </button>
              </form>
            </Card>
          </div>

          {/* Account & session */}
          <div className="space-y-6">
            <Card>
              <SectionTitle
                title="Account & session"
                subtitle="Workspace ownership and authentication details"
                action={<Shield size={16} className="text-accent-light" />}
              />
              <dl className="divide-y divide-slate-400/10 text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-400">Account ID</dt>
                  <dd className="font-mono text-[11px] text-slate-200">{user?.id}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-400">Session status</dt>
                  <dd>
                    <Badge tone="green">Active JWT</Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-400">Member since</dt>
                  <dd className="text-slate-200">{fmtFullDate(user?.created_at)}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-400">Persistence layer</dt>
                  <dd className="text-slate-300">SQLite (local prototype)</dd>
                </div>
              </dl>
              <div className="mt-5 border-t border-slate-400/15 pt-4">
                <button onClick={handleLogout} className="btn-danger w-full text-xs">
                  <LogOut size={14} /> Sign out of this session
                </button>
              </div>
            </Card>

            <Notice>
              All analyses, uploaded datasets, collection records, and generated reports are strictly scoped to
              your account ID on the backend. Other users cannot view or delete your records.
            </Notice>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
