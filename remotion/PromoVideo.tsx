import { createContext, useContext } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Series,
  Easing,
  Img,
  staticFile,
} from "remotion";

const FPS = 30;

const primary = "oklch(0.55 0.17 163)";
const primaryFg = "oklch(0.985 0 0)";
const bg = "oklch(1 0 0)";
const fg = "oklch(0.145 0 0)";
const muted = "oklch(0.97 0 0)";
const mutedFg = "oklch(0.45 0 0)";
const border = "oklch(0.88 0 0)";
const radius = 16;
const fontStack =
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

const smoothSpring = { damping: 200, stiffness: 120 };
const punchSpring = { damping: 24, stiffness: 200 };

const TRANSITION_FRAMES = 22;

const INTRO_FRAMES = 90;   // Company intro: name, what we do, tagline
const HOOK_FRAMES = 100;
const TOPIC_IN_FRAMES = 115;
const STEPS_FRAMES = 160;
const PROOF_FRAMES = 75;
const CTA_FRAMES = 95;

const overlap = TRANSITION_FRAMES - 1;
const TOTAL_FRAMES =
  INTRO_FRAMES +
  HOOK_FRAMES +
  TOPIC_IN_FRAMES +
  STEPS_FRAMES +
  PROOF_FRAMES +
  CTA_FRAMES -
  5 * overlap;

// Short variant: Intro → Topic in → Proof → CTA (~7s), for Reels/TikTok
const SHORT_INTRO_FRAMES = 55;
const SHORT_TOPIC_IN_FRAMES = 75;
const SHORT_PROOF_FRAMES = 55;
const SHORT_CTA_FRAMES = 65;
const TOTAL_SHORT_FRAMES =
  SHORT_INTRO_FRAMES +
  SHORT_TOPIC_IN_FRAMES +
  SHORT_PROOF_FRAMES +
  SHORT_CTA_FRAMES -
  3 * overlap;

export const PROMO_DURATION_IN_FRAMES = TOTAL_FRAMES;
export const PROMO_DURATION_SHORT_FRAMES = TOTAL_SHORT_FRAMES;
export const PROMO_FPS = FPS;

type Variant = "full" | "short";
const VariantContext = createContext<Variant>("full");

const BLINK_CYCLE_FRAMES = 18;

function useIsVertical() {
  const { width, height } = useVideoConfig();
  return height > width;
}

function BlinkingCursor({
  frame,
  color = fg,
  heightRatio = 1.2,
  widthPx = 4,
}: {
  frame: number;
  color?: string;
  heightRatio?: number;
  widthPx?: number;
}) {
  const cycle = frame % (BLINK_CYCLE_FRAMES * 2);
  const visible = cycle < BLINK_CYCLE_FRAMES ? 1 : 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: widthPx,
        height: `${heightRatio}em`,
        marginLeft: 4,
        verticalAlign: "text-bottom",
        background: color,
        opacity: visible,
        borderRadius: 1,
      }}
    />
  );
}

