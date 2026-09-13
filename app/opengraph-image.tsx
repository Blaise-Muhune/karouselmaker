import { ImageResponse } from "next/og";

export const alt = "Karouselmaker creates organic Instagram and TikTok carousels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "74px",
          color: "#f7f8f7",
          background: "linear-gradient(135deg, #102d2a 0%, #0b1817 58%, #152f2b 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>
          Karouselmaker
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          <div style={{ fontSize: 76, lineHeight: 1.02, fontWeight: 700, letterSpacing: -4 }}>
            Organic carousels that market your product.
          </div>
          <div style={{ marginTop: 28, color: "#b9d4cc", fontSize: 32, lineHeight: 1.3 }}>
            Instagram and TikTok content that earns attention before the soft sell.
          </div>
        </div>
        <div style={{ display: "flex", color: "#75d5b4", fontSize: 24, fontWeight: 600 }}>
          Niche + offer in. Swipe-ready posts out.
        </div>
      </div>
    ),
    size
  );
}
