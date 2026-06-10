import { useEffect, useRef } from "react";
import { useMotion } from "../context/ThemeContext";

// Studio-Ghibli-style soot sprites (susuwatari) that treat the page as home and mind
// their own business: they amble to new spots, occasionally form follow-the-leader trains
// carrying little star-candies (konpeito), blink, jiggle, and skitter away when the cursor
// comes near — then go back to whatever they were doing. Each has a personality that
// scales how it reacts, springs, roams and darts. A lightweight "director" fires the
// occasional roam / train event. Faint cobwebs sit in the corners. One rAF loop drives it.

const BODIES = ["#141019", "#15130f", "#101014", "#181117"];
const STAR_COLORS = ["#ffd1e8", "#fff3b0", "#cdeffd", "#d8f5c8", "#ffd6a5"];

// repel(radius×) force(scatter×) home(return×) damp idle(roam×) idleSp dart(prob/frame)
const PERSONALITIES = [
  { repel: 1.8, force: 1.6, home: 1.7, damp: 0.86, idle: 0.5, idleSp: 1.4, dart: 0 },      // skittish
  { repel: 0.7, force: 0.7, home: 0.45, damp: 0.9, idle: 1.9, idleSp: 0.5, dart: 0 },       // lazy
  { repel: 1.1, force: 1.3, home: 0.9, damp: 0.8, idle: 1.2, idleSp: 1.6, dart: 0.006 },     // playful
  { repel: 1.3, force: 1.0, home: 0.65, damp: 0.86, idle: 2.4, idleSp: 0.9, dart: 0.0015 },  // curious
];

const REPEL_RADIUS = 135;
const REPEL_FORCE = 3.6;
const HOME_FORCE = 0.02;
const FOLLOW_FORCE = 0.08; // tighter spring when marching in a train
const IDLE_AMP = 10;
const MAX_SPEED = 34;
const EYE_AMP = 2.0; // how far the pupils swivel (SVG user units) when watching something
const GLANCE_R = 200; // glance at the cursor when it's within this many px
const WATCH_R = 620; // a nosy idle soot within this of the caret may drift over to peek
const TRAIN_SPACING = 26; // px gap between sprites in a line
const TRAIN_SIZE = 4; // dedicated soots that permanently march the border (leader + 3)

const MODE_IDLE = 0;
const MODE_LEAD = 1;
const MODE_FOLLOW = 2;

