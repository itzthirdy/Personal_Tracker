"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ModuleContent() {
  const params = useParams<{ module: string }>();
  const moduleSlug = String(params?.module ?? "module");
  const formattedTitle = moduleSlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#f0f6fc] flex flex-col">
      <header className="border-b border-[#30363d] bg-[#161b22]/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition-colors"
          >
            ← Back to My Dashboard
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-sm font-bold text-white">{formattedTitle}</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center text-2xl mx-auto mb-4">
            ✨
          </div>
          <h1 className="text-xl font-bold text-white">{formattedTitle}</h1>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            This workspace module is ready on your Hub and marked as{" "}
            <strong className="text-gray-200">Coming Soon</strong>. Head over to
            the Routine &amp; Habit Tracker to log your daily consistency!
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d]"
            >
              ← Workspace Hub
            </Link>
            <Link
              href="/dashboard/calendar"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d]"
            >
              Calendar
            </Link>
            <Link
              href="/dashboard/habits"
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#39d353] text-[#090d16] hover:bg-[#26a641] hover:text-white"
            >
              Habit Tracker →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

