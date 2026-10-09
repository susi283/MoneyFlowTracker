import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, Loader2, Eye, EyeOff, ArrowRight, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthPage({ initialMode = 'login', onRecoveryComplete }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (mode === 'reset' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });

        if (resetError) throw resetError;
        setMessage('If an account exists for that email, we sent a password reset link.');
      } else if (mode === 'reset') {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        onRecoveryComplete?.();
      } else if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });

        if (signUpError) throw signUpError;

        if (!data.session) {
          setMessage('Account created. Check your email to confirm your account, then sign in.');
        } else {
          setMessage('Account created successfully.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setMessage('');
    setGoogleLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });

      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || 'Google sign in is not available yet.');
      setGoogleLoading(false);
    }
  }

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  return (
    <div className="auth-screen">
      <section className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-brand">
            <div className="auth-brand-mark">
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className="auth-brand-name">Money<span>Tracker</span></div>
              <div className="auth-brand-tagline">Track Today. Brighter Tomorrow.</div>
            </div>
          </div>

          <div className="auth-heading">
            <h1>
              {isLogin ? <>Welcome <span>Back</span></> : isSignup ? <>Create <span>Account</span></> : isForgot ? <>Forgot <span>Password?</span></> : <>Reset <span>Password</span></>}
            </h1>
            <p>
              {isLogin
                ? 'Sign in to continue your journey'
                : isSignup
                  ? 'Start tracking your money with confidence'
                  : isForgot
                    ? 'Enter your registered email and we’ll send you a reset link'
                    : 'Choose a new password for your account'}
            </p>
          </div>

          {error && <div className="auth-alert auth-alert--error">{error}</div>}
          {message && <div className="auth-alert auth-alert--success">{message}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {isSignup && (
              <label className="auth-field">
                <span>Name</span>
                <div className="auth-input-wrap">
                  <UserPlus size={18} />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />
                </div>
              </label>
            )}

            {!isReset && (
              <label className="auth-field">
                <span>Email</span>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>
            )}

            {!isForgot && (
              <label className="auth-field">
                <span>{isReset ? 'New password' : 'Password'}</span>
                <div className="auth-input-wrap">
                  {isReset ? <KeyRound size={18} /> : <Lock size={18} />}
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}

            {isReset && (
              <label className="auth-field">
                <span>Confirm new password</span>
                <div className="auth-input-wrap">
                  <Lock size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </label>
            )}

            {isLogin && (
              <div className="auth-options">
                <label className="auth-remember">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              </div>
            )}

            <button className="auth-submit" disabled={loading}>
              {loading ? <Loader2 size={19} className="animate-spin" /> : isLogin ? <LogIn size={19} /> : isSignup ? <UserPlus size={19} /> : <KeyRound size={19} />}
              <span>{isLogin ? 'Sign In' : isSignup ? 'Create Account' : isForgot ? 'Send reset link' : 'Update password'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {isLogin && (
            <>
              <div className="auth-divider"><span>or</span></div>

              <button
                type="button"
                className="auth-google"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <span className="google-g">G</span>
                )}
                <span>Continue with Google</span>
              </button>
            </>
          )}

          <p className="auth-switch">
            {isLogin ? (
              <>
                New here?
                <button type="button" onClick={() => switchMode('signup')}>Create an account</button>
              </>
            ) : isSignup ? (
              <>
                Already have an account?
                <button type="button" onClick={() => switchMode('login')}>Sign in</button>
              </>
            ) : (
              <button type="button" onClick={() => switchMode('login')}>Back to sign in</button>
            )}
          </p>
        </div>
      </section>

      <section className="auth-art-panel" aria-hidden="true">
        <img src="/assets/moneytracker-login-art.png" alt="" draggable="false" />
      </section>
    </div>
  );
}
