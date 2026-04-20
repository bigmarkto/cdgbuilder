'use client';

import type { ReactNode } from 'react';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.15em] text-ink-300 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-400 mt-1">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded bg-ink-900 border border-ink-600 px-2 py-1.5 text-ink-50 placeholder:text-ink-500 focus:outline-none focus:border-ember-400"
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded bg-ink-900 border border-ink-600 px-2 py-1.5 text-ink-50 placeholder:text-ink-500 focus:outline-none focus:border-ember-400 resize-y"
    />
  );
}
