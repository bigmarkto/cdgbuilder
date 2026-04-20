// Gerador de ficha HTML estática — sem React, sem JSX, sem dependências
// de runtime do Next.js. Recebe ctx + character, devolve uma string HTML
// completa (document.html) pronta para download ou impressão.
//
// Estilização CDG: paleta ink (fundos/neutros) + blood (destaques
// dramáticos) + ember (números e títulos). Inspirado no layout
// Ficha-Vale-Desperto-v1.8.html, mas com tipografia e hierarquia próprias.

import type { Character } from '../character';
import type { DataContext } from '../context';
import { computeAttributes } from '../attributes';
import { computeDerived } from '../derived';
import { findRace } from '../context';
import { ownedTalentsByTree } from '../trees';
import { computeXP } from '../xp';
import { ATTR_IDS } from '../character';
import {
  sizeInfo,
  traumaStage,
  atBreakingPoint,
  findCondition,
  conditionEffects,
  isStaged
} from '../rules';

/** Escapa HTML para evitar injeção via nomes/descrições do jogador. */
function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Preserva quebras de linha no HTML (respeita textarea multi-linha). */
function escMulti(s: unknown): string {
  return esc(s).replace(/\n/g, '<br>');
}

export interface RenderSheetOptions {
  /** Título da tag <title> e cabeçalho. Default: nome do personagem. */
  title?: string;
  /** Inline quase tudo — default true para arquivo portátil. */
  embedCss?: boolean;
}

/**
 * Produz o HTML completo (<!doctype html>…) da ficha.
 * Deve ser puro: mesma entrada ⇒ mesma saída.
 */
