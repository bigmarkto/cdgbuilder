'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DataContext } from '@/engine/context';
import { findRace } from '@/engine/context';
import { computeAttributes } from '@/engine/attributes';
import { computeDerived } from '@/engine/derived';
import { ATTR_IDS } from '@/engine/character';
import { computeXP } from '@/engine/xp';
import { ownedTalentsByTree } from '@/engine/trees';
import { ensureLevelHistory } from '@/engine/levelup';
import type { Vertente } from '@/lib/types';
import { useBuilderStore } from '@/lib/store';
import { LevelUpWizard } from './LevelUpWizard';
import { DownloadSheetButton } from './DownloadSheetButton';
import { DownloadTemplateButton } from './DownloadTemplateButton';
import { TraumaTracker } from './TraumaTracker';
import { SizeInfo } from './SizeInfo';
import { RulesReferencePanel } from './RulesReferencePanel';
import { ActiveConditionsTracker } from './ActiveConditionsTracker';

export function SheetView({ ctx, vertentes = [] }: { ctx: DataContext; vertentes?: Vertente[] }) {
  // Evita mismatch SSR/CSR: o store só hidrata no cliente.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const character = useBuilderStore((s) => s.character);
  const replaceCharacter = useBuilderStore((s) => s.replaceCharacter);

  // Backfill sintético do ledger para personagens migrados sem histórico.
  // Roda uma vez, só se o personagem está acima do nível 1 e não tem levelHistory.
  // Entradas sintéticas carregam `synthetic: true` — o jogador pode ver/editar depois.
  useEffect(() => {
    if (!hydrated) return;
    if (!ctx.levelGrants) return;
    if ((character.level ?? 1) <= 1) return;
    if ((character.levelHistory ?? []).length > 0) return;
    const next = ensureLevelHistory(ctx, character);
    if (next !== character) replaceCharacter(next);
    // Intencionalmente: depende só de hydrated + id; não queremos rodar a cada
    // mutação pequena. Na troca de ficha (id novo), reavalia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, character.id]);

  if (!hydrated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-ink-300">
        Carregando ficha…
      </div>
    );
  }

  const race = findRace(ctx, character.raceId);
  const subtype = race?.subtypes?.find((st) => st.id === character.subtypeId) ?? null;
  const attrs = computeAttributes(ctx, character);
  const d = computeDerived(ctx, character);
  const xp = computeXP(ctx, character);

  const sysAttrs = ctx.system.attributes ?? [];
  const profList = ctx.proficiencies.proficiencies ?? [];
  const subList = ctx.proficiencies.subProficiencies ?? [];

  const proficienciesTaken = Object.entries(character.proficiencies)
    .map(([id, rank]) => {
      const p = profList.find((x) => x.id === id);
      return { id, rank, name: p?.name ?? id, attribute: p?.attribute };
    })
    .filter((x) => x.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));

  const subsTaken = Object.entries(character.subProficiencies ?? {})
    .map(([id, rank]) => {
      const s = subList.find((x) => x.id === id);
      return {
        id,
        rank,
        name: s?.name ?? id,
        attribute: s?.attribute,
        parent: s?.parent ?? null
      };
    })
    .filter((x) => x.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));

  const ownedTalents = ownedTalentsByTree(ctx, character);

  const conjurations = character.conjurations ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 print:py-4 print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden gap-2">
        <Link href="/builder" className="text-sm text-ink-200 hover:text-ember-400">
          ← Voltar ao criador
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/builder/sheet/print"
            className="px-3 py-1.5 rounded border border-ink-500 text-ink-200 hover:text-ember-400 text-sm"
          >
            Preview HTML
          </Link>
          <DownloadSheetButton ctx={ctx} />
          <DownloadTemplateButton ctx={ctx} />
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded border border-ember-400/60 text-ember-400 hover:bg-ember-400/10"
          >
            Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <div className="mb-4 print:hidden">
        <LevelUpWizard ctx={ctx} />
      </div>

      {(ctx.rules?.trauma || ctx.rules?.sizes) && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 print:hidden">
          {ctx.rules?.trauma && <TraumaTracker ctx={ctx} />}
          {ctx.rules?.sizes && <SizeInfo ctx={ctx} raceSizeId={race?.size ?? null} />}
        </div>
      )}

      {ctx.rules?.conditions && (
        <div className="mb-4 print:hidden">
          <ActiveConditionsTracker ctx={ctx} />
        </div>
      )}

      <div className="mb-4 print:hidden">
        <RulesReferencePanel ctx={ctx} />
      </div>

      <article className="sheet">
        <header className="border-b-2 border-ink-100 pb-2 mb-3">
          <p className="text-[10px] uppercase tracking-[0.25em] sheet-muted">
            Cicatrizes do Gatilho · Ficha de Personagem
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-serif text-3xl sheet-heading">
              {character.name || 'Sem nome'}
            </h1>
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
                <li
                  key={id}
                  className="flex items-center justify-between rounded border border-ink-500 px-2 py-1"
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-wider sheet-muted">
                      {meta?.group ?? ''}
                    </p>
                    <p className="font-serif sheet-heading leading-none">{id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl sheet-accent leading-none">
                      {attrs[id].total}
                    </p>
                    <p className="font-mono text-[10px] sheet-muted">
                      {attrs[id].base}
                      {attrs[id].racial !== 0 &&
                        ` ${attrs[id].racial >= 0 ? '+' : ''}${attrs[id].racial}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Derivados">
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-sm">
            <Stat label="HP" value={d.HP_MAX} />
            <Stat label="DP" value={d.DP} />
            <Stat label="Iniciativa" value={`+${d.INICIATIVA}`} />
            <Stat label="Per. Passiva" value={d.PER_PASSIVA} />
            <Stat label="Movimento" value={`${d.MOVIMENTO}m`} />
            <Stat label="Dado de Vida" value={d.hitDie ?? '—'} />
            <Stat label="Carga" value={d.CARGA} />
            <Stat label="Pool Cósmica" value={d.POOL_ENERGIA_COSMICA} />
            <Stat label="Usos Energia" value={d.USOS_ENERGIA} />
            <Stat label="Mana Arcana" value={d.MANA_ARCANA} />
            <Stat label="Mana Divina" value={d.MANA_DIVINA} />
            <Stat label="Foco Corpo" value={d.FOCO_CORPO} />
            <Stat label="Foco Primal" value={d.FOCO_PRIMAL} />
            <Stat label="Mana Magitech" value={d.MANA_MAGITECH} />
            <Stat label="Grimório" value={d.GRIMORIO} />
            <Stat label="Esp. Conjuração" value={d.ESPACOS_CONJURACAO} />
          </ul>
        </Section>

        {proficienciesTaken.length > 0 && (
          <Section title="Proficiências">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
              {proficienciesTaken.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between">
                  <span className="sheet-body">
                    {p.name}
                    {p.attribute && (
                      <span className="text-[10px] sheet-muted ml-1">({p.attribute})</span>
                    )}
                  </span>
                  <span className="font-mono sheet-accent">R{p.rank}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {subsTaken.length > 0 && (
          <Section title="Sub-Proficiências">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
              {subsTaken.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between">
                  <span className="sheet-body">
                    {s.name}
                    {s.parent && (
                      <span className="text-[10px] sheet-muted ml-1">⮡ {s.parent}</span>
                    )}
                  </span>
                  <span className="font-mono sheet-accent">R{s.rank}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {ownedTalents.length > 0 && (
          <Section title="Talentos">
            <ul className="space-y-2 text-sm">
              {ownedTalents.map(({ tree, entries }) => (
                <li key={tree.id}>
                  <p className="font-serif sheet-heading text-base">{tree.name}</p>
                  <ul className="ml-3 mt-0.5 space-y-0.5">
                    {entries.map(({ tier, ability }) => (
                      <li key={ability.id} className="flex items-baseline justify-between gap-2">
                        <span className="sheet-body">
                          <span className="font-mono sheet-muted mr-1">T{tier.tier}</span>
                          {ability.name}
                          {ability.description && (
                            <span className="sheet-muted"> — {ability.description}</span>
                          )}
                        </span>
                        {typeof ability.cost === 'number' && ability.cost > 0 && (
                          <span className="font-mono text-[10px] sheet-muted shrink-0">
                            {ability.cost} XP
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {character.originalPower && character.originalPower.concept && (
          <Section title="Poder Original">
            <div className="rounded border border-ink-500 p-2 text-sm space-y-1">
              <KV label="Conceito" value={character.originalPower.concept} />
              {character.originalPower.trigger && (
                <KV label="Gatilho" value={character.originalPower.trigger} />
              )}
              {character.originalPower.costSource && (
                <KV label="Custo" value={character.originalPower.costSource} />
              )}
              {character.originalPower.effect && (
                <KV label="Efeito" value={character.originalPower.effect} />
              )}
              {character.originalPower.condition && (
                <KV label="Condição" value={character.originalPower.condition} />
              )}
              {character.originalPower.weakness && (
                <KV label="Fraqueza" value={character.originalPower.weakness} />
              )}
            </div>
            {character.originalPower.abilities && character.originalPower.abilities.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {character.originalPower.abilities
                  .filter((a) => a.name.trim() || a.description.trim())
                  .map((a) => (
                    <li
                      key={a.id}
                      className="rounded border border-ink-500 p-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-serif sheet-heading">{a.name || '(sem nome)'}</p>
                        {a.unlockedAt && (
                          <span className="text-[11px] sheet-muted font-mono">
                            {a.unlockedAt}
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <p className="sheet-body text-xs mt-0.5 whitespace-pre-line">
                          {a.description}
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </Section>
        )}

        {conjurations.length > 0 && (
          <Section title="Conjurações">
            <ul className="space-y-2 text-sm">
              {conjurations.map((c) => {
                const vert = vertentes.find((v) => v.id === c.vertenteId);
                return (
                  <li key={c.id} className="rounded border border-ink-500 p-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-serif sheet-heading">{c.name}</p>
                      <span className="font-mono text-[11px] sheet-accent">
                        custo {c.cost ?? '?'}
                      </span>
                    </div>
                    <p className="text-[11px] sheet-muted">
                      {vert?.name ?? 'Vertente ?'}
                      {c.form && ` · ${c.form}`}
                      {c.range && ` · ${c.range}`}
                      {c.intensity && ` · ${c.intensity}`}
                    </p>
                    {c.components && c.components.length > 0 && (
                      <ul className="mt-1 text-[11px] sheet-body space-y-0.5">
                        {c.components.map((comp, i) => (
                          <li key={i}>• {comp}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section title="XP">
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5 text-sm">
            <KVStat label="Total" value={xp.total} />
            <KVStat label="Nível atual" value={xp.levelCurrent} />
            <KVStat
              label="Próximo marco"
              value={xp.xpForNextLevel !== null ? xp.xpForNextLevel : '—'}
            />
            <KVStat label="Disponível" value={xp.available} />
            <KVStat label="Gasto" value={xp.spent} />
            <KVStat label="Restante" value={xp.remaining} />
          </ul>
          {xp.spent > 0 && (
            <p className="mt-1 text-[11px] sheet-muted font-mono">
              sub {xp.breakdown.subProficiencies} · poder {xp.breakdown.originalPower} · talentos{' '}
              {xp.breakdown.talents}
            </p>
          )}
        </Section>

        {(character.equipmentPackageId || character.equipmentNotes) && (
          <Section title="Equipamento">
            {character.equipmentPackageId && (
              <p className="text-sm sheet-body">
                <strong className="sheet-heading">Pacote:</strong>{' '}
                {labelForPackage(ctx, character.equipmentPackageId)}
              </p>
            )}
            {character.equipmentNotes && (
              <p className="text-sm sheet-body whitespace-pre-line mt-1">
                {character.equipmentNotes}
              </p>
            )}
          </Section>
        )}

        {character.scars.length > 0 && (
          <Section title="Cicatrizes">
            <ul className="space-y-1 text-sm">
              {character.scars.map((s) => (
                <li key={s.id}>
                  <strong className="sheet-heading">{s.name}</strong>
                  {s.note && <span className="sheet-body"> — {s.note}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(character.personality.motivation ||
          character.personality.appearance ||
          character.personality.history ||
          character.personality.bonds) && (
          <Section title="Personalidade">
            <div className="space-y-1 text-sm">
              {character.personality.motivation && (
                <KV label="Motivação" value={character.personality.motivation} />
              )}
              {character.personality.appearance && (
                <KV label="Aparência" value={character.personality.appearance} />
              )}
              {character.personality.history && (
                <KV label="História" value={character.personality.history} />
              )}
              {character.personality.bonds && (
                <KV label="Laços" value={character.personality.bonds} />
              )}
            </div>
          </Section>
        )}

        {character.notes && (
          <Section title="Notas">
            <p className="text-sm sheet-body whitespace-pre-line">{character.notes}</p>
          </Section>
        )}
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 print:mb-3">
      <h2 className="text-[11px] uppercase tracking-[0.25em] sheet-accent border-b border-ink-500 mb-1.5 pb-0.5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <li className="flex items-center justify-between rounded border border-ink-500 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wider sheet-muted">{label}</span>
      <span className="font-mono sheet-accent">{value}</span>
    </li>
  );
}

function KVStat({ label, value }: { label: string; value: string | number }) {
  return (
    <li className="flex items-baseline justify-between">
      <span className="sheet-body">{label}</span>
      <span className="font-mono sheet-accent">{value}</span>
    </li>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <p className="sheet-body">
      <strong className="sheet-heading">{label}:</strong>{' '}
      <span className="whitespace-pre-line">{value}</span>
    </p>
  );
}

function labelForPackage(ctx: DataContext, id: string): string {
  const pkgs =
    (ctx.creation as unknown as { initialEquipment?: { packages?: Array<{ id: string; name: string; contents?: string }> } })
      .initialEquipment?.packages ?? [];
  const pkg = pkgs.find((x) => x.id === id);
  if (!pkg) return id;
  return pkg.contents ? `${pkg.name} — ${pkg.contents}` : pkg.name;
}
