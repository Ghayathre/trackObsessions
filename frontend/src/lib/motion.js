import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useMotion } from "../context/ThemeContext";

// All primitives below read the active motion preset's tokens from context, so the
// whole app re-tunes when the user switches preset in Settings → Motion.

// ---------- Reveal (fade + slide up when in view) ----------
export function Reveal({ children, delay = 0, y, className = "", ...rest }) {
  const { tokens } = useMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const distance = y ?? tokens.revealY;
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: distance }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: tokens.duration, delay, ease: tokens.ease }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ---------- Staggered grid ----------
export const StaggerGrid = motion.div;

// Hook form — builds container/item variants from the active preset.
export function useStagger() {
  const { tokens } = useMotion();
  return {
    container: {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: { staggerChildren: tokens.stagger, delayChildren: tokens.delayChildren },
      },
    },
    item: {
      hidden: { opacity: 0, y: tokens.itemY, scale: tokens.itemScale },
      show: {
        opacity: 1, y: 0, scale: 1,
        transition: { duration: tokens.itemDuration, ease: tokens.ease },
      },
    },
  };
}

// Static fallbacks (calm-ish) for any caller not using the hook.
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] } },
};

// ---------- CountUp number ----------
export function CountUp({ value, decimals = 0, suffix = "", duration }) {
  const { tokens } = useMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const [display, setDisplay] = useState(0);
  const dur = duration ?? tokens.countDuration;

  useEffect(() => {
    if (!inView) return;
    const target = Number(value) || 0;
    if (!isFinite(target)) { setDisplay(target); return; }
    const start = performance.now();
    const from = 0;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (dur * 1000));
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [value, inView, dur]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();
  return <span ref={ref}>{formatted}{suffix}</span>;
}

// ---------- Page transition wrapper ----------
export function PageTransition({ children }) {
  const { tokens } = useMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: tokens.pageY }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -Math.round(tokens.pageY * 0.7) }}
      transition={{ duration: tokens.pageDuration, ease: tokens.ease }}
    >
      {children}
    </motion.div>
  );
}

// ---------- Parallax (translate Y based on scroll) ----------
export function Parallax({ children, offset = 80, className = "" }) {
  const { tokens } = useMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const range = offset * tokens.parallax;
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [range, -range]), { stiffness: 80, damping: 22 });
  // When parallax is disabled (minimal/reduced) skip the motion wrapper entirely.
  if (!tokens.parallax) return <div className={className}>{children}</div>;
  return (
    <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>
  );
}

// ---------- Float (gentle idle drift; only animates under the antigravity preset) ----------
// Pure CSS via the `.motion-float` utility — opt-in per element. CSS gates the actual
// animation to `.motion-antigravity`, so this is inert under calm/minimal/reduced.
export function Float({ children, className = "", ...rest }) {
  return (
    <div className={`motion-float ${className}`} {...rest}>{children}</div>
  );
}

// Spring config for hover interactions, from the active preset.
export function useHoverSpring() {
  const { tokens } = useMotion();
  return tokens;
}

// ---------- Typewriter (types text out one character at a time) ----------
// Renders an invisible full-text sizer with the typed text overlaid on top, so the
// element reserves its final size from the start — nothing below it reflows while typing.
// Instant (no caret) under the Minimal preset or OS reduced-motion.
export function Typewriter({ text, speed = 38, startDelay = 0, caret = true, className = "" }) {
  const { motion: preset, reducedMotion } = useMotion();
  const instant = reducedMotion || preset === "minimal";
  const [count, setCount] = useState(instant ? text.length : 0);
  const [started, setStarted] = useState(instant);
  const [done, setDone] = useState(instant);

  useEffect(() => {
    if (instant) { setCount(text.length); setStarted(true); setDone(true); return; }
    setCount(0); setStarted(false); setDone(false);
    let raf;
    const begin = setTimeout(() => {
      setStarted(true);
      const t0 = performance.now();
      const tick = (now) => {
        const n = Math.min(text.length, Math.floor((now - t0) / speed));
        setCount(n);
        if (n < text.length) raf = requestAnimationFrame(tick);
        else setDone(true);
      };
      raf = requestAnimationFrame(tick);
    }, startDelay);
    return () => { clearTimeout(begin); if (raf) cancelAnimationFrame(raf); };
  }, [text, speed, startDelay, instant]);

  return (
    <span className={`relative inline-block align-top max-w-full ${className}`} aria-label={text}>
      <span className="invisible" aria-hidden="true">{text}</span>
      <span className="absolute inset-0" aria-hidden="true">
        {text.slice(0, count)}
        {caret && started && !done && <span className="tw-caret" />}
      </span>
    </span>
  );
}
