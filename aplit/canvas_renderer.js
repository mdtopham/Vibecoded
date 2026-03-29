import { TAU, clamp, lerp, transformPoint, transformPolyline } from './vector.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.palette = [
      '#7CFFCB', '#60F7FF', '#58C7FF', '#6E8CFF',
      '#A971FF', '#E470FF', '#FF69C7', '#FF6A6A',
      '#FF915A', '#FFB85A', '#FFE56A', '#D5FF6A',
      '#98FF6A', '#5BFF94', '#4DFFD9', '#B7FFF3'
    ];
    this.paletteOffset = 0;
    this.bloomEnabled = true;
    this.width = 0;
    this.height = 0;
    this.resize();
  }

  pal(i) { return this.palette[(i + this.paletteOffset) % this.palette.length]; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.width = innerWidth;
    this.height = innerHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  beginFrame() {
    const { ctx, width, height } = this;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5, 6, 10, 0.23)';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 36; i++) {
      const x = (i * 173) % width;
      const y = (i * 97) % height;
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(x, y, 1, 1);
    }

    const g = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    g.addColorStop(0, 'rgba(40,50,70,0.04)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(120, 160, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();
  }

  drawBeamPath(builder, color, width, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = this.bloomEnabled ? width * 5.5 : 0;

    ctx.globalAlpha = alpha * 0.16;
    ctx.lineWidth = width * 4.2;
    ctx.beginPath(); builder(); ctx.stroke();

    ctx.globalAlpha = alpha * 0.28;
    ctx.lineWidth = width * 2.2;
    ctx.beginPath(); builder(); ctx.stroke();

    ctx.shadowBlur = this.bloomEnabled ? width * 1.5 : 0;
    ctx.globalAlpha = alpha * 0.95;
    ctx.lineWidth = width;
    ctx.beginPath(); builder(); ctx.stroke();

    ctx.restore();
  }

  drawCurveSegments(segments, obj, color, width, alpha = 1) {
    this.drawBeamPath(() => {
      for (const seg of segments) {
        const p0 = transformPoint(seg.p0.x, seg.p0.y, obj);
        const c = transformPoint(seg.c.x, seg.c.y, obj);
        const p1 = transformPoint(seg.p1.x, seg.p1.y, obj);
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.quadraticCurveTo(c.x, c.y, p1.x, p1.y);
      }
    }, color, width, alpha);
  }

  drawPolyline(points, color, width, alpha = 1) {
    if (points.length < 2) return;
    this.drawBeamPath(() => {
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) this.ctx.lineTo(points[i].x, points[i].y);
    }, color, width, alpha);
  }

  drawGlowDisc(x, y, radius, color, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.bloomEnabled ? radius * 3.5 : 0;
    ctx.globalAlpha = alpha * 0.08;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha * 0.28;
    ctx.shadowBlur = this.bloomEnabled ? radius * 1.2 : 0;
    ctx.beginPath(); ctx.arc(x, y, radius * 0.38, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawScene(scene, assets, nowSec) {
    this.beginFrame();

    for (const t of scene.trails) this.drawGlowDisc(t.x, t.y, t.size, this.pal(t.colorIndex), t.life);

    for (const a of scene.asteroids) {
      this.drawCurveSegments(a.segments, a, this.pal(a.colorIndex), clamp(a.radius * 0.06, 1.2, 3.4), 0.95);
    }

    for (const p of scene.projectiles) {
      const p0 = { x: p.x - p.vx * 1.5, y: p.y - p.vy * 1.5 };
      const p1 = { x: p.x, y: p.y };
      this.drawPolyline([p0, p1], this.pal(p.colorIndex), 2.2, p.life);
    }

    if (scene.alien) {
      this.drawCurveSegments(assets.alienShape.hullCurves, scene.alien, this.pal(scene.alien.colorIndex), 2.2, 0.95);
      this.drawCurveSegments(assets.alienShape.domeCurves, scene.alien, this.pal((scene.alien.colorIndex + 3) % 16), 1.6, 0.9);
    }

    if (scene.ship.alive) {
      const ship = scene.ship;
      const alpha = ship.invuln > 0 ? (0.45 + 0.45 * Math.sin(nowSec * 20)) : 1.0;
      this.drawCurveSegments(assets.shipShape.hullCurves, ship, this.pal(ship.colorIndex), 2.4, alpha);

      const thrust = Math.hypot(ship.vx, ship.vy);
      if (scene.shipThrustVisual && thrust > 0.18) {
        const flameObj = { x: ship.x, y: ship.y, rot: ship.rot + (Math.random() - 0.5) * 0.1 };
        this.drawCurveSegments(assets.shipShape.flameCurves, flameObj, this.pal((ship.colorIndex + 10) % 16), lerp(1.2, 2.4, Math.min(thrust / 4, 1)), 0.8);
      }
    }

    if (this.bloomEnabled && scene.ship.alive && !scene.gameOver.active) {
      const ship = scene.ship;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const wash = ctx.createRadialGradient(ship.x, ship.y, 0, ship.x, ship.y, 220);
      wash.addColorStop(0, 'rgba(100,200,255,0.03)');
      wash.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wash;
      ctx.fillRect(ship.x - 220, ship.y - 220, 440, 440);
      ctx.restore();
    }

    if (scene.gameOver.active) this.drawGameOver(scene.gameOver, assets.gameOverText);
  }

  drawGameOver(gameOver, textModel) {
    const t = gameOver.t;
    const appear = Math.min(1, t / 0.9);
    const merge = clamp((t - 2.2) / 1.3, 0, 1);

    const startX = this.width * 0.5, startY = this.height * 0.28;
    const endX = this.width * 0.5, endY = this.height * 0.5;
    const x = lerp(startX, endX, merge);
    const y = lerp(startY, endY, merge);
    const scale = lerp(4.8, 2.0, appear);
    const scale2 = lerp(scale, 1.25, merge);
    const wobble = Math.sin(t * 4.0) * (1 - merge) * 6;

    const shiftedPaths = textModel.paths.map(path => path.map(p => ({
      x: (p.x - textModel.width * 0.5) * scale2 + x,
      y: (p.y - textModel.height * 0.5) * scale2 + y + wobble
    })));
    for (const path of shiftedPaths) this.drawPolyline(path, this.pal(6), 1.6 * scale2, 0.95);

    if (t > 0.9 && merge < 1) {
      const line = [{ x: this.width * 0.5 - 120, y: this.height * 0.64 }, { x: this.width * 0.5 + 120, y: this.height * 0.64 }];
      this.drawPolyline(line, this.pal(10), 1.2, (1 - merge) * 0.65);
    }
  }
}