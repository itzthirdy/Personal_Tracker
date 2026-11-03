"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiLogin, apiRegister, saveAuthSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        await apiRegister(username, email, password);
      } else {
        await apiLogin(identifier, password);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickDemoLogin() {
    setError(null);
    setLoading(true);
    const demoUser = "thirdy";
    const demoEmail = "thirdy@personaltracker.local";
    const demoPass = "password123";

    try {
      await apiLogin(demoEmail, demoPass);
      router.push("/dashboard");
    } catch {
      try {
        await apiRegister(demoUser, demoEmail, demoPass);
        router.push("/dashboard");
      } catch {
        // Offline fallback session so the user can still navigate if backend is stopped
        saveAuthSession("offline-demo-jwt", {
          id: "local-demo-user",
          username: demoUser,
          email: demoEmail,
        });
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#f0f6fc] flex flex-col justify-between p-4">
      {/* Top Back Link */}
      <div className="max-w-7xl w-full mx-auto py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-medium text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>

      {/* Centered Auth Card */}
      <div className="w-full max-w-md mx-auto bg-[#161b22] border border-[#30363d] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#39d353] flex items-center justify-center text-[#090d16] font-extrabold text-base shadow-[0_0_12px_rgba(57,211,83,0.45)]">
            ✓
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              {mode === "login" ? "Welcome Back" : "Create Your Account"}
            </h1>
            <p className="text-xs text-gray-400">
              {mode === "login"
                ? "Sign in to open your Workspace Hub"
                : "Seeds your default Hub cards & Monday–Sunday schedule"}
            </p>
          </div>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="grid grid-cols-2 bg-[#0d1117] p-1 rounded-lg border border-[#30363d] mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              mode === "login"
                ? "bg-[#801E0F] text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              mode === "register"
                ? "bg-[#801E0F] text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-[#801E0F]/30 border border-[#991b1b] text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. thirdy"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#39d353] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#39d353] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Email or Username
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your email or username"
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#39d353] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#39d353] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-bold bg-[#39d353] text-[#090d16] hover:bg-[#26a641] hover:text-white disabled:opacity-50 transition-all cursor-pointer shadow-[0_0_14px_rgba(57,211,83,0.35)]"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In to My Dashboard →"
                : "Create Account & Open Hub →"}
          </button>
        </form>

        {/* Divider + Quick Demo Login */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px bg-[#30363d] flex-1" />
          <span className="text-[11px] uppercase tracking-wider text-gray-500">
            or instant access
          </span>
          <div className="h-px bg-[#30363d] flex-1" />
        </div>

        <button
          type="button"
          onClick={handleQuickDemoLogin}
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition-colors cursor-pointer"
        >
          ⚡ Quick Demo Login (Auto-Create &amp; Enter Hub)
        </button>
      </div>

      <div className="text-center text-xs text-gray-500 py-4">
        JWT-Protected Multi-Tenant Workspace
      </div>
    </div>
  );
}

