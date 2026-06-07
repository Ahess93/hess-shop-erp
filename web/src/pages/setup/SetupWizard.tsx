import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { setupApi } from '../../api/setup';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type Step = 1 | 2 | 3;

export function SetupWizard() {
  const [step, setStep] = useState<Step>(1);
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { setTenantId } = useAuthStore();
  const navigate = useNavigate();

  const setupMutation = useMutation({
    mutationFn: setupApi.complete,
    onSuccess: (data) => {
      setTenantId(data.tenantId);
      void navigate('/login');
    },
    onError: (err: Error) => {
      setErrors({ submit: err.message });
    },
  });

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!orgName.trim()) e['orgName'] = 'Organization name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e: Record<string, string> = {};
    if (!adminName.trim()) e['adminName'] = 'Name is required';
    if (!adminEmail.trim()) e['adminEmail'] = 'Email is required';
    if (!adminEmail.includes('@')) e['adminEmail'] = 'Enter a valid email';
    if (adminPassword.length < 8) e['adminPassword'] = 'Password must be at least 8 characters';
    if (adminPassword !== confirmPassword) e['confirmPassword'] = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  }

  function handleSubmit() {
    setupMutation.mutate({ orgName, adminName, adminEmail, adminPassword });
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-[var(--gold)] font-bold text-3xl">Hess Solutions</div>
          <div className="text-[var(--text-muted)] text-sm mt-1">Shop ERP — First Time Setup</div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? 'bg-[var(--gold)] text-black'
                    : s < step
                      ? 'bg-[var(--gold)]/40 text-[var(--gold)]'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {s === 1 ? 'Organization' : s === 2 ? 'Admin Account' : 'Confirm'}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-5">
          {step === 1 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Your Organization</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  What is the name of your shop or business?
                </p>
              </div>
              <Input
                label="Organization Name"
                placeholder="e.g. Hess Solutions"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                error={errors['orgName']}
                autoFocus
              />
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Super Admin Account</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Create the master account. This account has full access.
                </p>
              </div>
              <Input
                label="Your Name"
                placeholder="e.g. Andrew Hess"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                error={errors['adminName']}
                autoFocus
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="you@yourshop.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                error={errors['adminEmail']}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Minimum 8 characters"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                error={errors['adminPassword']}
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors['confirmPassword']}
              />
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Confirm Setup</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Review your details and finish setup.
                </p>
              </div>
              <div className="space-y-3 bg-[var(--surface-2)] rounded-lg p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Organization</span>
                  <span className="text-[var(--text)] font-medium">{orgName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Admin Name</span>
                  <span className="text-[var(--text)] font-medium">{adminName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Admin Email</span>
                  <span className="text-[var(--text)] font-medium">{adminEmail}</span>
                </div>
              </div>
              {errors['submit'] && (
                <p className="text-sm text-[var(--danger)]">{errors['submit']}</p>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button
                variant="secondary"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="flex-1"
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={handleNext} className="flex-1">
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={setupMutation.isPending} className="flex-1">
                Finish Setup
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
