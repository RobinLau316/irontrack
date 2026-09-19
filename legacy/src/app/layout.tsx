import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IronTrack - 智能健身伴侣",
  description: "AI 驱动的增肌塑形训练指导与记录工具",
  manifest: process.env.GITHUB_ACTIONS === "true" ? "/irontrack/manifest.json" : "/manifest.json",
  themeColor: "#1a1a2e",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IronTrack",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-dark-bg text-[#e8e8e8]">
        {children}
      </body>
    </html>
  );
}
