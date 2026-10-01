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

/* =====================================================
   ICONS
====================================================== */

// Eye icon (password visible)
function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Eye-off icon (password hidden)
function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Official Google "G" logo
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');

  // Name field for registration
  const [name, setName] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Show / hide password
  const [showPassword, setShowPassword] = useState(false);

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


            {/* Password with show / hide eye toggle */}
            <label>
              Password

              <div
                className="auth-password-wrap"
                style={{ position: 'relative' }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
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
                  style={{
                    width: '100%',
                    paddingRight: '44px',
                  }}
                />

                <button
                  type="button"
                  className="auth-eye"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  aria-pressed={showPassword}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'inherit',
                    opacity: 0.7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
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
            <GoogleIcon />
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