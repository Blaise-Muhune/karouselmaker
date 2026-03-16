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

/** Base URL for canonical and structured data; use env in production. */
const siteUrl =
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    : "https://karouselmaker.com";

const metaDescription =
  "Karouselmaker is an AI carousel maker for Instagram and LinkedIn. Create swipe carousels from a topic or URL: AI generates slides, you pick templates and export. Supports Instagram carousel templates, LinkedIn carousel posts, and import template from image.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Karouselmaker — AI Carousel Maker for Instagram & LinkedIn",
    template: "%s | Karouselmaker",
  },
  description: metaDescription,
  keywords: [
    "AI carousel maker",
    "Instagram carousel maker",
    "LinkedIn carousel",
    "instagram carousel template",
    "linkedin post generator",
    "carousel post maker",
    "swipe carousel",
    "carousel template",
  ],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Karouselmaker",
    title: "Karouselmaker — AI Carousel Maker for Instagram & LinkedIn",
    description: metaDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Karouselmaker — AI Carousel Maker for Instagram & LinkedIn",
    description: metaDescription,
  },
  appleWebApp: {
    capable: true,
    title: "Karouselmaker",
    statusBarStyle: "default",
  },
  alternates: {
    canonical: siteUrl,
  },
};

/** JSON-LD for Organization + WebApplication so LLMs and search engines understand the product. */
function StructuredDataScript() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Karouselmaker",
        url: siteUrl,
        description: metaDescription,
      },
      {
        "@type": "WebApplication",
        name: "Karouselmaker",
        description: metaDescription,
        url: siteUrl,
        applicationCategory: "MultimediaApplication",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "AI carousel generation from topic or URL",
          "Instagram carousel templates",
          "LinkedIn carousel posts",
          "Import template from image",
          "Export as images or video",
        ],
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen">
          <StructuredDataScript />
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
