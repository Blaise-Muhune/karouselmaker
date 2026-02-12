# Remotion: Maximum quality settings

The project is configured for **maximum visual quality** by default. This doc summarizes what’s set and how to override or go further.

## What’s configured (remotion.config.ts)

| Setting | Value | Effect |
|--------|--------|--------|
| **Frame format** | `png` | Lossless frame capture (no JPEG artifacts). |
| **CRF** | `1` | Near-lossless H.264 (1 = best, 51 = worst). Larger files, best quality. |
| **Pixel format** | `yuv444p` | 4:4:4 chroma (sharper color edges than default 4:2:0). |
| **x264 preset** | `slow` | Better compression/quality than `medium`; reasonable encode time. |
| **Scale** | `2` | Output at 2× resolution (e.g. 1080×1080 comp → 2160×2160). Sharp on high-DPI and when downscaled. |

## CLI overrides

Render commands can override these. Examples:

```bash
# Use default max-quality config (from remotion.config.ts)
npx remotion render remotion/index.ts PromoVideo out/promo.mp4

# Smaller file, still high quality (e.g. for web): CRF 18, scale 1
npx remotion render remotion/index.ts PromoVideo out/promo.mp4 --crf=18 --scale=1

# Exact 1080×1080 (no 2× scale) for platforms that require 1080
npx remotion render remotion/index.ts PromoVideo out/promo.mp4 --scale=1
```

## Color accuracy (CLI only)

For more accurate colors, pass the color space when rendering (not in config):

```bash
npx remotion render remotion/index.ts PromoVideo out/promo.mp4 --color-space=bt709
```

## ProRes (master / post-production)

For editing in DaVinci Resolve, Premiere, etc., use ProRes instead of H.264:

```bash
# Highest quality ProRes (4444-xq, supports alpha)
npx remotion render remotion/index.ts PromoVideo out/promo.mov --codec=prores --prores-profile=4444-xq

# High quality, smaller file (no alpha)
npx remotion render remotion/index.ts PromoVideo out/promo.mov --codec=prores --prores-profile=hq
```

Note: With ProRes, CRF and x264 preset are ignored.

## Hardware acceleration

If you enable hardware acceleration (e.g. for faster encodes), **CRF cannot be used**. Use a fixed video bitrate instead:

```bash
# Example: 20 Mbps for 4K-quality output
npx remotion render remotion/index.ts PromoVideo out/promo.mp4 --video-bitrate=20M
```

## Reference

- [Remotion: Encoding guide](https://www.remotion.dev/docs/encoding) — codecs, CRF, ProRes profiles  
- [Remotion: Quality guide](https://www.remotion.dev/docs/quality) — CRF, resolution, JPEG/PNG, color  
- [Remotion: Config](https://www.remotion.dev/docs/config) — all `Config.set*` options  
- [Remotion: Scaling](https://www.remotion.dev/docs/scaling) — `--scale` and sharp text
