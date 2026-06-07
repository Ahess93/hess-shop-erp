import type { ReactNode } from 'react';

type BadgeVariant = 'gold' | 'green' | 'red' | 'gray' | 'blue';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  gold: 'bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30',
  green: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  red: 'bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/30',
  gray: 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]',
  blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};

export function Badge({ variant = 'gray', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
