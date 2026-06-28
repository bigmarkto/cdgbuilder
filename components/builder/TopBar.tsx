'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { DataContext } from '@/engine/context';
import type { StepStatus } from '@/engine/validation';
import { computeXP } from '@/engine/xp';
import { useBuilderStore } from '@/lib/store';
import { RosterMenu } from './RosterMenu';

export function TopBar({ ctx, steps }: { ctx: DataContext; steps: StepStatus[] }) {
  const character = useBuilderStore((s) => s.character);
  const reset = useBuilderStore((s) => s.reset);
  const exportJson = useBuilderStore((s) => s.exportJson);
  const importJson = useBuilderStore((s) => s.importJson);
  const setXP = useBuilderStore((s) => s.setXP);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const xp = computeXP(ctx, character);

  // Campo de entrada local: permite que o usuário digite sem dar commit a cada tecla.
  const [xpDraft, setXpDraft] = useState<string>(String(character.xp));
  useEffect(() => {
    setXpDraft(String(character.xp));
  }, [character.xp]);

  const completed = steps.filter((s) => s.complete && s.valid).length;
  const total = steps.length;

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (character.name || 'personagem').replace(/[^\w-]+/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}.cdg.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Ficha exportada.');
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = importJson(String(reader.result ?? ''));
      flash(res.ok ? 'Ficha importada como nova.' : `Erro: ${res.error ?? 'arquivo inválido'}`);
    };
    reader.readAsText(file);
  };

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleReset = () => {
    if (confirm('Recomeçar do zero apaga TODAS as fichas salvas. Prosseguir?')) reset();
  };

  const commitXP = () => {
    const n = Number(xpDraft);
    if (!Number.isFinite(n) || n < 0) {
      setXpDraft(String(character.xp));
      return;
    }
    setXP(Math.floor(n));
  };

  const rulesetLabel = character.rulesetId || 'core';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-ink-700">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-ember-400">Criador</p>
        <h1 className="font-serif text-2xl text-ink-50 leading-none">
          {character.name || 'Novo personagem'}
        </h1>
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <span
            className="inline-flex items-center rounded border border-ember-400/40 bg-ember-400/5 px-1.5 py-0.5 font-mono uppercase tracking-wider text-ember-400"
            title="Ruleset ativo"
          >
            ruleset: {rulesetLabel}
          </span>
          <span className="text-ink-500">·</span>
          <span className="text-ink-400">
            Nv <span className="font-mono text-ink-200">{xp.levelCurrent}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <label className="flex items-center gap-1 text-xs text-ink-300">
          <span>XP</span>
          <input
            type="number"
            min={0}
            value={xpDraft}
            onChange={(e) => setXpDraft(e.target.value)}
            onBlur={commitXP}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitXP();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-20 rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-right font-mono text-ink-100 focus:border-ember-400 focus:outline-none"
          />
        </label>
        <span className="text-xs text-ink-300">
          {completed}/{total} passos
        </span>
        <RosterMenu ctx={ctx} />
        <Link
          href="/builder/sheet"
          className="px-2.5 py-1 rounded border border-ink-600 text-ink-100 hover:bg-ink-800"
        >
          Ficha
        </Link>
        <Link
          href="/builder/comparar"
          className="px-2.5 py-1 rounded border border-ink-600 text-ink-100 hover:bg-ink-800"
        >
          Comparar
        </Link>
        <button onClick={handleExport} className="px-2.5 py-1 rounded border border-ink-600 text-ink-100 hover:bg-ink-800">
          Exportar
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="px-2.5 py-1 rounded border border-ink-600 text-ink-100 hover:bg-ink-800"
        >
          Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={handleReset}
          className="px-2.5 py-1 rounded border border-blood-500/60 text-blood-400 hover:bg-blood-500/10"
        >
          Zerar tudo
        </button>
        {toast && <span className="text-xs text-ember-400">{toast}</span>}
      </div>
    </div>
  );
}
