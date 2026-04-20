'use client';

import { useEffect, useRef, useState } from 'react';
import type { DataContext } from '@/engine/context';
import { findRace } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';

export function RosterMenu({ ctx }: { ctx: DataContext }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const activeId = useBuilderStore((s) => s.character.id);
  const activeName = useBuilderStore((s) => s.character.name);
  const rosterList = useBuilderStore((s) => s.rosterList);
  const createCharacter = useBuilderStore((s) => s.createCharacter);
  const selectCharacter = useBuilderStore((s) => s.selectCharacter);
  const duplicateCharacter = useBuilderStore((s) => s.duplicateCharacter);
  const deleteCharacter = useBuilderStore((s) => s.deleteCharacter);

  const list = rosterList();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2.5 py-1 rounded border border-ink-600 text-ink-100 hover:bg-ink-800 flex items-center gap-1.5"
      >
        <span className="text-xs text-ink-300">Ficha:</span>
        <span className="text-sm truncate max-w-[140px]">{activeName || 'sem nome'}</span>
        <span className="text-ink-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-80 rounded border border-ink-700 bg-ink-900 shadow-xl">
          <div className="px-3 py-2 border-b border-ink-800 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
              Fichas ({list.length})
            </span>
            <button
              onClick={() => {
                createCharacter();
                setOpen(false);
              }}
              className="text-xs px-2 py-0.5 rounded border border-ember-400/60 text-ember-400 hover:bg-ember-400/10"
            >
              + Nova
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {list.map((entry) => {
              const isActive = entry.id === activeId;
              const race = findRace(ctx, entry.raceId);
              return (
                <li key={entry.id}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 text-sm ${
                      isActive ? 'bg-ember-400/10' : 'hover:bg-ink-800'
                    }`}
                  >
                    <button
                      onClick={() => {
                        selectCharacter(entry.id);
                        setOpen(false);
                      }}
                      disabled={isActive}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className={`truncate ${isActive ? 'text-ember-400' : 'text-ink-50'}`}>
                        {entry.name || <span className="italic text-ink-400">sem nome</span>}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {race?.name ?? '—'} · Nv {entry.level}
                      </p>
                    </button>
                    <button
                      onClick={() => duplicateCharacter(entry.id)}
                      title="Duplicar"
                      className="text-ink-400 hover:text-ember-400 text-xs px-1"
                    >
                      ⎘
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Apagar "${entry.name || 'sem nome'}"?`)) {
                          deleteCharacter(entry.id);
                        }
                      }}
                      title="Apagar"
                      className="text-ink-400 hover:text-blood-400 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
