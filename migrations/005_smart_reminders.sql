-- Rappels intelligents V2 : toggles, pending relance basse énergie, suivi absence.
-- Colonnes ajoutées avec DEFAULT pour les lignes notification_preferences existantes.

ALTER TABLE notification_preferences
ADD COLUMN low_energy_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (low_energy_enabled IN (0, 1));

ALTER TABLE notification_preferences
ADD COLUMN absence_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (absence_enabled IN (0, 1));

ALTER TABLE notification_preferences
ADD COLUMN pending_low_energy_fire_at TEXT;

ALTER TABLE notification_preferences
ADD COLUMN pending_low_energy_entry_id TEXT;

ALTER TABLE notification_preferences
ADD COLUMN absence_last_sent_on TEXT;
