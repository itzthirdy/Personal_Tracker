"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearAuthSession,
  fetchWorkspaceHub,
  getFallbackWorkspaceCards,
  getStoredToken,
  getStoredUser,
} from "@/lib/api";
import type {
  AuthUser,
  HabitsLivePreview,
  WorkspaceCard,
} from "@/types/tracker";

function isHabitsPreview(
  preview: WorkspaceCard["livePreview"]
): preview is HabitsLivePreview {
  return "consistencyScore" in preview;
}

function getCardIconEmoji(icon: string, moduleKey: string): string {
  if (moduleKey === "habits" || icon === "target") return "🎯";
  if (moduleKey === "calendar" || icon === "calendar") return "📅";
  if (moduleKey === "finance" || moduleKey === "finances" || icon === "wallet") return "👛";
  if (moduleKey === "exercise" || icon === "dumbbell") return "🏋️";
  return "📄";
}

export default function WorkspaceHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cards, setCards] = useState<WorkspaceCard[]>(() =>
    getFallbackWorkspaceCards()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (!token) {
      router.replace("/login");
      return;
    }

    setUser(storedUser);

    let active = true;
    async function loadHub() {
      try {
        const serverCards = await fetchWorkspaceHub();
        if (active && serverCards.length > 0) {
          // Filter to strictly lock the 4 static core modules
          const coreModuleOrder = ["habits", "calendar", "finance", "exercise"];
          const normalized = serverCards
            .filter((c) =>
              coreModuleOrder.includes(c.moduleKey === "finances" ? "finance" : c.moduleKey)
            )
            .map((c) => ({
              ...c,
              route:
                c.moduleKey === "finances"
                  ? "/dashboard/finance"
                  : c.route || `/dashboard/${c.moduleKey}`,
            }));

          if (normalized.length >= 4) {
            setCards(normalized);
          } else {
            setCards(getFallbackWorkspaceCards());
          }
        }
      } catch {
        // Keep fallback cards if backend is unreachable
      } finally {
        if (active) setLoading(false);
      }
    }
    loadHub();
    return () => {
      active = false;
    };
  }, [router]);

  function handleSignOut() {
    clearAuthSession();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#f0f6fc] flex flex-col justify-between">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#202020] border border-[#2f2f2f] text-sm font-serif tracking-wide text-gray-100 shadow">
              <span className="text-base text-[#39d353]">✓</span>
              <span>Workspace Hub</span>
            </div>

            {user && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                Signed in as <strong className="text-gray-200">{user.username}</strong>
              </span>
            )}
          </div>

          {/* Right Navigation Controls */}
          <div className="flex items-center gap-2 text-gray-400">
            <Link
              href="/"
              className="text-xs px-2.5 py-1.5 rounded-md hover:bg-[#242424] hover:text-white transition-colors"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-2.5 py-1.5 rounded-md hover:bg-[#242424] hover:text-red-300 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* 4-Module Fixed Core Architecture Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-52 rounded-xl bg-[#202020] border border-[#2f2f2f] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {cards.map((card) => {
              const habitsPreview = isHabitsPreview(card.livePreview)
                ? card.livePreview
                : null;

              return (
                <Link
                  key={card.id}
                  href={card.route}
                  className="group relative rounded-xl overflow-hidden bg-[#222222] border border-[#303030] hover:border-[#801E0F]/80 shadow-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
                >
                  {/* Card Cover Image Banner */}
                  <div className="relative h-36 w-full overflow-hidden bg-[#191919]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.coverImage}
                      alt={card.title}
                      className="w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#222222] via-transparent to-black/30" />

                    {/* Status / Live Preview Badge in Top Right */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      {habitsPreview ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#0d1117]/90 text-[#39d353] border border-[#39d353]/40 backdrop-blur">
                          {habitsPreview.todayProgress.completionPercentage}% Today • {habitsPreview.currentStreak}d 🔥
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0d1117]/85 text-gray-300 border border-[#30363d] backdrop-blur">
                          {"subtitle" in card.livePreview
                            ? card.livePreview.subtitle
                            : "Coming Soon"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Bar */}
                  <div className="px-4 py-3.5 bg-[#262626] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">
                        {getCardIconEmoji(card.icon, card.moduleKey)}
                      </span>
                      <span className="text-sm font-serif font-medium text-gray-100 truncate">
                        {card.title}
                      </span>
                    </div>

                    <span className="text-xs text-gray-400 group-hover:text-[#39d353] transition-colors">
                      Open →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Quick Module Switcher Strip */}
        <div className="mt-8 rounded-lg bg-[#222222] border border-[#303030] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-serif tracking-widest uppercase text-gray-400">
            CORE PLATFORM MODULES
          </span>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link
              href="/dashboard/habits"
              className="text-[#39d353] hover:underline font-medium"
            >
              Habit Tracker →
            </Link>
            <span className="text-gray-600">•</span>
            <Link
              href="/dashboard/calendar"
              className="text-gray-300 hover:text-white font-medium"
            >
              Calendar Schedule →
            </Link>
            <span className="text-gray-600">•</span>
            <Link
              href="/dashboard/finance"
              className="text-gray-400 hover:text-white"
            >
              Finance
            </Link>
            <span className="text-gray-600">•</span>
            <Link
              href="/dashboard/exercise"
              className="text-gray-400 hover:text-white"
            >
              Exercise
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