export function renderSheetHtml(
  ctx: DataContext,
  character: Character,
  opts: RenderSheetOptions = {}
): string {
  const title = opts.title ?? character.name ?? 'Ficha CDG';
  const embedCss = opts.embedCss !== false;

  const race = findRace(ctx, character.raceId);
  const subtype =
    race?.subtypes?.find((st) => st.id === character.subtypeId) ?? null;
  const attrs = computeAttributes(ctx, character);
  const d = computeDerived(ctx, character);
  const xp = computeXP(ctx, character);

  // Vale Desperto v2.0 — opcionais, só renderizam se o bundle de regras
  // estiver presente em `ctx.rules` e o dado existir no personagem.
  const size =
    ctx.rules?.sizes && race?.size ? sizeInfo(ctx.rules.sizes, race.size) : null;
  const traumaLevel = character.trauma ?? 0;
  const traumaBlock = ctx.rules?.trauma
    ? {
        stage: traumaStage(ctx.rules.trauma, traumaLevel),
        level: traumaLevel,
        max: Math.max(...ctx.rules.trauma.track.map((s) => s.level)),
        atBreak: atBreakingPoint(ctx.rules.trauma, traumaLevel)
      }
    : null;

  // Condições ativas — enriquecidas com dados do catálogo em ctx.rules.conditions.
  const activeConds =
    ctx.rules?.conditions && character.activeConditions
      ? character.activeConditions
          .map((ac) => {
            const rec = findCondition(ctx.rules!.conditions!, ac.id);
            if (!rec) return null;
            const staged = isStaged(rec);
            const effects = conditionEffects(rec, staged ? ac.stage ?? 1 : undefined);
            return { ac, rec, staged, effects };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

  const sysAttrs = ctx.system.attributes ?? [];
  const profList = ctx.proficiencies.proficiencies ?? [];
  const subList = ctx.proficiencies.subProficiencies ?? [];
  const vertentes = ctx.vertentes ?? [];

  const profsTaken = Object.entries(character.proficiencies)
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
  const opAbilities = character.originalPower?.abilities ?? [];
  // Garante no mínimo 4 slots renderizados (como solicitado): slots extras
  // aparecem em branco para serem preenchidos à mão no impresso.
  const SLOTS_MIN = 4;
  const extraSlots = Math.max(0, SLOTS_MIN - opAbilities.length);

  const body = `
    <header class="cdg-header">
      <p class="cdg-eyebrow">Cicatrizes do Gatilho · Ficha de Personagem</p>
      <div class="cdg-title-row">
        <h1>${esc(character.name || 'Sem nome')}</h1>
        <p class="cdg-subtitle">
          Nível ${esc(character.level)} · ${esc(race?.name ?? '—')}${
            subtype ? ' · ' + esc(subtype.name) : ''
          }${size ? ' · ' + esc(size.name) : ''}
        </p>
      </div>
      ${character.concept ? `<p class="cdg-concept">${esc(character.concept)}</p>` : ''}
    </header>

    <section class="cdg-block">
      <h2>Atributos</h2>
      <ul class="cdg-attr-grid">
        ${ATTR_IDS.map((id) => {
          const meta = sysAttrs.find((x) => x.id === id);
          const a = attrs[id];
          return `
            <li>
              <p class="cdg-eyebrow">${esc(meta?.group ?? '')}</p>
              <div class="cdg-attr-row">
                <span class="cdg-attr-key">${esc(id)}</span>
                <span class="cdg-attr-val">${esc(a.total)}</span>
              </div>
              <p class="cdg-attr-note">
                base ${esc(a.base)}${a.racial !== 0 ? ' ' + (a.racial >= 0 ? '+' : '') + esc(a.racial) : ''}
              </p>
            </li>
          `;
        }).join('')}
      </ul>
    </section>

    <section class="cdg-block">
      <h2>Derivados</h2>
      <ul class="cdg-derived-grid">
        ${renderStat('HP', d.HP_MAX)}
        ${renderStat('DP', d.DP)}
        ${renderStat('Iniciativa', '+' + d.INICIATIVA)}
        ${renderStat('Per. Passiva', d.PER_PASSIVA)}
        ${renderStat('Movimento', d.MOVIMENTO + 'm')}
        ${renderStat('Dado de Vida', d.hitDie ?? '—')}
        ${renderStat('Carga', d.CARGA)}
        ${renderStat('Pool Cósmica', d.POOL_ENERGIA_COSMICA)}
        ${renderStat('Usos Energia', d.USOS_ENERGIA)}
        ${renderStat('Mana Arcana', d.MANA_ARCANA)}
        ${renderStat('Mana Divina', d.MANA_DIVINA)}
        ${renderStat('Foco Corpo', d.FOCO_CORPO)}
        ${renderStat('Foco Primal', d.FOCO_PRIMAL)}
        ${renderStat('Mana Magitech', d.MANA_MAGITECH)}
        ${renderStat('Grimório', d.GRIMORIO)}
        ${renderStat('Esp. Conjuração', d.ESPACOS_CONJURACAO)}
      </ul>
    </section>

    ${
      size
        ? `
        <section class="cdg-block">
          <h2>Tamanho — ${esc(size.name)}</h2>
          <ul class="cdg-derived-grid">
            ${renderStat('Espaço', size.spaceMeters + 'm')}
            ${renderStat('Alcance', size.reachMeters + 'm')}
            ${renderStat('Carga ×', size.carryMult)}
            ${renderStat('Ataque', formatSigned(size.attackMod))}
            ${renderStat('Furtividade', formatSigned(size.stealthMod))}
            ${renderStat('Ordem', formatSigned(size.order))}
          </ul>
          <p class="cdg-note">
            Ataque/Furtividade = diferenciais vs. alvo Médio; aplicar ±1 por categoria
            de diferença (clamp ±3).
          </p>
        </section>
      `
        : ''
    }

    ${
      traumaBlock
        ? `
        <section class="cdg-block">
          <h2>Trauma — ${esc(traumaBlock.stage.name)}</h2>
          <ul class="cdg-trauma-pips">
            ${Array.from({ length: traumaBlock.max + 1 }, (_, i) => {
              const filled = i > 0 && i <= traumaBlock.level;
              const peak = i > 0 && i === traumaBlock.max && filled;
              return `<li class="cdg-pip${filled ? ' cdg-pip-on' : ''}${
                peak ? ' cdg-pip-peak' : ''
              }"></li>`;
            }).join('')}
            <li class="cdg-pip-label">
              ${esc(traumaBlock.level)} / ${esc(traumaBlock.max)}
            </li>
          </ul>
          ${
            traumaBlock.stage.effects && traumaBlock.stage.effects.length > 0
              ? `
              <ul class="cdg-trauma-effects">
                ${traumaBlock.stage.effects
                  .map(
                    (e) =>
                      `<li>• ${esc(
                        (e as { text?: unknown; type?: unknown }).text ??
                          (e as { type?: unknown }).type ??
                          ''
                      )}</li>`
                  )
                  .join('')}
              </ul>
            `
              : ''
          }
          ${
            traumaBlock.atBreak
              ? `<p class="cdg-note cdg-trauma-break">Próximo gatilho força rolagem na Tabela de Cicatrizes Psíquicas.</p>`
              : ''
          }
        </section>
      `
        : ''
    }

    ${
      activeConds.length > 0
        ? `
        <section class="cdg-block">
          <h2>Condições Ativas</h2>
          <ul class="cdg-conditions">
            ${activeConds
              .map(({ ac, rec, staged, effects }) => {
                const effectsText = effects
                  .map(
                    (e) =>
                      (e as { text?: unknown; type?: unknown }).text ??
                      (e as { type?: unknown }).type ??
                      ''
                  )
                  .filter(Boolean) as string[];
                return `
                <li>
                  <p class="cdg-cond-head">
                    <strong>${esc(rec.name)}</strong>
                    ${
                      staged && ac.stage !== undefined
                        ? `<span class="cdg-cond-stage">·${esc(ac.stage)}</span>`
                        : ''
                    }
                    ${ac.note ? `<span class="cdg-cond-note">— ${esc(ac.note)}</span>` : ''}
                  </p>
                  ${
                    effectsText.length > 0
                      ? `<ul class="cdg-cond-effects">${effectsText
                          .map((t) => `<li>• ${esc(t)}</li>`)
                          .join('')}</ul>`
                      : ''
                  }
                </li>
              `;
              })
              .join('')}
          </ul>
        </section>
      `
        : ''
    }

    ${
      profsTaken.length > 0
        ? `
        <section class="cdg-block">
          <h2>Proficiências</h2>
          <ul class="cdg-two-col">
            ${profsTaken
              .map(
                (p) => `
              <li>
                <span>${esc(p.name)}${
                  p.attribute ? ` <em>(${esc(p.attribute)})</em>` : ''
                }</span>
                <span class="cdg-rank">R${esc(p.rank)}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </section>
      `
        : ''
    }

    ${
      subsTaken.length > 0
        ? `
        <section class="cdg-block">
          <h2>Sub-Proficiências</h2>
          <ul class="cdg-two-col">
            ${subsTaken
              .map(
                (s) => `
              <li>
                <span>${esc(s.name)}${
                  s.parent ? ` <em>⮡ ${esc(s.parent)}</em>` : ''
                }</span>
                <span class="cdg-rank">R${esc(s.rank)}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </section>
      `
        : ''
    }

    ${
      ownedTalents.length > 0
        ? `
        <section class="cdg-block">
          <h2>Talentos</h2>
          <ul class="cdg-talent-list">
            ${ownedTalents
              .map(
                ({ tree, entries }) => `
              <li>
                <p class="cdg-talent-tree">${esc(tree.name)}</p>
                <ul>
                  ${entries
                    .map(
                      ({ tier, ability }) => `
                    <li>
                      <span class="cdg-tier">T${esc(tier.tier)}</span>
                      <span class="cdg-ability-name">${esc(ability.name)}</span>
                      ${
                        ability.description
                          ? `<span class="cdg-ability-desc"> — ${esc(ability.description)}</span>`
                          : ''
                      }
                      ${
                        typeof ability.cost === 'number' && ability.cost > 0
                          ? `<span class="cdg-cost">${esc(ability.cost)} XP</span>`
                          : ''
                      }
                    </li>
                  `
                    )
                    .join('')}
                </ul>
              </li>
            `
              )
              .join('')}
          </ul>
        </section>
      `
        : ''
    }

    ${
      character.originalPower && character.originalPower.concept
        ? `
        <section class="cdg-block">
          <h2>Poder Original</h2>
          <div class="cdg-op-core">
            ${kv('Conceito', character.originalPower.concept)}
            ${character.originalPower.trigger ? kv('Gatilho', character.originalPower.trigger) : ''}
            ${character.originalPower.costSource ? kv('Custo', character.originalPower.costSource) : ''}
            ${character.originalPower.effect ? kv('Efeito', character.originalPower.effect) : ''}
            ${character.originalPower.condition ? kv('Condição', character.originalPower.condition) : ''}
            ${character.originalPower.weakness ? kv('Fraqueza', character.originalPower.weakness) : ''}
            ${kv('Rank', String(character.originalPower.rank))}
          </div>

          <p class="cdg-eyebrow cdg-slots-title">Habilidades / Slots Extras</p>
          <ol class="cdg-op-slots">
            ${opAbilities
              .map(
                (a, i) => `
              <li>
                <span class="cdg-slot-idx">${i + 1}</span>
                <div>
                  <p class="cdg-slot-head">
                    <strong>${esc(a.name || '(sem nome)')}</strong>
                    ${a.unlockedAt ? `<span class="cdg-slot-tag">${esc(a.unlockedAt)}</span>` : ''}
                  </p>
                  ${
                    a.description
                      ? `<p class="cdg-slot-desc">${escMulti(a.description)}</p>`
                      : ''
                  }
                </div>
              </li>
            `
              )
              .join('')}
            ${Array.from({ length: extraSlots })
              .map(
                (_, i) => `
              <li class="cdg-slot-empty">
                <span class="cdg-slot-idx">${opAbilities.length + i + 1}</span>
                <div>
                  <p class="cdg-slot-head"><em>slot vazio</em></p>
                  <p class="cdg-slot-desc cdg-slot-line"></p>
                  <p class="cdg-slot-desc cdg-slot-line"></p>
                </div>
              </li>
            `
              )
              .join('')}
          </ol>
        </section>
      `
        : ''
    }

    ${
      conjurations.length > 0
        ? `
        <section class="cdg-block">
          <h2>Conjurações (Montagem Modular)</h2>
          <p class="cdg-note">
            Cada conjuração = Vertente + Efeito + Forma + Alcance + Intensidade.
            Custo resultante é aplicado ao orçamento da pool/vertente do personagem.
          </p>
          <ul class="cdg-conj-list">
            ${conjurations
              .map((c) => {
                const vert = vertentes.find((v) => v.id === c.vertenteId);
                return `
                <li>
                  <div class="cdg-conj-head">
                    <strong>${esc(c.name)}</strong>
                    <span class="cdg-conj-cost">custo ${esc(c.cost ?? '?')}</span>
                  </div>
                  <p class="cdg-conj-meta">
                    ${esc(vert?.name ?? 'Vertente ?')}
                    ${c.form ? ' · ' + esc(c.form) : ''}
                    ${c.range ? ' · ' + esc(c.range) : ''}
                    ${c.intensity ? ' · ' + esc(c.intensity) : ''}
                    · Rank ${esc(c.rank)}
                  </p>
                  ${
                    c.components && c.components.length > 0
                      ? `<ul class="cdg-conj-components">${c.components
                          .map((comp) => `<li>• ${esc(comp)}</li>`)
                          .join('')}</ul>`
                      : ''
                  }
                  ${c.notes ? `<p class="cdg-conj-notes">${escMulti(c.notes)}</p>` : ''}
                </li>
              `;
              })
              .join('')}
          </ul>
        </section>
      `
        : ''
    }

    <section class="cdg-block">
      <h2>XP</h2>
      <ul class="cdg-two-col">
        ${kvLine('Total', String(xp.total))}
        ${kvLine('Nível atual', String(xp.levelCurrent))}
        ${kvLine(
          'Próximo marco',
          xp.xpForNextLevel !== null ? String(xp.xpForNextLevel) : '—'
        )}
        ${kvLine('XP disponível', String(xp.available))}
        ${kvLine('XP gasto', String(xp.spent))}
        ${kvLine('XP restante', String(xp.remaining))}
      </ul>
      ${
        xp.spent > 0
          ? `<p class="cdg-note">sub ${xp.breakdown.subProficiencies} · poder ${xp.breakdown.originalPower} · talentos ${xp.breakdown.talents}</p>`
          : ''
      }
    </section>

    ${
      character.scars && character.scars.length > 0
        ? `
        <section class="cdg-block">
          <h2>Cicatrizes</h2>
          <ul class="cdg-scars">
            ${character.scars
              .map(
                (s) => `
              <li>
                <strong>${esc(s.name)}</strong>${
                  s.note ? `<span> — ${esc(s.note)}</span>` : ''
                }
              </li>
            `
              )
              .join('')}
          </ul>
        </section>
      `
        : ''
    }

    ${
      character.personality &&
      (character.personality.motivation ||
        character.personality.appearance ||
        character.personality.history ||
        character.personality.bonds)
        ? `
        <section class="cdg-block">
          <h2>Personalidade</h2>
          <div class="cdg-personality">
            ${character.personality.motivation ? kv('Motivação', character.personality.motivation) : ''}
            ${character.personality.appearance ? kv('Aparência', character.personality.appearance) : ''}
            ${character.personality.history ? kv('História', character.personality.history) : ''}
            ${character.personality.bonds ? kv('Laços', character.personality.bonds) : ''}
          </div>
        </section>
      `
        : ''
    }

    ${
      character.notes
        ? `
        <section class="cdg-block">
          <h2>Notas</h2>
          <p class="cdg-notes">${escMulti(character.notes)}</p>
        </section>
      `
        : ''
    }

    <footer class="cdg-footer">
      <p>
        CDG Builder · gerado em ${esc(new Date().toISOString().slice(0, 10))} ·
        ruleset <code>${esc(character.rulesetId)}</code>
      </p>
    </footer>
  `;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  ${embedCss ? `<style>${SHEET_CSS}</style>` : ''}
</head>
<body>
  <main class="cdg-sheet">
    ${body}
  </main>
</body>
</html>`;
}

// --- helpers ---

function renderStat(label: string, value: string | number): string {
  return `
    <li>
      <span class="cdg-stat-label">${esc(label)}</span>
      <span class="cdg-stat-val">${esc(value)}</span>
    </li>
  `;
}

function kv(label: string, value: string): string {
  return `<p class="cdg-kv"><strong>${esc(label)}:</strong> <span>${escMulti(value)}</span></p>`;
}

function kvLine(label: string, value: string): string {
  return `<li><span>${esc(label)}</span><span class="cdg-rank">${esc(value)}</span></li>`;
}

function formatSigned(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : String(n);
}

// --- CSS (paleta CDG: ink/blood/ember) ---

export const SHEET_CSS = `
:root {
  --ink-50: #f5f0e6;
  --ink-100: #e6dbc5;
  --ink-200: #b6a887;
  --ink-300: #9a8e73;
  --ink-400: #6b6350;
  --ink-500: #3a3327;
  --ink-700: #1f1b13;
  --ink-800: #17140e;
  --ink-900: #0d0b07;
  --blood-400: #c04c3b;
  --blood-500: #8a2c22;
  --ember-300: #f3b755;
  --ember-400: #d68c2c;
  --ember-500: #a5601b;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--ink-900);
  color: var(--ink-100);
  font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  line-height: 1.4;
  padding: 24px 16px;
}
.cdg-sheet {
  max-width: 840px;
  margin: 0 auto;
  background: var(--ink-800);
  border: 1px solid var(--ink-500);
  padding: 24px 28px;
}
h1 {
  font-family: inherit;
  color: var(--ember-300);
  font-size: 32px;
  font-weight: 700;
  margin: 0;
}
h2 {
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--ember-400);
  border-bottom: 1px solid var(--ink-500);
  padding-bottom: 4px;
  margin: 0 0 10px;
}
.cdg-header { border-bottom: 2px solid var(--ink-200); padding-bottom: 12px; margin-bottom: 16px; }
.cdg-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cdg-eyebrow { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-300); margin: 0 0 4px; }
.cdg-subtitle { color: var(--ink-200); font-size: 13px; margin: 0; }
.cdg-concept { color: var(--ink-100); font-style: italic; margin: 4px 0 0; }
.cdg-block { margin-bottom: 16px; page-break-inside: avoid; }
.cdg-attr-grid, .cdg-derived-grid, .cdg-two-col, .cdg-op-slots, .cdg-conj-list, .cdg-scars, .cdg-talent-list {
  list-style: none; padding: 0; margin: 0;
}
.cdg-attr-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.cdg-attr-grid li {
  border: 1px solid var(--ink-500);
  padding: 6px 10px;
}
.cdg-attr-row { display: flex; align-items: baseline; justify-content: space-between; }
.cdg-attr-key { font-size: 18px; color: var(--ember-300); font-weight: 700; }
.cdg-attr-val { font-family: 'Menlo', 'Consolas', monospace; font-size: 22px; color: var(--ember-400); }
.cdg-attr-note { margin: 2px 0 0; font-size: 10px; color: var(--ink-300); font-family: 'Menlo', 'Consolas', monospace; }
.cdg-derived-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.cdg-derived-grid li {
  border: 1px solid var(--ink-500);
  padding: 4px 8px;
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 12px;
}
.cdg-stat-label { text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; color: var(--ink-300); }
.cdg-stat-val { font-family: 'Menlo', 'Consolas', monospace; color: var(--ember-400); }
.cdg-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.cdg-two-col li { display: flex; justify-content: space-between; font-size: 13px; }
.cdg-two-col li em { color: var(--ink-300); font-style: normal; font-size: 10px; }
.cdg-rank { font-family: 'Menlo', 'Consolas', monospace; color: var(--ember-400); }
.cdg-talent-list li { margin-bottom: 6px; }
.cdg-talent-tree { font-size: 14px; color: var(--ember-300); margin: 0 0 2px; font-weight: 700; }
.cdg-talent-list ul { list-style: none; padding: 0 0 0 12px; margin: 0; }
.cdg-talent-list ul li { font-size: 12px; margin: 0; }
.cdg-tier { font-family: 'Menlo', 'Consolas', monospace; color: var(--ink-300); margin-right: 4px; }
.cdg-ability-name { color: var(--ink-100); }
.cdg-ability-desc { color: var(--ink-300); }
.cdg-cost { margin-left: 6px; font-size: 10px; color: var(--ink-300); font-family: 'Menlo', 'Consolas', monospace; }
.cdg-op-core { margin-bottom: 10px; border: 1px solid var(--ink-500); padding: 8px; }
.cdg-kv { margin: 0 0 3px; font-size: 13px; }
.cdg-kv strong { color: var(--ember-400); }
.cdg-slots-title { margin-top: 6px !important; }
.cdg-op-slots { display: grid; gap: 6px; counter-reset: opslot; }
.cdg-op-slots > li {
  display: flex; gap: 8px; align-items: flex-start;
  border: 1px solid var(--ink-500); padding: 6px 8px;
}
.cdg-op-slots.cdg-slot-empty { opacity: 0.7; }
.cdg-slot-idx {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px;
  border: 1px solid var(--ember-400); color: var(--ember-300);
  border-radius: 50%; font-size: 11px; font-family: 'Menlo', 'Consolas', monospace;
}
.cdg-slot-head { margin: 0; font-size: 13px; color: var(--ink-50); display: flex; gap: 6px; align-items: baseline; }
.cdg-slot-tag { color: var(--ink-300); font-size: 10px; font-family: 'Menlo', 'Consolas', monospace; }
.cdg-slot-desc { margin: 2px 0 0; font-size: 12px; color: var(--ink-200); }
.cdg-slot-line { border-bottom: 1px dashed var(--ink-500); min-height: 14px; }
.cdg-conj-list { display: grid; gap: 8px; }
.cdg-conj-list > li { border: 1px solid var(--ink-500); padding: 6px 8px; }
.cdg-conj-head { display: flex; justify-content: space-between; align-items: baseline; }
.cdg-conj-head strong { color: var(--ember-300); font-size: 14px; }
.cdg-conj-cost { font-family: 'Menlo', 'Consolas', monospace; font-size: 11px; color: var(--ember-400); }
.cdg-conj-meta { margin: 2px 0 0; font-size: 11px; color: var(--ink-300); }
.cdg-conj-components, .cdg-conj-notes { margin: 4px 0 0; font-size: 12px; color: var(--ink-200); }
.cdg-conj-components { list-style: none; padding: 0; }
.cdg-scars li { font-size: 13px; margin-bottom: 2px; }
.cdg-scars strong { color: var(--blood-400); }
.cdg-note { font-size: 11px; color: var(--ink-300); margin: 4px 0 0; font-family: 'Menlo', 'Consolas', monospace; }
.cdg-personality .cdg-kv { margin-bottom: 4px; }
.cdg-notes { font-size: 13px; color: var(--ink-100); white-space: pre-line; }
.cdg-footer { margin-top: 18px; border-top: 1px solid var(--ink-500); padding-top: 6px; font-size: 10px; color: var(--ink-300); text-align: right; }
.cdg-footer code { font-family: 'Menlo', 'Consolas', monospace; color: var(--ember-400); }

/* Vale Desperto: trauma pips */
.cdg-trauma-pips {
  list-style: none; padding: 0; margin: 0 0 6px;
  display: flex; align-items: center; gap: 4px;
}
.cdg-pip {
  flex: 1; height: 8px;
  background: var(--ink-700);
  border: 1px solid var(--ink-500);
  border-radius: 2px;
}
.cdg-pip-on { background: var(--blood-500); border-color: var(--blood-400); }
.cdg-pip-peak { background: var(--blood-400); }
.cdg-pip-label {
  flex: 0 0 auto; font-size: 10px;
  font-family: 'Menlo', 'Consolas', monospace;
  color: var(--ink-300); padding-left: 6px;
}
.cdg-trauma-effects { list-style: none; padding: 0; margin: 4px 0 0; font-size: 12px; color: var(--ink-200); }
.cdg-trauma-break { color: var(--blood-400) !important; font-style: italic; }

/* Vale Desperto: condições ativas */
.cdg-conditions { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.cdg-conditions > li { border: 1px solid var(--blood-500); border-left-width: 3px; padding: 6px 8px; background: rgba(138, 44, 34, 0.06); }
.cdg-cond-head { margin: 0; font-size: 13px; color: var(--ink-50); display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
.cdg-cond-head strong { color: var(--blood-400); }
.cdg-cond-stage { font-family: 'Menlo', 'Consolas', monospace; font-size: 11px; color: var(--ember-400); }
.cdg-cond-note { font-size: 11px; color: var(--ink-300); font-style: italic; }
.cdg-cond-effects { list-style: none; padding: 0; margin: 4px 0 0; font-size: 12px; color: var(--ink-200); }

@media print {
  body { background: white; color: black; padding: 0; }
  .cdg-sheet { background: white; border: none; padding: 12px; max-width: none; }
  h1 { color: #a5601b; }
  h2 { color: #a5601b; border-bottom-color: #888; }
  .cdg-attr-key, .cdg-attr-val, .cdg-rank, .cdg-stat-val, .cdg-ability-name, .cdg-slot-head { color: black; }
  .cdg-attr-note, .cdg-stat-label, .cdg-eyebrow, .cdg-note { color: #444; }
  .cdg-block { page-break-inside: avoid; }
  .cdg-attr-grid li, .cdg-derived-grid li, .cdg-op-core, .cdg-op-slots > li, .cdg-conj-list > li { border-color: #888; }
  .cdg-footer { color: #555; }
  .cdg-pip { background: white; border-color: #888; }
  .cdg-pip-on { background: #555; border-color: #222; }
  .cdg-pip-peak { background: #222; }
  .cdg-pip-label { color: #444; }
  .cdg-trauma-break { color: #8a2c22 !important; }
  .cdg-conditions > li { border-color: #888; background: white; }
  .cdg-cond-head strong { color: #8a2c22; }
  .cdg-cond-stage { color: #333; }
  .cdg-cond-note { color: #555; }
}
`;
