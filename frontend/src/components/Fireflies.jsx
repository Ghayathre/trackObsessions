import { useEffect, useRef } from "react";
import { useMotion } from "../context/ThemeContext";

// A calm field of glowing fireflies that drift around their home spots, twinkle, and
// softly scatter from the cursor. Theme-coloured (primary / accent / secondary), behind
// the content. Cheap: one rAF loop writes only translate + opacity (no per-frame filters
// or scale), and the glow is a static box-shadow on a cached layer.
const COLORS = ["--primary", "--accent", "--secondary"];
const REPEL_RADIUS = 120;
const REPEL_FORCE = 2.2;
const HOME_FORCE = 0.014;
const DAMPING = 0.9;
const IDLE_AMP = 16;
const MAX_SPEED = 20;

export default function Fireflies() {
  const { tokens, creatures } = useMotion();
  const cfg = creatures.firefly;
  const active = (tokens.sprites || 0) > 0; // motion preset gates creatures on/off
  const count = active ? cfg.count : 0;
  const sizeMul = cfg.size;
  const nodesRef = useRef([]);
  const speedRef = useRef(cfg.speed);
  useEffect(() => { speedRef.current = cfg.speed; }, [cfg.speed]);

  useEffect(() => {
    if (!count) return;
    if (typeof window === "undefined") return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    const mouse = { x: -9999, y: -9999 };

    const state = Array.from({ length: count }, () => {
      const fx = Math.random();
      const fy = Math.random();
      return {
        x: fx * W, y: fy * H, vx: 0, vy: 0, fx, fy,
        is: 0.4 + Math.random() * 0.6,
        is2: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        tw: 1.2 + Math.random() * 1.6,
      };
    });

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    const R2 = REPEL_RADIUS * REPEL_RADIUS;
    let raf;
    const loop = (now) => {
      const t = now / 1000;
      const spd = speedRef.current; // live speed multiplier from the slider
      for (let i = 0; i < count; i++) {
        const s = state[i];

        // drift around home
        const homeX = s.fx * W + Math.sin(t * s.is + s.phase) * IDLE_AMP;
        const homeY = s.fy * H + Math.cos(t * s.is2 + s.phase) * IDLE_AMP;
        s.vx += (homeX - s.x) * HOME_FORCE * spd;
        s.vy += (homeY - s.y) * HOME_FORCE * spd;

        // soft cursor repulsion
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / REPEL_RADIUS) * REPEL_FORCE;
          s.vx += (dx / d) * f;
          s.vy += (dy / d) * f;
        }

        s.vx *= DAMPING;
        s.vy *= DAMPING;
        const cap = MAX_SPEED * spd;
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > cap) { s.vx = (s.vx / sp) * cap; s.vy = (s.vy / sp) * cap; }
        s.x += s.vx;
        s.y += s.vy;

        const node = nodesRef.current[i];
        if (node) {
          const flick = 0.5 + 0.5 * Math.sin(t * s.tw + s.phase);
          node.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) translate(-50%, -50%)`;
          node.style.opacity = (0.2 + 0.75 * flick).toFixed(3);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [count]);

  if (!count) return null;

  return (
    <div className="hanabi-fireflies" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        const size = (4 + (i % 4) * 1.6) * sizeMul;
        const c = COLORS[i % COLORS.length];
        return (
          <span
            key={i}
            ref={(el) => (nodesRef.current[i] = el)}
            className="hanabi-firefly"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              background: `radial-gradient(circle at 35% 35%, #fff 0%, hsl(var(${c})) 45%, transparent 72%)`,
              boxShadow: `0 0 ${size}px hsl(var(${c})), 0 0 ${size * 2.4}px hsl(var(${c}) / 0.5)`,
            }}
          />
        );
      })}
    </div>
  );
}
