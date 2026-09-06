CREATE TABLE energy_entries (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  energy INTEGER NOT NULL CHECK (energy >= 0 AND energy <= 10),
  fatigue INTEGER NOT NULL CHECK (fatigue >= 0 AND fatigue <= 10),
  desire INTEGER CHECK (desire IS NULL OR (desire >= 0 AND desire <= 10)),
  context TEXT CHECK (context IS NULL OR length(context) <= 280),
  activity TEXT CHECK (
    activity IS NULL
    OR activity IN (
      'rest',
      'work',
      'transport',
      'leisure',
      'creative',
      'sport',
      'other'
    )
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_energy_entries_timestamp_id
ON energy_entries (timestamp DESC, id DESC);
