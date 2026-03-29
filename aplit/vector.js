export const TAU = Math.PI * 2;

export function rand(a, b) { return a + Math.random() * (b - a); }
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
export function len(x, y) { return Math.hypot(x, y); }
export function mid(a, b) { return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 }; }

export function wrap(obj, width, height, pad = 120) {
  if (obj.x < -pad) obj.x = width + pad;
  if (obj.x > width + pad) obj.x = -pad;
  if (obj.y < -pad) obj.y = height + pad;
  if (obj.y > height + pad) obj.y = -pad;
}

export function pointSegDist2(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const d = abx * abx + aby * aby;
  let t = d > 0 ? (apx * abx + apy * aby) / d : 0;
  t = clamp(t, 0, 1);
  const qx = a.x + abx * t, qy = a.y + aby * t;
  const dx = p.x - qx, dy = p.y - qy;
  return dx * dx + dy * dy;
}

export function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
export function onSeg(a, b, p) {
  return Math.min(a.x, b.x) - 1e-6 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-6 &&
         Math.min(a.y, b.y) - 1e-6 <= p.y && p.y <= Math.max(a.y, b.y) + 1e-6;
}
export function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  if (Math.abs(o1) < 1e-6 && onSeg(a, b, c)) return true;
  if (Math.abs(o2) < 1e-6 && onSeg(a, b, d)) return true;
  if (Math.abs(o3) < 1e-6 && onSeg(c, d, a)) return true;
  if (Math.abs(o4) < 1e-6 && onSeg(c, d, b)) return true;
  return false;
}
export function segSegDist2(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegDist2(a, c, d),
    pointSegDist2(b, c, d),
    pointSegDist2(c, a, b),
    pointSegDist2(d, a, b)
  );
}

export function flattenQuadratic(p0, c, p1, steps = 8) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
    });
  }
  return pts;
}

export function jitteredCurveLoop(points, jitter = 0.14) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const m = mid(p0, p1);
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const bow = l * rand(-jitter, jitter);
    out.push({ p0, c: { x: m.x + nx * bow, y: m.y + ny * bow }, p1 });
  }
  return out;
}

export function buildFlatLocal(segments, steps = 7) {
  const flat = [];
  for (const seg of segments) {
    const pts = flattenQuadratic(seg.p0, seg.c, seg.p1, steps);
    for (let i = 0; i < pts.length; i++) {
      if (flat.length && i === 0) continue;
      flat.push(pts[i]);
    }
  }
  return flat;
}

export function transformPoint(px, py, obj) {
  const c = Math.cos(obj.rot || 0), s = Math.sin(obj.rot || 0);
  return { x: obj.x + px * c - py * s, y: obj.y + px * s + py * c };
}
export function transformPolyline(localPts, obj) {
  const c = Math.cos(obj.rot || 0), s = Math.sin(obj.rot || 0);
  const out = [];
  for (const p of localPts) {
    out.push({ x: obj.x + p.x * c - p.y * s, y: obj.y + p.x * s + p.y * c });
  }
  return out;
}

export function makeTextModel(text, scale = 1) {
  const chars = {
    'G': [[0,0, 24,0, 24,8, 12,8, 12,16, 24,16, 24,24, 0,24, 0,0]],
    'A': [[0,24, 10,0, 20,24], [5,14, 15,14]],
    'M': [[0,24, 0,0, 10,12, 20,0, 20,24]],
    'E': [[20,0, 0,0, 0,24, 20,24], [0,12, 14,12]],
    'O': [[0,0, 20,0, 20,24, 0,24, 0,0]],
    'V': [[0,0, 10,24, 20,0]],
    'R': [[0,24, 0,0, 14,0, 18,4, 18,8, 14,12, 0,12], [10,12, 20,24]],
    ' ': []
  };
  const paths = [];
  let xoff = 0;
  for (const ch of text) {
    const defs = chars[ch] || [];
    for (const path of defs) {
      const pts = [];
      for (let i = 0; i < path.length; i += 2) pts.push({ x: xoff + path[i] * scale, y: path[i + 1] * scale });
      paths.push(pts);
    }
    xoff += 28 * scale;
  }
  return { paths, width: Math.max(0, xoff - 8 * scale), height: 24 * scale };
}

export function makeCurvedAsteroid(cx, cy, r, colorIndex) {
  const count = Math.floor(rand(7, 12));
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const rr = r * rand(0.72, 1.26);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  const segments = jitteredCurveLoop(pts, 0.18);
  return {
    kind: 'asteroid',
    x: cx, y: cy,
    vx: rand(-0.8, 0.8), vy: rand(-0.8, 0.8),
    rot: rand(0, TAU), rotv: rand(-0.012, 0.012),
    radius: r,
    colorIndex,
    segments,
    flatLocal: buildFlatLocal(segments, 7)
  };
}

export function makeShipShape() {
  const hull = [{ x: 20, y: 0 }, { x: -10, y: -12 }, { x: -4, y: 0 }, { x: -10, y: 12 }];
  const flame = [{ x: -10, y: -6 }, { x: -22, y: 0 }, { x: -10, y: 6 }];
  const hullCurves = jitteredCurveLoop(hull, 0.10);
  return {
    hullCurves,
    flameCurves: jitteredCurveLoop(flame, 0.05),
    hullLocal: buildFlatLocal(hullCurves, 8)
  };
}

export function makeAlienShape() {
  const hull = [
    { x: -24, y: 0 }, { x: -12, y: -10 }, { x: 12, y: -10 },
    { x: 24, y: 0 }, { x: 12, y: 10 }, { x: -12, y: 10 }
  ];
  const dome = [{ x: -8, y: -4 }, { x: -2, y: -14 }, { x: 2, y: -14 }, { x: 8, y: -4 }];
  const hullCurves = jitteredCurveLoop(hull, 0.06);
  return {
    hullCurves,
    domeCurves: jitteredCurveLoop(dome, 0.04),
    hullLocal: buildFlatLocal(hullCurves, 7)
  };
}