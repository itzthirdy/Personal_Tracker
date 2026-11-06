"use client";

import React, { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#f0f6fc] flex flex-col md:flex-row">
      <Suspense
        fallback={
          <aside className="hidden md:flex md:w-64 md:shrink-0 bg-[#0d1117] border-r border-[#30363d] min-h-screen" />
        }
      >
        <Sidebar />
      </Suspense>
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