function useSceneWithTransition(
  localFrame: number,
  durationInFrames: number,
  opts?: { delay?: number; isLast?: boolean }
) {
  const { delay = 0, isLast = false } = opts ?? {};
  const t = localFrame - delay;
  const enter = spring({
    frame: t,
    fps: FPS,
    config: smoothSpring,
    durationInFrames: 28,
  });
  const opacityIn = interpolate(t, [0, 14], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitStart = durationInFrames - TRANSITION_FRAMES;
  const exitProgress = interpolate(t, [exitStart, durationInFrames], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacityOut = 1 - exitProgress;
  const scaleExit = interpolate(exitProgress, [0, 1], [1, 0.88]);
  const translateYExit = interpolate(exitProgress, [0, 1], [0, -70]);
  const scaleEnter = 0.88 + enter * 0.12;
  const translateYEnter = interpolate(enter, [0, 1], [70, 0]);
  const opacity = isLast ? opacityIn : Math.min(opacityIn, opacityOut);
  const scale = isLast ? scaleEnter : scaleEnter * scaleExit;
  const translateY = isLast ? translateYEnter : translateYEnter + translateYExit;
  return { opacity, scale, translateY, progress: enter };
}

// —— 0. INTRO: Company introduction ——
function IntroScene() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const variant = useContext(VariantContext);
  const isVertical = useIsVertical();
  const duration = variant === "short" ? SHORT_INTRO_FRAMES : INTRO_FRAMES;
  const { opacity, scale, translateY } = useSceneWithTransition(
    frame,
    duration,
    { isLast: false }
  );

  const nameOpacity = interpolate(frame, [8, 28], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const nameY = interpolate(frame, [8, 28], [20, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const descOpacity = interpolate(frame, [28, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineOpacity = interpolate(frame, [48, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const nameSize = isVertical
    ? Math.max(48, Math.min(width / 7, height / 18))
    : Math.max(56, width / 12);
  const descSize = isVertical
    ? Math.max(16, Math.min(width / 38, height / 65))
    : Math.max(18, width / 48);
  const taglineSize = isVertical
    ? Math.max(18, Math.min(width / 32, height / 52))
    : Math.max(20, width / 42);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${bg} 0%, oklch(0.99 0.008 163) 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${primary}08 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          textAlign: "center",
          padding: isVertical ? "32px 28px" : "40px 48px",
          maxWidth: width * 0.9,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{
            width: isVertical ? Math.min(88, width * 0.2) : Math.min(112, width * 0.14),
            height: "auto",
            marginBottom: isVertical ? 16 : 20,
            opacity: logoOpacity,
            objectFit: "contain",
          }}
        />
        <h1
          style={{
            fontFamily: fontStack,
            fontSize: nameSize,
            fontWeight: 800,
            color: primary,
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            opacity: nameOpacity,
            transform: `translateY(${nameY}px)`,
          }}
        >
          Karouselmaker
        </h1>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: descSize,
            fontWeight: 500,
            color: mutedFg,
            marginTop: isVertical ? 16 : 20,
            lineHeight: 1.4,
            letterSpacing: "-0.01em",
            opacity: descOpacity,
          }}
        >
          AI-powered carousel generator for content creators
        </p>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: taglineSize,
            fontWeight: 700,
            color: fg,
            marginTop: isVertical ? 14 : 18,
            letterSpacing: "-0.02em",
            opacity: taglineOpacity,
          }}
        >
          Grow faster with carousels
        </p>
      </div>
    </AbsoluteFill>
  );
}

// —— 1. HOOK: Full-bleed impact ——
function HookScene() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = useIsVertical();
  const { opacity, scale, translateY } = useSceneWithTransition(
    frame,
    HOOK_FRAMES,
    { isLast: false }
  );

  const statOpacity = interpolate(frame, [5, 22], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const questionOpacity = interpolate(frame, [38, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headlineSize = isVertical
    ? Math.max(56, Math.min(width / 8, height / 14))
    : Math.max(72, width / 9);
  const subSize = isVertical
    ? Math.max(20, Math.min(width / 32, height / 48))
    : Math.max(22, width / 38);
  const paddingV = isVertical ? 32 : 40;
  const paddingH = isVertical ? 36 : 48;
  const marginTopSub = isVertical ? 20 : 28;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, oklch(0.48 0.16 163) 45%, oklch(0.42 0.14 163) 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 50% at 50% 120%, oklch(0.55 0.17 163 / 0.25) 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          textAlign: "center",
          padding: `${paddingV}px ${paddingH}px`,
          maxWidth: width * 0.92,
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontFamily: fontStack,
            fontSize: headlineSize,
            fontWeight: 800,
            color: primaryFg,
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            opacity: statOpacity,
            textShadow: `0 2px 20px oklch(0 0 0 / 0.2)`,
          }}
        >
          Carousels get <span style={{ color: "oklch(0.95 0.05 85)" }}>3–5×</span> more engagement.
        </p>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: subSize,
            fontWeight: 600,
            color: "oklch(1 0 0 / 0.85)",
            marginTop: marginTopSub,
            letterSpacing: "-0.02em",
            opacity: questionOpacity,
          }}
        >
          Most creators don't have time to design them.
        </p>
      </div>
    </AbsoluteFill>
  );
}

