"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  apiCreateWorkspaceCard,
  apiDeleteWorkspaceCard,
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
  if (moduleKey === "finances" || icon === "wallet") return "◐";
  if (moduleKey === "exercise" || icon === "dumbbell") return "🏋️";
  if (icon === "book-open") return "📖";
  if (icon === "utensils") return "🍴";
  if (icon === "heart") return "🤍";
  return "📄";
}

export default function WorkspaceHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cards, setCards] = useState<WorkspaceCard[]>(() =>
    getFallbackWorkspaceCards()
  );
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCoverUrl, setNewCoverUrl] = useState("");
  const [creating, setCreating] = useState(false);

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
          setCards(serverCards);
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

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || creating) return;
    setCreating(true);

    try {
      const created = await apiCreateWorkspaceCard({
        title: trimmed,
        coverImage: newCoverUrl.trim() || undefined,
      });
      setCards((prev) => [...prev, created]);
    } catch {
      const slug =
        trimmed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "custom";
      const localCard: WorkspaceCard = {
        id: `local-${Date.now()}`,
        userId: user?.id ?? "local",
        title: trimmed,
        moduleKey: "custom",
        icon: "file-text",
        coverImage:
          newCoverUrl.trim() ||
          "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80",
        route: `/dashboard/${slug}`,
        order: cards.length + 1,
        status: "active",
        livePreview: { subtitle: "Coming Soon" },
      };
      setCards((prev) => [...prev, localCard]);
    } finally {
      setCreating(false);
      setNewTitle("");
      setNewCoverUrl("");
      setShowNewModal(false);
    }
  }

  async function handleDeleteCard(e: React.MouseEvent, cardId: string) {
    e.preventDefault();
    e.stopPropagation();
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    try {
      await apiDeleteWorkspaceCard(cardId);
    } catch {
      // ignore if offline
    }
  }

  function handleSignOut() {
    clearAuthSession();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#f0f6fc] flex flex-col justify-between">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Notion-Inspired Dashboard Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#202020] border border-[#2f2f2f] text-sm font-serif tracking-wide text-gray-100 shadow">
              <span className="text-base">♡</span>
              <span>My Dashboard</span>
            </div>

            {user && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                Signed in as{" "}
                <strong className="text-gray-200">{user.username}</strong>
              </span>
            )}
          </div>

          {/* Right Toolbar Icons + Blue "New" Button */}
          <div className="flex items-center gap-3 text-gray-400">
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
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#2383e2] hover:bg-[#1b6ec2] text-white text-xs font-semibold shadow transition-colors cursor-pointer"
            >
              <span>New</span>
              <span className="text-[10px] opacity-80">▾</span>
            </button>
          </div>
        </div>

        {/* 3-Column Notion Gallery Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-52 rounded-xl bg-[#202020] border border-[#2f2f2f] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((card) => {
              const habitsPreview = isHabitsPreview(card.livePreview)
                ? card.livePreview
                : null;

              return (
                <Link
                  key={card.id}
                  href={card.route}
                  className="group relative rounded-xl overflow-hidden bg-[#222222] border border-[#303030] hover:border-[#39d353]/60 shadow-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
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
                          {habitsPreview.todayProgress.completionPercentage}%
                          Today • {habitsPreview.currentStreak}d 🔥
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0d1117]/85 text-gray-300 border border-[#30363d] backdrop-blur">
                          {"subtitle" in card.livePreview
                            ? card.livePreview.subtitle
                            : "Coming Soon"}
                        </span>
                      )}

                      {card.moduleKey === "custom" && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCard(e, card.id)}
                          title="Delete page"
                          className="w-6 h-6 rounded-full bg-black/70 text-gray-300 hover:text-red-400 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Bar (Icon + Serif Title) */}
                  <div className="px-4 py-3.5 bg-[#262626] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">
                        {getCardIconEmoji(card.icon, card.moduleKey)}
                      </span>
                      <span className="text-base font-serif font-medium text-gray-100 truncate">
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

            {/* "+ New page" Gallery Slot */}
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="min-h-[196px] rounded-xl bg-[#1c1c1c] hover:bg-[#232323] border border-[#2f2f2f] hover:border-gray-500 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
            >
              <span className="text-lg">+</span>
              <span className="text-base font-serif">New page</span>
            </button>
          </div>
        )}

        {/* Bottom WEEKLY PLANNER Bar (matching Notion reference screenshot) */}
        <div className="mt-8 rounded-lg bg-[#222222] border border-[#303030] px-5 py-2.5 flex items-center justify-between">
          <span className="text-xs font-serif tracking-widest uppercase text-gray-400">
            WEEKLY PLANNER
          </span>
          <Link
            href="/dashboard/habits"
            className="text-xs font-medium text-[#39d353] hover:underline"
          >
            Open Routine &amp; Habit Tracker →
          </Link>
        </div>
      </div>

      {/* Modal for "+ New page" */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">
                Add New Workspace Page
              </h2>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Page Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Planning & Goals, Academics, Recipe..."
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#39d353] rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Cover Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={newCoverUrl}
                  onChange={(e) => setNewCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#39d353] rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-[#21262d] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2383e2] hover:bg-[#1b6ec2] text-white disabled:opacity-40 cursor-pointer"
                >
                  {creating ? "Creating..." : "Create Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
