import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi, formatBytes } from '../../api/backup';
import type { BackupConfig } from '../../api/backup';

type SettingsTab = 'auth' | 'smtp' | 'backup' | 'theme';

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('backup');

  const tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'auth', label: 'Auth Mode', icon: '🔐' },
    { key: 'smtp', label: 'Email / SMTP', icon: '✉️' },
    { key: 'backup', label: 'Backups', icon: '💾' },
    { key: 'theme', label: 'Theme', icon: '🎨' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          System configuration — Super Admin only
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--surface-2)] rounded-lg p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
              tab === t.key
                ? 'bg-[var(--gold)] text-black'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'auth' && <AuthTab />}
      {tab === 'smtp' && <SmtpTab />}
      {tab === 'backup' && <BackupTab />}
      {tab === 'theme' && <ThemeTab />}
    </div>
  );
}

// ─── Auth Tab ────────────────────────────────────────────────────────────────

function AuthTab() {
  return (
    <section className="space-y-4">
      <Card
        title="Authentication Mode"
        description="Choose how employees sign in to shop-floor terminals."
      >
        <div className="flex gap-3 mt-4">
          <button className="px-4 py-2 rounded-md bg-[var(--gold)] text-black text-sm font-semibold">
            Password
          </button>
          <button className="px-4 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] text-sm hover:text-[var(--text)] transition-colors">
            PIN
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Full auth-mode switching coming in a future update.
        </p>
      </Card>
    </section>
  );
}

// ─── SMTP Tab ────────────────────────────────────────────────────────────────

function SmtpTab() {
  return (
    <section>
      <Card
        title="Email / SMTP"
        description="Configure the outbound email server for overdue-job and low-stock alerts."
      >
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="SMTP Host" placeholder="smtp.gmail.com" disabled />
          <Field label="Port" placeholder="587" disabled />
          <Field label="Username / Email" placeholder="you@example.com" disabled />
          <Field label="Password" placeholder="••••••••" type="password" disabled />
          <Field label="From Name" placeholder="Hess Shop ERP" disabled />
          <Field label="From Email" placeholder="erp@hesssolutions.com" disabled />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-4">
          Full SMTP configuration coming in a future update. For now, edit the{' '}
          <code className="bg-[var(--surface-2)] px-1 rounded">smtp</code> key in the SystemSettings
          table directly.
        </p>
      </Card>
    </section>
  );
}

// ─── Backup Tab ──────────────────────────────────────────────────────────────