export default function SootSprites() {
  const { tokens, creatures } = useMotion();
  const cfg = creatures.soot;
  const active = (tokens.sprites || 0) > 0; // motion preset gates creatures on/off
  const count = active ? cfg.count : 0; // free roamers (the train is extra)
  const sizeMul = cfg.size;
  const nodesRef = useRef([]);
  const starsRef = useRef([]);
  const pupilsRef = useRef([]); // the <g> wrapping each sprite's two pupils, moved to aim its gaze
  const speedRef = useRef(cfg.speed); // read live so the speed slider needs no re-init
  useEffect(() => { speedRef.current = cfg.speed; }, [cfg.speed]);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    const mouse = { x: -9999, y: -9999 };

    // The free roamers come from the preset budget; the train gets its own dedicated soots
    // appended after them (indices count … count+TRAIN_SIZE-1).
    const total = count + TRAIN_SIZE;

    const state = Array.from({ length: total }, (_, i) => {
      if (i < count) {
        // free-roaming sprite
        const fx = Math.random();
        const fy = Math.random();
        const pi = (Math.random() * PERSONALITIES.length) | 0;
        const p = PERSONALITIES[pi];
        const r = REPEL_RADIUS * p.repel;
        return {
          x: fx * W, y: fy * H, vx: 0, vy: 0,
          fx, fy, // home spot as a fraction of the viewport (mutable — they relocate)
          is: 0.5 + Math.random() * 0.6,
          is2: 0.5 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          repelR: r, repelR2: r * r, force: REPEL_FORCE * p.force,
          home: HOME_FORCE * p.home, damp: p.damp, idle: IDLE_AMP * p.idle,
          idleSp: p.idleSp, dart: p.dart,
          maxSp: MAX_SPEED, leadK: 0.035, followK: FOLLOW_FORCE,
          mode: MODE_IDLE, ahead: -1, carrying: false, until: 0,
          border: false, corner: 0,
          nosy: pi >= 2, watch: false, // playful & curious ones peek at what you're typing
        };
      }
      // dedicated train member — leader (n=0) marches the border forever; rest chain behind
      const n = i - count;
      const isLeader = n === 0;
      const r = REPEL_RADIUS * 1.1;
      return {
        x: 70 - n * TRAIN_SPACING, y: 70, vx: 0, vy: 0,
        fx: 70 / W, fy: 70 / H, // starts at the top-left corner
        is: 0.5 + Math.random() * 0.6,
        is2: 0.5 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        repelR: r, repelR2: r * r, force: REPEL_FORCE * 1.2,
        home: HOME_FORCE, damp: 0.84, idle: 5, idleSp: 1.0, dart: 0,
        // the train moves slowly: low speed cap + gentle springs
        maxSp: 2.4, leadK: 0.007, followK: 0.05,
        mode: isLeader ? MODE_LEAD : MODE_FOLLOW,
        ahead: isLeader ? -1 : i - 1,
        carrying: true, until: Infinity, // never ends
        border: isLeader, corner: 0,
        dir: Math.random() < 0.5 ? 1 : -1, // which way it walks the border
        paused: false, wait: 0,
        nosy: false, watch: false, // the train keeps marching; it doesn't stop to gawk
      };
    });

    // A point hugging the window border (one of the four corners), as a viewport fraction.
    const cornerFrac = (idx) => {
      const M = 70; // px inset from the edge
      const mx = M / W, my = M / H;
      switch (idx & 3) {
        case 0: return { fx: mx, fy: my };       // top-left
        case 1: return { fx: 1 - mx, fy: my };   // top-right
        case 2: return { fx: 1 - mx, fy: 1 - my }; // bottom-right
        default: return { fx: mx, fy: 1 - my };  // bottom-left
      }
    };

    // A random spot somewhere along the border (not just the corners).
    const randomBorderFrac = () => {
      const M = 70;
      const mx = M / W, my = M / H;
      const a = Math.random();
      switch ((Math.random() * 4) | 0) {
        case 0: return { fx: mx + a * (1 - 2 * mx), fy: my };       // top edge
        case 1: return { fx: 1 - mx, fy: my + a * (1 - 2 * my) };   // right edge
        case 2: return { fx: mx + a * (1 - 2 * mx), fy: 1 - my };   // bottom edge
        default: return { fx: mx, fy: my + a * (1 - 2 * my) };      // left edge
      }
    };

    // When the train stops, invite a couple of nearby idle soots to come mill around it.
    const gatherNear = (leader) => {
      let picked = 0;
      for (let i = 0; i < count && picked < 2; i++) {
        const s = state[i];
        if (s.mode !== MODE_IDLE || s.watch) continue;
        const dx = s.x - leader.x, dy = s.y - leader.y;
        if (dx * dx + dy * dy < 360 * 360) {
          const ang = Math.random() * Math.PI * 2;
          const rad = 34 + Math.random() * 26;
          s.fx = (leader.x + Math.cos(ang) * rad) / W;
          s.fy = (leader.y + Math.sin(ang) * rad) / H;
          picked++;
        }
      }
    };

    // The train leader reached its waypoint — decide what to do next.
    const leaderArrived = (s, t) => {
      // sometimes stop and dwell for a few seconds, drawing a couple of soots over
      if (!s.paused && Math.random() < 0.45) {
        s.paused = true;
        s.wait = t + 2 + Math.random() * 4.5;
        gatherNear(s);
        return;
      }
      s.paused = false;
      if (Math.random() < 0.25) s.dir = -s.dir; // occasionally turn around
      const roll = Math.random();
      if (roll < 0.3) {
        const b = randomBorderFrac(); // a random point along an edge
        s.fx = b.fx; s.fy = b.fy;
      } else if (roll < 0.45) {
        s.corner = (Math.random() * 4) | 0; // jump to a random corner
        const c = cornerFrac(s.corner); s.fx = c.fx; s.fy = c.fy;
      } else {
        s.corner = (s.corner + s.dir + 4) & 3; // continue to the next corner
        const c = cornerFrac(s.corner); s.fx = c.fx; s.fy = c.fy;
      }
    };

    // ---- director: occasionally sends sprites off to do things ----
    const idleOnes = () => {
      const out = [];
      for (let i = 0; i < count; i++) if (state[i].mode === MODE_IDLE && !state[i].watch) out.push(i);
      return out;
    };
    const fireEvent = (t) => {
      const idle = idleOnes();
      if (!idle.length) return;
      // a lone free sprite ambles off to a new spot, sometimes on an errand with a star
      const s = state[idle[(Math.random() * idle.length) | 0]];
      s.fx = 0.06 + Math.random() * 0.88;
      s.fy = 0.08 + Math.random() * 0.84;
      s.carrying = Math.random() < 0.25;
      s.until = t + 4 + Math.random() * 4; // drop whatever it carries when it arrives
      if (s.carrying) {
        s.mode = MODE_LEAD; // reuse "go to fx/fy" behaviour
        s.maxSp = 2.4; s.leadK = 0.007; // carry slowly & carefully, like the train
      }
    };
    let nextEvent = 5;

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    // ---- "what are you typing?" : follow the caret of the focused text field ----
    // The soots sit behind the content (z-index -1), so peeking never covers your text.
    const measure = (() => { try { return document.createElement("canvas").getContext("2d"); } catch { return null; } })();
    const TEXT_SEL = "input, textarea, [contenteditable=''], [contenteditable='true']";
    const ALLOW_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number", ""]);
    const isTextEl = (el) => {
      if (!el || !el.matches || !el.matches(TEXT_SEL)) return false;
      if (el.disabled || el.readOnly) return false;
      if (el.tagName === "INPUT") return ALLOW_TYPES.has(el.type || "");
      return true;
    };
    // Pixel position of the caret (so their eyes land where the letters appear).
    const caretPoint = (el) => {
      const r = el.getBoundingClientRect();
      if (el.tagName === "INPUT" && measure) {
        const st = getComputedStyle(el);
        measure.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
        const val = el.value || "";
        const caret = el.selectionStart == null ? val.length : el.selectionStart;
        const w = measure.measureText(val.slice(0, caret)).width;
        const padL = parseFloat(st.paddingLeft) || 0;
        const x = Math.min(r.left + padL + w - (el.scrollLeft || 0), r.right - 4);
        return { x, y: r.top + r.height / 2 };
      }
      // textarea / contenteditable: a gentle aim at the upper-left of the text area
      return { x: r.left + Math.min(40, r.width * 0.4), y: r.top + Math.min(28, r.height / 2) };
    };
    const attention = { x: 0, y: 0, active: false, until: 0, assigned: false, el: null };
    const nowSec = () => performance.now() / 1000;
    const engage = (el, fresh) => {
      const p = caretPoint(el);
      attention.x = p.x; attention.y = p.y;
      attention.until = nowSec() + 3; // attention lapses ~3s after you stop typing
      if (fresh || attention.el !== el || !attention.active) attention.assigned = false;
      attention.active = true;
      attention.el = el;
    };
    const onFocusIn = (e) => { if (isTextEl(e.target)) engage(e.target, true); };
    const onInput = (e) => { if (e.target === attention.el || isTextEl(e.target)) engage(e.target, false); };
    const onSelChange = () => { const el = document.activeElement; if (el && el === attention.el) engage(el, false); };
    const onFocusOut = (e) => { if (e.target === attention.el) attention.until = Math.min(attention.until, nowSec() + 0.8); };
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("selectionchange", onSelChange);
    document.addEventListener("focusout", onFocusOut, true);

    // A couple of nearby nosy soots wander over to a respectful spot beside the caret.
    const assignWatchers = () => {
      const offs = [-64, 24, -120, 96];
      let picked = 0;
      for (let i = 0; i < count && picked < 3; i++) {
        const s = state[i];
        if (!s.nosy || s.mode !== MODE_IDLE) continue;
        const dx = s.x - attention.x, dy = s.y - attention.y;
        if (dx * dx + dy * dy < WATCH_R * WATCH_R) {
          s.watch = true;
          s.fx = Math.min(0.96, Math.max(0.04, (attention.x + offs[picked]) / W));
          s.fy = Math.min(0.94, Math.max(0.06, (attention.y + 70 + (picked % 2) * 26) / H));
          picked++;
        }
      }
      attention.assigned = true;
    };
    const clearWatchers = () => { for (let i = 0; i < count; i++) state[i].watch = false; };

    let raf;
    const loop = (now) => {
      const t = now / 1000;
      const spd = speedRef.current; // live speed multiplier from the slider
      if (t > nextEvent) { fireEvent(t); nextEvent = t + 10 + Math.random() * 12; }

      // typing attention: enlist watchers when it begins, release them when it lapses
      const attentive = attention.active && t < attention.until;
      if (attention.active && !attentive) { attention.active = false; clearWatchers(); }
      else if (attentive && !attention.assigned) assignWatchers();

      for (let i = 0; i < total; i++) {
        const s = state[i];

        // end a job → settle down where it ended
        if (s.mode !== MODE_IDLE && t > s.until) {
          s.mode = MODE_IDLE;
          s.carrying = false;
          s.border = false;
          s.maxSp = MAX_SPEED; s.leadK = 0.035; // back to normal free-roam speed
          s.fx = s.x / W;
          s.fy = s.y / H;
        }

        // pick a target + spring strength based on what it's doing
        let tx, ty, k;
        if (s.mode === MODE_FOLLOW && state[s.ahead]) {
          const a = state[s.ahead];
          const al = Math.hypot(a.vx, a.vy);
          if (al > 0.5) { tx = a.x - (a.vx / al) * TRAIN_SPACING; ty = a.y - (a.vy / al) * TRAIN_SPACING; }
          else { tx = a.x - TRAIN_SPACING; ty = a.y; }
          k = s.followK;
        } else {
          tx = s.fx * W + Math.sin(t * s.is * s.idleSp + s.phase) * s.idle;
          ty = s.fy * H + Math.cos(t * s.is2 * s.idleSp + s.phase) * s.idle;
          k = s.mode === MODE_LEAD ? s.leadK : s.home;
          // a leader that has arrived decides what to do next
          if (s.mode === MODE_LEAD) {
            const arrived = Math.hypot(s.fx * W - s.x, s.fy * H - s.y) < 46;
            if (s.border) {
              // train leader: wander the border with stops & turns (paused = dwelling)
              if (t >= s.wait && arrived) leaderArrived(s, t);
            } else if (arrived) {
              // lone errand-runner: pick any new spot
              s.fx = 0.08 + Math.random() * 0.84;
              s.fy = 0.1 + Math.random() * 0.8;
            }
          }
        }
        s.vx += (tx - s.x) * k * spd;
        s.vy += (ty - s.y) * k * spd;

        // playful/curious sprites occasionally dart off on a whim
        if (s.dart && s.mode === MODE_IDLE && Math.random() < s.dart) {
          s.vx += (Math.random() - 0.5) * 10;
          s.vy += (Math.random() - 0.5) * 10;
        }

        // cursor repulsion — skitter away, stronger the closer
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

        const cap = s.maxSp * spd;
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > cap) { s.vx = (s.vx / sp) * cap; s.vy = (s.vy / sp) * cap; }

        s.x += s.vx;
        s.y += s.vy;

        const node = nodesRef.current[i];
        if (node) {
          const squash = Math.min(0.14, sp * 0.012);
          const sx = (1 + 0.05 * Math.sin(t * 2.2 * s.idleSp + s.phase) + squash).toFixed(3);
          const sy = (1 + 0.05 * Math.cos(t * 2.0 * s.idleSp + s.phase) - squash).toFixed(3);
          node.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) translate(-50%, -50%) scale(${sx}, ${sy})`;
        }
        const star = starsRef.current[i];
        if (star) star.style.opacity = s.carrying ? "1" : "0";

        // gaze: watch the caret if enlisted, else glance at a nearby cursor, else idle drift
        const pg = pupilsRef.current[i];
        if (pg) {
          let gx, gy, gazing = false;
          if (attentive && s.watch) { gx = attention.x; gy = attention.y; gazing = true; }
          else {
            const mdx = s.x - mouse.x, mdy = s.y - mouse.y;
            if (mdx * mdx + mdy * mdy < GLANCE_R * GLANCE_R) { gx = mouse.x; gy = mouse.y; gazing = true; }
          }
          let ox, oy;
          if (gazing) {
            const ex = gx - s.x, ey = gy - s.y;
            const el = Math.hypot(ex, ey) || 1;
            ox = (ex / el) * EYE_AMP; oy = (ey / el) * EYE_AMP;
          } else {
            ox = Math.sin(t * 0.7 + s.phase) * 1.1;
            oy = Math.cos(t * 0.55 + s.phase) * 0.7;
          }
          pg.setAttribute("transform", `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("selectionchange", onSelChange);
      document.removeEventListener("focusout", onFocusOut, true);
      cancelAnimationFrame(raf);
    };
  }, [count, active]);

  if (!active) return null;
  const total = count + TRAIN_SIZE; // free roamers + the dedicated border train

  return (
    <div className="hanabi-soot-field" aria-hidden="true">
      {/* faint cobwebs in two corners — the sprites have clearly been living here */}
      <CornerWeb className="soot-web soot-web-tl" />
      <CornerWeb className="soot-web soot-web-br" />

      {Array.from({ length: total }).map((_, i) => {
        const size = (18 + (i % 5) * 4) * sizeMul; // base 18–34px, scaled by the size slider
        const body = BODIES[i % BODIES.length];
        const star = STAR_COLORS[i % STAR_COLORS.length];
        const blinkDur = (3.4 + (i % 6) * 0.7).toFixed(2);
        const blinkDelay = ((i * 0.37) % 5).toFixed(2);
        return (
          <span
            key={i}
            ref={(el) => (nodesRef.current[i] = el)}
            className="hanabi-soot"
            // Spread them out from the first paint so they're visible even before the
            // rAF loop's first frame (the loop overwrites transform in px once running).
            style={{
              width: `${size}px`,
              height: `${size}px`,
              transform: `translate3d(${((i * 37 + 13) % 96) + 2}vw, ${((i * 59 + 29) % 92) + 4}vh, 0) translate(-50%, -50%)`,
            }}
          >
            <span
              className="soot-star"
              ref={(el) => (starsRef.current[i] = el)}
              style={{ color: star, fontSize: `${Math.round(size * 0.5)}px` }}
            >
              ✦
            </span>
            <svg viewBox="0 0 44 44" width="100%" height="100%">
              {/* Each sprite carries its own fuzz filter. A shared filter in a separate
                  <svg> isn't resolved cross-element by Safari/Firefox (the body then
                  doesn't paint at all), so we keep the reference inside this same <svg>. */}
              <defs>
                <filter id={`hanabiSootFuzz${i}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
                </filter>
              </defs>
              <g filter={`url(#hanabiSootFuzz${i})`}>
                {/* highlight rim underlay (foreground colour via currentColor) */}
                <path d="M12 13 L16 2.5 L20 13 Z M21 11 L25 1.5 L29 11 Z M29 14 L33 5 L36 15 Z" fill="currentColor" />
                <circle cx="22" cy="24" r="15.6" fill="currentColor" />
                {/* little spiky tufts on top + fuzzy body */}
                <path d="M13 13 L16 4 L19 13 Z M22 11 L25 3 L28 11 Z M30 14 L33 6 L35 15 Z" fill={body} />
                <circle cx="22" cy="24" r="14" fill={body} />
              </g>
              <g className="soot-eyes" style={{ animationDuration: `${blinkDur}s`, animationDelay: `-${blinkDelay}s` }}>
                <ellipse cx="17.5" cy="21" rx="4" ry="5" fill="#fdfdfd" />
                <ellipse cx="26.5" cy="21" rx="4" ry="5" fill="#fdfdfd" />
                <g ref={(el) => (pupilsRef.current[i] = el)}>
                  <circle cx="17.5" cy="21" r="1.7" fill="#1b1b1b" />
                  <circle cx="26.5" cy="21" r="1.7" fill="#1b1b1b" />
                </g>
              </g>
            </svg>
          </span>
        );
      })}
    </div>
  );
}

function CornerWeb({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" width="130" height="130" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="0.6" strokeLinecap="round">
        <line x1="0" y1="0" x2="100" y2="16" />
        <line x1="0" y1="0" x2="78" y2="50" />
        <line x1="0" y1="0" x2="50" y2="78" />
        <line x1="0" y1="0" x2="16" y2="100" />
        <path d="M22 4 Q 17 17 5 22" />
        <path d="M44 9 Q 33 33 9 44" />
        <path d="M68 14 Q 50 50 14 68" />
        <path d="M90 20 Q 64 64 20 90" />
      </g>
    </svg>
  );
}
