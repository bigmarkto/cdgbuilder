'use client';

import type { StepStatus } from '@/engine/validation';
import { useBuilderStore } from '@/lib/store';

export function StepNav({ steps }: { steps: StepStatus[] }) {
  const currentStep = useBuilderStore((s) => s.currentStep);
  const setStep = useBuilderStore((s) => s.setStep);

  return (
    <aside className="lg:sticky lg:top-20 self-start">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2 px-1">Passos</p>
      <ol className="space-y-0.5">
        {steps.map((s, i) => {
          const active = s.step === currentStep;
          const marker = !s.valid ? '!' : s.complete ? '✓' : i + 1;
          const markerClass = !s.valid
            ? 'bg-blood-500 text-ink-50'
            : s.complete
              ? 'bg-ember-400 text-ink-900'
              : 'border border-ink-600 text-ink-300';
          return (
            <li key={s.step}>
              <button
                onClick={() => setStep(s.step)}
                className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  active ? 'bg-ink-800 text-ember-400 border-l-2 border-ember-400' : 'text-ink-200 hover:bg-ink-800'
                }`}
              >
                <span
                  className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-mono ${markerClass}`}
                >
                  {marker}
                </span>
                <span>{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
