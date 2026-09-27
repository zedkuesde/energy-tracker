CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  time_hhmm TEXT NOT NULL CHECK (time_hhmm GLOB '[0-2][0-9]:[0-5][0-9]'),
  last_sent_on TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_push_subscriptions_endpoint
ON push_subscriptions (endpoint);

CREATE INDEX idx_push_subscriptions_user_id
ON push_subscriptions (user_id);

CREATE INDEX idx_notification_preferences_enabled
ON notification_preferences (enabled);
