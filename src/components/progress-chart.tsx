import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

const HEIGHT = 150;
const PAD = { top: 12, right: 44, bottom: 22, left: 8 };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Smallest "nice" number ≥ value whose half is also a clean tick (1, 2, 4, 5, 6, 8, 10 × 10ⁿ). */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 5, 6, 8, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

interface Props {
  values: number[];
  /** ISO week-start dates, one per value — used for month labels. */
  weekStarts: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatTick: (value: number) => string;
  color?: string;
}

/**
 * Strava-style weekly line chart: one dot per week, a soft area wash, and tap/drag to
 * select a week (the screen shows that week's totals).
 */
export function ProgressChart({ values, weekStarts, selectedIndex, onSelect, formatTick, color = Colors.chart }: Props) {
  const [width, setWidth] = useState(0);
  const max = niceMax(Math.max(...values));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = values.length > 1 ? plotW / (values.length - 1) : 0;
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + plotH * (1 - v / max);

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const pick = (e: GestureResponderEvent) => {
    if (!step) return;
    const index = Math.min(values.length - 1, Math.max(0, Math.round((e.nativeEvent.locationX - PAD.left) / step)));
    if (index !== selectedIndex) {
      haptics.selection();
      onSelect(index);
    }
  };

  // Label the first week of each month, like Strava's month markers.
  const monthStarts = weekStarts
    .map((iso, i) => ({ i, month: Number(iso.slice(5, 7)) - 1 }))
    .filter(({ i, month }) => i === 0 || month !== Number(weekStarts[i - 1].slice(5, 7)) - 1);
  // Drop the leading partial month if the next label would crowd it.
  const monthLabels = monthStarts.length > 1 && monthStarts[1].i < 3 ? monthStarts.slice(1) : monthStarts;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
      onResponderTerminationRequest={() => true}
      accessibilityRole="adjustable"
      accessibilityLabel="Weekly progress chart"
      accessibilityValue={{ text: `Week ${selectedIndex + 1} of ${values.length}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const delta = e.nativeEvent.actionName === 'increment' ? 1 : -1;
        onSelect(Math.min(values.length - 1, Math.max(0, selectedIndex + delta)));
      }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT} pointerEvents="none">
          <Defs>
            <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke={Colors.separator}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          ))}

          <Line
            x1={x(selectedIndex)}
            x2={x(selectedIndex)}
            y1={PAD.top}
            y2={y(0)}
            stroke={Colors.textSubtle}
            strokeWidth={1}
          />

          <Path d={area} fill="url(#wash)" />
          <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

          {values.map((v, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={i === selectedIndex ? 6 : 4}
              fill={i === selectedIndex ? Colors.text : color}
              stroke={Colors.background}
              strokeWidth={2}
            />
          ))}
        </Svg>
      )}

      {width > 0 &&
        [0.5, 1].map((f) => (
          <Text key={f} style={[styles.tick, { top: y(max * f) - 8, left: PAD.left + plotW + 6 }]}>
            {formatTick(max * f)}
          </Text>
        ))}
      {width > 0 &&
        monthLabels.map(({ i, month }) => (
          <Text key={i} style={[styles.month, { left: Math.min(x(i), PAD.left + plotW - 24) }]}>
            {MONTHS[month]}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
  },
  tick: {
    position: 'absolute',
    color: Colors.textSubtle,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  month: {
    position: 'absolute',
    bottom: 0,
    color: Colors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
