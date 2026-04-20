// Renderizador genérico de entidades do CDG.
// A forma dos JSONs varia bastante (raça tem traits/weaknesses, vertente tem conjurations,
// árvore tem tiers, regra tem track/triggers/degrees/table, etc.). Em vez de criar uma view
// por tipo, este componente reconhece famílias de estruturas e renderiza cada uma com
// formatação semântica. O fallback de JSON cru é último recurso e só aparece se sobrar
// algo que o renderer não conhece.

import type { EntityBase } from '@/lib/types';

// Chaves de nível superior consideradas "meta" (renderizadas pelo cabeçalho).
const TOP_LEVEL_META = new Set(['id', 'name', 'source', 'description', 'notes', 'tags']);

// Chaves que representam listas de sub-entidades (objetos com name/description/effects/…).
// Renderizadas como listas ricas via NestedEntity.
const NESTED_LIST_KEYS: Array<[string, string]> = [
  ['traits', 'Traços'],
  ['weaknesses', 'Fraquezas'],
  ['subtypes', 'Subtipos / Linhagens'],
  ['boons', 'Benefícios'],
  ['costs', 'Preços'],
  ['conjurations', 'Conjurações'],
  ['effects', 'Efeitos'],
  ['rules', 'Regras'],
  ['proficiencies', 'Proficiências'],
  ['subProficiencies', 'Sub-Proficiências'],
  ['subProficiencyRanks', 'Ranks de Sub-Proficiência'],
  ['ranks', 'Ranks'],
  ['attributes', 'Atributos'],
  ['derived', 'Valores Derivados'],
  ['steps', 'Passos'],
  // Regras de sistema:
  ['degrees', 'Graus'],
  ['applicabilityHints', 'Aplicações'],
  ['conditions', 'Condições'],
  ['track', 'Trilha'],
  ['triggers', 'Gatilhos'],
  ['recovery', 'Recuperação'],
  ['tiers', 'Tiers de Cobertura'], // sobrescrito no handler de tiers-árvore
  ['table', 'Tabela'],
  ['surfaceModifiers', 'Modificadores de Superfície'],
  ['reductions', 'Reduções'],
  ['sizes', 'Tamanhos'],
  ['levels', 'Níveis'],
  // Meta de criação:
  ['packages', 'Pacotes'],
  ['creationSteps', 'Passos de Criação']
];

// Chaves escalares (string/número) que viram uma subseção com rótulo humano.
const SCALAR_FIELDS: Array<[string, string]> = [
  ['baseFormula', 'Fórmula Base'],
  ['stackingRule', 'Empilhamento'],
  ['removalCommon', 'Remoção'],
  ['attribute', 'Atributo'],
  ['saveDC', 'DT de Save'],
  ['damageType', 'Tipo de Dano'],
  ['capDice', 'Teto em Dados'],
  ['subProficiencyTestFormula', 'Fórmula do Teste (Sub)'],
  ['subProficiencyPrerequisiteRule', 'Pré-requisito (Sub)'],
  ['formula', 'Fórmula'],
  ['alternateFormula', 'Fórmula Alternativa'],
  ['conflictNote', 'Nota de Conflito']
];

// Chaves objeto (dict) que viram tabela chave-valor.
const OBJECT_FIELDS: Array<[string, string]> = [
  ['naturalShift', 'Deslocamento por d20 Natural'],
  ['margins', 'Margens'],
  ['resources', 'Recursos'],
  ['subProficiencyRules', 'Regras de Sub-Proficiência'],
  ['originalPowerRules', 'Regras de Poder Original'],
  ['proficiencyBudget', 'Orçamento de Proficiência'],
  ['attributeBasics', 'Atributos (Básico)']
];

