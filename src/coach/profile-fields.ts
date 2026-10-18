/**
 * The athlete details the coach keeps between chats, as editable form fields ("Your details" screen).
 * Shared by the app only, but kept free of React Native so it can be unit-tested.
 */
import type { AthleteProfile, AthleteProfilePatch } from './contract';

export type ProfileKey = keyof AthleteProfile;

export interface ProfileField {
  key: ProfileKey;
  label: string;
  /** text = one line, long = multi-line, number = whole number, list = comma-separated, date = YYYY-MM-DD. */
  kind: 'text' | 'long' | 'number' | 'list' | 'date';
  placeholder: string;
  unit?: string;
}

export const PROFILE_FIELDS: ProfileField[] = [
  { key: 'goal', label: 'Goal', kind: 'text', placeholder: 'e.g. Hyrox Open, sub-1:20' },
  { key: 'goalDate', label: 'Race date', kind: 'date', placeholder: 'YYYY-MM-DD' },
  { key: 'sports', label: 'Sports', kind: 'list', placeholder: 'e.g. run, strength, hyrox' },
  { key: 'age', label: 'Age', kind: 'number', placeholder: '–' },
  { key: 'experience', label: 'Experience', kind: 'long', placeholder: 'Years training, consistency, biggest weeks' },
  { key: 'currentVolume', label: 'Current training', kind: 'long', placeholder: 'Last 4–8 weeks per sport' },
  { key: 'recentResults', label: 'Recent races & tests', kind: 'long', placeholder: 'With dates' },
  { key: 'thresholdPace', label: 'Threshold pace', kind: 'text', placeholder: 'e.g. 4:10 /km' },
  { key: 'lthr', label: 'Threshold heart rate', kind: 'number', placeholder: '–', unit: 'bpm' },
  { key: 'maxHr', label: 'Max heart rate', kind: 'number', placeholder: '–', unit: 'bpm' },
  { key: 'restingHr', label: 'Resting heart rate', kind: 'number', placeholder: '–', unit: 'bpm' },
  { key: 'ftp', label: 'Bike FTP', kind: 'number', placeholder: '–', unit: 'W' },
  { key: 'css', label: 'Swim CSS', kind: 'text', placeholder: 'e.g. 1:45 /100 m' },
  { key: 'availability', label: 'Availability', kind: 'long', placeholder: 'Days, times, longest session, doubles' },
  { key: 'health', label: 'Injuries & health', kind: 'long', placeholder: 'Niggles, conditions, medication' },
  { key: 'equipment', label: 'Equipment', kind: 'long', placeholder: 'HR strap, power meter, gym, sled, rower…' },
  { key: 'preferences', label: 'Preferences', kind: 'long', placeholder: 'Pace vs heart rate vs feel, likes, dislikes' },
];

export type ProfileForm = Record<ProfileKey, string>;

/** The profile as form text, one string per field. */
export function toForm(profile: AthleteProfilePatch): ProfileForm {
  const form = {} as ProfileForm;
  for (const { key } of PROFILE_FIELDS) {
    const value = profile[key];
    form[key] = value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value);
  }
  return form;
}

/** Form text back to a profile. Empty fields are left out (forgotten); invalid ones are reported. */
export function fromForm(form: ProfileForm): { profile: AthleteProfilePatch; errors: string[] } {
  const profile: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const field of PROFILE_FIELDS) {
    const text = form[field.key]?.trim() ?? '';
    if (!text) continue;
    if (field.kind === 'number') {
      const n = Number(text);
      if (Number.isFinite(n) && n > 0) profile[field.key] = Math.round(n);
      else errors.push(`${field.label} should be a number.`);
    } else if (field.kind === 'date') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) profile[field.key] = text;
      else errors.push(`${field.label} should look like 2026-11-24.`);
    } else if (field.kind === 'list') {
      const items = text.split(',').map((s) => s.trim()).filter(Boolean);
      if (items.length) profile[field.key] = items;
    } else {
      profile[field.key] = text;
    }
  }
  return { profile: profile as AthleteProfilePatch, errors };
}

/** Labels of the details the coach has, e.g. ["Goal", "Age", "Availability"]. */
export function knownDetails(profile: AthleteProfilePatch): string[] {
  return PROFILE_FIELDS.filter(({ key }) => {
    const v = profile[key];
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).map((f) => f.label);
}
