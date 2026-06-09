// Style packs — fonts, radius, texture. Theme controls colour; Style controls form.
import {
  Minus, Sparkle, Building2, ScrollText, Crown,
  Cpu, Brush, Feather, Gamepad2, Square, Diamond, Droplet
} from "lucide-react";

export const STYLES = [
  { slug: "minimalist",    name: "Minimalist",     blurb: "Clean sans · sharp corners · no clutter", icon: Minus,       sample: "Aa" },
  { slug: "retro-arcade",  name: "Retro Arcade",   blurb: "Chunky display · big rounded shapes",     icon: Gamepad2,    sample: "Aa" },
  { slug: "mid-century",   name: "Mid-Century",    blurb: "Geometric · simple ornaments",            icon: Building2,   sample: "Aa" },
  { slug: "vintage-paper", name: "Vintage Paper",  blurb: "Serif · paper grain · dotted dividers",   icon: ScrollText,  sample: "Aa" },
  { slug: "filigree",      name: "Filigree",       blurb: "Decorative serif · ornate borders",       icon: Crown,       sample: "Aa" },
  { slug: "cyberpunk",     name: "Cyberpunk",      blurb: "Tech mono · sharp edges · neon hum",      icon: Cpu,         sample: "Aa" },
  { slug: "doodle",        name: "Doodle",         blurb: "Hand-drawn · wobbly · playful",           icon: Brush,       sample: "Aa" },
  { slug: "sumi-ink",      name: "Sumi Ink",       blurb: "Brush serif · ink wash · still",         icon: Feather,     sample: "Aa" },
  { slug: "pixel-8bit",    name: "Pixel 8-bit",    blurb: "Crunchy pixels · square everything",      icon: Square,      sample: "Aa" },
  { slug: "brutalist",     name: "Brutalist",      blurb: "Bold display · hard edges · raw",         icon: Square,      sample: "Aa" },
  { slug: "art-deco",      name: "Art Deco",       blurb: "Elegant · geometric · gilded",            icon: Diamond,     sample: "Aa" },
  { slug: "watercolor",    name: "Watercolor",     blurb: "Soft brush · serif · blooming edges",     icon: Droplet,     sample: "Aa" },
  { slug: "default",       name: "Hanabi Default", blurb: "The original Cabinet Grotesk look",        icon: Sparkle,     sample: "Aa" },
];

export const DEFAULT_STYLE = "default";
