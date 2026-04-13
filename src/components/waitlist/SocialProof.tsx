"use client";

import { useEffect, useRef, useState } from "react";

const metrics = [
  { end: 125, suffix: "+", label: "locations", prefix: "" },
  { end: 10, suffix: "/10", label: "avg client rating", prefix: "" },
  { end: 7, suffix: "", label: "years running", prefix: "" },
];

interface MetricDef {
  end: number;
  suffix: string;
  prefix: string;
}

function AnimatedNumber({ end, suffix, prefix }: MetricDef) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1600;
          const startTime = performance.now();

          function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(eased * end);
            if (progress < 1) requestAnimationFrame(tick);
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  const display =
    end >= 1000 ? Math.round(value).toLocaleString() : String(Math.round(value));

  return (
    <span ref={ref} className="wl-stat-number">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

export default function SocialProof() {
  return (
    <section className="wl-section wl-stats-section">
      <div className="wl-stats">
        {metrics.map((m, i) => (
          <div key={m.label} className="wl-stat-item">
            <AnimatedNumber end={m.end} suffix={m.suffix} prefix={m.prefix} />
            <span className="wl-stat-label">{m.label}</span>
            {i < metrics.length - 1 && <span className="wl-stat-divider" />}
          </div>
        ))}
      </div>
    </section>
  );
}
