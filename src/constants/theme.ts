/**
 * Design tokens for Intense: matte black with a cool blue cast, minimal and modern. Dark-only. Keep new UI on
 * these tokens rather than hard-coding hex values in components. Sport colours live in `src/data/sports.ts`.
 */

export const Colors = {
  // Surfaces — matte blacks with a slight blue tint
  background: '#0B0D11',
  backgroundAlt: '#101319',
  header: '#161A22',
  surface: '#161A22',
  surfacePressed: '#1E232D',
  surfaceBorder: '#272E3A',
  separator: '#232A35',
  tabBar: '#090B0E',
  /** Rows of weeks that have already finished. */
  pastWeek: '#12161D',

  // Text — cool whites and greys
  text: '#E9EDF5',
  textMuted: '#98A2B5',
  textSubtle: '#626D81',
  textOnLight: '#0B0D11',

  // Accents
  light: '#E6ECF6',
  accent: '#5AA8FF',
  /** Brand surface: the avatar, the coach badge. */
  brand: '#1F2836',
  /** Progress chart line — Strava-style orange. */
  chart: '#FC5A1E',
  danger: '#F2555A',
  marker: '#7B8597',
  handle: '#3A4454',
  tabActive: '#E9EDF5',
  tabInactive: '#5A6578',
} as const;

/** The Intense mark: concentric octagons from matte black to blue (outer → inner). */
export const BrandRings = ['#161C27', '#1F2B3E', '#2A4166', '#4A86E8'] as const;

/** Background gradient behind the Today screen body (top → bottom): a blue haze fading to matte black. */
export const TodayGradient = ['#1C2432', '#141922', '#0E1116', '#0B0D11'] as const;

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