// —— 2. TOPIC IN: Big type + huge slide cards + cursor ——
function TopicInScene() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const variant = useContext(VariantContext);
  const isVertical = useIsVertical();
  const duration = variant === "short" ? SHORT_TOPIC_IN_FRAMES : TOPIC_IN_FRAMES;
  const { opacity, scale, translateY } = useSceneWithTransition(
    frame,
    duration,
    { delay: 0, isLast: false }
  );

  const line1Opacity = interpolate(frame, [8, 26], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Opacity = interpolate(frame, [22, 42], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSize = isVertical
    ? Math.max(42, Math.min(width / 10, height / 22))
    : Math.max(48, width / 14);
  const subCopySize = isVertical ? Math.max(16, height / 55) : Math.max(18, width / 52);
  const cardW = isVertical
    ? Math.min(width * 0.26, height * 0.14)
    : Math.min(width * 0.28, 320);
  const cardH = cardW * 1.15;
  const gap = isVertical ? 14 : 20;
  const paddingTop = isVertical ? height * 0.04 : height * 0.06;
  const cardsMarginTop = isVertical ? height * 0.03 : height * 0.04;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, oklch(0.97 0.02 163) 0%, ${bg} 50%)`,
        justifyContent: "flex-start",
        alignItems: "center",
        opacity,
        paddingTop,
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          textAlign: "center",
          width: "100%",
          padding: isVertical ? "0 24px" : "0 32px",
        }}
      >
        <p
          style={{
            fontFamily: fontStack,
            fontSize: titleSize,
            fontWeight: 800,
            color: fg,
            margin: 0,
            letterSpacing: "-0.04em",
            opacity: line1Opacity,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Topic in.
          <BlinkingCursor frame={frame} color={fg} heightRatio={1.1} widthPx={isVertical ? 3 : 4} />
        </p>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: titleSize,
            fontWeight: 800,
            color: primary,
            margin: 0,
            marginTop: 4,
            letterSpacing: "-0.04em",
            opacity: line2Opacity,
          }}
        >
          Carousel out.
        </p>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: subCopySize,
            fontWeight: 600,
            color: mutedFg,
            marginTop: 10,
            opacity: line2Opacity,
          }}
        >
          No design skills. Just your ideas.
        </p>

        {/* Mock product: input bar + Generate */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: isVertical ? 18 : 24,
            padding: "0 20px",
            opacity: line2Opacity,
          }}
        >
          <div
            style={{
              flex: 1,
              maxWidth: 320,
              height: isVertical ? 44 : 50,
              borderRadius: radius,
              border: `2px solid ${border}`,
              background: bg,
              display: "flex",
              alignItems: "center",
              paddingLeft: 16,
            }}
          >
            <span
              style={{
                fontFamily: fontStack,
                fontSize: isVertical ? 14 : 15,
                color: mutedFg,
                fontWeight: 500,
              }}
            >
              Paste topic or URL...
            </span>
          </div>
          <div
            style={{
              padding: "0 20px",
              height: isVertical ? 44 : 50,
              borderRadius: radius,
              background: primary,
              color: primaryFg,
              fontFamily: fontStack,
              fontSize: 15,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Generate
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap,
            marginTop: cardsMarginTop,
            padding: "0 16px",
          }}
        >
          {[0, 1, 2].map((i) => {
            const cardStart = 42 + i * 12;
            const cardFrame = frame - cardStart;
            const cardSpring = spring({
              frame: cardFrame,
              fps: FPS,
              config: punchSpring,
              durationInFrames: 26,
            });
            const cardOpacity = interpolate(cardFrame, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(cardSpring, [0, 1], [80, 0]);
            const rot = interpolate(cardSpring, [0, 1], [i === 0 ? -6 : i === 1 ? 0 : 6, 0]);
            const isCenter = i === 1;
            return (
              <div
                key={i}
                style={{
                  width: cardW,
                  height: cardH,
                  borderRadius: radius + 4,
                  background: isCenter ? primary : muted,
                  border: `3px solid ${isCenter ? primary : border}`,
                  opacity: cardOpacity,
                  transform: `translateX(${x}px) rotate(${rot}deg)`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isCenter ? "flex-start" : "center",
                  justifyContent: "center",
                  padding: isCenter ? 16 : 24,
                  boxShadow: isCenter
                    ? `0 20px 50px oklch(0.55 0.17 163 / 0.35)`
                    : `0 12px 32px oklch(0 0 0 / 0.12)`,
                }}
              >
                {isCenter ? (
                  <>
                    <div
                      style={{
                        fontFamily: fontStack,
                        fontSize: Math.max(10, cardW * 0.12),
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.95)",
                        marginBottom: 10,
                        lineHeight: 1.2,
                      }}
                    >
                      5 habits of top founders
                    </div>
                    <div
                      style={{
                        fontFamily: fontStack,
                        fontSize: Math.max(8, cardW * 0.085),
                        color: "rgba(255,255,255,0.8)",
                        lineHeight: 1.4,
                      }}
                    >
                      • Wake early, same time
                    </div>
                    <div
                      style={{
                        fontFamily: fontStack,
                        fontSize: Math.max(8, cardW * 0.085),
                        color: "rgba(255,255,255,0.75)",
                        lineHeight: 1.4,
                        marginTop: 4,
                      }}
                    >
                      • Deep work blocks
                    </div>
                    <div
                      style={{
                        fontFamily: fontStack,
                        fontSize: Math.max(8, cardW * 0.085),
                        color: "rgba(255,255,255,0.6)",
                        lineHeight: 1.4,
                        marginTop: 4,
                      }}
                    >
                      • Ship something daily
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: "75%",
                        height: 10,
                        borderRadius: 5,
                        background: "oklch(0 0 0 / 0.1)",
                      }}
                    />
                    <div
                      style={{
                        width: "55%",
                        height: 6,
                        borderRadius: 3,
                        background: "oklch(0 0 0 / 0.07)",
                        marginTop: 12,
                      }}
                    />
                    <div
                      style={{
                        width: "60%",
                        height: 6,
                        borderRadius: 3,
                        background: "oklch(0 0 0 / 0.05)",
                        marginTop: 8,
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// —— 3. STEPS: 2×2 grid (1 col on vertical) ——
const STEPS = [
  { title: "Create project", sub: "Brand, niche, tone" },
  { title: "Enter topic", sub: "Paste topic or URL" },
  { title: "Slides drafted", sub: "AI writes hook, points, CTA" },
  { title: "Edit & export", sub: "Tweak, reorder, export PNGs" },
];

function StepsScene() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isVertical = useIsVertical();
  const { opacity, scale, translateY } = useSceneWithTransition(
    frame,
    STEPS_FRAMES,
    { delay: 0, isLast: false }
  );

  const stepDuration = Math.floor(STEPS_FRAMES / 4);
  const stagger = 8;

  const titleSize = isVertical
    ? Math.max(20, Math.min(width / 32, height / 42))
    : Math.max(22, width / 38);
  const subSize = isVertical
    ? Math.max(14, Math.min(width / 45, height / 55))
    : Math.max(15, width / 58);
  const stepGap = isVertical ? 14 : 20;
  const stepPadding = isVertical ? "18px 20px" : "24px 22px";
  const gradientHeight = isVertical ? "35%" : "42%";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${bg} 0%, oklch(0.98 0.01 163) 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: gradientHeight,
          background: `linear-gradient(180deg, ${primary}18 0%, transparent 100%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          padding: isVertical ? "20px 24px" : "24px 28px",
          width: "100%",
          maxWidth: width * 0.96,
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            fontFamily: fontStack,
            fontSize: isVertical ? Math.max(12, height / 65) : Math.max(14, width / 55),
            fontWeight: 700,
            color: mutedFg,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: isVertical ? 16 : 20,
            textAlign: "center",
          }}
        >
          How it works
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isVertical ? "1fr" : "1fr 1fr",
            gap: stepGap,
          }}
        >
        {STEPS.map((step, i) => {
          const start = i * stepDuration + stagger;
          const t = frame - start;
          const stepEnter = spring({
            frame: t,
            fps: FPS,
            config: punchSpring,
            durationInFrames: 24,
          });
          const stepOpacity = interpolate(t, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(stepEnter, [0, 1], [50, 0]);
          return (
            <div
              key={step.title}
              style={{
                background: muted,
                border: `2px solid ${border}`,
                borderRadius: radius + 6,
                padding: stepPadding,
                opacity: stepOpacity,
                transform: `translateY(${y}px)`,
                boxShadow: `0 8px 24px oklch(0 0 0 / 0.06)`,
              }}
            >
              <div
                style={{
                  width: isVertical ? 40 : 44,
                  height: isVertical ? 40 : 44,
                  borderRadius: "50%",
                  background: primary,
                  color: primaryFg,
                  fontFamily: fontStack,
                  fontSize: 18,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: isVertical ? 10 : 14,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  fontFamily: fontStack,
                  fontSize: titleSize,
                  fontWeight: 700,
                  color: fg,
                  letterSpacing: "-0.02em",
                  marginBottom: 4,
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  fontFamily: fontStack,
                  fontSize: subSize,
                  color: mutedFg,
                  letterSpacing: "-0.01em",
                }}
              >
                {step.sub}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// —— 4. PROOF: Full-bleed primary, huge number ——
function ProofScene() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const variant = useContext(VariantContext);
  const isVertical = useIsVertical();
  const duration = variant === "short" ? SHORT_PROOF_FRAMES : PROOF_FRAMES;
  const { opacity, scale, translateY } = useSceneWithTransition(
    frame,
    duration,
    { delay: 0, isLast: false }
  );

  const bigNumOpacity = interpolate(frame, [8, 28], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineOpacity = interpolate(frame, [24, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const numSize = isVertical
    ? Math.max(100, Math.min(width / 4.5, height / 8))
    : Math.max(140, width / 5.5);
  const lineSize = isVertical
    ? Math.max(20, Math.min(width / 42, height / 55))
    : Math.max(24, width / 38);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(145deg, ${primary} 0%, oklch(0.45 0.16 163) 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 30% 50%, oklch(0.6 0.18 163 / 0.4) 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          textAlign: "center",
          padding: "40px 40px",
          maxWidth: width * 0.9,
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontFamily: fontStack,
            fontSize: numSize,
            fontWeight: 800,
            color: primaryFg,
            margin: 0,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            opacity: bigNumOpacity,
            textShadow: `0 4px 30px oklch(0 0 0 / 0.25)`,
          }}
        >
          3–5×
        </p>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: lineSize,
            fontWeight: 600,
            color: "oklch(1 0 0 / 0.9)",
            marginTop: 16,
            letterSpacing: "-0.02em",
            lineHeight: 1.35,
            opacity: lineOpacity,
          }}
        >
          more engagement. You bring the idea,
          <br />
          we handle the design.
        </p>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: isVertical ? 12 : 13,
            fontWeight: 500,
            color: "oklch(1 0 0 / 0.65)",
            marginTop: 14,
            letterSpacing: "0.01em",
            opacity: lineOpacity,
          }}
        >
          Based on industry benchmarks
        </p>
      </div>
    </AbsoluteFill>
  );
}

// —— 5. CTA: Bold strip ——
function CTAScene() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const variant = useContext(VariantContext);
  const isVertical = useIsVertical();
  const duration = variant === "short" ? SHORT_CTA_FRAMES : CTA_FRAMES;
  const { opacity, scale, translateY } = useSceneWithTransition(
    frame,
    duration,
    { delay: 0, isLast: true }
  );

  const btnProgress = spring({
    frame: frame - 22,
    fps: FPS,
    config: punchSpring,
    durationInFrames: 28,
  });
  const btnScale = 0.9 + btnProgress * 0.1;

  const titleSize = isVertical
    ? Math.max(24, Math.min(width / 36, height / 45))
    : Math.max(28, width / 32);
  const btnSize = isVertical
    ? Math.max(18, Math.min(width / 45, height / 55))
    : Math.max(20, width / 42);
  const stripHeight = isVertical ? "50%" : "55%";
  const paddingCta = isVertical ? "36px 32px" : "48px 40px";
  const btnPadding = isVertical ? "20px 44px" : "22px 52px";

  return (
    <AbsoluteFill
      style={{
        background: bg,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: stripHeight,
          background: `linear-gradient(0deg, ${primary}12 0%, transparent 100%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          textAlign: "center",
          padding: paddingCta,
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          style={{
            fontFamily: fontStack,
            fontSize: isVertical ? 12 : 14,
            fontWeight: 700,
            color: mutedFg,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 12,
          }}
        >
          Karouselmaker
        </p>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: titleSize,
            color: fg,
            fontWeight: 700,
            marginBottom: isVertical ? 24 : 32,
            letterSpacing: "-0.02em",
          }}
        >
          Ready to ship your first carousel?
        </p>
        <div
          style={{
            display: "inline-block",
            padding: btnPadding,
            borderRadius: radius + 4,
            background: primary,
            color: primaryFg,
            fontFamily: fontStack,
            fontSize: btnSize,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            boxShadow: `0 12px 36px oklch(0.55 0.17 163 / 0.4)`,
            transform: `scale(${btnScale})`,
          }}
        >
          Create your first carousel
        </div>
        <p
          style={{
            fontFamily: fontStack,
            fontSize: isVertical ? 11 : 12,
            color: mutedFg,
            marginTop: 14,
            fontWeight: 500,
          }}
        >
          Try free — no card required
        </p>
      </div>
    </AbsoluteFill>
  );
}

// —— Root: overlapping sequences for crossfade + zoom transition ——
export type PromoVideoProps = { variant?: "full" | "short" };

export function PromoVideo({ variant = "full" }: PromoVideoProps) {
  const { width, height } = useVideoConfig();

  return (
    <VariantContext.Provider value={variant}>
      <AbsoluteFill style={{ width, height, background: bg }}>
        {variant === "short" ? (
          <Series>
            <Series.Sequence durationInFrames={SHORT_INTRO_FRAMES}>
              <IntroScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={SHORT_TOPIC_IN_FRAMES}>
              <TopicInScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={SHORT_PROOF_FRAMES}>
              <ProofScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={SHORT_CTA_FRAMES}>
              <CTAScene />
            </Series.Sequence>
          </Series>
        ) : (
          <Series>
            <Series.Sequence durationInFrames={INTRO_FRAMES}>
              <IntroScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={HOOK_FRAMES}>
              <HookScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={TOPIC_IN_FRAMES}>
              <TopicInScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={STEPS_FRAMES}>
              <StepsScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={PROOF_FRAMES}>
              <ProofScene />
            </Series.Sequence>
            <Series.Sequence offset={-overlap} durationInFrames={CTA_FRAMES}>
              <CTAScene />
            </Series.Sequence>
          </Series>
        )}
      </AbsoluteFill>
    </VariantContext.Provider>
  );
}
