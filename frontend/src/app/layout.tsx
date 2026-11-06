import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Routine & Habit Tracker",
  description:
    "GitHub-inspired consistency heatmap, schedule calendar, and daily routine checklist tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full bg-[#0d1117] text-[#f0f6fc] flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
