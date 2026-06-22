import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/blurit/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlurIt — Blur faces & sensitive info before sharing",
  description:
    "Blur faces, license plates, and sensitive info in photos before sharing them online. Auto-detect faces, tap to blur, download. No uploads, no sign-up, 100% free. Your photos never leave your device.",
  keywords: [
    "blur faces",
    "photo blur",
    "privacy",
    "pixelate",
    "blur license plate",
    "face blur",
    "image blur",
    "client-side",
  ],
  authors: [{ name: "Jeffrey Hamilton" }],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "BlurIt — Blur faces before sharing",
    description:
      "Blur faces and sensitive info in photos privately in your browser. No uploads. No sign-up. 100% free.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BlurIt — Blur faces before sharing",
    description:
      "Blur faces and sensitive info in photos privately in your browser.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
