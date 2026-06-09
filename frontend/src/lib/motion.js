import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// ---------- Reveal (fade + slide up when in view) ----------
export function Reveal({ children, delay = 0, y = 24, className = "", ...rest }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 0.61, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ---------- Staggered grid container ----------
export const StaggerGrid = motion.div;

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.05 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] },
  },
};

// ---------- CountUp number ----------
export function CountUp({ value, decimals = 0, suffix = "", duration = 1.2 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const target = Number(value) || 0;
    if (!isFinite(target)) { setDisplay(target); return; }
    const start = performance.now();
    const from = 0;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [value, inView, duration]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();
  return <span ref={ref}>{formatted}{suffix}</span>;
}

// ---------- Page transition wrapper ----------
export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ---------- Parallax (translate Y based on scroll) ----------
export function Parallax({ children, offset = 80, className = "" }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [offset, -offset]), { stiffness: 80, damping: 22 });
  return (
    <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>
  );
}
