'use client';

import type { DataContext } from '@/engine/context';
import { findRace } from '@/engine/context';
import { computeAttributes } from '@/engine/attributes';
import { computeDerived } from '@/engine/derived';
import { ATTR_IDS } from '@/engine/character';
import { computeXP } from '@/engine/xp';
import { useBuilderStore } from '@/lib/store';

export function LiveSidebar({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);
  const attrs = computeAttributes(ctx, character);
  const derived = computeDerived(ctx, character);
  const race = findRace(ctx, character.raceId);
  const xp = computeXP(ctx, character);

  return (
    <aside className="lg:sticky lg:top-20 self-start space-y-4">
      <section className="rounded border border-ink-700 bg-ink-900/60 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-1">Ficha ao vivo</p>
        <p className="font-serif text-lg text-ink-50 truncate">{character.name || 'Sem nome'}</p>
        <p className="text-xs text-ink-300">
          {race?.name ?? 'Raça ?'} · Nível {character.level}
        </p>
      </section>

      <section className="rounded border border-ink-700 bg-ink-900/60 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2">XP</p>
        <ul className="text-xs space-y-0.5">
          <Row label="Total" value={xp.total} />
          <Row
            label={xp.xpForNextLevel !== null ? `Próximo nv ${xp.levelCurrent + 1}` : 'Topo'}
            value={xp.xpForNextLevel !== null ? xp.xpForNextLevel : '—'}
          />
          {xp.xpToNextLevel !== null && <Row label="Falta" value={xp.xpToNextLevel} />}
          <li className="border-t border-ink-800 my-1" />
          <Row label="Disponível" value={xp.available} />
          <Row label="Gasto" value={xp.spent} />
          <Row
            label="Restante"
            value={xp.remaining}
            tone={xp.remaining < 0 ? 'bad' : xp.remaining === 0 ? 'muted' : 'good'}
          />
          {xp.spent > 0 && (
            <li className="pt-1 text-[10px] text-ink-400 font-mono">
              sub {xp.breakdown.subProficiencies} · poder {xp.breakdown.originalPower} · tal{' '}
              {xp.breakdown.talents}
            </li>
          )}
        </ul>
        {xp.violations.length > 0 && (
          <p className="mt-1 text-[10px] text-blood-400">{xp.violations[0]}</p>
        )}
      </section>

      <section className="rounded border border-ink-700 bg-ink-900/60 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2">Atributos</p>
        <ul className="grid grid-cols-3 gap-1 text-xs font-mono">
          {ATTR_IDS.map((id) => {
            const a = attrs[id];
            const parts: string[] = [`base ${a.base}`];
            if (a.racial) parts.push(`racial ${a.racial >= 0 ? '+' : ''}${a.racial}`);
            if (a.effects) parts.push(`mods ${a.effects >= 0 ? '+' : ''}${a.effects}`);
            const tip = parts.join(' · ');
            return (
              <li
                key={id}
                className="flex justify-between rounded bg-ink-800/60 px-1.5 py-1"
                title={tip}
              >
                <span className="text-ink-300">{id}</span>
                <span className="text-ember-400">{a.total}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded border border-ink-700 bg-ink-900/60 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2">Derivados</p>
        <ul className="text-xs space-y-0.5">
          <Row label="HP" value={derived.HP_MAX} tip={tipForContributors(derived.contributors?.HP_MAX)} />
          <Row label="DP" value={derived.DP} tip={tipForContributors(derived.contributors?.DP)} />
          <Row label="Iniciativa" value={`+${derived.INICIATIVA}`} tip={tipForContributors(derived.contributors?.INICIATIVA)} />
          <Row label="Per. passiva" value={derived.PER_PASSIVA} tip={tipForContributors(derived.contributors?.PER_PASSIVA)} />
          <Row label="Movimento" value={`${derived.MOVIMENTO}m`} tip={tipForContributors(derived.contributors?.MOVIMENTO)} />
          <Row label="Dado de Vida" value={derived.hitDie ?? '—'} />
          <Row label="Pool Cósmica" value={derived.POOL_ENERGIA_COSMICA} tip={tipForContributors(derived.contributors?.POOL_ENERGIA_COSMICA)} />
          <Row label="Usos Energia" value={derived.USOS_ENERGIA} />
          <Row label="Carga" value={derived.CARGA} />
        </ul>
      </section>
    </aside>
  );
}

function tipForContributors(
  contributors?: Array<{ source: { name?: string; id: string }; op: string; value: number | string }>
): string | undefined {
  if (!contributors || contributors.length === 0) return undefined;
  return contributors
    .map((c) => `${c.source.name ?? c.source.id}: ${c.op} ${c.value}`)
    .join(' · ');
}

function Row({
  label,
  value,
  tone = 'default',
  tip
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'good' | 'bad' | 'muted';
  tip?: string;
}) {
  const toneClass =
    tone === 'bad' ? 'text-blood-400' : tone === 'muted' ? 'text-ink-400' : 'text-ember-400';
  return (
    <li className="flex justify-between" title={tip}>
      <span className={`text-ink-300 ${tip ? 'underline decoration-dotted decoration-ink-500 underline-offset-2' : ''}`}>{label}</span>
      <span className={`font-mono ${toneClass}`}>{value}</span>
    </li>
  );
}
