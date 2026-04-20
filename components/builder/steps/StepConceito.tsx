'use client';

import { useBuilderStore } from '@/lib/store';
import { Field, TextArea, TextInput } from '../fields';

export function StepConceito() {
  const character = useBuilderStore((s) => s.character);
  const setName = useBuilderStore((s) => s.setName);
  const setConcept = useBuilderStore((s) => s.setConcept);
  const setLevel = useBuilderStore((s) => s.setLevel);

  return (
    <div className="space-y-4 max-w-xl">
      <Field label="Nome do personagem">
        <TextInput value={character.name} onChange={setName} placeholder="Ex: Elion, o Andarilho" />
      </Field>
      <Field label="Conceito (uma frase)">
        <TextArea
          value={character.concept}
          onChange={setConcept}
          placeholder="Ex: Caçador que troca memórias por força."
          rows={2}
        />
      </Field>
      <Field label="Nível inicial">
        <input
          type="number"
          min={1}
          max={12}
          value={character.level}
          onChange={(e) => setLevel(parseInt(e.target.value || '1', 10))}
          className="w-24 rounded bg-ink-900 border border-ink-600 px-2 py-1 text-ink-50 font-mono"
        />
      </Field>
      <p className="text-xs text-ink-300">
        Antes dos números: quem é esse personagem? Qual a cicatriz que o move? Depois voltamos
        aqui conforme a ficha for tomando forma.
      </p>
    </div>
  );
}