function BackupTab() {
  const qc = useQueryClient();
  const [pathInput, setPathInput] = useState('');
  const [retainInput, setRetainInput] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [createStatus, setCreateStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['backup', 'config'],
    queryFn: () => backupApi.getConfig(),
    select: (d) => {
      // Pre-fill inputs once on load
      if (!configLoaded) {
        setPathInput(d.backupPath);
        setRetainInput(String(d.retainCount));
        setConfigLoaded(true);
      }
      return d;
    },
  });

  const {
    data: backups = [],
    isLoading: listLoading,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['backup', 'list'],
    queryFn: () => backupApi.list(),
  });

  const saveMut = useMutation({
    mutationFn: (dto: Partial<BackupConfig>) => backupApi.saveConfig(dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['backup', 'config'] }),
  });

  const handleSaveConfig = () => {
    saveMut.mutate({
      backupPath: pathInput,
      retainCount: parseInt(retainInput, 10) || 10,
      autoBackup: config?.autoBackup ?? true,
    });
  };

  const handleAutoBackupToggle = () => {
    if (!config) return;
    saveMut.mutate({ autoBackup: !config.autoBackup });
  };

  const handleCreateBackup = async () => {
    setCreateStatus('running');
    setLastResult(null);
    try {
      const result = await backupApi.create();
      setLastResult(
        `✅ Backup created: ${result.filename} (${formatBytes(result.sizeBytes)}, ${result.durationMs}ms)`,
      );
      setCreateStatus('done');
      void refetchList();
    } catch (err) {
      setLastResult(`❌ Backup failed: ${String(err)}`);
      setCreateStatus('error');
    }
  };

  // Electron folder picker — only available inside the desktop app
  const isElectron =
    typeof window !== 'undefined' &&
    'electronAPI' in window &&
    (window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron ===
      true;

  const handleBrowse = async () => {
    if (!isElectron) return;
    const api = (
      window as unknown as {
        electronAPI: { openFolderDialog: () => Promise<string | null> };
      }
    ).electronAPI;
    const chosen = await api.openFolderDialog();
    if (chosen) setPathInput(chosen);
  };

  if (configLoading) return <Spinner />;

  return (
    <section className="space-y-4">
      {/* Config card */}
      <Card
        title="Backup Configuration"
        description="Where backups are stored and how many to keep."
      >
        <div className="mt-4 space-y-4">
          {/* Backup path */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Backup Folder</label>
            <div className="flex gap-2">
              <input
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
                placeholder="C:\Users\You\HessERP\backups"
              />
              {isElectron && (
                <button
                  onClick={() => void handleBrowse()}
                  className="px-3 py-2 text-sm rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Browse…
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Can be a local folder, external drive, or network path (UNC like{' '}
              <code className="bg-[var(--surface-2)] px-1 rounded">\\NAS\backups</code>).
            </p>
          </div>

          {/* Retain count */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Keep last N backups
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={retainInput}
                onChange={(e) => setRetainInput(e.target.value)}
                className="w-20 bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>

            {/* Auto-backup toggle */}
            <div className="flex items-center gap-2 pt-4">
              <button
                onClick={handleAutoBackupToggle}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none ${
                  config?.autoBackup ? 'bg-[var(--gold)]' : 'bg-[var(--border)]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                    config?.autoBackup ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-sm text-[var(--text)]">Nightly auto-backup (runs at 1 AM)</span>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveConfig}
              disabled={saveMut.isPending}
              className="px-4 py-2 rounded-md bg-[var(--gold)] text-black text-sm font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {saveMut.isPending ? 'Saving…' : 'Save Configuration'}
            </button>
            {saveMut.isSuccess && <span className="text-sm text-emerald-400">✓ Saved</span>}
          </div>
        </div>
      </Card>

      {/* Manual backup card */}
      <Card
        title="Manual Backup"
        description="Create a backup right now. Includes the database and all uploaded files."
      >
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => void handleCreateBackup()}
            disabled={createStatus === 'running'}
            className="px-4 py-2 rounded-md bg-[var(--gold)] text-black text-sm font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {createStatus === 'running' ? (
              <>
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Creating backup…
              </>
            ) : (
              '💾 Create Backup Now'
            )}
          </button>
          {lastResult && <p className="text-sm text-[var(--text-muted)]">{lastResult}</p>}
        </div>
      </Card>

      {/* Backup list */}
      <Card
        title="Existing Backups"
        description={`${backups.length} backup${backups.length === 1 ? '' : 's'} stored in the configured folder.`}
      >
        {listLoading ? (
          <Spinner />
        ) : backups.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            No backups yet. Run a manual backup or wait for the nightly job.
          </p>
        ) : (
          <div className="mt-4 rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <th className="text-left px-4 py-2 text-[var(--text-muted)] font-medium">
                    Filename
                  </th>
                  <th className="text-right px-4 py-2 text-[var(--text-muted)] font-medium">
                    Size
                  </th>
                  <th className="text-right px-4 py-2 text-[var(--text-muted)] font-medium">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr
                    key={b.filename}
                    className={`border-b border-[var(--border)] ${
                      i === 0 ? 'bg-[var(--gold)]/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text)]">
                      {i === 0 && (
                        <span className="mr-2 text-[var(--gold)] font-sans font-medium text-xs">
                          latest
                        </span>
                      )}
                      {b.filename}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--text-muted)]">
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td className="px-4 py-2 text-right text-[var(--text-muted)]">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Restore note */}
        <div className="mt-4 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">
            <strong className="text-[var(--text)]">To restore:</strong> Use the{' '}
            <em>Verify Backup</em> button in the desktop app, then follow the restore instructions.
            Restoring requires stopping the server and running{' '}
            <code className="bg-[var(--surface)] px-1 rounded">pg_restore</code>.
          </p>
        </div>
      </Card>

      {/* Cloud backup note */}
      <Card
        title="Cloud Backup (OneDrive / Google Drive / Dropbox)"
        description="Set the backup folder to your cloud sync folder for automatic off-site copies."
      >
        <ul className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
          <li>
            📁 <strong className="text-[var(--text)]">OneDrive:</strong>{' '}
            <code className="bg-[var(--surface-2)] px-1 rounded">
              C:\Users\YourName\OneDrive\HessERP\backups
            </code>
          </li>
          <li>
            📁 <strong className="text-[var(--text)]">Google Drive:</strong>{' '}
            <code className="bg-[var(--surface-2)] px-1 rounded">
              C:\Users\YourName\Google Drive\HessERP\backups
            </code>
          </li>
          <li>
            📁 <strong className="text-[var(--text)]">Dropbox:</strong>{' '}
            <code className="bg-[var(--surface-2)] px-1 rounded">
              C:\Users\YourName\Dropbox\HessERP\backups
            </code>
          </li>
        </ul>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Set any of these as your Backup Folder above. The cloud sync app will automatically upload
          new backups to the cloud.
        </p>
      </Card>
    </section>
  );
}

// ─── Theme Tab ───────────────────────────────────────────────────────────────

function ThemeTab() {
  return (
    <section>
      <Card title="White-Label Theme" description="Customize colors and branding per deployment.">
        <div className="mt-3 flex gap-3">
          <ColorSwatch color="#d4a017" label="Gold (default)" active />
          <ColorSwatch color="#3b82f6" label="Blue" />
          <ColorSwatch color="#10b981" label="Green" />
          <ColorSwatch color="#ef4444" label="Red" />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-4">
          Full theme customization (logo, color tokens, company name) coming in a future update.
        </p>
      </Card>
    </section>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
      <h2 className="font-semibold text-[var(--text)]">{title}</h2>
      <p className="text-sm text-[var(--text-muted)] mt-0.5">{description}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)] disabled:opacity-50"
      />
    </div>
  );
}

function ColorSwatch({
  color,
  label,
  active = false,
}: {
  color: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
        active ? 'border-white' : 'border-[var(--border)]'
      }`}
      style={{ backgroundColor: color }}
      title={label}
    />
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-24">
      <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
