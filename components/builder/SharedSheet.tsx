/**
 * SharedSheet — render read-only de uma ficha compartilhada (server component).
 *
 * Não usa o store nem 'use client': recebe ctx + Character já coercido e roda
 * o engine puro (computeAttributes/Derived/XP) no servidor. Espelha as seções
 * essenciais do SheetView, sem nenhum controle de edição.
 */
import type { DataContext } from '@/engine/context';
import { findRace } from '@/engine/context';
import { computeAttributes } from '@/engine/attributes';
import { computeDerived } from '@/engine/derived';
import { computeXP } from '@/engine/xp';
import { ATTR_IDS, type Character } from '@/engine/character';

export function SharedSheet({ ctx, character }: { ctx: DataContext; character: Character }) {
  const race = findRace(ctx, character.raceId);
  const subtype = race?.subtypes?.find((st) => st.id === character.subtypeId) ?? null;
  const attrs = computeAttributes(ctx, character);
  const d = computeDerived(ctx, character);
  const xp = computeXP(ctx, character);

  const sysAttrs = ctx.system.attributes ?? [];
  const profList = ctx.proficiencies.proficiencies ?? [];
  const subList = ctx.proficiencies.subProficiencies ?? [];

  const profsTaken = Object.entries(character.proficiencies ?? {})
    .map(([id, rank]) => ({ id, rank, name: profList.find((x) => x.id === id)?.name ?? id }))
    .filter((x) => x.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));

  const subsTaken = Object.entries(character.subProficiencies ?? {})
    .map(([id, rank]) => ({ id, rank, name: subList.find((x) => x.id === id)?.name ?? id }))
    .filter((x) => x.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));

  const talentCount = Object.values(character.talents ?? {}).filter((v) => v > 0).length;

  return (
    <article className="sheet">
      <header className="border-b-2 border-ink-100 pb-2 mb-3">
        <p className="text-[10px] uppercase tracking-[0.25em] sheet-muted">
          Cicatrizes do Gatilho · Ficha compartilhada
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-serif text-3xl sheet-heading">{character.name || 'Sem nome'}</h1>
          <p className="text-sm sheet-muted">
            Nível {character.level} · {race?.name ?? '—'}
            {subtype && ` · ${subtype.name}`}
          </p>
        </div>
        {character.concept && <p className="sheet-body mt-1 italic">{character.concept}</p>}
      </header>

      <Section title="Atributos">
        <ul className="grid grid-cols-3 gap-2">
          {ATTR_IDS.map((id) => {
            const meta = sysAttrs.find((x) => x.id === id);
            return (
              <li key={id} className="flex items-baseline justify-between border-b border-ink-200/40 py-0.5">
                <span className="text-xs sheet-muted">{meta?.name ?? id}</span>
                <span className="font-mono sheet-body">{attrs[id].total}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Derivados">
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
          <Stat label="HP" value={d.HP_MAX} />
          <Stat label="DP" value={d.DP} />
          <Stat label="Iniciativa" value={`+${d.INICIATIVA}`} />
          <Stat label="Per. Passiva" value={d.PER_PASSIVA} />
          <Stat label="Movimento" value={`${d.MOVIMENTO}m`} />
          <Stat label="Dado de Vida" value={d.hitDie ?? '—'} />
          <Stat label="Carga" value={d.CARGA} />
          <Stat label="Pool Cósmica" value={d.POOL_ENERGIA_COSMICA} />
          <Stat label="Influência" value={d.INFLUENCIA} />
          <Stat label="Engenhocas" value={d.ENGENHOCAS} />
          <Stat label="Nível / XP" value={`${xp.levelCurrent} · ${xp.total}`} />
        </ul>
      </Section>

      {profsTaken.length > 0 && (
        <Section title="Proficiências">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
            {profsTaken.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="sheet-body">{p.name}</span>
                <span className="font-mono sheet-muted">R{p.rank}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {subsTaken.length > 0 && (
        <Section title="Sub-proficiências">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
            {subsTaken.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="sheet-body">{p.name}</span>
                <span className="font-mono sheet-muted">R{p.rank}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {character.originalPower && character.originalPower.concept && (
        <Section title="Poder Original">
          <p className="sheet-body font-medium">
            {character.originalPower.concept}{' '}
            <span className="sheet-muted font-normal">· Rank {character.originalPower.rank}</span>
          </p>
          {character.originalPower.effect && (
            <p className="sheet-body text-sm mt-0.5">{character.originalPower.effect}</p>
          )}
        </Section>
      )}

      {(character.conjurations?.length ?? 0) > 0 && (
        <Section title="Conjurações">
          <ul className="space-y-1 text-sm">
            {character.conjurations.map((c) => (
              <li key={c.id} className="sheet-body">
                <span className="font-medium">{c.name || 'Conjuração'}</span>
                {c.rank ? <span className="sheet-muted"> · R{c.rank}</span> : null}
                {c.notes ? <span className="sheet-muted"> — {c.notes}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {talentCount > 0 && (
        <Section title="Talentos">
          <p className="sheet-body text-sm">{talentCount} habilidade(s) de árvore adquirida(s).</p>
        </Section>
      )}

      {character.scars.length > 0 && (
        <Section title="Cicatrizes">
          <ul className="space-y-0.5 text-sm">
            {character.scars.map((s, i) => (
              <li key={`${s.id}-${i}`} className="sheet-body">
                {s.name}
                {s.note ? <span className="sheet-muted"> — {s.note}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(character.personality.appearance ||
        character.personality.history ||
        character.personality.motivation ||
        character.personality.bonds) && (
        <Section title="Personalidade">
          <dl className="space-y-1 text-sm">
            {character.personality.appearance && (
              <PersonalityRow label="Aparência" value={character.personality.appearance} />
            )}
            {character.personality.motivation && (
              <PersonalityRow label="Motivação" value={character.personality.motivation} />
            )}
            {character.personality.bonds && (
              <PersonalityRow label="Vínculos" value={character.personality.bonds} />
            )}
            {character.personality.history && (
              <PersonalityRow label="História" value={character.personality.history} />
            )}
          </dl>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h2 className="text-[11px] uppercase tracking-[0.2em] sheet-muted border-b border-ink-200/40 mb-1.5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <li className="flex items-baseline justify-between border-b border-ink-200/30 py-0.5">
      <span className="text-xs sheet-muted">{label}</span>
      <span className="font-mono sheet-body">{value}</span>
    </li>
  );
}

function PersonalityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider sheet-muted">{label}</dt>
      <dd className="sheet-body whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
