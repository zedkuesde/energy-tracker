import { useEffect, useState, type FormEvent } from 'react';
import { StatusPanel } from '../components/StatusPanel';
import {
  fetchReminders,
  ReminderRequestError,
  saveReminders,
  subscribePush,
  type ReminderSettings,
} from '../lib/api/reminders';
import {
  ensurePushSubscription,
  getPushSupport,
  notificationPermission,
  subscriptionToPayload,
} from '../lib/push-client';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function RemindersPage() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [timeHhmm, setTimeHhmm] = useState('20:00');
  const [lowEnergyEnabled, setLowEnergyEnabled] = useState(false);
  const [absenceEnabled, setAbsenceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => notificationPermission());

  const pushSupport = getPushSupport();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchReminders();
        if (cancelled) {
          return;
        }
        setSettings(data);
        setEnabled(data.enabled);
        setTimeHhmm(data.timeHhmm);
        setLowEnergyEnabled(data.lowEnergyEnabled);
        setAbsenceEnabled(data.absenceEnabled);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(
          err instanceof ReminderRequestError && err.kind === 'network'
            ? 'Impossible de charger les rappels (réseau).'
            : 'Impossible de charger les rappels.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!TIME_PATTERN.test(timeHhmm)) {
      setError('Choisis une heure au format HH:MM.');
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const data = await saveReminders({
        enabled,
        timeHhmm,
        lowEnergyEnabled,
        absenceEnabled,
      });
      setSettings(data);
      setEnabled(data.enabled);
      setTimeHhmm(data.timeHhmm);
      setLowEnergyEnabled(data.lowEnergyEnabled);
      setAbsenceEnabled(data.absenceEnabled);
      setMessage('Préférences de rappel enregistrées (Europe/Paris).');
    } catch (err) {
      setError(
        err instanceof ReminderRequestError
          ? err.message
          : 'Enregistrement impossible.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEnablePush() {
    setPushBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (!settings?.pushConfigured || !settings.vapidPublicKey) {
        setError(
          'Les notifications push ne sont pas configurées sur ce serveur.',
        );
        return;
      }
      if (!pushSupport.supported) {
        setError(
          pushSupport.reason === 'insecure'
            ? 'Les notifications push nécessitent HTTPS.'
            : 'Les notifications push ne sont pas prises en charge sur cet appareil.',
        );
        return;
      }

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setMessage(
          'Permission refusée. L’application reste utilisable sans notification.',
        );
        return;
      }

      const subscription = await ensurePushSubscription(
        settings.vapidPublicKey,
      );
      await subscribePush(subscriptionToPayload(subscription));
      const refreshed = await fetchReminders();
      setSettings(refreshed);
      setMessage('Notifications activées sur cet appareil.');
    } catch (err) {
      setError(
        err instanceof ReminderRequestError
          ? err.message
          : 'Activation des notifications impossible.',
      );
    } finally {
      setPushBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="page">
        <h1>Rappels</h1>
        <StatusPanel tone="loading">Chargement…</StatusPanel>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Rappels</h1>
      <p className="lede">
        Rappels à heure fixe et rappels intelligents (Europe/Paris). Un
        abonnement push sur un appareil est requis pour recevoir les
        notifications.
      </p>

      <form className="reminders-form" onSubmit={handleSave}>
        <label className="reminders-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
            }}
          />
          <span>Activer le rappel quotidien</span>
        </label>

        <label className="field-label" htmlFor="reminder-time">
          Heure (Europe/Paris)
        </label>
        <input
          id="reminder-time"
          className="reminders-time"
          type="time"
          required
          value={timeHhmm}
          onChange={(event) => {
            setTimeHhmm(event.target.value);
          }}
        />

        <label className="reminders-toggle">
          <input
            type="checkbox"
            checked={lowEnergyEnabled}
            onChange={(event) => {
              setLowEnergyEnabled(event.target.checked);
            }}
          />
          <span>Relance après une note basse</span>
        </label>

        <label className="reminders-toggle">
          <input
            type="checkbox"
            checked={absenceEnabled}
            onChange={(event) => {
              setAbsenceEnabled(event.target.checked);
            }}
          />
          <span>Rappel si aucune saisie à 19 h</span>
        </label>

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <div className="reminders-push">
        <h2>Notifications sur cet appareil</h2>
        <p className="lede">
          Sur iPhone, installe d’abord l’app sur l’écran d’accueil (PWA). La
          permission n’est demandée que si tu appuies ci-dessous.
        </p>
        {!settings?.pushConfigured ? (
          <StatusPanel>
            Push non configuré sur le serveur (clés VAPID absentes). Les
            réglages d’horaire restent disponibles.
          </StatusPanel>
        ) : null}
        {pushSupport.supported === false ? (
          <StatusPanel>
            {pushSupport.reason === 'insecure'
              ? 'Contexte non sécurisé : push indisponible.'
              : 'Cet appareil ne prend pas en charge les notifications push.'}
          </StatusPanel>
        ) : null}
        {permission === 'denied' ? (
          <StatusPanel>
            Permission refusée dans le navigateur. L’app reste utilisable.
          </StatusPanel>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          disabled={
            pushBusy ||
            !settings?.pushConfigured ||
            !pushSupport.supported ||
            permission === 'denied'
          }
          onClick={() => {
            void handleEnablePush();
          }}
        >
          {pushBusy
            ? 'Activation…'
            : 'Activer les notifications sur cet appareil'}
        </button>
        {settings ? (
          <p className="form-status">
            Abonnements enregistrés pour ce compte :{' '}
            {settings.subscriptionCount}
          </p>
        ) : null}
      </div>

      {message ? (
        <p className="form-status" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
