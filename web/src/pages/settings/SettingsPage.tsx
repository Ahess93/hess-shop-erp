export function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">System configuration</p>
      </div>

      <div className="space-y-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="font-semibold text-[var(--text)] mb-1">Authentication Mode</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Choose how employees sign in to the shop floor terminals.
          </p>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-md bg-[var(--gold)] text-black text-sm font-semibold">
              Password
            </button>
            <button className="px-4 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] text-sm hover:text-[var(--text)] transition-colors">
              PIN
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Full settings management coming in a future phase.
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="font-semibold text-[var(--text)] mb-1">Theme</h2>
          <p className="text-sm text-[var(--text-muted)]">
            White-label color customization — coming soon.
          </p>
          <div className="mt-3 flex gap-3">
            <div
              className="w-6 h-6 rounded-full bg-[var(--gold)] border-2 border-[var(--gold)]"
              title="Gold (default)"
            />
            <div
              className="w-6 h-6 rounded-full bg-blue-500 border-2 border-[var(--border)]"
              title="Blue"
            />
            <div
              className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-[var(--border)]"
              title="Green"
            />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="font-semibold text-[var(--text)] mb-1">Email / SMTP</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Configure outbound email for notifications — coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
