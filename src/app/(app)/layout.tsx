"use client";

import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto min-h-screen pb-safe">
      <main className="px-4 pt-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
