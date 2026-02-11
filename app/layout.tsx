import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "Karouselmaker",
  description: "Generate swipe carousel posts from topics or URLs.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "Karouselmaker",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen">
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
