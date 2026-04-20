'use client';

import { useMemo, useState } from 'react';
import type { Vertente } from '@/lib/types';
import type { CharacterConjuration } from '@/engine/character';
import { useBuilderStore } from '@/lib/store';
import { Field, TextInput } from '../fields';

/**
 * Sistema modular de conjurações: vertente + efeito + forma + alcance +
 * intensidade → custo automático. O conjurador monta cada magia, guarda
 * na ficha, e usa em jogo. Esta UI é o montador.
 */

interface SpellOption {
  id: string;
  name: string;
  description?: string;
  costModifier?: number;
}

interface VertenteSystem {
  effects: SpellOption[];
  forms: Array<SpellOption & { ignoresRange?: boolean }>;
  ranges: Array<SpellOption & { meters?: number }>;
  intensities: Array<SpellOption & { dice?: string; controlDT?: number }>;
  caps?: Record<string, { max: number | null; requirement?: string }>;
  costFormula?: string;
}

export function StepMagias({
  vertentes,
  system
}: {
  vertentes: Vertente[];
  system: VertenteSystem | null;
}) {
  const conjurations = useBuilderStore((s) => s.character.conjurations);
  const addConjuration = useBuilderStore((s) => s.addConjuration);
  const removeConjuration = useBuilderStore((s) => s.removeConjuration);
  const updateConjuration = useBuilderStore((s) => s.updateConjuration);

  if (!system) {
    return (
      <p className="text-sm text-ink-400">
        Sistema de conjurações indisponível — verifique <code className="font-mono">data/vertentes/system.json</code>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-300">
        Monte cada conjuração escolhendo <span className="text-ember-400">Vertente + Efeito + Forma + Alcance + Intensidade</span>. O custo é calculado automaticamente pela soma dos modificadores.
      </p>

      <Builder
        vertentes={vertentes}
        system={system}
        onSave={(c) => addConjuration(c)}
      />

      {conjurations.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Conjurações na ficha ({conjurations.length})
          </p>
          <ul className="space-y-2">
            {conjurations.map((c) => (
              <SavedRow
                key={c.id}
                conj={c}
                vertentes={vertentes}
                onUpdate={(patch) => updateConjuration(c.id, patch)}
                onRemove={() => removeConjuration(c.id)}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-xs text-ink-400">Nenhuma conjuração salva ainda.</p>
      )}
    </div>
  );
}

// ---------- Builder ----------

function Builder({
  vertentes,
  system,
  onSave
}: {
  vertentes: Vertente[];
  system: VertenteSystem;
  onSave: (c: CharacterConjuration) => void;
}) {
  const [name, setName] = useState('');
  const [vertenteId, setVertenteId] = useState<string>(vertentes[0]?.id ?? '');
  const [effectId, setEffectId] = useState<string>(system.effects[0]?.id ?? '');
  const [formId, setFormId] = useState<string>(system.forms[0]?.id ?? '');
  const [rangeId, setRangeId] = useState<string>(system.ranges[1]?.id ?? system.ranges[0]?.id ?? '');
  const [intensityId, setIntensityId] = useState<string>(system.intensities[0]?.id ?? '');

  const form = system.forms.find((f) => f.id === formId);
  const range = system.ranges.find((r) => r.id === rangeId);
  const intensity = system.intensities.find((i) => i.id === intensityId);
  const effect = system.effects.find((e) => e.id === effectId);
  const vertente = vertentes.find((v) => v.id === vertenteId) ?? null;

  const cost = useMemo(() => {
    const fc = form?.costModifier ?? 0;
    const rc = form?.ignoresRange ? 0 : range?.costModifier ?? 0;
    const ic = intensity?.costModifier ?? 0;
    return fc + rc + ic;
  }, [form, range, intensity]);

  const capNormal = system.caps?.normal?.max ?? null;
  const overCap = capNormal !== null && cost > capNormal;
  // Vertentes que explicitamente permitem passar do teto pagando consequência.
  const UNCAPPED_VERTENTES = new Set(['ancianica', 'abissal', 'sacrificial']);
  const canOverride = vertente ? UNCAPPED_VERTENTES.has(vertente.id) : false;
  const [allowOvercap, setAllowOvercap] = useState(false);
  const saveBlocked = overCap && !(canOverride && allowOvercap);

  function handleSave() {
    if (!effect || !form || !range || !intensity) return;
    if (saveBlocked) return;
    const conj: CharacterConjuration = {
      id: freshId(),
      name: name.trim() || `${effect.name} · ${form.name}`,
      vertenteId: vertente?.id ?? null,
      rank: 1,
      form: form.name,
      range: range.name,
      intensity: intensity.name,
      cost: String(cost),
      components: [
        `Efeito: ${effect.name}`,
        `Forma: ${form.name}`,
        `Alcance: ${range.name}${range.meters !== undefined ? ` (${range.meters}m)` : ''}`,
        `Intensidade: ${intensity.name}${intensity.dice ? ` ${intensity.dice}` : ''}`,
        ...(overCap && canOverride ? [`Excede o teto (${capNormal}) — vertente ${vertente?.name} paga com consequência.`] : [])
      ]
    };
    onSave(conj);
    setName('');
    setAllowOvercap(false);
  }

  return (
    <section className="rounded border border-ink-700 bg-ink-900/60 p-3 space-y-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Montar conjuração</p>

      <Field label="Nome (opcional)">
        <TextInput value={name} onChange={setName} placeholder="Ex: Cólera de Ferro" />
      </Field>

      <Picker
        label="Vertente"
        options={vertentes.map((v) => ({ id: v.id, name: v.name, description: v.description }))}
        value={vertenteId}
        onChange={setVertenteId}
      />

      <Picker
        label="Efeito"
        options={system.effects}
        value={effectId}
        onChange={setEffectId}
      />
      <Picker
        label="Forma"
        options={system.forms}
        value={formId}
        onChange={setFormId}
        badge={(o) => costBadge(o.costModifier)}
      />
      <Picker
        label="Alcance"
        options={system.ranges}
        value={rangeId}
        onChange={setRangeId}
        badge={(o) => costBadge(o.costModifier)}
        disabledAll={form?.ignoresRange}
        disabledHint={form?.ignoresRange ? 'Forma ignora alcance.' : undefined}
      />
      <Picker
        label="Intensidade"
        options={system.intensities}
        value={intensityId}
        onChange={setIntensityId}
        badge={(o) => {
          const parts: string[] = [];
          if (o.dice) parts.push(o.dice);
          parts.push(costBadge(o.costModifier));
          return parts.join(' · ');
        }}
      />

      <footer className="pt-2 border-t border-ink-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-ink-400">Custo total:</span>{' '}
            <span className={`font-mono ${overCap ? 'text-blood-400' : 'text-ember-400'}`}>
              {cost}
            </span>
            {overCap && (
              <span className="text-[11px] text-blood-400 ml-2">
                acima do teto normal ({capNormal})
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!effect || !form || !range || !intensity || saveBlocked}
            className="rounded bg-ember-400 text-ink-900 px-3 py-1 text-sm font-medium disabled:opacity-40"
            title={saveBlocked ? 'Reduza o custo ou selecione uma vertente que permita excedente.' : ''}
          >
            Adicionar à ficha
          </button>
        </div>
        {overCap && (
          canOverride ? (
            <label className="flex items-start gap-2 text-[11px] text-blood-400">
              <input
                type="checkbox"
                checked={allowOvercap}
                onChange={(e) => setAllowOvercap(e.target.checked)}
                className="mt-0.5 accent-blood-400"
              />
              <span>
                Pagar a consequência da vertente <span className="font-mono">{vertente?.id}</span>: {system.caps?.[vertente?.id ?? '']?.requirement ?? 'permite exceder o teto com penalidade.'}
              </span>
            </label>
          ) : (
            <p className="text-[11px] text-blood-400">
              Custo excede {capNormal}. Essa vertente não permite passar do teto — reduza a
              conjuração, mude para ancianica/abissal/sacrificial ou use uma híbrida.
            </p>
          )
        )}
      </footer>
    </section>
  );
}

function costBadge(m: number | undefined): string {
  if (!m || m === 0) return '+0';
  return `+${m}`;
}

// ---------- Picker ----------

function Picker<T extends SpellOption>({
  label,
  options,
  value,
  onChange,
  badge,
  disabledAll,
  disabledHint
}: {
  label: string;
  options: T[];
  value: string;
  onChange: (id: string) => void;
  badge?: (o: T) => string;
  disabledAll?: boolean;
  disabledHint?: string;
}) {
  return (
    <div>
      <p className="block text-xs uppercase tracking-[0.15em] text-ink-300 mb-1">
        {label} {disabledHint && <span className="text-ink-500 normal-case">— {disabledHint}</span>}
      </p>
      <ul className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <li key={o.id}>
              <button
                onClick={() => onChange(o.id)}
                disabled={disabledAll}
                className={`text-left rounded border px-2 py-1 text-xs transition-colors ${
                  active
                    ? 'border-ember-400 bg-ember-400/10 text-ember-400'
                    : 'border-ink-700 text-ink-200 enabled:hover:bg-ink-800 disabled:opacity-40'
                }`}
                title={o.description}
              >
                <span>{o.name}</span>
                {badge && <span className="ml-1.5 text-[10px] text-ink-400 font-mono">{badge(o)}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Saved row ----------

function SavedRow({
  conj,
  vertentes,
  onUpdate,
  onRemove
}: {
  conj: CharacterConjuration;
  vertentes: Vertente[];
  onUpdate: (patch: Partial<CharacterConjuration>) => void;
  onRemove: () => void;
}) {
  const vertName = vertentes.find((v) => v.id === conj.vertenteId)?.name ?? '?';
  return (
    <li className="rounded border border-ink-700 bg-ink-900/60 p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <input
            value={conj.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full bg-transparent text-ink-50 font-serif text-base focus:outline-none border-b border-transparent focus:border-ember-400"
          />
          <p className="text-[11px] text-ink-400 mt-0.5">
            Vertente: {vertName} · custo <span className="font-mono text-ember-400">{conj.cost ?? '?'}</span>
          </p>
          {conj.components && conj.components.length > 0 && (
            <ul className="mt-1 text-xs text-ink-300 space-y-0.5">
              {conj.components.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-blood-400 hover:text-blood-300"
          title="Remover"
        >
          remover
        </button>
      </div>
    </li>
  );
}

function freshId(): string {
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    const c = (globalThis as unknown as { crypto: Crypto }).crypto;
    if (c && 'randomUUID' in c) return 'sp_' + c.randomUUID().slice(0, 8);
  }
  return 'sp_' + Math.random().toString(36).slice(2, 10);
}
