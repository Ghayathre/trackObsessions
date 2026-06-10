// Motion presets — a third "vibe" axis alongside Themes (colour) and Styles (form).
// A motion preset controls how things move: entrance feel, stagger, hover physics,
// page transitions, scroll parallax, and the ambient background. Selected like a theme;
// applied as a `motion-<slug>` class on <html> and consumed as JS tokens by lib/motion.
import { Orbit, Feather, Gauge } from "lucide-react";

// Token shape consumed by lib/motion.js primitives. Every preset defines all keys so
// callers never have to null-check.
export const MOTION_TOKENS = {
  antigravity: {
    // entrance (Reveal)
    revealY: 52,
    duration: 0.95,
    ease: [0.16, 1, 0.3, 1], // easeOutExpo — long, weightless deceleration
    // staggered grids
    stagger: 0.085,
    delayChildren: 0.08,
    itemY: 36,
    itemScale: 0.9,
    itemDuration: 0.85,
    // card hover physics (soft, buoyant spring)
    hoverLift: -12,
    hoverScale: 1.05,
    spring: { type: "spring", stiffness: 150, damping: 18, mass: 1.15 },
    // route transitions
    pageY: 26,
    pageDuration: 0.7,
    // animated counters
    countDuration: 1.8,
    // scroll parallax strength multiplier (0 disables)
    parallax: 1.25,
    // ambient drifting background + idle float utilities
    ambient: true,
    float: true,
    // ambient confetti field that scatters from the cursor (0 = off)
    fireflies: 320,
  },
  calm: {
    revealY: 24,
    duration: 0.6,
    ease: [0.22, 0.61, 0.36, 1],
    stagger: 0.05,
    delayChildren: 0.05,
    itemY: 18,
    itemScale: 0.97,
    itemDuration: 0.55,
    hoverLift: -6,
    hoverScale: 1.035,
    spring: { type: "spring", stiffness: 280, damping: 24 },
    pageY: 14,
    pageDuration: 0.45,
    countDuration: 1.2,
    parallax: 0.55,
    ambient: true,
    float: false,
    fireflies: 170,
  },
  minimal: {
    revealY: 10,
    duration: 0.28,
    ease: [0.4, 0, 0.2, 1],
    stagger: 0.02,
    delayChildren: 0,
    itemY: 8,
    itemScale: 1,
    itemDuration: 0.26,
    hoverLift: -3,
    hoverScale: 1.015,
    spring: { type: "spring", stiffness: 400, damping: 30 },
    pageY: 8,
    pageDuration: 0.2,
    countDuration: 0.7,
    parallax: 0,
    ambient: false,
    float: false,
    fireflies: 0,
  },
};

// When the OS asks for reduced motion we collapse everything to near-stillness,
// regardless of the chosen preset. Ambient drift and parallax are fully off.
export const REDUCED_TOKENS = {
  ...MOTION_TOKENS.minimal,
  revealY: 0,
  duration: 0.001,
  itemY: 0,
  itemScale: 1,
  itemDuration: 0.001,
  hoverLift: 0,
  hoverScale: 1,
  pageY: 0,
  pageDuration: 0.001,
  countDuration: 0.001,
  parallax: 0,
  ambient: false,
  float: false,
};

export const MOTIONS = [
  {
    slug: "antigravity",
    name: "Antigravity",
    blurb: "Weightless · floating · cinematic",
    mood: "Things drift up from the dark and settle like they have no weight.",
    icon: Orbit,
  },
  {
    slug: "calm",
    name: "Calm",
    blurb: "Smooth · refined · understated",
    mood: "Gentle reveals and soft hovers. Polished, never showy.",
    icon: Feather,
  },
  {
    slug: "minimal",
    name: "Minimal",
    blurb: "Snappy · quiet · out of the way",
    mood: "Near-instant. Best for focus, low-power devices, or motion sensitivity.",
    icon: Gauge,
  },
];

export const DEFAULT_MOTION = "antigravity";

export function getMotionTokens(slug) {
  return MOTION_TOKENS[slug] || MOTION_TOKENS[DEFAULT_MOTION];
}
