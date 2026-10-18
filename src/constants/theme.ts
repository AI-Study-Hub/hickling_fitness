/**
 * Design tokens. The app is dark-only, modelled on Runna's dark UI.
 * Colours were sampled from reference screenshots — keep new UI on these tokens
 * rather than hard-coding hex values in components.
 */

export const Colors = {
  // Surfaces
  background: '#141518',
  backgroundAlt: '#181B21',
  header: '#252A34',
  surface: '#252A34',
  surfacePressed: '#2E3440',
  surfaceBorder: '#3A404C',
  separator: '#3E434C',
  tabBar: '#141414',
  /** Rows of weeks that have already finished, like Runna's tinted past weeks. */
  pastWeek: '#1D2129',

  // Text
  text: '#ECEEF6',
  textMuted: '#9FA5B7',
  textSubtle: '#6E7A8F',
  textOnLight: '#14161B',

  // Accents
  light: '#E4EAF1',
  accent: '#2DD4B0',
  brand: '#C8675A',
  /** Progress chart line — Strava-style orange. */
  chart: '#FC5A1E',
  danger: '#F2555A',
  marker: '#8E9296',
  handle: '#4A5566',
  tabActive: '#EFF1F5',
  tabInactive: '#6C7B8F',
} as const;

/** Background gradient behind the Today screen body (top → bottom). */
export const TodayGradient = ['#434041', '#2E2F32', '#1E2126', '#181B21'] as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const Type = {
  hero: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyBold: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '500' },
  caps: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
} as const;
