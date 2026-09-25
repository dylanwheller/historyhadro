import type { ImageSourcePropType } from 'react-native';

// Node positions are stored as fractions (0–1) of the map's width/height so the
// same layout works at any screen size — and so a hand-made map image can be
// dropped in later just by editing these numbers.
export type Pt = { x: number; y: number };

export type MapDef = {
  // height / width of the map area.
  aspect: number;
  // Index 0–4 are levels 1–5; index 5 is the boss.
  points: Pt[];
  // Optional painted background. When absent the code-drawn backdrop is used.
  image?: ImageSourcePropType;
};

const ASPECT = 1.6;

const P1: Pt[] = [
  { x: 0.2, y: 0.88 }, { x: 0.64, y: 0.78 }, { x: 0.3, y: 0.62 },
  { x: 0.72, y: 0.48 }, { x: 0.34, y: 0.33 }, { x: 0.64, y: 0.14 },
];
const P2: Pt[] = P1.map(({ x, y }) => ({ x: 1 - x, y }));
const P3: Pt[] = [
  { x: 0.78, y: 0.88 }, { x: 0.36, y: 0.76 }, { x: 0.7, y: 0.62 },
  { x: 0.26, y: 0.48 }, { x: 0.66, y: 0.33 }, { x: 0.36, y: 0.14 },
];
const P4: Pt[] = [
  { x: 0.5, y: 0.89 }, { x: 0.22, y: 0.74 }, { x: 0.72, y: 0.62 },
  { x: 0.3, y: 0.47 }, { x: 0.74, y: 0.33 }, { x: 0.5, y: 0.14 },
];

export const WORLD_MAPS: Record<number, MapDef> = {
  1: { aspect: ASPECT, points: P1 },
  2: { aspect: ASPECT, points: P2 },
  3: { aspect: ASPECT, points: P3 },
  4: { aspect: ASPECT, points: P4 },
};

export function getMapDef(worldId: number): MapDef {
  return WORLD_MAPS[worldId] ?? WORLD_MAPS[1];
}

export type Bezier = { p0: Pt; c1: Pt; c2: Pt; p1: Pt };

// Catmull-Rom through the nodes, converted to one cubic Bézier per hop.
export function buildSegments(points: Pt[], w: number, h: number): Bezier[] {
  const P = points.map((p) => ({ x: p.x * w, y: p.y * h }));
  const out: Bezier[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i];
    const p1 = P[i + 1];
    const prev = P[i - 1] ?? p0;
    const next = P[i + 2] ?? p1;
    out.push({
      p0,
      p1,
      c1: { x: p0.x + (p1.x - prev.x) / 6, y: p0.y + (p1.y - prev.y) / 6 },
      c2: { x: p1.x - (next.x - p0.x) / 6, y: p1.y - (next.y - p0.y) / 6 },
    });
  }
  return out;
}

export function segmentPath(s: Bezier): string {
  return `M ${s.p0.x} ${s.p0.y} C ${s.c1.x} ${s.c1.y} ${s.c2.x} ${s.c2.y} ${s.p1.x} ${s.p1.y}`;
}

export const SAMPLES = 24;

// Flat lookup tables so the avatar can follow the curve on the UI thread.
// Index = segment * (SAMPLES + 1) + step.
export function sampleSegments(segments: Bezier[]): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of segments) {
    for (let k = 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES;
      const u = 1 - t;
      xs.push(u * u * u * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p1.x);
      ys.push(u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p1.y);
    }
  }
  return { xs, ys };
}
