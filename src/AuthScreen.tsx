import { FormEvent, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { firebaseAuth, googleProvider } from './firebase';

type AuthMode = 'login' | 'register';

function authMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';

  const messages: Record<string, string> = {
    'auth/invalid-credential':
      'That email or password is not correct.',

    'auth/email-already-in-use':
      'An account already exists for this email.',

    'auth/weak-password':
      'Use a password with at least 6 characters.',

    'auth/invalid-email':
      'Enter a valid email address.',

    'auth/popup-closed-by-user':
      'Google sign-in was closed before it completed.',

    'auth/popup-blocked':
      'Your browser blocked the Google sign-in popup.',

    'auth/too-many-requests':
      'Too many attempts. Wait a moment and try again.',
  };

  return messages[code] || 'Authentication failed. Please try again.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');

  // Name field for registration
  const [name, setName] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setBusy(true);
    setError('');

    try {
      if (mode === 'login') {
        // Login with email and password
        await signInWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password
        );
      } else {
        // Validate name before creating account
        const trimmedName = name.trim();

        if (!trimmedName) {
          setError('Please enter your full name.');
          setBusy(false);
          return;
        }

        // Create Firebase account
        const userCredential =
          await createUserWithEmailAndPassword(
            firebaseAuth,
            email.trim(),
            password
          );

        // Save name to Firebase Authentication profile
        await updateProfile(userCredential.user, {
          displayName: trimmedName,
        });
      }
    } catch (authError) {
      setError(authMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setBusy(true);
    setError('');

    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (authError) {
      setError(authMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">

      {/* =====================================================
          LEFT / VISUAL SECTION
      ====================================================== */}
      <section
        className="auth-visual"
        aria-label="FROST Aura overview"
      >
        <div className="auth-visual-top">

          <div className="auth-brand">
            FROST<span>·</span>
          </div>

          <div className="auth-status">
            <i /> Aura system
          </div>

        </div>

        <div className="auth-visual-copy">

          <p className="auth-kicker">
            A calmer day, precisely timed.
          </p>

          <h1>
            Your rhythm,
            <br />
            <em>in focus.</em>
          </h1>

          <p>
            One intelligent clock for hydration, movement,
            recovery, and the small rituals that keep you well.
          </p>

        </div>

        <div
          className="auth-orbit"
          aria-hidden="true"
        >
          <div className="auth-orbit-ring ring-one" />

          <div className="auth-orbit-ring ring-two" />

          <div className="auth-orbit-core">
            <span>10:45</span>
            <small>YOUR DAY</small>
          </div>

          <b className="orbit-dot dot-a">
            HYDRATE
          </b>

          <b className="orbit-dot dot-b">
            RESET
          </b>

          <b className="orbit-dot dot-c">
            MOVE
          </b>
        </div>

        <div className="auth-visual-foot">
          <span>FROST AURA</span>
          <span>PERSONAL WELLBEING DEVICE</span>
        </div>

      </section>


      {/* =====================================================
          RIGHT / AUTHENTICATION SECTION
      ====================================================== */}
      <section className="auth-panel">

        <div className="auth-panel-inner">

          {/* Mobile Brand */}
          <div className="auth-mobile-brand">
            FROST<span>·</span>
          </div>


          {/* Heading */}
          <div className="auth-heading">

            <p className="auth-kicker">
              Welcome to Aura
            </p>

            <h2>
              {mode === 'login'
                ? 'Sign in to your day.'
                : 'Create your Aura.'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Pick up exactly where your rhythm left off.'
                : 'Set up your personal FROST command center.'}
            </p>

          </div>


          {/* =================================================
              LOGIN / REGISTER TABS
          ================================================== */}
          <div
            className="auth-tabs"
            role="tablist"
            aria-label="Authentication mode"
          >

            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
              role="tab"
              aria-selected={mode === 'login'}
            >
              Sign in
            </button>

            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register');
                setError('');
              }}
              role="tab"
              aria-selected={mode === 'register'}
            >
              Create account
            </button>

          </div>


          {/* =================================================
              AUTH FORM
          ================================================== */}
          <form
            className="auth-form"
            onSubmit={submit}
          >

            {/* ===============================================
                FULL NAME
                Visible ONLY during registration
            ================================================ */}
            {mode === 'register' && (
              <label>
                Full name

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>
            )}


            {/* Email */}
            <label>
              Email address

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>


            {/* Password */}
            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="At least 6 characters"
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
                minLength={6}
                required
              />
            </label>


            {/* Error Message */}
            {error && (
              <p
                className="auth-error"
                role="alert"
              >
                {error}
              </p>
            )}


            {/* Submit Button */}
            <button
              className="auth-primary"
              type="submit"
              disabled={busy}
            >

              {busy
                ? 'Working...'
                : mode === 'login'
                  ? 'Enter Aura'
                  : 'Create account'}

              <span>→</span>

            </button>

          </form>


          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>


          {/* Google Login */}
          <button
            className="auth-google"
            type="button"
            onClick={continueWithGoogle}
            disabled={busy}
          >
            <strong>G</strong>
            Continue with Google
          </button>


          {/* Legal */}
          <p className="auth-legal">
            By continuing, you agree to use FROST Aura
            for your personal wellbeing routines.
          </p>

        </div>

      </section>

    </main>
  );
}