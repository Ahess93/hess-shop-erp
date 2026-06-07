import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--text)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`px-3 py-2 rounded-md bg-[var(--surface-2)] border text-[var(--text)] placeholder-[var(--text-muted)] text-sm outline-none transition-colors
          ${error ? 'border-[var(--danger)]' : 'border-[var(--border)] focus:border-[var(--gold)]'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
