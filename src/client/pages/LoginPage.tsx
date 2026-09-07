import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, safeReturnPath } from '../auth/auth-context';
import { BrandMark } from '../brand/BrandMark';
import { AuthRequestError } from '../lib/api/auth';

function errorMessage(error: unknown): string {
  if (error instanceof AuthRequestError && error.message) {
    if (error.code === 'invalid_credentials') {
      return 'Identifiants invalides.';
    }
    if (error.code === 'too_many_attempts') {
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    }
    if (error.kind === 'network') {
      return 'La connexion n’a pas abouti. Réessaie.';
    }
  }
  return 'La connexion n’a pas abouti. Réessaie.';
}

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  if (status === 'authenticated') {
    const from =
      location.state &&
      typeof location.state === 'object' &&
      'from' in location.state
        ? location.state.from
        : undefined;
    return <Navigate to={safeReturnPath(from)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || submitting) {
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      setEmail('');
      setPassword('');
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <BrandMark />
      </header>
      <main className="app-main login-main">
        <section className="page">
          <h1>Accès à Energy Tracker</h1>
          <p className="lede">Entre ton email et ton mot de passe.</p>
          <form
            className="log-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="password-input"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="login-password">
                Mot de passe
              </label>
              <div className="password-field">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="password-input"
                />
                <button
                  type="button"
                  className="secondary-button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !canSubmit}
            >
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
