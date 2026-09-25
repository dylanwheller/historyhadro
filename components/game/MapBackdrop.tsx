import React, { useMemo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

type Props = { worldId: number; width: number; height: number; accent: string };
type Dim = Pick<Props, 'width' | 'height'>;

const GOLD = '#eab308';

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Dust motes drifting in the "parchment" air.
function Dust({ worldId, width, height }: Props) {
  const dots = useMemo(() => {
    const r = rng(worldId + 3);
    return Array.from({ length: 34 }, () => ({ x: r() * width, y: r() * height, r: 0.8 + r() * 1.6, o: 0.15 + r() * 0.3 }));
  }, [worldId, width, height]);
  return (
    <G>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#fde68a" opacity={d.o} />
      ))}
    </G>
  );
}

function wave(w: number, y: number, amp: number, len: number) {
  let d = `M 0 ${y}`;
  for (let x = 0; x < w; x += len) d += ` q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0`;
  return d;
}

// World 1 — Ancient Civilisations: a desert sun, pyramids and a column.
function Ancient({ width: w, height: h }: Dim) {
  return (
    <G>
      <Circle cx={w * 0.12} cy={h * 0.1} r={w * 0.3} fill="url(#glow)" />
      <Circle cx={w * 0.12} cy={h * 0.1} r={w * 0.09} fill="#fde68a" />
      <Polygon points={`${w * 0.78},${h} ${w * 0.9},${h * 0.83} ${w * 1.02},${h}`} fill="#a16207" />
      <Polygon points={`${w * 0.9},${h * 0.83} ${w * 1.02},${h} ${w * 0.93},${h}`} fill="#854d0e" />
      <Polygon points={`${w * 0.66},${h} ${w * 0.73},${h * 0.9} ${w * 0.8},${h}`} fill="#ca8a04" opacity={0.85} />
      <Rect x={w * 0.03} y={h * 0.52} width={w * 0.06} height={h * 0.1} fill="#d6b56a" />
      <Rect x={w * 0.02} y={h * 0.5} width={w * 0.08} height={h * 0.014} fill="#e7cf8f" />
      <Rect x={w * 0.02} y={h * 0.615} width={w * 0.08} height={h * 0.014} fill="#e7cf8f" />
      <Path d={`M ${w * 0.9} ${h * 0.34} l 6 6 l 6 -6 l 6 6 M ${w * 0.9} ${h * 0.4} h 24`} stroke={GOLD} strokeWidth={2} fill="none" opacity={0.5} />
    </G>
  );
}

// World 2 — The Middle Ages: a castle, banners and a shield.
function Medieval({ width: w, height: h }: Dim) {
  const cx = w * 0.82;
  const top = h * 0.07;
  const crenels = (x: number, y: number, n: number, cw: number) =>
    Array.from({ length: n }, (_, i) => <Rect key={`${x}${i}`} x={x + i * cw * 2} y={y - cw} width={cw} height={cw} fill="#57534e" />);
  return (
    <G>
      <Circle cx={w * 0.12} cy={h * 0.1} r={w * 0.06} fill="#fef3c7" opacity={0.85} />
      <Rect x={cx - w * 0.14} y={top + h * 0.05} width={w * 0.28} height={h * 0.09} fill="#57534e" />
      {crenels(cx - w * 0.14, top + h * 0.05, 5, w * 0.028)}
      <Rect x={cx - w * 0.17} y={top} width={w * 0.06} height={h * 0.14} fill="#44403c" />
      <Rect x={cx + w * 0.11} y={top} width={w * 0.06} height={h * 0.14} fill="#44403c" />
      {crenels(cx - w * 0.17, top, 2, w * 0.02)}
      {crenels(cx + w * 0.11, top, 2, w * 0.02)}
      <Path d={`M ${cx - w * 0.02} ${top + h * 0.14} v -${h * 0.04} a ${w * 0.02} ${w * 0.02} 0 0 1 ${w * 0.04} 0 v ${h * 0.04} z`} fill="#1c1917" />
      <Path d={`M ${cx + w * 0.14} ${top} v -${h * 0.04} l ${w * 0.06} ${h * 0.01} l -${w * 0.06} ${h * 0.015}`} fill="#dc2626" />
      <Path d={`M ${w * 0.05} ${h * 0.56} h ${w * 0.1} v ${h * 0.05} q 0 ${h * 0.05} -${w * 0.05} ${h * 0.07} q -${w * 0.05} -${h * 0.02} -${w * 0.05} -${h * 0.07} z`} fill="#b91c1c" stroke="#fde68a" strokeWidth={2} />
      <Path d={`M ${w * 0.1} ${h * 0.57} v ${h * 0.09} M ${w * 0.055} ${h * 0.61} h ${w * 0.09}`} stroke="#fde68a" strokeWidth={2} />
      <Polygon points={`0,${h} ${w * 0.08},${h * 0.9} ${w * 0.18},${h}`} fill="#292524" opacity={0.8} />
    </G>
  );
}

