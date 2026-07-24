import React, { useEffect, useRef } from 'react';

const LogoMosaicDrift = () => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const tilesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });

    const palette = [
      'rgba(14, 165, 233, 0.35)',
      'rgba(239, 68, 68, 0.28)',
      'rgba(132, 204, 22, 0.26)',
      'rgba(168, 85, 247, 0.22)',
      'rgba(31, 41, 55, 0.14)'
    ];

    const rand = (min, max) => min + Math.random() * (max - min);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = window.innerWidth * window.innerHeight;
      const count = Math.max(90, Math.min(220, Math.floor(area / 9000)));
      const base = Math.min(window.innerWidth, window.innerHeight);

      tilesRef.current = Array.from({ length: count }, () => {
        const size = rand(base * 0.015, base * 0.05);
        const speed = rand(0.08, 0.35);
        const angle = rand(0, Math.PI * 2);
        const blur = Math.random() < 0.55 ? rand(6, 18) : 0;
        const alpha = blur > 0 ? rand(0.18, 0.35) : rand(0.14, 0.28);

        return {
          x: rand(-window.innerWidth * 0.2, window.innerWidth * 1.2),
          y: rand(-window.innerHeight * 0.2, window.innerHeight * 1.2),
          size,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: rand(-0.6, 0.6),
          rotSpeed: rand(-0.004, 0.004),
          fill: palette[Math.floor(Math.random() * palette.length)],
          blur,
          alpha
        };
      });
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.9);
      bg.addColorStop(0, 'rgba(255,255,255,1)');
      bg.addColorStop(1, 'rgba(248,250,252,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (const t of tilesRef.current) {
        t.x += t.vx;
        t.y += t.vy;
        t.rot += t.rotSpeed;

        const driftX = (t.x - cx) * 0.0008;
        const driftY = (t.y - cy) * 0.0008;
        t.x += driftX;
        t.y += driftY;

        if (t.x < -w * 0.35) t.x = w * 1.35;
        if (t.x > w * 1.35) t.x = -w * 0.35;
        if (t.y < -h * 0.35) t.y = h * 1.35;
        if (t.y > h * 1.35) t.y = -h * 0.35;

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rot);
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = t.fill;
        ctx.shadowBlur = t.blur;
        ctx.shadowColor = t.fill;
        const s = t.size;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      const vignette = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.15, cx, cy, Math.max(w, h) * 0.9);
      vignette.addColorStop(0, 'rgba(255,255,255,0)');
      vignette.addColorStop(1, 'rgba(2,6,23,0.06)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      rafRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    rafRef.current = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />;
};

export default LogoMosaicDrift;

