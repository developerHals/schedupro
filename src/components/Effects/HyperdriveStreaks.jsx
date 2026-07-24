import React, { useEffect, useRef } from 'react';

const HyperdriveStreaks = () => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streaksRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });

    const rand = (min, max) => min + Math.random() * (max - min);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(80, Math.floor((window.innerWidth * window.innerHeight) / 18000));
      streaksRef.current = Array.from({ length: count }, () => ({
        x: rand(-window.innerWidth * 0.6, window.innerWidth * 1.6),
        y: rand(-window.innerHeight * 0.6, window.innerHeight * 1.6),
        z: rand(0.15, 1),
        colorIndex: Math.floor(Math.random() * 3),
        lum: rand(35, 65)
      }));
    };

    const resetStreak = (s) => {
      s.x = rand(-window.innerWidth * 0.6, window.innerWidth * 1.6);
      s.y = rand(-window.innerHeight * 0.6, window.innerHeight * 1.6);
      s.z = rand(0.15, 1);
      s.colorIndex = Math.floor(Math.random() * 3);
      s.lum = rand(35, 65);
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
      bg.addColorStop(0, 'rgba(0,0,0,0.0)');
      bg.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      ctx.globalCompositeOperation = 'source-over';

      const speed = 0.010;
      const stretch = 1300;
      const thicknessBase = 0.9;
      const colors = [
        { h: 220, s: 35 },
        { h: 0, s: 25 },
        { h: 0, s: 0 }
      ];

      for (const s of streaksRef.current) {
        const dx = (s.x - cx) / w;
        const dy = (s.y - cy) / h;

        const vx = dx * stretch * speed;
        const vy = dy * stretch * speed;
        const px = s.x;
        const py = s.y;

        s.z += speed * (0.9 + s.z * 1.2);
        s.x += vx * (0.8 + s.z * 1.6);
        s.y += vy * (0.8 + s.z * 1.6);

        const alpha = Math.min(0.75, 0.15 + s.z * 0.55);
        const width = Math.max(0.6, thicknessBase + s.z * 1.2);

        const c = colors[s.colorIndex] || colors[0];
        ctx.strokeStyle = `hsla(${c.h}, ${c.s}%, ${s.lum}%, ${alpha})`;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        if (s.x < -w * 0.8 || s.x > w * 1.8 || s.y < -h * 0.8 || s.y > h * 1.8 || s.z > 3.2) {
          resetStreak(s);
        }
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    rafRef.current = window.requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-[1]" />;
};

export default HyperdriveStreaks;
