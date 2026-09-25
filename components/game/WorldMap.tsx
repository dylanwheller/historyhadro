import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfettiBurst from '@/components/game/ConfettiBurst';
import MapBackdrop from '@/components/game/MapBackdrop';
import { SAMPLES, buildSegments, getMapDef, sampleSegments, segmentPath } from '@/lib/mapLayout';

// Flip on to number the nodes and print their coordinates while tuning a layout.
const DEBUG_NODES = false;

const LEVEL_COUNT = 5;
const BOSS_INDEX = LEVEL_COUNT;
const NODE_R = 24;
const BOSS_R = 32;
const AVATAR = 46;
const HOP_MS = 700;

type Props = {
  worldId: number;
  accent: string;
  avatarSource: ImageSourcePropType;
  levelStars: (levelId: number) => number;
  levelUnlocked: (levelId: number) => boolean;
  allLevelsComplete: boolean;
  bossDefeated: boolean;
  bossLocked: boolean;
  onLevel: (levelId: number) => void;
  onBoss: () => void;
  // AsyncStorage key remembering which node the avatar last stood on.
  storageKey: string;
};

function CurrentPulse({ size, color }: { size: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 0.7 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export default function WorldMap({
  worldId,
  accent,
  avatarSource,
  levelStars,
  levelUnlocked,
  allLevelsComplete,
  bossDefeated,
  bossLocked,
  onLevel,
  onBoss,
  storageKey,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );
  const def = getMapDef(worldId);
  const width = Math.min(screenW - 32, 520);
  const height = Math.round(width * def.aspect);

  const segments = useMemo(() => buildSegments(def.points, width, height), [def, width, height]);
  const tables = useMemo(() => sampleSegments(segments), [segments]);
  const nodes = useMemo(() => def.points.map((p) => ({ x: p.x * width, y: p.y * height })), [def, width, height]);

  // The node the player is "at": their first unfinished level, or the boss.
  const currentIndex = useMemo(() => {
    for (let l = 1; l <= LEVEL_COUNT; l++) {
      if (levelStars(l) === 0) return levelUnlocked(l) ? l - 1 : Math.max(0, l - 2);
    }
    return BOSS_INDEX;
  }, [levelStars, levelUnlocked]);

  // ── Avatar movement ────────────────────────────────────────────────────────
  // `pos` is a fractional node index (0–5); the avatar follows the Bézier path.
  const pos = useSharedValue(0);
  const shown = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [burst, setBurst] = useState({ key: 0, at: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const persist = (idx: number) => {
    AsyncStorage.setItem(storageKey, String(idx)).catch(() => {});
  };

  const walk = (from: number, to: number) => {
    shown.current = to;
    const steps: number[] = [];
    const dir = to > from ? 1 : -1;
    for (let i = from + dir; dir > 0 ? i <= to : i >= to; i += dir) steps.push(i);
    pos.value = from;
    pos.value = withSequence(
      ...steps.map((s) => withTiming(s, { duration: HOP_MS, easing: Easing.inOut(Easing.quad) })),
    );
    persist(to);
    if (dir > 0) {
      timers.current.push(
        setTimeout(() => setBurst((b) => ({ key: b.key + 1, at: to })), steps.length * HOP_MS),
      );
    }
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // First mount: restore where the avatar last stood so it can walk to the new spot.
  useEffect(() => {
    let alive = true;
    (async () => {
      let stored: number | null = null;
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw !== null) {
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) stored = Math.max(0, Math.min(BOSS_INDEX, n));
        }
      } catch { /* ignore */ }
      if (!alive) return;
      const from = stored !== null && stored <= currentIndex ? stored : currentIndex;
      shown.current = from;
      pos.value = from;
      if (from !== stored) persist(from);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Walk whenever the screen is visible and the avatar isn't yet on the current node
  // (e.g. right after coming back from finishing a level).
  useEffect(() => {
    if (!ready || !isFocused) return;
    const from = shown.current;
    if (from === null || from === currentIndex) return;
    const t = setTimeout(() => walk(from, currentIndex), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isFocused, currentIndex]);

  const xs = tables.xs;
  const ys = tables.ys;
  const lastSeg = segments.length - 1;

  const avatarStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(pos.value, lastSeg + 1));
    const seg = Math.min(Math.floor(p), lastSeg);
    const f = (p - seg) * SAMPLES;
    const k = Math.min(Math.floor(f), SAMPLES - 1);
    const frac = f - k;
    const i0 = seg * (SAMPLES + 1) + k;
    const x = xs[i0] + (xs[i0 + 1] - xs[i0]) * frac;
    const y = ys[i0] + (ys[i0 + 1] - ys[i0]) * frac;
    // A little hop between nodes: zero while standing on a node, peaks mid-way.
    const hop = -Math.sin((p % 1) * Math.PI) * 12;
    return {
      transform: [{ translateX: x - AVATAR / 2 }, { translateY: y - NODE_R - AVATAR / 2 - 6 + hop }],
    };
  });

  return (
    <View style={{ width, height, alignSelf: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: '#03060f' }}>
      {def.image ? (
        <Image source={def.image} style={{ width, height }} resizeMode="cover" />
      ) : (
        <MapBackdrop worldId={worldId} width={width} height={height} accent={accent} />
      )}

      {/* Trail: dashed ahead of the player, solid and glowing behind them. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {segments.map((s, i) => {
          const done = i < currentIndex;
          const d = segmentPath(s);
          return done ? (
            <React.Fragment key={i}>
              <Path d={d} stroke={accent} strokeWidth={14} strokeOpacity={0.25} strokeLinecap="round" fill="none" />
              <Path d={d} stroke={accent} strokeWidth={5} strokeLinecap="round" fill="none" />
            </React.Fragment>
          ) : (
            <Path
              key={i}
              d={d}
              stroke="#ffffff"
              strokeOpacity={0.35}
              strokeWidth={4}
              strokeDasharray="2 9"
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
      </Svg>

      {/* Nodes */}
      {nodes.map((n, i) => {
        const isBoss = i === BOSS_INDEX;
        const r = isBoss ? BOSS_R : NODE_R;
        const levelId = i + 1;
        const stars = isBoss ? 0 : levelStars(levelId);
        const complete = isBoss ? bossDefeated : stars > 0;
        const unlocked = isBoss ? allLevelsComplete : levelUnlocked(levelId);
        const isCurrent = i === currentIndex && !complete && unlocked;

        const bg = complete ? accent : isCurrent ? '#ffffff' : '#1f2937';
        const border = complete ? '#ffffff' : isCurrent ? accent : '#4b5563';
        const label = isBoss
          ? bossDefeated ? '✓' : unlocked ? '⚔️' : '🔒'
          : unlocked ? String(levelId) : '🔒';
        const labelColor = complete ? '#ffffff' : isCurrent ? accent : '#9ca3af';

        return (
          <View
            key={i}
            style={{ position: 'absolute', left: n.x - r, top: n.y - r, width: r * 2, height: r * 2, alignItems: 'center', justifyContent: 'center' }}
          >
            {isCurrent && <CurrentPulse size={r * 2} color={accent} />}
            <TouchableOpacity
              activeOpacity={unlocked ? 0.75 : 1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => (isBoss ? onBoss() : onLevel(levelId))}
              style={{
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: bg,
                borderWidth: 3,
                borderColor: border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: unlocked ? 1 : 0.75,
              }}
            >
              <Text style={{ color: labelColor, fontWeight: '800', fontSize: isBoss ? 22 : 18 }}>{label}</Text>
            </TouchableOpacity>

            {!isBoss && complete && (
              <Text
                pointerEvents="none"
                style={{ position: 'absolute', top: r * 2 + 1, fontSize: 12, letterSpacing: 1, color: '#fbbf24' }}
              >
                {'★'.repeat(stars)}
                <Text style={{ color: '#6b7280' }}>{'★'.repeat(3 - stars)}</Text>
              </Text>
            )}
            {isBoss && bossLocked && (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: r * 2 + 2, alignSelf: 'center', backgroundColor: '#7c3aed', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 84, alignItems: 'center' }}
              >
                <Text numberOfLines={1} style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>★ Premium</Text>
              </View>
            )}
            {DEBUG_NODES && (
              <Text pointerEvents="none" style={{ position: 'absolute', top: r * 2 + 2, color: '#fff', fontSize: 9 }}>
                {`${i}: ${(n.x / width).toFixed(2)},${(n.y / height).toFixed(2)}`}
              </Text>
            )}
          </View>
        );
      })}

      {/* Celebration where the avatar just arrived */}
      {burst.key > 0 && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: nodes[burst.at].x - 20, top: nodes[burst.at].y - 20, width: 40, height: 40 }}
        >
          <ConfettiBurst burstKey={burst.key} count={22} />
        </View>
      )}

      {/* The player */}
      {ready && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: AVATAR,
              height: AVATAR,
              borderRadius: AVATAR / 2,
              borderWidth: 3,
              borderColor: '#ffffff',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 4,
              elevation: 6,
            },
            avatarStyle,
          ]}
        >
          <Image source={avatarSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </Animated.View>
      )}
    </View>
  );
}
