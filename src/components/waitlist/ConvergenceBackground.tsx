"use client";

import { useEffect, useRef } from "react";

interface Streak {
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  opacity: number;
  width: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const WHITE = { r: 255, g: 255, b: 255 };

function rgba(c: { r: number; g: number; b: number }, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function ConvergenceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const dpr = window.devicePixelRatio || 1;
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let inputRect = { x: w / 2, y: h * 0.55, w: Math.min(460, w - 48), h: 56 };

    function updateInputRect() {
      const el = document.querySelector(".wl-card");
      if (el) {
        const r = el.getBoundingClientRect();
        inputRect = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          w: r.width,
          h: r.height,
        };
      }
    }

    updateInputRect();
    const rectInterval = setInterval(updateInputRect, 150);

    function getFocalPoint(): { x: number; y: number } {
      return { x: inputRect.x, y: inputRect.y };
    }

    const isMobile = w < 768;
    const isLowEnd = isMobile && (navigator.hardwareConcurrency ?? 4) <= 4;
    const STREAK_COUNT = isLowEnd ? 17 : isMobile ? 26 : 48;
    const streaks: Streak[] = [];

    function spawnStreak(): Streak {
      const focal = getFocalPoint();
      const edge = Math.random();
      let sx: number, sy: number;

      if (edge < 0.25) {
        sx = Math.random() * w;
        sy = -20;
      } else if (edge < 0.5) {
        sx = Math.random() * w;
        sy = h + 20;
      } else if (edge < 0.75) {
        sx = -20;
        sy = Math.random() * h;
      } else {
        sx = w + 20;
        sy = Math.random() * h;
      }

      const dx = focal.x - sx;
      const dy = focal.y - sy;
      const angle = Math.atan2(dy, dx);

      return {
        x: sx,
        y: sy,
        angle: angle + (Math.random() - 0.5) * (isMobile ? 0.05 : 0.15),
        speed: 1.5 + Math.random() * 2,
        length: 36 + Math.random() * 96,
        opacity: isMobile ? 0.11 + Math.random() * 0.21 : 0.08 + Math.random() * 0.15,
        width: 0.6 + Math.random() * 1.2,
      };
    }