export function EntityView({ entity }: { entity: EntityBase }) {
  const { name, source, description, notes, tags } = entity;

  return (
    <article className="prose-cdg">
      <header className="mb-6">
        <h1>{name}</h1>
        <div className="flex flex-wrap gap-2 items-center mt-2">
          {tags?.map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
          {source && <span className="chip text-ink-300">fonte: {source}</span>}
        </div>
      </header>

      {description && <p className="text-ink-100 text-lg leading-relaxed">{String(description)}</p>}

      {renderRichBlocks(entity)}

      {renderNotes(notes)}

      {/* Fallback: dump remaining unknown keys as collapsible JSON */}
      <RawDetails entity={entity} />
    </article>
  );
}

function renderNotes(notes: unknown) {
  if (notes == null) return null;
  if (Array.isArray(notes)) {
    const flat = notes.map((n) => (typeof n === 'string' ? n : JSON.stringify(n)));
    if (flat.length === 0) return null;
    return (
      <section>
        <h2>Notas</h2>
        <ul className="list-disc pl-5 space-y-1 text-ink-300 italic">
          {flat.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </section>
    );
  }
  return (
    <section>
      <h2>Notas</h2>
      <p className="text-ink-300 italic">{String(notes)}</p>
    </section>
  );
}

function renderRichBlocks(entity: EntityBase) {
  const blocks: React.ReactNode[] = [];
  const e = entity as Record<string, unknown>;

  // Attribute bonuses (raças)
  if (e.attributeBonus && typeof e.attributeBonus === 'object') {
    const ab = e.attributeBonus as { values?: Record<string, number>; notes?: string };
    if (ab.values) {
      blocks.push(
        <section key="ab">
          <h2>Bônus de Atributo</h2>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(ab.values).map(([attr, value]) => (
              <span key={attr} className="chip text-ember-400 border-ember-400/40">
                {value >= 0 ? '+' : ''}{value} {attr}
              </span>
            ))}
          </div>
          {ab.notes && <p className="text-sm text-ink-300 italic mt-2">{ab.notes}</p>}
        </section>
      );
    }
  }

  // Stat row (raças + tamanhos individuais)
  const statRow: Array<[string, unknown]> = [];
  if (e.hitDie) statRow.push(['Dado de Vida', e.hitDie]);
  if (e.baseSpeed) statRow.push(['Movimento', `${e.baseSpeed}m`]);
  if (e.size) statRow.push(['Tamanho', e.size]);
  if (e.governingAttribute) statRow.push(['Atrib. Governante', e.governingAttribute]);
  if (e.maxRankNormal !== undefined) statRow.push(['Rank Máx (normal)', e.maxRankNormal === null ? 'Sem teto' : e.maxRankNormal]);
  if (statRow.length > 0) {
    blocks.push(
      <section key="stats">
        <div className="flex flex-wrap gap-3 mt-2">
          {statRow.map(([k, v]) => (
            <div key={k} className="stat-box">
              <span className="stat-box-label">{k}</span>
              <span className="stat-box-value">{String(v)}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Scalar / doc fields: render as labeled small sections.
  for (const [key, label] of SCALAR_FIELDS) {
    const v = e[key];
    if (v == null) continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    blocks.push(
      <section key={`sf-${key}`}>
        <h3 className="text-sm uppercase tracking-wider text-ink-400 mt-4">{label}</h3>
        <p className="text-ink-100 leading-relaxed">{String(v)}</p>
      </section>
    );
  }

  // Object-shaped fields: render as key/value table.
  for (const [key, label] of OBJECT_FIELDS) {
    const v = e[key];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    blocks.push(
      <section key={`of-${key}`}>
        <h2>{label}</h2>
        <KeyValueTable data={v as Record<string, unknown>} />
      </section>
    );
  }

  // Tiers de Árvore (estrutura rica com abilities). Precisa antes do genérico
  // porque o genérico de 'tiers' não vai saber renderizar habilidades.
  if (Array.isArray(e.tiers) && (e.tiers as Array<Record<string, unknown>>).some((t) => Array.isArray(t.abilities))) {
    blocks.push(
      <section key="tiers-tree">
        <h2>Tiers</h2>
        {(e.tiers as Array<Record<string, unknown>>).map((tier, i) => (
          <div key={i} className="mb-6">
            <h3>
              Tier {String(tier.tier)}
              {tier.nome ? ` · ${String(tier.nome)}` : ''}
              {tier.slots ? ` · ${String(tier.slots)} slots` : ''}
            </h3>
            {Array.isArray(tier.abilities) && (
              <ul className="space-y-2">
                {(tier.abilities as Array<Record<string, unknown>>).map((ab, j) => (
                  <li key={(ab.id as string) ?? j} className="rounded bg-ink-900/40 border border-ink-700 p-3">
                    <div className="flex justify-between items-baseline gap-3">
                      <strong className="text-ink-50 font-serif">{String(ab.name ?? ab.id)}</strong>
                      {ab.cost !== undefined && <span className="chip">custo {String(ab.cost)}</span>}
                    </div>
                    {ab.description ? <p className="text-sm text-ink-200 mt-1">{String(ab.description)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    );
  }

  // Listas genéricas de sub-entidades.
  const renderedTiersRich = Array.isArray(e.tiers) && (e.tiers as Array<Record<string, unknown>>).some((t) => Array.isArray(t.abilities));
  for (const [key, label] of NESTED_LIST_KEYS) {
    if (key === 'tiers' && renderedTiersRich) continue;
    const arr = e[key];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    if (!arr.every((x) => x && typeof x === 'object')) continue;
    blocks.push(
      <section key={`nl-${key}`}>
        <h2>{label}</h2>
        <ul className="space-y-3">
          {(arr as Array<Record<string, unknown>>).map((x, i) => (
            <li key={(x.id as string) ?? i} className="border-l-2 border-ink-700 pl-3">
              <NestedEntity entity={x} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return blocks;
}

/**
 * Renderiza um objeto aninhado (ex: uma condição, um grau de sucesso, um nível
 * de trauma, uma linha da tabela de queda). Mostra o nome, metadados curtos
 * (stage/level/order/rank/dice/min..max), descrição e efeitos/stages.
 */
function NestedEntity({ entity }: { entity: Record<string, unknown> }) {
  const { name, id, notes } = entity;
  const description = typeof entity.description === 'string' ? entity.description : null;
  const narrative = typeof entity.narrative === 'string' ? entity.narrative : null;
  const rule = typeof entity.rule === 'string' ? entity.rule : null;
  const duration = typeof entity.duration === 'string' ? entity.duration : null;
  const formula = typeof entity.formula === 'string' ? entity.formula : null;
  const title = String(name ?? id ?? '—');

  const chips: Array<[string, string]> = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    chips.push([label, String(value)]);
  };
  // Rank/level/order metadata
  if (entity.rank !== undefined) push('Rank', entity.rank);
  if (entity.level !== undefined) push('Nível', entity.level);
  if (entity.stage !== undefined) push('Estágio', entity.stage);
  if (entity.order !== undefined) push('Ordem', entity.order);
  if (entity.tier !== undefined) push('Tier', entity.tier);
  // Fall table row
  if (entity.minMeters !== undefined || entity.maxMeters !== undefined) {
    const min = entity.minMeters ?? '?';
    const max = entity.maxMeters ?? '∞';
    chips.push(['Altura', `${min} – ${max}m`]);
  }
  if (entity.dice !== undefined) push('Dado', entity.dice);
  // Cover tier
  if (entity.dpBonus !== undefined) push('DP', entity.dpBonus === null ? '—' : signed(entity.dpBonus));
  if (entity.reflexBonus !== undefined) push('Reflexo', entity.reflexBonus === null ? '—' : signed(entity.reflexBonus));
  if (entity.blocksLineOfSight) chips.push(['LoS', 'bloqueada']);
  // Trauma trigger
  if (entity.gain !== undefined) push('Ganho', entity.gain);
  if (entity.save !== undefined && typeof entity.save === 'string') push('Save', entity.save);
  // Surface modifier / recovery
  if (entity.multiplier !== undefined) push('Multiplicador', `×${entity.multiplier}`);
  // Sizes
  if (entity.spaceMeters !== undefined) push('Espaço', `${entity.spaceMeters}m`);
  if (entity.reachMeters !== undefined) push('Alcance', `${entity.reachMeters}m`);
  if (entity.attackMod !== undefined) push('Ataque', signed(entity.attackMod));
  if (entity.stealthMod !== undefined) push('Furtiv.', signed(entity.stealthMod));
  if (entity.carryMult !== undefined) push('Carga', `×${entity.carryMult}`);
  // Sub-prof ranks
  if (entity.xp !== undefined) push('XP', entity.xp === null ? '—' : entity.xp);
  if (entity.levelMin !== undefined) push('Nível mín.', entity.levelMin === null ? '—' : entity.levelMin);
  if (entity.roll !== undefined && typeof entity.roll === 'string') push('Rolagem', entity.roll);
  // Progression level row
  if (entity.xpRequired !== undefined) push('XP Req.', entity.xpRequired);
  if (entity.hp !== undefined && typeof entity.hp === 'string') push('HP', entity.hp);
  if (entity.usosMagia !== undefined && typeof entity.usosMagia === 'string') push('Usos Magia', entity.usosMagia);
  if (entity.energia !== undefined && typeof entity.energia === 'string' && entity.energia) push('Energia', entity.energia);
  if (entity.proficiencia !== undefined && typeof entity.proficiencia === 'string' && entity.proficiencia) push('Prof', entity.proficiencia);
  if (entity.especial !== undefined && typeof entity.especial === 'string' && entity.especial) push('Especial', entity.especial);

  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="font-serif text-ink-50">{title}</div>
        {chips.map(([k, v]) => (
          <span key={k} className="chip text-[10px]">{k}: {v}</span>
        ))}
      </div>
      {description && <p className="text-sm text-ink-200 mt-1">{description}</p>}
      {narrative && <p className="text-sm text-ink-200 italic mt-1">{narrative}</p>}
      {rule && <p className="text-xs text-ink-300 mt-1 font-mono">regra: {rule}</p>}
      {formula && <p className="text-xs text-ink-300 mt-1 font-mono">fórmula: {formula}</p>}
      {duration && <p className="text-xs text-ink-300 mt-1">duração: {duration}</p>}

      {/* Effects nested */}
      {Array.isArray(entity.effects) && (entity.effects as unknown[]).length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-ink-200 list-disc pl-5">
          {(entity.effects as Array<Record<string, unknown>>).map((ef, i) => (
            <li key={i}>{formatEffect(ef)}</li>
          ))}
        </ul>
      )}

      {/* Stages nested (conditions, trauma) */}
      {Array.isArray(entity.stages) && (entity.stages as unknown[]).length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-ink-400">Estágios</p>
          <ul className="space-y-1 text-sm text-ink-200">
            {(entity.stages as Array<Record<string, unknown>>).map((st, i) => (
              <li key={i} className="pl-3 border-l border-ink-700">
                <strong className="text-ink-100">
                  {st.stage ? `E${String(st.stage)}` : `#${i + 1}`}
                  {st.name ? ` · ${String(st.name)}` : ''}
                </strong>
                {Array.isArray(st.effects) && (
                  <ul className="list-disc pl-5 text-sm text-ink-300">
                    {(st.effects as Array<Record<string, unknown>>).map((ef, j) => (
                      <li key={j}>{formatEffect(ef)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes != null && Array.isArray(notes) && notes.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-ink-400 italic space-y-0.5">
          {(notes as unknown[]).map((n, i) => (
            <li key={i}>{typeof n === 'string' ? n : JSON.stringify(n)}</li>
          ))}
        </ul>
      )}
      {notes != null && !Array.isArray(notes) && (
        <p className="mt-2 text-xs text-ink-400 italic">{String(notes)}</p>
      )}
    </div>
  );
}

function signed(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v ?? '—');
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : String(n);
}

function formatEffect(ef: Record<string, unknown>): string {
  const type = typeof ef.type === 'string' ? ef.type : null;
  const text = typeof ef.text === 'string' ? ef.text : null;
  if (text) return text;
  if (type === 'attribute' && typeof ef.attr === 'string' && ef.value !== undefined) {
    const v = Number(ef.value);
    return `${ef.attr} ${v >= 0 ? '+' : ''}${v}`;
  }
  if (type === 'mod' && typeof ef.text === 'string') return ef.text;
  // Fallback compacto: type + rest
  const bits: string[] = [];
  if (type) bits.push(type);
  for (const [k, v] of Object.entries(ef)) {
    if (k === 'type' || k === 'text') continue;
    bits.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  }
  return bits.join(' · ') || '—';
}

function KeyValueTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[minmax(0,200px)_1fr] gap-x-4 gap-y-1 text-sm">
      {entries.map(([k, v]) => (
        <FragmentRow key={k} label={k} value={v} />
      ))}
    </dl>
  );
}

function FragmentRow({ label, value }: { label: string; value: unknown }) {
  return (
    <>
      <dt className="text-ink-400 font-mono text-xs uppercase tracking-wider">{label}</dt>
      <dd className="text-ink-100">{formatValue(value)}</dd>
    </>
  );
}

function formatValue(v: unknown): React.ReactNode {
  if (v == null) return <span className="text-ink-500">—</span>;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return <span>{(v as Array<string | number>).join(', ')}</span>;
    }
    return (
      <ul className="list-disc pl-5 space-y-1">
        {v.map((x, i) => (
          <li key={i}>{formatValue(x)}</li>
        ))}
      </ul>
    );
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return (
      <div className="pl-2 border-l border-ink-700 space-y-0.5">
        {Object.entries(obj).map(([k, val]) => (
          <div key={k} className="text-xs">
            <span className="text-ink-400 font-mono">{k}: </span>
            <span className="text-ink-200">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
          </div>
        ))}
      </div>
    );
  }
  return String(v);
}

function RawDetails({ entity }: { entity: EntityBase }) {
  const handled = new Set<string>([
    ...TOP_LEVEL_META,
    'attributeBonus', 'hitDie', 'baseSpeed', 'size', 'governingAttribute', 'maxRankNormal',
    ...NESTED_LIST_KEYS.map(([k]) => k),
    ...SCALAR_FIELDS.map(([k]) => k),
    ...OBJECT_FIELDS.map(([k]) => k)
  ]);
  const e = entity as Record<string, unknown>;
  const remaining = Object.fromEntries(Object.entries(e).filter(([k]) => !handled.has(k)));
  if (Object.keys(remaining).length === 0) return null;
  return (
    <details className="mt-8">
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-ink-400">
        Campos adicionais ({Object.keys(remaining).length})
      </summary>
      <pre className="mt-2 text-xs bg-ink-900/60 border border-ink-700 rounded p-3 overflow-auto">
{JSON.stringify(remaining, null, 2)}
      </pre>
    </details>
  );
}
