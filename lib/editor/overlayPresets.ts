/**
 * Preset color combinations for image overlay: gradient color, opacity, and text color.
 */

export type OverlayPreset = {
  id: string;
  name: string;
  gradientColor: string;
  gradientOpacity: number;
  textColor: string;
};

export const OVERLAY_PRESETS: OverlayPreset[] = [
  {
    id: "dark",
    name: "Dark",
    gradientColor: "#000000",
    gradientOpacity: 0.6,
    textColor: "#ffffff",
  },
  {
    id: "warm",
    name: "Warm",
    gradientColor: "#1a0a00",
    gradientOpacity: 0.55,
    textColor: "#fff5eb",
  },
  {
    id: "cool",
    name: "Cool",
    gradientColor: "#0a0a1a",
    gradientOpacity: 0.55,
    textColor: "#e8e8ff",
  },
  {
    id: "high-contrast",
    name: "High contrast",
    gradientColor: "#000000",
    gradientOpacity: 0.75,
    textColor: "#ffffff",
  },
  {
    id: "soft-dark",
    name: "Soft dark",
    gradientColor: "#1a1a1a",
    gradientOpacity: 0.45,
    textColor: "#f0f0f0",
  },
  {
    id: "navy",
    name: "Navy",
    gradientColor: "#0a0a2e",
    gradientOpacity: 0.6,
    textColor: "#e0e8ff",
  },
  {
    id: "forest",
    name: "Forest",
    gradientColor: "#0a1a0a",
    gradientOpacity: 0.5,
    textColor: "#e8ffe8",
  },
  {
    id: "burgundy",
    name: "Burgundy",
    gradientColor: "#1a0505",
    gradientOpacity: 0.55,
    textColor: "#ffe8e8",
  },
  {
    id: "light",
    name: "Light (dark text)",
    gradientColor: "#ffffff",
    gradientOpacity: 0.35,
    textColor: "#111111",
  },
  {
    id: "custom",
    name: "Custom",
    gradientColor: "#000000",
    gradientOpacity: 0.5,
    textColor: "#ffffff",
  },
];

export const PRESET_CUSTOM_ID = "custom";
