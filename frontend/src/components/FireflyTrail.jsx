import { useEffect, useRef } from "react";
import { useMotion } from "../context/ThemeContext";

// An ambient field of small confetti specks drifting in the background (à la the
// antigravity.google hero). They meander on their own and are *repelled* by the cursor —
// moving the mouse through the field scatters them, leaving a clear bubble around the
// pointer that fills back in as you move away. Sits behind the page content (z-index: -1),
// gated by the preset's `fireflies` count, and skipped on touch / reduced motion.
// One rAF loop writes transforms straight to the DOM — no React re-render per frame.
// Festive fireworks palette (Hanabi = 花火), independent of the active theme.
const PALETTE = ["#ff7a3a", "#ff5fa2", "#a06bff", "#3ad6ff", "#ffd166", "#4ade80", "#ff5470", "#5b8cff"];
// Cute little glyphs — flowers, sparkles, stars, hearts. The trailing ︎ forces
// text (not emoji) presentation so each glyph takes its CSS palette colour.
const SHAPES = ["✿︎", "❀︎", "✦︎", "★︎", "♥︎", "✸︎", "❁︎", "✺︎"];
const REPEL_RADIUS = 130; // px — specks scatter when the cursor comes this close
const REPEL_FORCE = 3.4; // how hard they're pushed away
const HOME_FORCE = 0.02; // spring pulling each speck back to its home spot
const IDLE_AMP = 9; // px — base in-place roam so the resting field stays alive
const MAX_SPEED = 34;

// Personality archetypes — each speck picks one, which scales how it reacts to the
// cursor, springs home, roams, spins and twinkles. Variety is what makes the field
// feel alive rather than a uniform grid of identical dots.
// keys: repel(radius×) force(scatter×) home(return×) damp idle(roam×) idleSp spin× twAmp twSp dart(probability/frame)
const PERSONALITIES = [
  { repel: 1.7, force: 1.5, home: 1.7, damp: 0.87, idle: 0.5, idleSp: 1.3, spin: 1.0, twAmp: 0.4, twSp: 1.3, dart: 0 },     // skittish — bolts & snaps back
  { repel: 0.7, force: 0.7, home: 0.45, damp: 0.9, idle: 1.9, idleSp: 0.5, spin: 0.4, twAmp: 0.3, twSp: 0.5, dart: 0 },     // lazy — barely flinches, drifts
  { repel: 1.1, force: 1.25, home: 0.85, damp: 0.78, idle: 1.2, idleSp: 1.6, spin: 2.4, twAmp: 0.55, twSp: 1.7, dart: 0.005 }, // playful — bouncy, darts, spins
  { repel: 1.0, force: 1.0, home: 1.0, damp: 0.85, idle: 0.8, idleSp: 1.0, spin: 0.8, twAmp: 1.0, twSp: 2.4, dart: 0 },     // sparkly — dramatic blink
  { repel: 1.3, force: 1.0, home: 0.65, damp: 0.86, idle: 2.4, idleSp: 0.8, spin: 0.6, twAmp: 0.45, twSp: 1.0, dart: 0.0015 }, // curious — roams wide
];

export default function FireflyTrail() {
  const { tokens } = useMotion();
  const count = tokens.fireflies || 0;
  const dotsRef = useRef([]);

  useEffect(() => {
    if (!count) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    // Mouse starts off-screen so the field drifts calmly until the user moves.
    const mouse = { x: -9999, y: -9999 };

    const state = Array.from({ length: count }, () => {
      const fx = Math.random(); // home position as a fraction of the viewport
      const fy = Math.random();
      const p = PERSONALITIES[(Math.random() * PERSONALITIES.length) | 0];
      const r = REPEL_RADIUS * p.repel;
      return {
        x: fx * W,
        y: fy * H,
        vx: 0,
        vy: 0,
        fx,
        fy,
        rot: Math.random() * 360,
        spin: (Math.random() - 0.5) * 0.6 * p.spin, // slow tumble (deg/frame)
        is: 0.4 + Math.random() * 0.5, // idle bob speeds / phase
        is2: 0.4 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        // personality-derived per-speck physics
        repelR: r,
        repelR2: r * r,
        force: REPEL_FORCE * p.force,
        home: HOME_FORCE * p.home,
        damp: p.damp,
        idle: IDLE_AMP * p.idle,
        idleSp: p.idleSp,
        twAmp: p.twAmp,
        twSp: p.twSp,
        dart: p.dart,
      };
    });

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    let raf;
    const loop = (now) => {
      const t = now / 1000;

      for (let i = 0; i < count; i++) {
        const s = state[i];

        // spring back toward home, roaming around it to its personality's degree
        const homeX = s.fx * W + Math.sin(t * s.is * s.idleSp + s.phase) * s.idle;
        const homeY = s.fy * H + Math.cos(t * s.is2 * s.idleSp + s.phase) * s.idle;
        s.vx += (homeX - s.x) * s.home;
        s.vy += (homeY - s.y) * s.home;

        // playful/curious specks occasionally dart off on a whim
        if (s.dart && Math.random() < s.dart) {
          s.vx += (Math.random() - 0.5) * 10;
          s.vy += (Math.random() - 0.5) * 10;
        }

        // cursor repulsion — scatter when the mouse is near, stronger the closer
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < s.repelR2) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / s.repelR) * s.force;
          s.vx += (dx / d) * f;
          s.vy += (dy / d) * f;
        }

        s.vx *= s.damp;
        s.vy *= s.damp;

        // clamp speed
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > MAX_SPEED) { s.vx = (s.vx / sp) * MAX_SPEED; s.vy = (s.vy / sp) * MAX_SPEED; }

        s.x += s.vx;
        s.y += s.vy;

        s.rot += s.spin;

        const node = dotsRef.current[i];
        if (node) {
          const flick = 0.5 + 0.5 * Math.sin(t * 1.4 * s.twSp + s.phase + i);
          const sc = (0.7 + s.twAmp * flick).toFixed(3);
          const op = Math.max(0.06, Math.min(1, 0.5 + (flick - 0.5) * (0.5 + s.twAmp)));
          node.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) translate(-50%, -50%) rotate(${s.rot}deg) scale(${sc})`;
          node.style.opacity = op.toFixed(3);
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
        const c = PALETTE[i % PALETTE.length];
        const shape = SHAPES[(i * 3) % SHAPES.length];
        const size = 9 + (i % 5) * 2; // 9–17px
        return (
          <span
            key={i}
            ref={(el) => (dotsRef.current[i] = el)}
            className="hanabi-firefly"
            style={{
              fontSize: `${size}px`,
              lineHeight: 1,
              color: c,
              textShadow: `0 0 6px ${c}99`,
            }}
          >
            {shape}
          </span>
        );
      })}
    </div>
  );
}
