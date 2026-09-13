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
    default: "Organic Instagram & TikTok Carousel Maker",
    template: "%s | Karouselmaker",
  },
  description: SITE_DESCRIPTION,
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
    siteName: SITE_NAME,
    title: "Organic Instagram & TikTok Carousel Maker | Karouselmaker",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Organic Instagram & TikTok Carousel Maker | Karouselmaker",
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
