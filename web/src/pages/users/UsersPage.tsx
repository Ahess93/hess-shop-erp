import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import type { User, CreateUserDto } from '../../api/users';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';

function roleBadge(role: User['role']) {
  if (role === 'SUPER_ADMIN') return <Badge variant="gold">Super Admin</Badge>;
  if (role === 'ADMIN') return <Badge variant="blue">Admin</Badge>;
  return <Badge variant="gray">Operator</Badge>;
}

interface UserFormProps {
  onClose: () => void;
}

function CreateUserModal({ onClose }: UserFormProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateUserDto>({
    name: '',
    email: '',
    password: '',
    role: 'OPERATOR',
  });
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: Error) => setErrors({ submit: err.message }),
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e['name'] = 'Name is required';
    if (!form.email.trim()) e['email'] = 'Email is required';
    if (!form.email.includes('@')) e['email'] = 'Enter a valid email';
    if (!form.password && !pin) e['password'] = 'Password or PIN is required';
    if (form.password && form.password.length < 8)
      e['password'] = 'Password must be at least 8 characters';
    if (pin && !/^\d{4,6}$/.test(pin)) e['pin'] = 'PIN must be 4-6 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    mutation.mutate({ ...form, pin: pin || undefined, password: form.password || undefined });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">Add User</h2>

        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors['name']}
          autoFocus
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors['email']}
        />

        {/* Role */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text)]">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as CreateUserDto['role'] })}
            className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
          >
            <option value="OPERATOR">Operator</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        <Input
          label="Password (optional if using PIN)"
          type="password"
          value={form.password ?? ''}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors['password']}
          placeholder="Minimum 8 characters"
        />
        <Input
          label="PIN (optional, 4-6 digits)"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          error={errors['pin']}
          placeholder="e.g. 1234"
          inputMode="numeric"
        />

        {errors['submit'] && <p className="text-sm text-[var(--danger)]">{errors['submit']}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending} className="flex-1">
            Create User
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UsersPage() {
  const {
    data: users,
    isLoading,
    error,
  } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? usersApi.deactivate(id) : usersApi.reactivate(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Users</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage shop accounts and permissions
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Add User</Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4 text-sm text-[var(--danger)]">
          Failed to load users: {(error as Error).message}
        </div>
      )}

      {users && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Email</th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Role</th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                  Last Login
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/50"
                >
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{u.name}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{u.email}</td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <Badge variant="green">Active</Badge>
                    ) : (
                      <Badge variant="red">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'SUPER_ADMIN' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive.mutate({ id: u.id, active: u.active })}
                        loading={toggleActive.isPending}
                      >
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
