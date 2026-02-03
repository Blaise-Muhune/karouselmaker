"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Extract dominant and secondary colors from an image using canvas. */
function extractColorsFromImage(
  imageUrl: string
): Promise<{ primary: string; secondary: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const colorCounts: Record<string, number> = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const a = data[i + 3]!;
        if (a < 128) continue;
        const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
        colorCounts[key] = (colorCounts[key] ?? 0) + 1;
      }
      const sorted = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => {
          const parts = k.split(",").map(Number);
          const [r, g, b] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
          return rgbToHex(r, g, b);
        });
      const primary = sorted[0] ?? "#000000";
      const secondary = sorted[1] ?? "#666666";
      resolve({ primary, secondary });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

type ColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** When set, show "Extract from logo" button. */
  onExtractFromLogo?: (primary: string, secondary: string) => void;
};

export function ColorPicker({
  value,
  onChange,
  placeholder = "#000000",
  className,
  onExtractFromLogo,
}: ColorPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onExtractFromLogo) return;
    const url = URL.createObjectURL(file);
    try {
      const { primary, secondary } = await extractColorsFromImage(url);
      onExtractFromLogo(primary, secondary);
    } catch {
      // ignore
    } finally {
      URL.revokeObjectURL(url);
      e.target.value = "";
    }
  };

  const hexValue = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        type="color"
        value={hexValue}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 cursor-pointer rounded-lg border border-input/80 bg-background p-0"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 font-mono text-sm"
      />
      {onExtractFromLogo && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => fileRef.current?.click()}
            title="Upload logo to extract colors"
          >
            <ImageIcon className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}
