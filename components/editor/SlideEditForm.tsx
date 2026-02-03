"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidePreview, type SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { AssetPickerModal } from "@/components/assets/AssetPickerModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSlide } from "@/app/actions/slides/updateSlide";
import { applyToAllSlides, applyOverlayToAllSlides, applyImageDisplayToAllSlides } from "@/app/actions/slides/applyToAllSlides";
import { shortenToFit } from "@/app/actions/slides/shortenToFit";
import { rewriteHook } from "@/app/actions/slides/rewriteHook";
import { saveSlidePreset } from "@/app/actions/presets/saveSlidePreset";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Slide, SlidePreset, Template } from "@/lib/server/db/types";
import {
  ArrowLeftIcon,
  Bookmark,
  CheckIcon,
  CopyIcon,
  HashIcon,
  ImageIcon,
  ImageOffIcon,
  InfoIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  PaletteIcon,
  ScissorsIcon,
  SparklesIcon,
  Trash2,
  Type,
  UploadIcon,
} from "lucide-react";
import { OVERLAY_PRESETS, PRESET_CUSTOM_ID, type OverlayPreset } from "@/lib/editor/overlayPresets";
import { HIGHLIGHT_COLORS } from "@/lib/editor/inlineFormat";

export type ImageDisplayState = {
  position?: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  fit?: "cover" | "contain";
  frame?: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy";
  frameRadius?: number;
  frameColor?: string;
  frameShape?: "squircle" | "circle" | "diamond" | "hexagon" | "pill";
  layout?: "auto" | "side-by-side" | "stacked" | "grid" | "overlay-circles";
  gap?: number;
  dividerStyle?: "gap" | "line" | "zigzag" | "diagonal" | "wave" | "dashed" | "scalloped";
  dividerColor?: string;
  dividerWidth?: number;
  /** Overlay-circles layout only. */
  overlayCircleSize?: number;
  overlayCircleBorderWidth?: number;
  overlayCircleBorderColor?: string;
  overlayCircleX?: number;
  overlayCircleY?: number;
};

export type SlideBackgroundState = SlideBackgroundOverride & {
  mode?: "image";
  asset_id?: string;
  storage_path?: string;
  /** User-pasted image URL (alternative to asset). */
  image_url?: string;
  /** Hook only: second image shown in circle (from library). */
  secondary_asset_id?: string;
  secondary_storage_path?: string;
  /** Hook only: second image URL (pasted). */
  secondary_image_url?: string;
  fit?: "cover" | "contain";
  image_display?: ImageDisplayState;
  overlay?: {
    gradient?: boolean;
    darken?: number;
    blur?: number;
    color?: string;
    textColor?: string;
    /** Where the dark part of the gradient sits: top, bottom, left, right. */
    direction?: "top" | "bottom" | "left" | "right";
  };
};

const PREVIEW_PX = 540;
const PREVIEW_SCALE = PREVIEW_PX / 1080;
const PREVIEW_SIZE = PREVIEW_PX;

const SECTION_INFO: Record<string, { title: string; body: string }> = {
  content: {
    title: "Content",
    body: "Type your headline and optional body here. For bold, wrap a word in **like this**. For colored highlights, click a color (e.g. Yellow), type the word, then click {{/}} to close. The Highlight row applies to whichever field (headline or body) you’re editing. Size sliders set font size per zone. Highlight style toggles between colored text only or a highlighter (colored background + dark text).",
  },
  layout: {
    title: "Slide layout",
    body: "The Template dropdown chooses the slide layout—where the headline and body are placed (e.g. center, bottom). Each template has a fixed layout; you only edit the text. Position number shows the slide index (e.g. 3/10) on the slide and always applies to all slides in the carousel. If you have multiple slides, use Apply template to all to use this template on every slide.",
  },
  background: {
    title: "Background",
    body: "You can use a solid color, a gradient, or a background image. Add image: pick from your library (Pick) or paste a URL. With an image, use the Gradient overlay section below to add a dark gradient so text stays readable; you can set position (top/bottom/left/right), color, opacity, and text color. With solid/gradient only, the color picker and Overlay checkbox control the fill.",
  },
  presets: {
    title: "Presets",
    body: "Presets save the current template, gradient overlay, and position-number setting so you can reuse them. Choose Apply preset… to load a saved preset on this slide. All slides applies that preset to every slide in this carousel. Save stores the current template, overlay, and position-number setting as a new preset (you’ll name it in the dialog).",
  },
  preview: {
    title: "Preview",
    body: "This shows how the slide will look when exported. It updates as you change content, template, background, and display options. On desktop it stays in view when you scroll; on mobile it appears above the form.",
  },
};

export type TemplateWithConfig = Template & { parsedConfig: TemplateConfig };

type SlideEditFormProps = {
  slide: Slide;
  templates: TemplateWithConfig[];
  brandKit: BrandKit;
  totalSlides: number;
  backHref: string;
  editorPath: string;
  initialBackgroundImageUrl?: string | null;
  /** Multiple images (2–4) for content slides: grid layout. */
  initialBackgroundImageUrls?: string[] | null;
  /** Source of single AI image: brave or unsplash (fallback). */
  initialImageSource?: "brave" | "unsplash" | "google" | null;
  /** Source per image for multi-image slides. */
  initialImageSources?: ("brave" | "unsplash" | "google")[] | null;
  /** Hook only: resolved URL for second image (circle). */
  initialSecondaryBackgroundImageUrl?: string | null;
  presets?: SlidePreset[];
};

function getTemplateConfig(
  templateId: string | null,
  templates: TemplateWithConfig[]
): TemplateConfig | null {
  if (templateId) {
    const t = templates.find((x) => x.id === templateId);
    return t?.parsedConfig ?? null;
  }
  return templates[0]?.parsedConfig ?? null;
}