    const maxAdvance = isMobile ? 200 : 600;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const s = spawnStreak();
      const advance = Math.random() * maxAdvance;
      s.x += Math.cos(s.angle) * advance;
      s.y += Math.sin(s.angle) * advance;
      streaks.push(s);
    }

    const MOTE_COUNT = isLowEnd ? 10 : isMobile ? 14 : 72;
    const motes: Mote[] = [];

    function spawnMote(): Mote {
      const focal = getFocalPoint();
      const edgeBias = Math.random() < 0.7;
      let mx: number, my: number;

      if (edgeBias) {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) {
          mx = Math.random() * w;
          my = Math.random() * h * 0.2;
        } else if (side === 1) {
          mx = Math.random() * w;
          my = h * 0.8 + Math.random() * h * 0.2;
        } else if (side === 2) {
          mx = Math.random() * w * 0.2;
          my = Math.random() * h;
        } else {
          mx = w * 0.8 + Math.random() * w * 0.2;
          my = Math.random() * h;
        }
      } else {
        mx = Math.random() * w;
        my = Math.random() * h;
      }

      const dx = focal.x - mx;
      const dy = focal.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxLife = isMobile ? 500 + Math.random() * 600 : 300 + Math.random() * 400;

      return {
        x: mx,
        y: my,
        vx:
          dist > 0
            ? (dx / dist) * (isMobile ? 0.4 + Math.random() * 0.6 : 0.3 + Math.random() * 0.5)
            : 0,
        vy:
          dist > 0
            ? (dy / dist) * (isMobile ? 0.4 + Math.random() * 0.6 : 0.3 + Math.random() * 0.5)
            : 0,
        radius: isMobile ? 0.2 + Math.random() * 0.5 : 0.4 + Math.random() * 1.1,
        opacity: isMobile ? 0.48 + Math.random() * 0.22 : 0.17 + Math.random() * 0.26,
        life: Math.random() * maxLife,
        maxLife,
      };
    }

    for (let i = 0; i < MOTE_COUNT; i++) {
      motes.push(spawnMote());
    }

    let screenDiag = Math.sqrt(w * w + h * h);
    let streakSpeedRadius = Math.max(300, screenDiag * 0.6);
    let streakFadeRadius =
      w < 768 ? Math.max(120, screenDiag * 0.18) : Math.max(80, screenDiag * 0.12);
    const streakTargetSpeed = 3.5;
    const streakAccelRate = 0.02;
    let streakHomingBase = isMobile ? 0.03 : 0.008;
    let streakGravityRadius = isMobile ? screenDiag * 0.5 : 0;
    let motePullRadius = w < 768 ? screenDiag * 1.2 : Math.max(400, screenDiag * 0.55);

    let animFrame: number;

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      const focal = getFocalPoint();

      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;

        const dx = focal.x - s.x;
        const dy = focal.y - s.y;
        const targetAngle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);

        let homingRate = streakHomingBase;
        if (streakGravityRadius > 0 && dist < streakGravityRadius) {
          const t = 1 - dist / streakGravityRadius;
          homingRate = 0.01 + 0.25 * t * t * t;
        }
        s.angle = lerp(s.angle, targetAngle, homingRate);

        let streakOpacity = s.opacity;
        if (dist < streakFadeRadius) streakOpacity *= dist / streakFadeRadius;
        if (dist < streakSpeedRadius)
          s.speed = lerp(s.speed, streakTargetSpeed, streakAccelRate);

        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const grad = ctx!.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, rgba(WHITE, 0));
        grad.addColorStop(0.7, rgba(WHITE, streakOpacity * 0.5));
        grad.addColorStop(1, rgba(WHITE, streakOpacity));

        ctx!.beginPath();
        ctx!.moveTo(tailX, tailY);
        ctx!.lineTo(s.x, s.y);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = s.width;
        ctx!.stroke();

        if (
          dist < streakFadeRadius * 0.3 ||
          s.x < -100 ||
          s.x > w + 100 ||
          s.y < -100 ||
          s.y > h + 100
        ) {
          streaks[i] = spawnStreak();
        }
      }

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];

        const dx = focal.x - m.x;
        const dy = focal.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const t = Math.max(0, 1 - dist / motePullRadius);
        const basePull = isMobile
          ? 0.008 + 0.15 * t * t
          : 0.003 + 0.04 * t * t * t;
        if (dist > 0) {
          m.vx += (dx / dist) * basePull;
          m.vy += (dy / dist) * basePull;
        }

        const damping = isMobile ? 0.993 : 0.995;
        m.vx *= damping;
        m.vy *= damping;

        m.x += m.vx;
        m.y += m.vy;
        m.life++;

        let moteOpacity = m.opacity;
        const lifeProg = m.life / m.maxLife;
        if (lifeProg < 0.1) moteOpacity *= lifeProg / 0.1;
        if (lifeProg > 0.8) moteOpacity *= (1 - lifeProg) / 0.2;
        if (dist < streakFadeRadius) moteOpacity *= dist / streakFadeRadius;

        const gRad = m.radius * 4;
        const grad = ctx!.createRadialGradient(m.x, m.y, 0, m.x, m.y, gRad);
        grad.addColorStop(0, rgba(WHITE, moteOpacity * 0.65));
        grad.addColorStop(1, rgba(WHITE, 0));
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, gRad, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx!.fillStyle = rgba(WHITE, moteOpacity);
        ctx!.fill();

        const dotProduct = m.vx * dx + m.vy * dy;
        const isEscaping = dotProduct < 0 && dist < streakFadeRadius * 2;
        if (m.life > m.maxLife || dist < streakFadeRadius * 0.3 || isEscaping) {
          motes[i] = spawnMote();
        }
      }

      animFrame = requestAnimationFrame(draw);
    }

    animFrame = requestAnimationFrame(draw);

    function handleResize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.scale(dpr, dpr);
      updateInputRect();
      screenDiag = Math.sqrt(w * w + h * h);
      streakSpeedRadius = Math.max(300, screenDiag * 0.6);
      streakFadeRadius =
        w < 768 ? Math.max(120, screenDiag * 0.18) : Math.max(80, screenDiag * 0.12);
      streakHomingBase = w < 768 ? 0.03 : 0.008;
      streakGravityRadius = w < 768 ? screenDiag * 0.5 : 0;
      motePullRadius = w < 768 ? screenDiag * 1.2 : Math.max(400, screenDiag * 0.55);
    }

    window.addEventListener("resize", handleResize);

    function handleVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(animFrame);
      } else {
        animFrame = requestAnimationFrame(draw);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animFrame);
      clearInterval(rectInterval);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="convergence-bg" aria-hidden="true" />;
}
