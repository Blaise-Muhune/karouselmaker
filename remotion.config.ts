import { Config } from "@remotion/cli/config";

// ——— Maximum quality defaults ———
// See docs/remotion-quality.md for full options and CLI overrides.

// Lossless frame capture (no JPEG compression artifacts)
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// Encoding: best quality for H.264 (CRF 1 = near-lossless; 1–51 scale, lower = better)
Config.setCrf(1);

// 4:4:4 chroma subsampling (sharper color edges than default 4:2:0)
Config.setPixelFormat("yuv444p");

// x264 preset: slower = better compression/quality (medium | slow | slower | veryslow)
Config.setX264Preset("slow");

// Output scale: 2 = render at 2x resolution (e.g. 1080p comp → 2160p output) for sharp text on high-DPI
Config.setScale(2);