export function SlideEditForm({
  slide,
  templates,
  brandKit,
  totalSlides,
  backHref,
  editorPath,
  initialBackgroundImageUrl,
  initialBackgroundImageUrls,
  initialImageSource,
  initialImageSources,
  initialSecondaryBackgroundImageUrl,
  presets = [],
}: SlideEditFormProps) {
  const router = useRouter();
  const [headline, setHeadline] = useState(() => slide.headline);
  const [body, setBody] = useState(() => slide.body ?? "");
  const [templateId, setTemplateId] = useState<string | null>(() => slide.template_id ?? templates[0]?.id ?? null);
  const [background, setBackground] = useState<SlideBackgroundState>(() => {
    const bg = slide.background as SlideBackgroundState | null;
    if (bg && (bg.mode === "image" || bg.style || bg.color != null)) {
      const base = { ...bg, style: bg.style ?? "solid", color: bg.color ?? brandKit.primary_color ?? "#0a0a0a", gradientOn: bg.gradientOn ?? true };
      if (bg.overlay) base.overlay = { ...bg.overlay, darken: bg.overlay.darken ?? 0.5, color: bg.overlay.color ?? "#000000", textColor: bg.overlay.textColor ?? "#ffffff" };
      if (bg.image_display) base.image_display = { ...bg.image_display };
      return base;
    }
    return { style: "solid", color: brandKit.primary_color ?? "#0a0a0a", gradientOn: true, overlay: { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" } };
  });
  const [imageDisplay, setImageDisplay] = useState<ImageDisplayState>(() => {
    const bg = slide.background as { image_display?: ImageDisplayState; images?: unknown[] } | null;
    const d = bg?.image_display ? { ...bg.image_display } : {};
    const ds = d.dividerStyle as string | undefined;
    if (ds === "dotted") d.dividerStyle = "dashed";
    else if (ds === "double" || ds === "triple") d.dividerStyle = "scalloped";
    const hasMultiImages = (bg?.images?.length ?? 0) >= 2 || (initialBackgroundImageUrls?.length ?? 0) >= 2;
    if (Object.keys(d).length === 0 && hasMultiImages) {
      return { position: "center", fit: "cover", frame: "none", frameRadius: 0, frameColor: "#ffffff", frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: "#ffffff", dividerWidth: 8 };
    }
    return d;
  });
  const [backgroundImageUrlForPreview, setBackgroundImageUrlForPreview] = useState<string | null>(() => initialBackgroundImageUrl ?? null);
  const [secondaryBackgroundImageUrlForPreview, setSecondaryBackgroundImageUrlForPreview] = useState<string | null>(() => initialSecondaryBackgroundImageUrl ?? null);
  const [imageUrls, setImageUrls] = useState<{ url: string; source?: "brave" | "unsplash" | "google" }[]>(() => {
    const bg = slide.background as { asset_id?: string; image_url?: string; images?: { image_url?: string; source?: "brave" | "google" | "unsplash" }[] } | null;
    if (bg?.asset_id) return [{ url: "", source: undefined }];
    if (initialBackgroundImageUrls?.length) {
      return initialBackgroundImageUrls.map((url, i) => ({
        url,
        source: initialImageSources?.[i],
      }));
    }
    if (initialBackgroundImageUrl) {
      return [{ url: initialBackgroundImageUrl, source: initialImageSource ?? undefined }];
    }
    if (bg?.images?.length) {
      return bg.images.map((img) => ({ url: img.image_url ?? "", source: img.source }));
    }
    if (bg?.image_url) return [{ url: bg.image_url, source: undefined }];
    return [{ url: "", source: undefined }];
  });
  const [showCounter, setShowCounter] = useState<boolean>(() => {
    const m = slide.meta as { show_counter?: boolean } | null;
    return m?.show_counter ?? false;
  });
  const [headlineFontSize, setHeadlineFontSize] = useState<number | undefined>(() => {
    const m = slide.meta as { headline_font_size?: number } | null;
    return m?.headline_font_size;
  });
  const [bodyFontSize, setBodyFontSize] = useState<number | undefined>(() => {
    const m = slide.meta as { body_font_size?: number } | null;
    return m?.body_font_size;
  });
  const [headlineHighlightStyle, setHeadlineHighlightStyle] = useState<"text" | "background">(() => {
    const m = slide.meta as { headline_highlight_style?: "text" | "background" } | null;
    return m?.headline_highlight_style === "background" ? "background" : "text";
  });
  const [bodyHighlightStyle, setBodyHighlightStyle] = useState<"text" | "background">(() => {
    const m = slide.meta as { body_highlight_style?: "text" | "background" } | null;
    return m?.body_highlight_style === "background" ? "background" : "text";
  });
  const headlineRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerForSecondary, setPickerForSecondary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shortening, setShortening] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [applyingOverlay, setApplyingOverlay] = useState(false);
  const [applyingDisplay, setApplyingDisplay] = useState(false);
  const [applyingImageDisplay, setApplyingImageDisplay] = useState(false);
  const [applyingBackground, setApplyingBackground] = useState(false);
  const [hookVariants, setHookVariants] = useState<string[]>([]);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [applyingPresetToAll, setApplyingPresetToAll] = useState(false);
  const [infoSection, setInfoSection] = useState<string | null>(null);

  const templateConfig = getTemplateConfig(templateId, templates);
  const isHook = slide.slide_type === "hook";
  const defaultHeadlineSize = templateConfig?.textZones?.find((z) => z.id === "headline")?.fontSize ?? 72;
  const defaultBodySize = templateConfig?.textZones?.find((z) => z.id === "body")?.fontSize ?? 48;

  const validImageCount = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim())).length;
  const multiImageDefaults: ImageDisplayState = { position: "center", fit: "cover", frame: "none", frameRadius: 0, frameColor: "#ffffff", frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: "#ffffff", dividerWidth: 8 };
  const effectiveImageDisplay = validImageCount >= 2 ? { ...multiImageDefaults, ...imageDisplay } : imageDisplay;

  const insertAtCursor = useCallback(
    (ref: React.RefObject<HTMLTextAreaElement | null>, setValue: (v: string) => void, getValue: () => string, toInsert: string) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = getValue();
      const before = text.slice(0, start);
      const after = text.slice(end);
      setValue(before + toInsert + after);
      setTimeout(() => {
        el.focus();
        const newPos = start + toInsert.length;
        el.setSelectionRange(newPos, newPos);
      }, 0);
    },
    []
  );

  const insertHighlight = useCallback(
    (preset: string, target: "headline" | "body") => {
      const tag = `{{${preset}}}`;
      if (target === "headline") {
        if (document.activeElement !== headlineRef.current) headlineRef.current?.focus();
        setTimeout(() => insertAtCursor(headlineRef, setHeadline, () => headline, tag), 0);
      } else {
        if (document.activeElement !== bodyRef.current) bodyRef.current?.focus();
        setTimeout(() => insertAtCursor(bodyRef, setBody, () => body, tag), 0);
      }
    },
    [headline, body, insertAtCursor]
  );
  const insertCloseHighlight = useCallback(
    (target: "headline" | "body") => {
      const tag = "{{/}}";
      if (target === "headline") {
        if (document.activeElement !== headlineRef.current) headlineRef.current?.focus();
        setTimeout(() => insertAtCursor(headlineRef, setHeadline, () => headline, tag), 0);
      } else {
        if (document.activeElement !== bodyRef.current) bodyRef.current?.focus();
        setTimeout(() => insertAtCursor(bodyRef, setBody, () => body, tag), 0);
      }
    },
    [headline, body, insertAtCursor]
  );

  const buildImageDisplayPayload = (): Record<string, unknown> | undefined => {
    const source = validImageCount >= 2 ? effectiveImageDisplay : imageDisplay;
    const hasAny = Object.keys(source).length > 0;
    if (!hasAny) return undefined;
    const payload: Record<string, unknown> = {};
    if (source.position != null) payload.position = source.position;
    if (source.fit != null) payload.fit = source.fit;
    if (source.frame != null) payload.frame = source.frame;
    if (source.frameRadius != null) payload.frameRadius = source.frameRadius;
    if (source.frameColor != null) payload.frameColor = source.frameColor;
    if (source.frameShape != null) payload.frameShape = source.frameShape;
    if (source.layout != null) payload.layout = source.layout;
    if (source.gap != null) payload.gap = source.gap;
    if (source.dividerStyle != null) payload.dividerStyle = source.dividerStyle;
    if (source.dividerColor != null) payload.dividerColor = source.dividerColor;
    if (source.dividerWidth != null) payload.dividerWidth = source.dividerWidth;
    if (source.overlayCircleSize != null) payload.overlayCircleSize = source.overlayCircleSize;
    if (source.overlayCircleBorderWidth != null) payload.overlayCircleBorderWidth = source.overlayCircleBorderWidth;
    if (source.overlayCircleBorderColor != null) payload.overlayCircleBorderColor = source.overlayCircleBorderColor;
    if (source.overlayCircleX != null) payload.overlayCircleX = source.overlayCircleX;
    if (source.overlayCircleY != null) payload.overlayCircleY = source.overlayCircleY;
    return Object.keys(payload).length > 0 ? payload : undefined;
  };

  const handleSave = async () => {
    setSaving(true);
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const validUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    const imageDisplayPayload = buildImageDisplayPayload();
    const bgPayload =
      background.mode === "image" || validUrls.length > 0
        ? validUrls.length >= 2
          ? { mode: "image", images: validUrls.map((i) => ({ image_url: i.url, source: i.source })), fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
          : validUrls.length === 1
            ? { mode: "image", image_url: validUrls[0]!.url, image_source: validUrls[0]!.source, fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
            : { mode: "image", asset_id: background.asset_id, storage_path: background.storage_path, image_url: background.image_url || undefined, fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
        : { style: background.style, color: background.color, gradientOn: background.gradientOn, overlay: overlayPayload };
    const result = await updateSlide(
      {
        slide_id: slide.id,
        headline,
        body: body.trim() || null,
        template_id: templateId,
        background: Object.keys(bgPayload).length ? (bgPayload as Record<string, unknown>) : undefined,
        meta: {
          ...(typeof slide.meta === "object" && slide.meta !== null ? (slide.meta as Record<string, unknown>) : {}),
          show_counter: showCounter,
          ...(headlineFontSize != null && { headline_font_size: headlineFontSize }),
          ...(bodyFontSize != null && { body_font_size: bodyFontSize }),
          headline_highlight_style: headlineHighlightStyle,
          body_highlight_style: bodyHighlightStyle,
        },
      },
      editorPath
    );
    setSaving(false);
    if (result.ok) {
      router.push(backHref);
    }
  };

  const handleShortenToFit = async () => {
    setShortening(true);
    const result = await shortenToFit(slide.id, editorPath);
    setShortening(false);
    if (result.ok) {
      setHeadline(result.headline);
      setBody(result.body);
    }
  };

  const handleRewriteHook = async () => {
    setRewriting(true);
    setHookVariants([]);
    const result = await rewriteHook(slide.id, 5);
    setRewriting(false);
    if (result.ok && result.variants.length > 0) {
      setHookVariants(result.variants);
    }
  };

  const buildBackgroundPayload = (): Record<string, unknown> => {
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const validUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    return background.mode === "image" || validUrls.length > 0
      ? validUrls.length >= 2
        ? { mode: "image", images: validUrls.map((i) => ({ image_url: i.url, source: i.source })), fit: background.fit ?? "cover", overlay: overlayPayload }
        : validUrls.length === 1
          ? { mode: "image", image_url: validUrls[0]!.url, image_source: validUrls[0]!.source, fit: background.fit ?? "cover", overlay: overlayPayload }
          : {
              mode: "image",
              asset_id: background.asset_id,
              storage_path: background.storage_path,
              image_url: background.image_url || undefined,
              fit: background.fit ?? "cover",
              overlay: overlayPayload,
              ...(isHook && (background.secondary_asset_id ?? background.secondary_storage_path ?? background.secondary_image_url)
                ? { secondary_asset_id: background.secondary_asset_id, secondary_storage_path: background.secondary_storage_path, secondary_image_url: background.secondary_image_url || undefined }
                : {}),
            }
      : { style: background.style, color: background.color, gradientOn: background.gradientOn, overlay: overlayPayload };
  };

  const handleApplyTemplateToAll = async () => {
    setApplyingTemplate(true);
    const result = await applyToAllSlides(slide.carousel_id, { template_id: templateId }, editorPath);
    setApplyingTemplate(false);
    if (result.ok) router.refresh();
  };

  const handleApplyOverlayToAll = async () => {
    setApplyingOverlay(true);
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const result = await applyOverlayToAllSlides(slide.carousel_id, overlayPayload, editorPath);
    setApplyingOverlay(false);
    if (result.ok) router.refresh();
  };

  const handleApplyBackgroundToAll = async () => {
    setApplyingBackground(true);
    const bgPayload = buildBackgroundPayload();
    const result = await applyToAllSlides(slide.carousel_id, { background: bgPayload }, editorPath);
    setApplyingBackground(false);
    if (result.ok) router.refresh();
  };

  const handleApplyImageDisplayToAll = async () => {
    setApplyingImageDisplay(true);
    const payload = buildImageDisplayPayload();
    const fullPayload = payload ?? {
      position: imageDisplay.position ?? "center",
      fit: imageDisplay.fit ?? "cover",
      frame: imageDisplay.frame ?? "medium",
      frameRadius: imageDisplay.frameRadius ?? 16,
      frameColor: imageDisplay.frameColor ?? "#ffffff",
      frameShape: imageDisplay.frameShape ?? "squircle",
      layout: imageDisplay.layout ?? "auto",
      gap: imageDisplay.gap ?? 12,
      dividerStyle: imageDisplay.dividerStyle ?? "gap",
      dividerColor: imageDisplay.dividerColor ?? "#ffffff",
      dividerWidth: imageDisplay.dividerWidth ?? 4,
    };
    const result = await applyImageDisplayToAllSlides(slide.carousel_id, fullPayload, editorPath);
    setApplyingImageDisplay(false);
    if (result.ok) router.refresh();
  };

  const handlePositionNumberChange = async (checked: boolean) => {
    setShowCounter(checked);
    setApplyingDisplay(true);
    const result = await applyToAllSlides(slide.carousel_id, { meta: { show_counter: checked } }, editorPath);
    setApplyingDisplay(false);
    if (result.ok) router.refresh();
  };

  const selectedPreset = selectedPresetId ? presets.find((p) => p.id === selectedPresetId) : null;

  const applyPresetToForm = useCallback(
    (preset: SlidePreset) => {
      setTemplateId(preset.template_id ?? null);
      const ov = preset.overlay as { gradient?: boolean; darken?: number; color?: string; textColor?: string } | null;
      setBackground((b) => ({ ...b, overlay: ov ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" } }));
      setShowCounter(preset.show_counter);
    },
    []
  );

  const handleApplyPresetToAll = async () => {
    const preset = selectedPresetId ? presets.find((p) => p.id === selectedPresetId) : null;
    if (!preset) return;
    setApplyingPresetToAll(true);
    const ov = preset.overlay as { gradient?: boolean; darken?: number; color?: string; textColor?: string };
    await applyToAllSlides(slide.carousel_id, { template_id: preset.template_id, meta: { show_counter: preset.show_counter } }, editorPath);
    await applyOverlayToAllSlides(slide.carousel_id, ov ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" }, editorPath);
    const imgDisp = preset.image_display as Record<string, unknown> | null | undefined;
    if (imgDisp && typeof imgDisp === "object" && Object.keys(imgDisp).length > 0) {
      await applyImageDisplayToAllSlides(slide.carousel_id, imgDisp, editorPath);
    }
    setApplyingPresetToAll(false);
    router.refresh();
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    setSavingPreset(true);
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const imageDisplayPayload = buildImageDisplayPayload();
    const result = await saveSlidePreset({
      name,
      template_id: templateId,
      overlay: overlayPayload,
      show_counter: showCounter,
      image_display: imageDisplayPayload ?? null,
    });
    setSavingPreset(false);
    if (result.ok) {
      setSavePresetOpen(false);
      setPresetName("");
      router.refresh();
    }
  };

  const handlePickImage = (asset: { id: string; storage_path: string }, url: string) => {
    if (pickerForSecondary) {
      setBackground((b) => ({
        ...b,
        mode: b.mode ?? "image",
        secondary_asset_id: asset.id,
        secondary_storage_path: asset.storage_path,
        secondary_image_url: undefined,
      }));
      setSecondaryBackgroundImageUrlForPreview(url);
      setPickerForSecondary(false);
    } else {
      setBackground((b) => ({
        ...b,
        mode: "image",
        asset_id: asset.id,
        storage_path: asset.storage_path,
        image_url: undefined,
        fit: "cover",
        overlay: b.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" },
      }));
      setBackgroundImageUrlForPreview(url);
    }
    setPickerOpen(false);
  };

  const applyPreset = (preset: OverlayPreset) => {
    setBackground((b) => ({
      ...b,
      overlay: {
        ...b.overlay,
        gradient: true,
        darken: preset.gradientOpacity,
        color: preset.gradientColor,
        textColor: preset.textColor,
      },
    }));
  };

  const currentPresetId =
    OVERLAY_PRESETS.find(
      (p) =>
        p.id !== PRESET_CUSTOM_ID &&
        p.gradientColor === (background.overlay?.color ?? "#000000") &&
        p.gradientOpacity === (background.overlay?.darken ?? 0.5) &&
        p.textColor === (background.overlay?.textColor ?? "#ffffff")
    )?.id ?? PRESET_CUSTOM_ID;

  const validImageUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
  const isImageMode =
    background.mode === "image" ||
    validImageUrls.length > 0 ||
    !!(background.image_url && /^https?:\/\//i.test(background.image_url)) ||
    !!background.asset_id;
  const previewBackgroundImageUrl =
    validImageUrls.length === 1
      ? validImageUrls[0]!.url
      : validImageUrls.length === 0
        ? (backgroundImageUrlForPreview ?? background.image_url ?? null)
        : null;
  const previewBackgroundImageUrls =
    validImageUrls.length >= 2 ? validImageUrls.map((i) => i.url) : undefined;
  const overlayDefaults = { gradientStrength: 0.5, gradientColor: "#000000", textColor: "#ffffff" };
  const previewBackgroundOverride: SlideBackgroundOverride = isImageMode
    ? {
        gradientOn: background.overlay?.gradient ?? true,
        color: background.color ?? brandKit.primary_color ?? "#0a0a0a",
        gradientStrength: background.overlay?.darken ?? overlayDefaults.gradientStrength,
        gradientColor: background.overlay?.color ?? overlayDefaults.gradientColor,
        textColor: background.overlay?.textColor ?? overlayDefaults.textColor,
        gradientDirection: background.overlay?.direction ?? "bottom",
      }
    : {
        style: background.style,
        color: background.color,
        gradientOn: background.gradientOn,
        gradientStrength: background.overlay?.darken ?? overlayDefaults.gradientStrength,
        gradientColor: background.overlay?.color ?? overlayDefaults.gradientColor,
        textColor: background.overlay?.textColor ?? overlayDefaults.textColor,
        gradientDirection: background.overlay?.direction ?? "bottom",
      };

  const overlaySection = (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PaletteIcon className="size-4 text-muted-foreground" />
          Overlay
        </Label>
        {totalSlides > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleApplyOverlayToAll}
            disabled={applyingOverlay}
            title="Apply overlay to all slides"
          >
            {applyingOverlay ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
            Apply to all
          </Button>
        )}
      </div>
        <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Position</span>
          <Select
            value={background.overlay?.direction ?? "bottom"}
            onValueChange={(v: "top" | "bottom" | "left" | "right") =>
              setBackground((b) => ({
                ...b,
                overlay: { ...b.overlay, gradient: true, direction: v, darken: b.overlay?.darken ?? 0.5, color: b.overlay?.color ?? "#000000", textColor: b.overlay?.textColor ?? "#ffffff" },
              }))
            }
          >
            <SelectTrigger className="h-10 w-[120px] rounded-lg border-input/80 bg-background">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Preset</span>
          <Select
            value={currentPresetId}
            onValueChange={(id) => {
              const preset = OVERLAY_PRESETS.find((p) => p.id === id);
              if (preset) applyPreset(preset);
            }}
          >
            <SelectTrigger className="h-10 w-[160px] rounded-lg border-input/80 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OVERLAY_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Color</span>
            <input
              type="color"
              value={background.overlay?.color ?? "#000000"}
              onChange={(e) =>
                setBackground((b) => ({
                  ...b,
                  overlay: { ...b.overlay, gradient: true, color: e.target.value, textColor: b.overlay?.textColor ?? "#ffffff", darken: b.overlay?.darken ?? 0.5 },
                }))
              }
              className="h-10 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Opacity</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((background.overlay?.darken ?? 0.5) * 100)}
                onChange={(e) =>
                  setBackground((b) => ({
                    ...b,
                    overlay: { ...b.overlay, gradient: true, darken: Number(e.target.value) / 100, color: b.overlay?.color ?? "#000000", textColor: b.overlay?.textColor ?? "#ffffff" },
                  }))
                }
                className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">
                {Math.round((background.overlay?.darken ?? 0.5) * 100)}%
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Text</span>
            <input
              type="color"
              value={background.overlay?.textColor ?? "#ffffff"}
              onChange={(e) =>
                setBackground((b) => ({
                  ...b,
                  overlay: { ...b.overlay, gradient: true, textColor: e.target.value, color: b.overlay?.color ?? "#000000", darken: b.overlay?.darken ?? 0.5 },
                }))
              }
              className="h-10 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={backHref}>
            <ArrowLeftIcon className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Edit slide {slide.slide_index}</h1>
      </div>

      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Save as preset</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Save current template, gradient overlay, and position number so you can reuse them on other slides or carousels.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset name</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Dark overlay"
              className="rounded-lg"
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setSavePresetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={savingPreset || !presetName.trim()}>
              {savingPreset ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={infoSection !== null} onOpenChange={(open) => !open && setInfoSection(null)}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{infoSection ? SECTION_INFO[infoSection]?.title ?? "Help" : "Help"}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {infoSection ? SECTION_INFO[infoSection]?.body ?? "" : ""}
          </p>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form column: on mobile appears below preview (order-2); on lg, left (order-1) */}
        <div className="flex flex-col gap-4 order-2 lg:order-1">
          <section className="rounded-xl border border-border/60 bg-card p-4 shadow-sm" aria-label="Content">
            <div className="flex items-center gap-2 mb-3">
              <Type className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Content</span>
              <button type="button" onClick={() => setInfoSection("content")} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Help">
                <InfoIcon className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="headline" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Type className="size-3.5 text-muted-foreground" /> Headline
              </Label>
            <Textarea
              ref={headlineRef}
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Headline"
              className="min-h-[88px] resize-none rounded-lg border-input/80 text-base field-sizing-content"
              rows={2}
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {Object.keys(HIGHLIGHT_COLORS).slice(0, 6).map((preset) => (
                <button key={preset} type="button" onClick={() => insertHighlight(preset, "headline")} className="rounded px-1.5 py-0.5 text-xs font-medium capitalize hover:bg-muted" style={{ color: HIGHLIGHT_COLORS[preset] as string }} title={`{{${preset}}}`}>
                  {preset}
                </button>
              ))}
              <button type="button" onClick={() => insertCloseHighlight("headline")} className="text-muted-foreground rounded px-1.5 py-0.5 text-xs hover:bg-muted" title="{{/}}">{"{{/}}"}</button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="range"
                min={24}
                max={160}
                value={headlineFontSize ?? defaultHeadlineSize}
                onChange={(e) => setHeadlineFontSize(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{headlineFontSize ?? defaultHeadlineSize}px</span>
              <Button type="button" variant={headlineHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setHeadlineHighlightStyle((s) => (s === "text" ? "background" : "text"))} title={headlineHighlightStyle === "text" ? "Bg highlight" : "Text color"}>
                {headlineHighlightStyle === "text" ? "Text" : "Bg"}
              </Button>
            </div>
            </div>
            <div className="border-t border-border/60 pt-4 mt-4 space-y-2">
              <Label htmlFor="body" className="text-sm font-medium text-foreground">Body</Label>
            <Textarea
              ref={bodyRef}
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body"
              className="min-h-[72px] resize-none rounded-lg border-input/80 text-base field-sizing-content"
              rows={2}
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {Object.keys(HIGHLIGHT_COLORS).slice(0, 6).map((preset) => (
                <button key={preset} type="button" onClick={() => insertHighlight(preset, "body")} className="rounded px-1.5 py-0.5 text-xs font-medium capitalize hover:bg-muted" style={{ color: HIGHLIGHT_COLORS[preset] as string }} title={`{{${preset}}}`}>
                  {preset}
                </button>
              ))}
              <button type="button" onClick={() => insertCloseHighlight("body")} className="text-muted-foreground rounded px-1.5 py-0.5 text-xs hover:bg-muted" title="{{/}}">{"{{/}}"}</button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="range"
                min={18}
                max={120}
                value={bodyFontSize ?? defaultBodySize}
                onChange={(e) => setBodyFontSize(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{bodyFontSize ?? defaultBodySize}px</span>
              <Button type="button" variant={bodyHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setBodyHighlightStyle((s) => (s === "text" ? "background" : "text"))} title={bodyHighlightStyle === "text" ? "Bg highlight" : "Text color"}>
                {bodyHighlightStyle === "text" ? "Text" : "Bg"}
              </Button>
            </div>
            </div>
          </section>
          <section className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-3" aria-label="Layout">
            <div className="flex items-center gap-2">
              <LayoutTemplateIcon className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium text-foreground">Layout</span>
              <button type="button" onClick={() => setInfoSection("layout")} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Help">
                <InfoIcon className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              <Select value={templateId ?? ""} onValueChange={(v) => setTemplateId(v || null)}>
                <SelectTrigger className="h-10 w-full rounded-lg border-input/80 bg-background text-sm">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 py-2 text-sm hover:bg-muted/50 rounded-lg" title="Show slide number (e.g. 3/10). Applies to all.">
                <input type="checkbox" checked={showCounter} onChange={(e) => handlePositionNumberChange(e.target.checked)} disabled={applyingDisplay} className="rounded border-input accent-primary" />
                {applyingDisplay ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : <HashIcon className="size-4 text-muted-foreground" />}
                <span className="text-sm">Slide #</span>
              </label>
              {totalSlides > 1 && (
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={handleApplyTemplateToAll} disabled={applyingTemplate} title="Apply template to all">
                  {applyingTemplate ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
                  Apply to all
                </Button>
              )}
            </div>
          </section>
          <section className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-3" aria-label="Background">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium text-foreground">Background</Label>
              <div className="flex items-center gap-1">
                {!isImageMode && totalSlides > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleApplyBackgroundToAll}
                    disabled={applyingBackground}
                    title="Apply background (color, style, overlay) to all slides"
                  >
                    {applyingBackground ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
                    Apply to all
                  </Button>
                )}
                {isImageMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Clear image"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setBackground((b) => ({ ...b, style: "solid", color: brandKit.primary_color ?? "#0a0a0a", gradientOn: true, mode: undefined, asset_id: undefined, storage_path: undefined, image_url: undefined, image_display: undefined }));
                      setBackgroundImageUrlForPreview(null);
                      setImageUrls([{ url: "", source: undefined }]);
                      setImageDisplay({});
                    }}
                  >
                    <ImageOffIcon className="size-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            {isImageMode && (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium">Image URLs</Label>
                  {imageUrls.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Input
                        type="url"
                        value={item.url}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setImageUrls((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i]!, url: v };
                            return next;
                          });
                        }}
                        placeholder="https://..."
                        className="h-10 flex-1 rounded-lg border-input/80 bg-background text-sm"
                      />
                      {item.source && (
                        <span
                          className={`shrink-0 self-center inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            item.source === "unsplash"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                              : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {item.source === "unsplash" ? "Fallback" : "Brave"}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setImageUrls((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ url: "", source: undefined }]));
                        }}
                        title="Remove"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {imageUrls.length < 4 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => setImageUrls((prev) => [...prev, { url: "", source: undefined }])}
                    >
                      Add image URL
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg h-9" title="Pick from library" onClick={() => { setPickerForSecondary(false); setPickerOpen(true); }}>
                    <ImageIcon className="size-4" /> Pick
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg h-9" asChild title="Upload image">
                    <a href="/assets" target="_blank" rel="noopener noreferrer">
                      <UploadIcon className="size-4" /> Upload
                    </a>
                  </Button>
                </div>
                <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
                      <LayoutTemplateIcon className="size-3.5" /> Image display
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={handleApplyImageDisplayToAll}
                      disabled={applyingImageDisplay || totalSlides < 2}
                      title={totalSlides < 2 ? "Need 2+ slides to apply" : "Apply image display to all slides"}
                    >
                      {applyingImageDisplay ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Position</span>
                      <Select
                        value={effectiveImageDisplay.position ?? "center"}
                        onValueChange={(v) => setImageDisplay((d) => ({ ...d, position: v as ImageDisplayState["position"] }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="top-left">Top left</SelectItem>
                          <SelectItem value="top-right">Top right</SelectItem>
                          <SelectItem value="bottom-left">Bottom left</SelectItem>
                          <SelectItem value="bottom-right">Bottom right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Fit</span>
                      <Select
                        value={imageDisplay.fit ?? "cover"}
                        onValueChange={(v: "cover" | "contain") => setImageDisplay((d) => ({ ...d, fit: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cover">Cover (fill)</SelectItem>
                          <SelectItem value="contain">Contain (fit)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Frame</span>
                      <Select
                        value={effectiveImageDisplay.frame ?? "medium"}
                        onValueChange={(v: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy") => setImageDisplay((d) => ({ ...d, frame: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="thin">Thin</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="thick">Thick</SelectItem>
                          <SelectItem value="chunky">Chunky</SelectItem>
                          <SelectItem value="heavy">Heavy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Shape</span>
                      <Select
                        value={imageDisplay.frameShape ?? "squircle"}
                        onValueChange={(v: "squircle" | "circle" | "diamond" | "hexagon" | "pill") => setImageDisplay((d) => ({ ...d, frameShape: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="squircle">Squircle</SelectItem>
                          <SelectItem value="circle">Circle</SelectItem>
                          <SelectItem value="diamond">Diamond</SelectItem>
                          <SelectItem value="hexagon">Hexagon</SelectItem>
                          <SelectItem value="pill">Pill</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Corner radius</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={48}
                          value={effectiveImageDisplay.frameRadius ?? 16}
                          onChange={(e) => setImageDisplay((d) => ({ ...d, frameRadius: Number(e.target.value) }))}
                          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                        />
                        <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{imageDisplay.frameRadius ?? 16}px</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <span className="text-muted-foreground text-xs">Frame color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveImageDisplay.frameColor ?? "#ffffff"}
                          onChange={(e) => setImageDisplay((d) => ({ ...d, frameColor: e.target.value }))}
                          className="h-9 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
                        />
                        <Input
                          value={effectiveImageDisplay.frameColor ?? "#ffffff"}
                          onChange={(e) => setImageDisplay((d) => ({ ...d, frameColor: e.target.value }))}
                          placeholder="#ffffff"
                          className="h-9 w-24 rounded-lg border-input/80 bg-background text-sm font-mono"
                        />
                      </div>
                    </div>
                    {validImageUrls.length >= 2 && (
                      <>
                        <div className="space-y-1.5">
                          <span className="text-muted-foreground text-xs">Layout</span>
                          <Select
                            value={effectiveImageDisplay.layout ?? "auto"}
                            onValueChange={(v: "auto" | "side-by-side" | "stacked" | "grid" | "overlay-circles") => setImageDisplay((d) => ({ ...d, layout: v }))}
                          >
                            <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="side-by-side">Side by side</SelectItem>
                              <SelectItem value="stacked">Stacked</SelectItem>
                              <SelectItem value="grid">Grid</SelectItem>
                              {validImageUrls.length >= 2 && validImageUrls.length <= 3 && (
                                <SelectItem value="overlay-circles">Overlay circles (2–3 only)</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {(effectiveImageDisplay.layout ?? "auto") !== "overlay-circles" && (
                          <>
                            <div className="space-y-1.5">
                              <span className="text-muted-foreground text-xs">Gap</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={1}
                                  max={48}
                                  value={imageDisplay.gap ?? 12}
                                  onChange={(e) => setImageDisplay((d) => ({ ...d, gap: Number(e.target.value) }))}
                                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                />
                                <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.gap ?? 12}px</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <span className="text-muted-foreground text-xs">Divider</span>
                              <div className="flex flex-wrap items-end gap-3">
                                <Select
                                  value={imageDisplay.dividerStyle ?? "gap"}
                                  onValueChange={(v: "gap" | "line" | "zigzag" | "diagonal" | "wave" | "dashed" | "scalloped") => setImageDisplay((d) => ({ ...d, dividerStyle: v }))}
                                >
                                  <SelectTrigger className="h-9 w-[130px] rounded-lg border-input/80 bg-background text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="gap">Gap</SelectItem>
                                    <SelectItem value="line">Line</SelectItem>
                                    <SelectItem value="zigzag">Zigzag</SelectItem>
                                    <SelectItem value="diagonal">Diagonal (2 only)</SelectItem>
                                    <SelectItem value="wave">Wave</SelectItem>
                                    <SelectItem value="dashed">Dashed</SelectItem>
                                    <SelectItem value="scalloped">Scalloped</SelectItem>
                                  </SelectContent>
                                </Select>
                                {(effectiveImageDisplay.dividerStyle !== "gap" && effectiveImageDisplay.dividerStyle !== undefined) && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={imageDisplay.dividerColor ?? "#ffffff"}
                                        onChange={(e) => setImageDisplay((d) => ({ ...d, dividerColor: e.target.value }))}
                                        className="h-9 w-10 cursor-pointer rounded-lg border border-input/80 bg-background"
                                      />
                                      <span className="text-muted-foreground text-xs">Color</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="range"
                                        min={0}
                                        max={60}
                                        value={effectiveImageDisplay.dividerWidth ?? 4}
                                        onChange={(e) => setImageDisplay((d) => ({ ...d, dividerWidth: Number(e.target.value) }))}
                                        className="h-2 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                      />
                                      <span className="text-muted-foreground min-w-6 text-xs tabular-nums">{imageDisplay.dividerWidth ?? 4}px</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        {(effectiveImageDisplay.layout ?? "auto") === "overlay-circles" && (
                          <div className="space-y-3 sm:col-span-2">
                            <span className="text-muted-foreground text-xs font-medium">Circle style</span>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { id: "quad-1", label: "Quadrant 1 (top-left)", x: 89, y: 89, size: 280 },
                                { id: "quad-2", label: "Quadrant 2 (top-right)", x: 11, y: 89, size: 280 },
                                { id: "quad-3", label: "Quadrant 3 (bottom-left)", x: 89, y: 11, size: 280 },
                                { id: "quad-4", label: "Quadrant 4 (bottom-right)", x: 11, y: 11, size: 280 },
                              ].map((preset) => (
                                <Button
                                  key={preset.id}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => setImageDisplay((d) => ({ ...d, overlayCircleSize: preset.size, overlayCircleX: preset.x, overlayCircleY: preset.y, overlayCircleBorderWidth: 12, overlayCircleBorderColor: "#ffffff" }))}
                                >
                                  {preset.label}
                                </Button>
                              ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Position X (0=right, 100=left)</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={imageDisplay.overlayCircleX ?? 0}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleX: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleX ?? 0}</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Position Y (0=bottom, 100=top)</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={imageDisplay.overlayCircleY ?? 0}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleY: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleY ?? 0}</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Size</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={120}
                                    max={400}
                                    value={imageDisplay.overlayCircleSize ?? 280}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleSize: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-10 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleSize ?? 280}px</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Border width</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={4}
                                    max={24}
                                    value={imageDisplay.overlayCircleBorderWidth ?? 12}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleBorderWidth: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleBorderWidth ?? 12}px</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Border color</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={imageDisplay.overlayCircleBorderColor ?? "#ffffff"}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleBorderColor: e.target.value }))}
                                    className="h-9 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
            {!isImageMode && (
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={background.style ?? "solid"}
                  onValueChange={(v: "solid" | "gradient") => setBackground((b) => ({ ...b, style: v }))}
                >
                  <SelectTrigger className="h-10 w-[130px] rounded-lg border-input/80 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={background.color ?? "#0a0a0a"}
                    onChange={(e) => setBackground((b) => ({ ...b, color: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={background.gradientOn ?? true}
                      onChange={(e) => setBackground((b) => ({ ...b, gradientOn: e.target.checked }))}
                      className="rounded border-input accent-primary"
                    />
                    Overlay
                  </label>
                </div>
              </div>
            )}
            {!isImageMode && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg h-9" title="Pick image" onClick={() => { setPickerForSecondary(false); setPickerOpen(true); }}>
                    <ImageIcon className="size-4" />
                    <span className="sr-only">Pick</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg h-9" asChild title="Upload">
                    <a href="/assets" target="_blank" rel="noopener noreferrer">
                      <UploadIcon className="size-4" />
                      <span className="sr-only">Upload</span>
                    </a>
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="image-url-solid" className="text-muted-foreground text-xs font-medium">URL</Label>
                  <Input
                    id="image-url-solid"
                    type="url"
                    value={!isImageMode && imageUrls[0] ? imageUrls[0].url : ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v && /^https?:\/\//i.test(v)) {
                        setImageUrls([{ url: v, source: undefined }]);
                        setBackground((b) => ({ ...b, mode: "image" }));
                      }
                    }}
                    placeholder="https://..."
                    className="h-10 rounded-lg border-input/80 bg-background text-sm"
                  />
                </div>
              </>
            )}
            {overlaySection}
          </section>
          <section className="rounded-lg border border-border/40 bg-muted/20 p-3" aria-label="Presets">
            <div className="flex items-center gap-2 mb-2">
              <Bookmark className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs font-medium">Presets</span>
              <button type="button" onClick={() => setInfoSection("presets")} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Help">
                <InfoIcon className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedPresetId ?? ""}
                onValueChange={(id) => {
                  setSelectedPresetId(id || null);
                  const preset = presets.find((p) => p.id === id);
                  if (preset) applyPresetToForm(preset);
                }}
              >
                <SelectTrigger className="h-9 w-[160px] rounded-lg border-input/80 bg-background text-sm">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPreset && totalSlides > 1 && (
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-xs" onClick={handleApplyPresetToAll} disabled={applyingPresetToAll} title="Apply preset to all slides">
                  {applyingPresetToAll ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
                  Apply to all
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg text-muted-foreground hover:text-foreground text-xs" onClick={() => setSavePresetOpen(true)} title="Save as preset">
                <Bookmark className="size-4" />
                Save
              </Button>
            </div>
          </section>
          <AssetPickerModal open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePickImage} />
        </div>

        {/* Preview: on mobile first (order-1), on lg right column + sticky so it stays in view when scrolling */}
        <div className="flex flex-col items-start order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start lg:pt-1">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <LayoutTemplateIcon className="size-4" aria-hidden /> Preview
            </Label>
            <button type="button" onClick={() => setInfoSection("preview")} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Help">
              <InfoIcon className="size-4" />
            </button>
          </div>
          <div
            className="rounded-lg border border-border bg-muted/30 shrink-0"
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, overflow: "hidden" }}
          >
            {templateConfig ? (
              <div style={{ width: 1080, height: 1080, zoom: PREVIEW_SCALE }}>
                <SlidePreview
                  slide={{
                    headline,
                    body: body.trim() || null,
                    slide_index: slide.slide_index,
                    slide_type: slide.slide_type,
                  }}
                  templateConfig={templateConfig}
                  brandKit={brandKit}
                  totalSlides={totalSlides}
                  backgroundImageUrl={previewBackgroundImageUrl}
                  backgroundImageUrls={previewBackgroundImageUrls}
                  secondaryBackgroundImageUrl={secondaryBackgroundImageUrlForPreview ?? initialSecondaryBackgroundImageUrl}
                  backgroundOverride={previewBackgroundOverride}
                  showCounterOverride={showCounter}
                  fontOverrides={
                    headlineFontSize != null || bodyFontSize != null
                      ? { headline_font_size: headlineFontSize, body_font_size: bodyFontSize }
                      : undefined
                  }
                  headlineHighlightStyle={headlineHighlightStyle}
                  bodyHighlightStyle={bodyHighlightStyle}
                  borderedFrame={!!(previewBackgroundImageUrl || previewBackgroundImageUrls?.length)}
                  imageDisplay={isImageMode ? effectiveImageDisplay : undefined}
                />
              </div>
            ) : (
              <div
                className="flex h-full items-center justify-center text-muted-foreground text-sm"
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
              >
                No template
              </div>
            )}
          </div>
        </div>
      </div>

      {hookVariants.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <Label className="text-xs flex items-center gap-1.5">
            <SparklesIcon className="size-3.5" /> Pick variant
          </Label>
          <ul className="mt-2 space-y-1">
            {hookVariants.map((v, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setHeadline(v);
                    setHookVariants([]);
                  }}
                >
                  {v}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            title="Shorten to fit"
            onClick={handleShortenToFit}
            disabled={shortening || !templateId}
          >
            {shortening ? <Loader2Icon className="size-4 animate-spin" /> : <ScissorsIcon className="size-4" />}
          </Button>
          {isHook && (
            <Button variant="outline" size="sm" className="h-9 w-9 p-0" title="Rewrite hook" onClick={handleRewriteHook} disabled={rewriting}>
              {rewriting ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
            </Button>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving} title="Save slide">
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
          Save
        </Button>
      </div>
    </div>
    </>
  );
}
