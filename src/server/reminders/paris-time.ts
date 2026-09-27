const PARIS = 'Europe/Paris';

export type ParisClock = {
  date: string;
  hour: number;
  minute: number;
  minutesOfDay: number;
  hhmm: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getParisClock(now: Date = new Date()): ParisClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const date = `${map.year}-${map.month}-${map.day}`;
  const hhmm = `${pad2(hour)}:${pad2(minute)}`;

  return {
    date,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    hhmm,
  };
}

export function parseHhmmToMinutes(hhmm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isReminderDue(
  reminderHhmm: string,
  clock: ParisClock,
  lastSentOn: string | null,
): boolean {
  if (lastSentOn === clock.date) {
    return false;
  }
  const target = parseHhmmToMinutes(reminderHhmm);
  if (target === null) {
    return false;
  }
  return clock.minutesOfDay >= target;
}
