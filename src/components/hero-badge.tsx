import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

const SIZE = 132;
// Outer → inner rings, sampled from the reference screenshot.
const RINGS = [
  { scale: 1, color: '#744C47', pulse: 0.07 },
  { scale: 0.76, color: '#9C5950', pulse: 0.05 },
  { scale: 0.54, color: '#B96256', pulse: 0.03 },
  { scale: 0.36, color: '#C36658', pulse: 0 },
];

function octagonPoints(size: number, inset: number): string {
  const c = size / 2;
  const r = c - inset;
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI / 8) * (2 * i + 1) + 0.18; // slight tilt
    return `${c + r * Math.cos(angle)},${c + r * Math.sin(angle)}`;
  }).join(' ');
}

const POINTS = octagonPoints(SIZE, 6);

/** Concentric octagons that slowly "breathe" — the empty-state hero on Today. */
export function HeroBadge() {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.container} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {RINGS.map((ring) => {
        const scale = pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [ring.scale, ring.scale * (1 + ring.pulse)],
        });
        return (
          <Animated.View key={ring.color} style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
            <Svg width={SIZE} height={SIZE}>
              <Polygon points={POINTS} fill={ring.color} stroke={ring.color} strokeWidth={10} strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        );
      })}
      <Text style={styles.glyph}>h.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: '#1B1416',
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
});
