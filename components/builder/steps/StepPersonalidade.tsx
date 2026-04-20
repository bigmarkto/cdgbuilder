'use client';

import { useBuilderStore } from '@/lib/store';
import { Field, TextArea } from '../fields';

export function StepPersonalidade() {
  const personality = useBuilderStore((s) => s.character.personality);
  const notes = useBuilderStore((s) => s.character.notes);
  const setPersonality = useBuilderStore((s) => s.setPersonality);
  const setNotes = useBuilderStore((s) => s.setNotes);

  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Aparência">
        <TextArea
          value={personality.appearance}
          onChange={(v) => setPersonality({ appearance: v })}
          rows={2}
          placeholder="Como as pessoas descrevem este personagem quando o encontram pela primeira vez?"
        />
      </Field>
      <Field label="História">
        <TextArea
          value={personality.history}
          onChange={(v) => setPersonality({ history: v })}
          rows={4}
          placeholder="De onde veio? O que deixou para trás?"
        />
      </Field>
      <Field label="Motivação" hint="Obrigatório. O que puxa esse personagem para frente.">
        <TextArea
          value={personality.motivation}
          onChange={(v) => setPersonality({ motivation: v })}
          rows={2}
          placeholder="Ex: Encontrar quem queimou a aldeia."
        />
      </Field>
      <Field label="Laços">
        <TextArea
          value={personality.bonds}
          onChange={(v) => setPersonality({ bonds: v })}
          rows={2}
          placeholder="Pessoas, lugares, objetos sagrados, juramentos."
        />
      </Field>
      <Field label="Notas livres">
        <TextArea value={notes} onChange={setNotes} rows={3} />
      </Field>
    </div>
  );
}
