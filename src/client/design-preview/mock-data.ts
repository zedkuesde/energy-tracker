export type MockEntry = {
  date: string;
  time: string;
  energy: number;
  fatigue: number;
  desire: number | null;
  activity: string | null;
  context: string | null;
};

export const MOCK_ENTRIES: MockEntry[] = [
  {
    date: 'Dimanche 6 septembre',
    time: '18:40',
    energy: 7,
    fatigue: 4,
    desire: 6,
    activity: 'Loisir',
    context: 'Après une marche, lumière encore douce.',
  },
  {
    date: 'Dimanche 6 septembre',
    time: '12:10',
    energy: 5,
    fatigue: 6,
    desire: null,
    activity: 'Repos',
    context: null,
  },
  {
    date: 'Samedi 5 septembre',
    time: '21:15',
    energy: 4,
    fatigue: 7,
    desire: 3,
    activity: 'Loisir',
    context: 'Fin de soirée calme.',
  },
  {
    date: 'Samedi 5 septembre',
    time: '09:05',
    energy: 8,
    fatigue: 2,
    desire: 7,
    activity: 'Travail',
    context: 'Début de journée, près de la fenêtre.',
  },
];

export const MOCK_ACTIVITIES = [
  'Repos',
  'Travail',
  'Transport',
  'Loisir',
  'Activité créative',
  'Sport',
  'Autre',
] as const;

export type MockActivity = (typeof MOCK_ACTIVITIES)[number];

export const MOCK_SAISIE = {
  energy: 7,
  fatigue: 4,
  desire: 6,
  activity: 'Loisir' as MockActivity,
  context: 'Fin d’après-midi, un peu d’air dehors.',
} as const;

export type ChartRange = 7 | 30 | 90;

export type MockChart = {
  energy: string;
  fatigue: string;
  desire: string;
  tooltip: {
    x: number;
    y: number;
    when: string;
    energy: number;
    fatigue: number;
    desire: number;
  };
};

export const MOCK_CHARTS: Record<ChartRange, MockChart> = {
  7: {
    energy: '40,76 84,62 128,90 172,48 216,76 260,62 304,62',
    fatigue: '40,90 84,104 128,76 172,118 216,90 260,104 304,104',
    desire: '84,76 128,90 172,62 260,76 304,76',
    tooltip: {
      x: 172,
      y: 48,
      when: 'Samedi 21:15',
      energy: 8,
      fatigue: 3,
      desire: 7,
    },
  },
  30: {
    energy:
      '40,90 70,76 100,84 130,62 160,70 190,48 220,76 250,58 280,66 304,54',
    fatigue:
      '40,104 70,96 100,110 130,90 160,104 190,118 220,96 250,108 280,90 304,100',
    desire: '70,84 130,76 190,62 250,80 304,70',
    tooltip: {
      x: 190,
      y: 48,
      when: 'Mardi 09:40',
      energy: 8,
      fatigue: 3,
      desire: 7,
    },
  },
  90: {
    energy:
      '40,96 68,84 96,90 124,70 152,78 180,62 208,74 236,58 264,66 292,60 304,52',
    fatigue:
      '40,110 68,100 96,114 124,96 152,108 180,92 208,104 236,118 264,98 292,106 304,100',
    desire: '68,90 124,80 180,76 236,70 292,78',
    tooltip: {
      x: 236,
      y: 58,
      when: '12 août · 18:20',
      energy: 8,
      fatigue: 2,
      desire: 6,
    },
  },
};
