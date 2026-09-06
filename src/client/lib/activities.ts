export const ACTIVITIES = [
  { value: 'rest', label: 'Repos' },
  { value: 'work', label: 'Travail' },
  { value: 'transport', label: 'Transport' },
  { value: 'leisure', label: 'Loisir' },
  { value: 'creative', label: 'Activité créative' },
  { value: 'sport', label: 'Sport' },
  { value: 'other', label: 'Autre' },
] as const;

export type Activity = (typeof ACTIVITIES)[number]['value'];

const ACTIVITY_VALUES = new Set<string>(ACTIVITIES.map((item) => item.value));

export function isActivity(value: string): value is Activity {
  return ACTIVITY_VALUES.has(value);
}