// World 3 — Exploration & Empire: a sailing ship, waves and a compass.
function Exploration({ width: w, height: h }: Dim) {
  return (
    <G>
      {[0.2, 0.42, 0.7, 0.92].map((y, i) => (
        <Path key={i} d={wave(w, h * y, 6, 46)} stroke="#38bdf8" strokeWidth={2.5} fill="none" opacity={0.2 + (i % 2) * 0.1} />
      ))}
      <Path d={`M ${w * 0.7} ${h * 0.15} h ${w * 0.22} l -${w * 0.03} ${h * 0.03} h -${w * 0.16} z`} fill="#78350f" />
      <Rect x={w * 0.8} y={h * 0.03} width={2.5} height={h * 0.12} fill="#e5e7eb" />
      <Polygon points={`${w * 0.8},${h * 0.04} ${w * 0.8},${h * 0.13} ${w * 0.72},${h * 0.13}`} fill="#fef3c7" />
      <Polygon points={`${w * 0.81},${h * 0.05} ${w * 0.81},${h * 0.13} ${w * 0.89},${h * 0.13}`} fill="#fde68a" />
      <Circle cx={w * 0.09} cy={h * 0.3} r={w * 0.08} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.7} />
      <Polygon points={`${w * 0.09},${h * 0.3 - w * 0.1} ${w * 0.09 + 6},${h * 0.3} ${w * 0.09},${h * 0.3 + w * 0.1} ${w * 0.09 - 6},${h * 0.3}`} fill={GOLD} opacity={0.75} />
      <Polygon points={`${w * 0.09 - w * 0.1},${h * 0.3} ${w * 0.09},${h * 0.3 + 6} ${w * 0.09 + w * 0.1},${h * 0.3} ${w * 0.09},${h * 0.3 - 6}`} fill="#fde68a" opacity={0.55} />
      <Path d={`M ${w * 0.95} ${h * 0.86} l -8 -14 l 16 0 z`} fill="#dc2626" opacity={0.8} />
    </G>
  );
}

// World 4 — The Modern World: gears and factory chimneys.
function Modern({ width: w, height: h }: Dim) {
  const gear = (cx: number, cy: number, r: number, key: string) => (
    <G key={key} opacity={0.5}>
      <Circle cx={cx} cy={cy} r={r} fill="#a16207" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <Rect key={i} x={cx + Math.cos(a) * r - 5} y={cy + Math.sin(a) * r - 5} width={10} height={10} fill="#a16207" />;
      })}
      <Circle cx={cx} cy={cy} r={r * 0.4} fill="#1a1300" />
    </G>
  );
  return (
    <G>
      {gear(w * 0.1, h * 0.1, w * 0.09, 'a')}
      {gear(w * 0.9, h * 0.1, w * 0.07, 'b')}
      <Rect x={0} y={h * 0.9} width={w * 0.24} height={h * 0.1} fill="#292524" />
      <Rect x={w * 0.03} y={h * 0.78} width={w * 0.035} height={h * 0.12} fill="#44403c" />
      <Rect x={w * 0.1} y={h * 0.82} width={w * 0.035} height={h * 0.08} fill="#44403c" />
      <Ellipse cx={w * 0.05} cy={h * 0.75} rx={w * 0.04} ry={h * 0.02} fill="#a8a29e" opacity={0.5} />
      <Ellipse cx={w * 0.09} cy={h * 0.7} rx={w * 0.05} ry={h * 0.024} fill="#a8a29e" opacity={0.35} />
      <Rect x={w * 0.8} y={h * 0.9} width={w * 0.2} height={h * 0.1} fill="#292524" />
      <Rect x={w * 0.86} y={h * 0.8} width={w * 0.035} height={h * 0.1} fill="#44403c" />
      <Ellipse cx={w * 0.88} cy={h * 0.77} rx={w * 0.04} ry={h * 0.02} fill="#a8a29e" opacity={0.45} />
      <Path d={`M ${w * 0.93} ${h * 0.5} v ${h * 0.06} M ${w * 0.9} ${h * 0.53} h ${w * 0.06}`} stroke={GOLD} strokeWidth={3} opacity={0.5} />
    </G>
  );
}

export default function MapBackdrop({ worldId, width, height, accent }: Props) {
  const Scene = worldId === 2 ? Medieval : worldId === 3 ? Exploration : worldId === 4 ? Modern : Ancient;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0d0a00" />
          <Stop offset="0.6" stopColor="#1a1300" />
          <Stop offset="1" stopColor={accent} stopOpacity={0.35} />
        </LinearGradient>
        <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#facc15" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#facc15" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
      <Dust worldId={worldId} width={width} height={height} accent={accent} />
      <Scene width={width} height={height} />
    </Svg>
  );
}
