const INSTANT_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const PARIS = 'Europe/Paris';

export function parseUtcInstant(value: string): Date {
  if (!INSTANT_WITH_ZONE.test(value)) {
    throw new Error(
      'Le timestamp doit être une date ISO 8601 avec fuseau explicite (Z ou offset).',
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Le timestamp est invalide.');
  }
  return date;
}

export function formatParisDateTime(value: string): string {
  const date = parseUtcInstant(value);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export function formatParisDateShort(value: string | number): string {
  const date =
    typeof value === 'number' ? new Date(value) : parseUtcInstant(value);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatParisTooltipStamp(value: string): string {
  const date = parseUtcInstant(value);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
