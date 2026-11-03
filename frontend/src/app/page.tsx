"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredUser } from "@/lib/api";
import type { AuthUser } from "@/types/tracker";

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#f0f6fc] flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#39d353] flex items-center justify-center text-[#090d16] font-extrabold text-sm shadow-[0_0_12px_rgba(57,211,83,0.45)]">
              ✓
            </div>
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              Personal Tracker
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#39d353] text-[#090d16] hover:bg-[#26a641] hover:text-white transition-all shadow-[0_0_12px_rgba(57,211,83,0.35)]"
              >
                Open My Dashboard ({user.username}) →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#21262d] border border-[#30363d] transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/login?mode=register"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#801E0F] hover:bg-[#991b1b] text-white transition-colors shadow"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center flex-1 flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-xs font-medium text-[#39d353] mb-6">
          <span className="w-2 h-2 rounded-full bg-[#39d353]" />
          <span>Notion-Style Workspace Hub • GitHub Consistency Heatmap</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-tight">
          Build Daily Discipline with Visual{" "}
          <span className="text-[#39d353]">Green-Shade</span> Consistency.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-gray-400 max-w-2xl leading-relaxed">
          Organize your life from a customizable{" "}
          <strong className="text-gray-200">My Dashboard</strong> window hub.
          Track your Monday–Sunday routines, workouts, school schedule, and
          chores while watching every completed day light up your GitHub-inspired
          calendar.
        </p>

        {/* Primary Action Flow Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={user ? "/dashboard" : "/login"}
            className="px-6 py-3 rounded-xl text-sm font-bold bg-[#39d353] text-[#090d16] hover:bg-[#26a641] hover:text-white transition-all shadow-[0_0_20px_rgba(57,211,83,0.4)]"
          >
            {user ? "Enter My Dashboard Hub →" : "Log In to Workspace Hub →"}
          </Link>

          {!user && (
            <Link
              href="/login?mode=register"
              className="px-6 py-3 rounded-xl text-sm font-semibold bg-[#161b22] text-gray-200 hover:text-white hover:bg-[#21262d] border border-[#30363d] transition-colors"
            >
              Create Free Account
            </Link>
          )}
        </div>

        {/* Visual Architecture Flow Preview Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Step 1 • Auth
              </span>
              <span className="text-lg">🔐</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Multi-User Isolated Account
            </h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Sign in with JWT authentication. Your weekly templates, daily
              habit logs, and workspace cards are privately scoped to your
              account.
            </p>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Step 2 • Window Hub
              </span>
              <span className="text-lg">🗂️</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Notion-Style Workspace Gallery
            </h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Open your customizable <strong className="text-gray-200">My Dashboard</strong> window
              with cards for Routine &amp; Habit Tracker, Finances, Exercise, and{" "}
              <code className="text-gray-300">+ New page</code>.
            </p>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#39d353]">
                Step 3 • Inside Window
              </span>
              <span className="text-lg">🟩</span>
            </div>
            <h3 className="text-base font-bold text-white">
              GitHub Routine Heatmap
            </h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Click into your Routine &amp; Habit Tracker card to check off daily
              habits and watch each calendar date square shift from dark green
              to neon green.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#30363d] py-6 text-center text-xs text-gray-500">
        Personal Tracker • Home → Login → Workspace Window Hub → Routine
        Heatmap
      </footer>
    </div>
  );
}
