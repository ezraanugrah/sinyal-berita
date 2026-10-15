import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sinyal — Berita Pilihan Anda",
  description: "Pembaca berita personal yang belajar dari minat dan penilaian Anda.",
  applicationName: "Sinyal Berita",
  appleWebApp: { capable: true, title: "Sinyal", statusBarStyle: "default" },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e121a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" suppressHydrationWarning><body>{children}</body></html>;
}
