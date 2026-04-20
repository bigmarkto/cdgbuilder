'use client';

import { useState } from 'react';
import { useBuilderStore } from '@/lib/store';
import { Field, TextArea, TextInput } from '../fields';

export function StepCicatrizes() {
  const scars = useBuilderStore((s) => s.character.scars);
  const addScar = useBuilderStore((s) => s.addScar);
  const removeScar = useBuilderStore((s) => s.removeScar);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addScar({ id: `scar_${Date.now()}`, name: trimmed, note: note.trim() || undefined });
    setName('');
    setNote('');
  };

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-xs text-ink-300">
        Nível 1 começa com zero cicatrizes — elas surgem durante o jogo. Este espaço fica reservado
        para registrá-las quando aparecerem.
      </p>

      {scars.length === 0 ? (
        <p className="text-sm text-ink-400 italic">Nenhuma cicatriz ainda.</p>
      ) : (
        <ul className="space-y-2">
          {scars.map((s) => (
            <li
              key={s.id}
              className="rounded border border-ink-700 bg-ink-900/60 p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-serif text-ink-50">{s.name}</p>
                {s.note && <p className="text-xs text-ink-300 mt-0.5">{s.note}</p>}
              </div>
              <button
                onClick={() => removeScar(s.id)}
                className="text-xs text-blood-400 hover:text-blood-300"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded border border-ink-800 p-3 bg-ink-900/30">
        <Field label="Nome da cicatriz">
          <TextInput value={name} onChange={setName} placeholder="Ex: Marca do Pacto" />
        </Field>
        <Field label="Nota (opcional)">
          <TextArea value={note} onChange={setNote} rows={2} />
        </Field>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="px-3 py-1.5 rounded border border-ember-400/70 text-ember-400 hover:bg-ember-400/10 disabled:opacity-30"
        >
          Adicionar cicatriz
        </button>
      </div>
    </div>
  );
}
