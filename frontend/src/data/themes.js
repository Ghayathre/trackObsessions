// Theme metadata. CSS variable definitions live in index.css under `.theme-<slug>` classes.
import {
  Moon, Flower2, Leaf, Cpu, Waves, Square, Skull,
  Sun, Flame, Trees, Snowflake, Coffee, Stars, Ghost
} from "lucide-react";

export const THEMES = [
  { slug: "tokyo-twilight", name: "Tokyo Twilight", mood: "Late-night neon",  icon: Moon,       swatches: ["#1b1d2c", "#ff5fa2", "#7c5cff"] },
  { slug: "sakura",         name: "Sakura Blossom", mood: "Soft pink calm",    icon: Flower2,    swatches: ["#fdf2f5", "#e96aa1", "#f4c0d1"] },
  { slug: "matcha",         name: "Matcha Latte",   mood: "Earthy & gentle",   icon: Leaf,       swatches: ["#f1f5f0", "#4f9c63", "#cfe0a4"] },
  { slug: "midnight-cyber", name: "Midnight Cyber", mood: "Neon noir",         icon: Cpu,        swatches: ["#08080d", "#fff200", "#00f0ff"] },
  { slug: "vaporwave",      name: "Retro Vaporwave",mood: "80s synth haze",    icon: Waves,      swatches: ["#1a0a26", "#ff3aa8", "#3ad6ff"] },
  { slug: "monochrome",     name: "Monochrome",     mood: "Minimal print",     icon: Square,     swatches: ["#ffffff", "#000000", "#dcdcdc"] },
  { slug: "dracula",        name: "Dracula",        mood: "Hacker dusk",       icon: Skull,      swatches: ["#282a36", "#ff79c6", "#8be9fd"] },
  { slug: "honey",          name: "Honey Pages",    mood: "Warm vintage",      icon: Sun,        swatches: ["#fdf6e3", "#b38b2f", "#e6c468"] },
  { slug: "ember",          name: "Ember",          mood: "Glowing fireside",  icon: Flame,      swatches: ["#1a0e0a", "#ff7a3a", "#ffd166"] },
  { slug: "forest",         name: "Deep Forest",    mood: "Mossy & cool",      icon: Trees,      swatches: ["#0f1a14", "#7fc99a", "#d8b56b"] },
  { slug: "arctic",         name: "Arctic",         mood: "Crisp & icy",       icon: Snowflake,  swatches: ["#f2f7fb", "#4d7a99", "#a9d8ec"] },
  { slug: "mocha",          name: "Mocha",          mood: "Cozy cafe",         icon: Coffee,     swatches: ["#1f1614", "#c98a5b", "#e7caa5"] },
  { slug: "stardust",       name: "Stardust",       mood: "Pastel galaxy",     icon: Stars,      swatches: ["#1b1230", "#b794ff", "#7fe3ff"] },
  { slug: "ghibli",         name: "Studio Sky",     mood: "Soft daylight",     icon: Ghost,      swatches: ["#e8f4f9", "#5b9bd5", "#f3a5a5"] },
];
