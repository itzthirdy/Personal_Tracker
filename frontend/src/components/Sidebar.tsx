"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthSession, getStoredUser } from "@/lib/api";
import type { AuthUser } from "@/types/tracker";

export const NAVIGATION_ITEMS = [
  { name: "Routines & Habits", href: "/dashboard/habits", icon: "CheckSquare" },
  { name: "Calendar", href: "/dashboard/calendar", icon: "Calendar" },
  { name: "Finance", href: "/dashboard/finance", icon: "Wallet" },
  { name: "Exercise", href: "/dashboard/exercise", icon: "Dumbbell" },
];

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const strokeClass = active ? "stroke-[#39d353]" : "stroke-current";

  switch (icon) {
    case "CheckSquare":
      return (
        <svg
          className={`w-4 h-4 ${strokeClass}`}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "Calendar":
      return (
        <svg
          className={`w-4 h-4 ${strokeClass}`}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "Wallet":
      return (
        <svg
          className={`w-4 h-4 ${strokeClass}`}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      );
    case "Dumbbell":
      return (
        <svg
          className={`w-4 h-4 ${strokeClass}`}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6.5 6.5 11 11" />
          <path d="m21 21-1-1a2 2 0 0 0-2.8 0l-.7.7a2 2 0 0 1-2.8 0l-7.4-7.4a2 2 0 0 1 0-2.8l.7-.7a2 2 0 0 0 0-2.8L6 3" />
          <path d="m3 6 1 1a2 2 0 0 0 2.8 0l.7-.7a2 2 0 0 1 2.8 0l7.4 7.4a2 2 0 0 1 0 2.8l-.7.7a2 2 0 0 0 0 2.8l1 1" />
        </svg>
      );
    default:
      return (
        <svg
          className={`w-4 h-4 ${strokeClass}`}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  function handleSignOut() {
    clearAuthSession();
    router.push("/login");
  }

  const isNavActive = (href: string) => {
    if (href === "/dashboard/finance") {
      return pathname === "/dashboard/finance" || pathname === "/dashboard/finances";
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand / Platform Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#39d353] flex items-center justify-center text-[#090d16] font-extrabold text-sm shadow-[0_0_12px_rgba(57,211,83,0.35)] transition-transform group-hover:scale-105">
              ✓
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight block">
                Personal Tracker
              </span>
              <span className="text-[10px] text-gray-400 font-mono tracking-wider block">
                STATIC CORE SUITE
              </span>
            </div>
          </Link>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-gray-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Dashboard Hub shortcut */}
        <div className="px-3 pt-4 pb-2">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              pathname === "/dashboard"
                ? "bg-[#21262d] text-white border-l-2 border-[#39d353] font-semibold"
                : "text-gray-400 hover:text-gray-100 hover:bg-[#161b22] border-l-2 border-transparent"
            }`}
          >
            <span className="text-sm">♡</span>
            <span>Workspace Hub</span>
          </Link>
        </div>

        {/* Core Modules Header */}
        <div className="px-5 pt-3 pb-1.5">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
            Core Modules
          </span>
        </div>

        {/* 4 Locked Static Core Navigation Items */}
        <nav className="px-3 space-y-1">
          {NAVIGATION_ITEMS.map((item) => {
            const active = isNavActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-[#801E0F]/20 text-white border-l-2 border-[#801E0F] font-semibold shadow-sm"
                    : "text-gray-400 hover:text-gray-100 hover:bg-[#161b22] border-l-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <NavIcon icon={item.icon} active={active} />
                  <span>{item.name}</span>
                </div>

                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#801E0F]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer: User profile & Sign Out */}
      <div className="p-3 border-t border-[#30363d] bg-[#12161c]">
        {user ? (
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center text-xs font-bold text-gray-200">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-gray-200 truncate block">
                  {user.username}
                </span>
                <span className="text-[10px] text-gray-400 truncate block">
                  {user.email}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 text-xs">
          <Link
            href="/"
            className="flex-1 text-center py-1.5 px-2 rounded-md bg-[#161b22] hover:bg-[#21262d] text-gray-300 hover:text-white transition-colors"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex-1 text-center py-1.5 px-2 rounded-md bg-[#161b22] hover:bg-[#801E0F]/30 hover:text-red-300 text-gray-300 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-[#30363d] sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#39d353] flex items-center justify-center text-[#090d16] font-bold text-xs">
            ✓
          </div>
          <span className="text-sm font-bold text-white">Personal Tracker</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg bg-[#21262d] border border-[#30363d] text-gray-300"
          aria-label="Toggle Navigation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-[#0d1117] border-r border-[#30363d] h-full z-10 flex flex-col">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 bg-[#0d1117] border-r border-[#30363d] min-h-screen sticky top-0 h-screen flex-col">
        {navContent}
      </aside>
    </>
  );
}

