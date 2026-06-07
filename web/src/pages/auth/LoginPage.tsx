import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login, loginPin } from '../../api/auth';
import { authTwoFaApi } from '../../api/twofa';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type Mode = 'password' | 'pin';
type Stage = 'credentials' | 'twofa';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('password');
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [error, setError] = useState('');

  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const passwordMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (result) => {
      if ('requiresTwoFa' in result && result.requiresTwoFa) {
        setStage('twofa');
        setError('');
      } else if ('user' in result) {
        setUser(result.user as Parameters<typeof setUser>[0]);
        void navigate('/jobs');
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const pinMutation = useMutation({
    mutationFn: () => loginPin(pin),
    onSuccess: (user) => {
      setUser(user);
      void navigate('/jobs');
    },
    onError: (err: Error) => setError(err.message),
  });

  const twoFaMutation = useMutation({
    mutationFn: () => authTwoFaApi.complete(twoFaCode),
    onSuccess: (result) => {
      setUser(result.user as Parameters<typeof setUser>[0]);
      void navigate('/jobs');
    },
    onError: (err: Error) => setError(err.message),
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    passwordMutation.mutate();
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    pinMutation.mutate();
  }

  function handleTwoFaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    twoFaMutation.mutate();
  }

  // PIN pad digit press
  function pressDigit(digit: string) {
    if (pin.length < 6) setPin((p) => p + digit);
  }

  function clearPin() {
    setPin('');
    setError('');
  }

  const isPending = passwordMutation.isPending || pinMutation.isPending || twoFaMutation.isPending;

  // ── 2FA step ──────────────────────────────────────────────────────────────

  if (stage === 'twofa') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-[var(--gold)] font-bold text-3xl">Hess Solutions</div>
            <div className="text-[var(--text-muted)] text-sm mt-1">Shop ERP</div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🛡️</div>
              <h2 className="font-bold text-[var(--text)] text-lg">Two-Factor Auth</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
            <form onSubmit={handleTwoFaSubmit} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                className="w-full text-center text-3xl font-mono tracking-widest bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
              {error && <p className="text-sm text-[var(--danger)] text-center">{error}</p>}
              <Button
                type="submit"
                loading={isPending}
                className="w-full"
                disabled={twoFaCode.length !== 6}
              >
                Verify
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStage('credentials');
                  setTwoFaCode('');
                  setError('');
                }}
                className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                ← Back to login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Credentials step ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-[var(--gold)] font-bold text-3xl">Hess Solutions</div>
          <div className="text-[var(--text-muted)] text-sm mt-1">Shop ERP</div>
        </div>

        {/* Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          {/* Mode toggle */}
          <div className="flex bg-[var(--surface-2)] rounded-lg p-1 mb-6">
            {(['password', 'pin'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  mode === m
                    ? 'bg-[var(--gold)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {m === 'password' ? 'Password' : 'PIN'}
              </button>
            ))}
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@yourshop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              <Input
                label="Password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <Button type="submit" loading={isPending} className="w-full">
                Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              {/* PIN display */}
              <div className="flex justify-center gap-3 py-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-colors ${
                      i < pin.length
                        ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)]'
                    }`}
                  >
                    {i < pin.length ? '●' : ''}
                  </div>
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => pressDigit(d)}
                    className="h-12 rounded-lg bg-[var(--surface-2)] text-[var(--text)] text-lg font-semibold hover:bg-[var(--surface-3)] transition-colors"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearPin}
                  className="h-12 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] text-sm hover:bg-[var(--surface-3)] transition-colors"
                >
                  CLR
                </button>
                <button
                  type="button"
                  onClick={() => pressDigit('0')}
                  className="h-12 rounded-lg bg-[var(--surface-2)] text-[var(--text)] text-lg font-semibold hover:bg-[var(--surface-3)] transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  className="h-12 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] text-sm hover:bg-[var(--surface-3)] transition-colors"
                >
                  ⌫
                </button>
              </div>

              {error && <p className="text-sm text-[var(--danger)] text-center">{error}</p>}
              <Button
                type="submit"
                loading={isPending}
                className="w-full"
                disabled={pin.length < 4}
              >
                Sign In with PIN
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
