'use client';

import type { DataContext } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';
import { Field, TextArea } from '../fields';

interface EquipPackage {
  id: string;
  name: string;
  contents: string;
  value: number;
}

export function StepEquipamento({ ctx }: { ctx: DataContext }) {
  const equipmentPackageId = useBuilderStore((s) => s.character.equipmentPackageId);
  const equipmentNotes = useBuilderStore((s) => s.character.equipmentNotes);
  const setPkg = useBuilderStore((s) => s.setEquipmentPackage);
  const setNotes = useBuilderStore((s) => s.setEquipmentNotes);

  const creation = ctx.creation as unknown as {
    initialEquipment?: { startingCoins?: number; currency?: string; packages?: EquipPackage[] };
  };
  const init = creation.initialEquipment ?? {};
  const packages = init.packages ?? [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-300">
        Início: <span className="font-mono text-ember-400">{init.startingCoins ?? 150}</span>{' '}
        {init.currency ?? 'Dracmas'}. Escolha um pacote — ou crie o próprio nas notas.
      </p>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {packages.map((pkg) => {
          const active = pkg.id === equipmentPackageId;
          return (
            <li key={pkg.id}>
              <button
                onClick={() => setPkg(active ? null : pkg.id)}
                className={`w-full text-left rounded border p-3 transition-colors ${
                  active
                    ? 'border-ember-400 bg-ember-400/10'
                    : 'border-ink-700 bg-ink-800/60 hover:border-ink-500'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-serif text-ink-50">{pkg.name}</p>
                  <span className="text-xs font-mono text-ember-400">{pkg.value} {init.currency ?? 'Dr'}</span>
                </div>
                <p className="text-sm text-ink-200 mt-1">{pkg.contents}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <Field label="Ajustes e itens próprios" hint="Substituições, itens compreados, descrições de equipamento.">
        <TextArea value={equipmentNotes} onChange={setNotes} rows={3} />
      </Field>
    </div>
  );
}
