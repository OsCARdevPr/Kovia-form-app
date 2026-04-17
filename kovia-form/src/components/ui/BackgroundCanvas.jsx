// src/components/ui/BackgroundCanvas.jsx
// ══════════════════════════════════════════════════════════
//  KOVIA — Cyberpunk 3D Tunnel Background
//  Componente React profesional con useRef + useEffect
//  Incluye: Grid 3D, rayo eléctrico, partículas de ruido,
//           efecto de apertura Iris al montar
// ══════════════════════════════════════════════════════════
import { useRef, useEffect } from 'react';

export default function BackgroundCanvas({ currentStep = 0 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ currentStep: 0 });

  // Actualizar el step sin reiniciar la animación
  useEffect(() => {
    stateRef.current.currentStep = currentStep;
  }, [currentStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animFrameId;
    let width, height;

    // ── State ────────────────────────────────────────────
    let time = 0;
    const lightnings = [];
    const particles = [];

    // Iris open amount (0 = closed, 1 = fully open)
    // Animate from 0 → 1 on mount for a professional reveal
    let irisOpen = 0;
    const IRIS_SPEED = 0.018;

    // ── Resize ───────────────────────────────────────────
    function resize() {
      width  = canvas.width  = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    // ── Particles (floating dust) ─────────────────────────
    function spawnParticle() {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.5 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.1 - Math.random() * 0.4,
        alpha: 0.05 + Math.random() * 0.15,
        life: 1.0,
        decay: 0.002 + Math.random() * 0.003,
      });
    }

    function initParticles() {
      for (let i = 0; i < 60; i++) spawnParticle();
    }

    function updateParticles() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          spawnParticle();
        }
      }
    }

    function drawParticles() {
      particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha * p.life;
        ctx.fillStyle = '#b12b24';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // ── Lightning ────────────────────────────────────────
    function triggerLightning() {
      lightnings.push({
        life: 1.0,
        x: Math.random() * width,
      });
    }

    function drawLightning(lx, life) {
      ctx.save();
      ctx.beginPath();
      let cx = lx, cy = 0;
      ctx.moveTo(cx, cy);
      const segments = 18;
      for (let i = 0; i < segments; i++) {
        cx += (Math.random() - 0.5) * 50;
        cy += height / segments;
        ctx.lineTo(cx, cy);
      }
      // White hot core
      ctx.strokeStyle = `rgba(255,255,255,${life})`;
      ctx.lineWidth = 2 + life * 3;
      ctx.shadowBlur = 50;
      ctx.shadowColor = '#ffffff';
      ctx.stroke();
      // Red outer glow
      ctx.strokeStyle = `rgba(177,43,36,${life * 0.5})`;
      ctx.lineWidth = 10;
      ctx.shadowBlur = 80;
      ctx.shadowColor = '#b12b24';
      ctx.stroke();
      ctx.restore();
    }

    // ── 3D Tunnel Grid ───────────────────────────────────
    function draw3DTunnel() {
      // Deep dark fill
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Only animate (zoom) on intro screen
      if (stateRef.current.currentStep === 0) {
        time += 0.0008;
      }

      const fov     = 380;
      const spacing = 140;
      const planes  = 32;
      const roomW   = 1600;
      const roomH   = 1100;

      ctx.lineWidth = 0.8;

      // ── Depth rings ───────────────────────────────────
      for (let i = 0; i < planes; i++) {
        const z      = ((i * spacing) - ((time * spacing * 10) % spacing)) % (planes * spacing);
        const actualZ = z < 0 ? z + planes * spacing : z;
        if (actualZ < 10) continue;

        const scale = fov / actualZ;
        const alpha = Math.max(0, 1 - actualZ / (planes * spacing));
        // Subtle pulse on alpha
        const pulse = 0.85 + 0.15 * Math.sin(time * 3 + i * 0.4);

        ctx.strokeStyle = `rgba(177,43,36,${alpha * pulse})`;

        const x1 = cx - roomW * scale;
        const x2 = cx + roomW * scale;
        const y1 = cy - roomH * scale;
        const y2 = cy + roomH * scale;

        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y1);
        ctx.lineTo(x2, y2); ctx.lineTo(x1, y2);
        ctx.closePath();
        ctx.stroke();
      }

      // ── Converging rails ──────────────────────────────
      const points = [];
      const subdivs = 16;

      for (let j = 0; j <= subdivs; j++) {
        const ratio = j / subdivs;
        const px = -roomW + roomW * 2 * ratio;
        points.push([px, -roomH]);
        points.push([px,  roomH]);
        const py = -roomH + roomH * 2 * ratio;
        if (j > 0 && j < subdivs) {
          points.push([-roomW, py]);
          points.push([ roomW, py]);
        }
      }

      points.forEach(([px, py]) => {
        const zFar  = planes * spacing;
        const zNear = 8;
        const xS = cx + px * (fov / zFar);
        const yS = cy + py * (fov / zFar);
        const xE = cx + px * (fov / zNear);
        const yE = cy + py * (fov / zNear);

        const lg = ctx.createLinearGradient(xS, yS, xE, yE);
        lg.addColorStop(0,   'rgba(177,43,36,0.0)');
        lg.addColorStop(0.7, 'rgba(177,43,36,0.3)');
        lg.addColorStop(1,   'rgba(177,43,36,0.6)');

        ctx.strokeStyle = lg;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(xS, yS);
        ctx.lineTo(xE, yE);
        ctx.stroke();
      });

      // ── Center glow (vanishing point) ─────────────────
      const glowR = 80 + 20 * Math.sin(time * 2);
      const grd   = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0,   `rgba(177,43,36,${0.18 + 0.07 * Math.sin(time * 2)})`);
      grd.addColorStop(0.5, 'rgba(177,43,36,0.04)');
      grd.addColorStop(1,   'rgba(177,43,36,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Vignette overlay ─────────────────────────────────
    function drawVignette() {
      const cx = width / 2;
      const cy = height / 2;
      const r  = Math.max(width, height) * 0.85;
      const grd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, width, height);
    }

    // ── Iris Opening Effect ──────────────────────────────
    // Professional reveal: grows from center on startup
    function drawIris() {
      if (irisOpen >= 1) return; // fully open, stop drawing
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy) * 1.1;
      const openR = irisOpen * maxR;

      // Mask everything outside the iris circle with black
      ctx.save();
      ctx.fillStyle = '#06070a';

      // Full rect minus circle clip
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(cx, cy, openR, 0, Math.PI * 2, true); // counterclockwise = punch hole
      ctx.fill('evenodd');

      // Glowing iris edge ring
      if (openR > 10) {
        ctx.beginPath();
        ctx.arc(cx, cy, openR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(177,43,36,${0.9 - irisOpen * 0.8})`;
        ctx.lineWidth = 3 - irisOpen * 2;
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#b12b24';
        ctx.stroke();
      }

      ctx.restore();
    }

    // ── Main render loop ──────────────────────────────────
    function render() {
      // Advance iris opening animation
      if (irisOpen < 1) irisOpen = Math.min(1, irisOpen + IRIS_SPEED);

      draw3DTunnel();
      updateParticles();
      drawParticles();

      // Lightning: rare ~0.08% chance per frame
      if (Math.random() < 0.0008) triggerLightning();

      for (let i = lightnings.length - 1; i >= 0; i--) {
        const l = lightnings[i];
        // Screen flash
        ctx.fillStyle = `rgba(255,255,255,${l.life * 0.25})`;
        ctx.fillRect(0, 0, width, height);
        drawLightning(l.x, l.life);
        // Random CRT scan glitch during high-life
        if (l.life > 0.8) {
          ctx.fillStyle = `rgba(177,43,36,${Math.random() * 0.12})`;
          ctx.fillRect(0, Math.random() * height, width, 1 + Math.random() * 5);
        }
        l.life -= 0.04;
        if (l.life <= 0) lightnings.splice(i, 1);
      }

      drawVignette();
      drawIris(); // Iris on top before CRT — fades out once open

      animFrameId = requestAnimationFrame(render);
    }

    // ── Boot ──────────────────────────────────────────────
    resize();
    initParticles();
    window.addEventListener('resize', resize);
    render();

    // ── Cleanup ───────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []); // Run once on mount

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}
