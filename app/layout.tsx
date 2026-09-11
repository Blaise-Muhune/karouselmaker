import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GoogleFontsLink } from "@/components/GoogleFontsLink";

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
  "Karouselmaker is a marketing tool for organic Instagram and TikTok carousels—problem-first swipe content that soft-sells your product. Niche + offer in, export-ready carousels out.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Karouselmaker — Organic Instagram & TikTok carousel marketing",
    template: "%s | Karouselmaker",
  },
  description: metaDescription,
  keywords: [
    "organic Instagram marketing",
    "TikTok carousel marketing",
    "Instagram carousel maker",
    "product marketing carousel",
    "organic social media content",
    "swipe carousel posts",
    "Instagram TikTok carousels",
    "niche product marketing",
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
    title: "Karouselmaker — Organic Instagram & TikTok carousel marketing",
    description: metaDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Karouselmaker — Organic Instagram & TikTok carousel marketing",
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
        applicationCategory: "BusinessApplication",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Organic Instagram and TikTok carousel marketing",
          "Problem-first product soft-sell content",
          "Project niche and offer context",
          "Swipe-ready slide generation",
          "Export PNG/JPEG ZIP and captions",
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
          <GoogleFontsLink />
          <StructuredDataScript />
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
