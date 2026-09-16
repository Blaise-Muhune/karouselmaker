import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GoogleFontsLink } from "@/components/GoogleFontsLink";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AI Carousel Generator for Instagram & TikTok",
    template: "%s | Karouselmaker",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "AI carousel generator",
    "Instagram carousel generator",
    "TikTok carousel generator",
    "Instagram carousel maker",
    "TikTok photo carousel maker",
    "social media carousel templates",
    "carousel content generator",
    "Instagram post generator",
    "TikTok content generator",
    "carousel caption generator",
  ],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "AI Carousel Generator for Instagram & TikTok | Karouselmaker",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Carousel Generator for Instagram & TikTok | Karouselmaker",
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: "Karouselmaker",
    statusBarStyle: "default",
  },
  alternates: {
    canonical: "/",
  },
};

/** JSON-LD for Organization + WebApplication so LLMs and search engines understand the product. */
function StructuredDataScript() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Project workspaces for consistent social content",
          "AI-generated titles, carousel slides, captions, and hashtags",
          "Built-in template collections and reusable template bundles",
          "Slide-level copy and image editing",
          "Instagram feed, TikTok photo, square, and story-ready formats",
          "ZIP exports with slides in posting order",
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
