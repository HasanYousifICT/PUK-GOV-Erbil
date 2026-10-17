import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Arabic-script font used for Kurdish Sorani (the interface switches to right-to-left)
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://attitude360.in"),
  title: "OpenRecruitOS — The Open Source Recruitment Operating System",
  description:
    "OpenRecruitOS is a simple, self-hostable, open-source Applicant Tracking System by Attitude360 (Attitude TalentBridge LLP). Jobs, candidates, pipeline, interviews and dashboard.",
  keywords: [
    "ATS",
    "Applicant Tracking System",
    "Open Source",
    "Recruitment",
    "OpenRecruitOS",
    "Attitude360",
    "Attitude TalentBridge LLP",
  ],
  authors: [{ name: "Attitude TalentBridge LLP", url: "https://attitude360.in" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "OpenRecruitOS",
    description: "The Open Source Recruitment Operating System — by Attitude360 (Attitude TalentBridge LLP)",
    siteName: "OpenRecruitOS",
    url: "https://attitude360.in",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06a2f5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} antialiased bg-background text-foreground`}
      >
        <LanguageProvider>
          {children}
          <Toaster position="top-right" richColors />
        </LanguageProvider>
      </body>
    </html>
  );
}
