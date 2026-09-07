import { useState, type FormEvent } from 'react';
import './design-preview.css';
import {
  MOCK_ACTIVITIES,
  MOCK_CHARTS,
  MOCK_ENTRIES,
  MOCK_SAISIE,
  type ChartRange,
  type MockActivity,
  type MockEntry,
} from './mock-data';

const ATELIER_SCREENS = [
  { id: 'saisie', label: 'Saisie' },
  { id: 'historique', label: 'Historique' },
  { id: 'graphes', label: 'Graphes' },
  { id: 'connexion', label: 'Connexion' },
  { id: 'dialogues', label: 'Dialogues' },
] as const;

type AtelierScreen = (typeof ATELIER_SCREENS)[number]['id'];
type ProductScreen = 'saisie' | 'historique' | 'graphes';

function percent(value: number): string {
  return `${(value / 10) * 100}%`;
}

function BrandMark() {
  return (
    <svg
      className="dp-mark"
      viewBox="0 0 28 28"
      role="img"
      aria-label="Energy Tracker"
    >
      <path
        d="M6 22V11"
        stroke="#c49a3c"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M14 22V6"
        stroke="#6e4452"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M22 22V13"
        stroke="#6a7d6e"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutControl() {
  return (
    <button type="button" className="dp-logout" aria-label="Se déconnecter">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M11 12h9M17 8l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function PreviewHeader({ showLogout = false }: { showLogout?: boolean }) {
  return (
    <header className="dp-header">
      <BrandMark />
      {showLogout ? <LogoutControl /> : <span className="dp-header-spacer" />}
    </header>
  );
}

function MockSlider({
  label,
  optional = false,
  value,
  tone,
}: {
  label: string;
  optional?: boolean;
  value: number;
  tone: 'energy' | 'fatigue' | 'desire';
}) {
  return (
    <div className={`dp-slider dp-slider-${tone}`}>
      <div className="dp-slider-head">
        <p className="dp-slider-label">
          <span className="dp-slider-tone" aria-hidden="true" />
          {label}
          {optional ? <span className="dp-optional"> facultatif</span> : null}
        </p>
        <p className="dp-slider-value">
          <strong>{value}</strong> / 10
        </p>
      </div>
      <div className="dp-track" aria-hidden="true">
        <span className="dp-track-line" />
        <span className="dp-track-fill" style={{ width: percent(value) }} />
        <span className="dp-thumb" style={{ left: percent(value) }} />
      </div>
    </div>
  );
}

function PhoneNav({
  active,
  onChange,
}: {
  active: ProductScreen;
  onChange: (screen: ProductScreen) => void;
}) {
  const items: { id: ProductScreen; label: string }[] = [
    { id: 'saisie', label: 'Saisie' },
    { id: 'historique', label: 'Historique' },
    { id: 'graphes', label: 'Graphes' },
  ];

  return (
    <nav className="dp-nav" aria-label="Navigation de la maquette">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.id === active
              ? 'dp-nav-link dp-nav-link-active'
              : 'dp-nav-link'
          }
          onClick={() => {
            onChange(item.id);
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function ActivityPicker() {
  const [activity, setActivity] = useState<MockActivity | null>(
    MOCK_SAISIE.activity,
  );

  return (
    <div>
      <p className="dp-field-label dp-activity-label">Activité</p>
      <div className="dp-chips" role="group" aria-label="Activité">
        {MOCK_ACTIVITIES.map((item) => {
          const pressed = activity === item;
          return (
            <button
              key={item}
              type="button"
              className={pressed ? 'dp-chip dp-chip-active' : 'dp-chip'}
              aria-pressed={pressed}
              onClick={() => {
                setActivity((current) => (current === item ? null : item));
              }}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SaisieScreen({ onNav }: { onNav: (screen: ProductScreen) => void }) {
  return (
    <div className="dp-shell">
      <PreviewHeader showLogout />
      <main className="dp-main dp-main-with-nav">
        <h1 className="dp-title">Comment tu te sens maintenant ?</h1>
        <p className="dp-lede">Quelques secondes pour faire le point.</p>
        <p className="dp-demo-note">Valeurs d’exemple — démo visuelle.</p>
        <div className="dp-stack">
          <MockSlider
            label="Énergie"
            tone="energy"
            value={MOCK_SAISIE.energy}
          />
          <MockSlider
            label="Fatigue"
            tone="fatigue"
            value={MOCK_SAISIE.fatigue}
          />
          <MockSlider
            label="Envie"
            tone="desire"
            optional
            value={MOCK_SAISIE.desire}
          />
          <ActivityPicker />
          <div>
            <p className="dp-field-label">Contexte</p>
            <p className="dp-context">{MOCK_SAISIE.context}</p>
          </div>
          <button type="button" className="dp-action">
            Enregistrer
          </button>
        </div>
      </main>
      <PhoneNav active="saisie" onChange={onNav} />
    </div>
  );
}

function MomentScores({ entry }: { entry: MockEntry }) {
  const scores = [
    { tone: 'energy', value: entry.energy, label: 'Énergie' },
    { tone: 'fatigue', value: entry.fatigue, label: 'Fatigue' },
    entry.desire === null
      ? null
      : { tone: 'desire', value: entry.desire, label: 'Envie' },
  ].filter((item): item is { tone: string; value: number; label: string } =>
    Boolean(item),
  );

  return (
    <div
      className={
        scores.length === 2
          ? 'dp-moment-scores dp-moment-scores-two'
          : 'dp-moment-scores'
      }
    >
      {scores.map((score) => (
        <p
          key={score.label}
          className={`dp-moment-score dp-moment-${score.tone}`}
        >
          <span className="dp-moment-num">{score.value}</span>
          <span className="dp-moment-label">/ {score.label}</span>
        </p>
      ))}
    </div>
  );
}

function EntryPreview({ entry }: { entry: MockEntry }) {
  return (
    <article className="dp-moment">
      <p className="dp-moment-date">{entry.date}</p>
      <p className="dp-moment-time">{entry.time}</p>
      <MomentScores entry={entry} />
      {entry.activity ? (
        <p className="dp-moment-activity">{entry.activity}</p>
      ) : null}
      {entry.context ? (
        <p className="dp-moment-context">{entry.context}</p>
      ) : null}
      <div className="dp-moment-actions">
        <span className="dp-quiet-button">Modifier</span>
        <span className="dp-quiet-button">Supprimer</span>
      </div>
    </article>
  );
}

function HistoriqueScreen({
  onNav,
}: {
  onNav: (screen: ProductScreen) => void;
}) {
  return (
    <div className="dp-shell">
      <PreviewHeader showLogout />
      <main className="dp-main dp-main-with-nav">
        <h1 className="dp-title">Historique</h1>
        <p className="dp-lede">
          Tes notes, de la plus récente à la plus ancienne.
        </p>
        <p className="dp-notice" role="status">
          Entrée enregistrée.
        </p>
        {MOCK_ENTRIES.map((entry) => (
          <EntryPreview key={`${entry.date}-${entry.time}`} entry={entry} />
        ))}
        <div className="dp-empty-demo">
          <p className="dp-empty-caption">Exemple d’état vide</p>
          <p className="dp-empty-text">
            Aucune entrée pour le moment. Tu pourras revenir ici après une
            première note.
          </p>
        </div>
      </main>
      <PhoneNav active="historique" onChange={onNav} />
    </div>
  );
}

function GraphesScreen({ onNav }: { onNav: (screen: ProductScreen) => void }) {
  const [range, setRange] = useState<ChartRange>(7);
  const chart = MOCK_CHARTS[range];

  return (
    <div className="dp-shell">
      <PreviewHeader showLogout />
      <main className="dp-main dp-main-with-nav">
        <h1 className="dp-title">Graphes</h1>
        <div
          className="dp-range"
          role="radiogroup"
          aria-label="Période d’exemple"
        >
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              role="radio"
              aria-checked={range === days}
              className={
                range === days
                  ? 'dp-range-button dp-range-button-active'
                  : 'dp-range-button'
              }
              onClick={() => {
                setRange(days);
              }}
            >
              {days} jours
            </button>
          ))}
        </div>
        <div className="dp-chart">
          <svg
            viewBox="0 0 340 180"
            role="img"
            aria-label={`Exemple de graphe sur ${range} jours, énergie fatigue et envie.`}
          >
            <line
              x1="32"
              y1="20"
              x2="32"
              y2="160"
              stroke="currentColor"
              strokeOpacity="0.18"
            />
            <line
              x1="32"
              y1="160"
              x2="320"
              y2="160"
              stroke="currentColor"
              strokeOpacity="0.18"
            />
            <text x="8" y="24" fontSize="10" fill="currentColor" opacity="0.55">
              10
            </text>
            <text
              x="12"
              y="164"
              fontSize="10"
              fill="currentColor"
              opacity="0.55"
            >
              0
            </text>
            <polyline
              fill="none"
              stroke="#c49a3c"
              strokeWidth="2"
              points={chart.energy}
            />
            <polyline
              fill="none"
              stroke="#6e4452"
              strokeWidth="2"
              points={chart.fatigue}
            />
            <polyline
              fill="none"
              stroke="#6a7d6e"
              strokeWidth="2"
              strokeDasharray="4 5"
              points={chart.desire}
            />
            <circle
              cx={chart.tooltip.x}
              cy={chart.tooltip.y}
              r="4"
              fill="#c49a3c"
            />
          </svg>
        </div>
        <div className="dp-chart-detail">
          <p className="dp-chart-when">{chart.tooltip.when}</p>
          <p className="dp-chart-line">Énergie {chart.tooltip.energy} / 10</p>
          <p className="dp-chart-line">Fatigue {chart.tooltip.fatigue} / 10</p>
          <p className="dp-chart-line">Envie {chart.tooltip.desire} / 10</p>
          <ul className="dp-legend">
            <li>
              <span className="dp-swatch dp-swatch-energy" aria-hidden="true" />
              Énergie
            </li>
            <li>
              <span
                className="dp-swatch dp-swatch-fatigue"
                aria-hidden="true"
              />
              Fatigue
            </li>
            <li>
              <span className="dp-swatch dp-swatch-desire" aria-hidden="true" />
              Envie
            </li>
          </ul>
        </div>
      </main>
      <PhoneNav active="graphes" onChange={onNav} />
    </div>
  );
}

function ConnexionScreen({ onBack }: { onBack: () => void }) {
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="dp-shell">
      <PreviewHeader />
      <main className="dp-main">
        <h1 className="dp-title">Accès à Energy Tracker</h1>
        <p className="dp-lede">Entre le mot de passe pour continuer.</p>
        <form className="dp-stack" onSubmit={handleSubmit}>
          <div className="dp-field">
            <label className="dp-field-label" htmlFor="design-preview-password">
              Mot de passe
            </label>
            <input
              id="design-preview-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="dp-password"
              value={password}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
              }}
            />
          </div>
          <p className="dp-error">Identifiants invalides.</p>
          <button type="submit" className="dp-action">
            Se connecter
          </button>
        </form>
        <button
          type="button"
          className="dp-login-back dp-quiet-button"
          onClick={onBack}
        >
          Retour à l’aperçu
        </button>
      </main>
    </div>
  );
}

function DialoguesScreen() {
  return (
    <div className="dp-shell">
      <PreviewHeader />
      <main className="dp-main">
        <div className="dp-dialog-stack">
          <section className="dp-dialog-preview" aria-label="Aperçu modifier">
            <h2 className="dp-dialog-title">Modifier l’entrée</h2>
            <p className="dp-dialog-when">Samedi 5 septembre · 21:15</p>
            <div className="dp-edit-fields">
              <MockSlider label="Énergie" tone="energy" value={4} />
              <MockSlider label="Fatigue" tone="fatigue" value={7} />
              <MockSlider label="Envie" tone="desire" optional value={3} />
            </div>
            <div className="dp-dialog-actions">
              <span className="dp-secondary">Annuler</span>
              <span className="dp-action">Enregistrer</span>
            </div>
          </section>
          <section className="dp-dialog-preview" aria-label="Aperçu supprimer">
            <h2 className="dp-dialog-title">Supprimer cette entrée ?</h2>
            <p className="dp-dialog-body">Cette action est définitive.</p>
            <div className="dp-dialog-actions">
              <span className="dp-secondary">Annuler</span>
              <span className="dp-danger">Supprimer</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export function DesignPreviewPage() {
  const [screen, setScreen] = useState<AtelierScreen>('saisie');

  function showProduct(next: ProductScreen) {
    setScreen(next);
  }

  return (
    <div className="design-preview">
      <p className="dp-banner">Aperçu visuel — aucune donnée réelle</p>
      <nav className="dp-atelier" aria-label="Écrans de maquette">
        {ATELIER_SCREENS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              item.id === screen
                ? 'dp-atelier-button dp-atelier-button-active'
                : 'dp-atelier-button'
            }
            onClick={() => {
              setScreen(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="dp-phone">
        {screen === 'saisie' ? <SaisieScreen onNav={showProduct} /> : null}
        {screen === 'historique' ? (
          <HistoriqueScreen onNav={showProduct} />
        ) : null}
        {screen === 'graphes' ? <GraphesScreen onNav={showProduct} /> : null}
        {screen === 'connexion' ? (
          <ConnexionScreen
            onBack={() => {
              setScreen('saisie');
            }}
          />
        ) : null}
        {screen === 'dialogues' ? <DialoguesScreen /> : null}
      </div>
    </div>
  );
}
