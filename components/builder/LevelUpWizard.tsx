'use client';

import { useMemo, useState } from 'react';
import type { DataContext } from '@/engine/context';
import { useBuilderStore } from '@/lib/store';
import {
  nextLevelPlan,
  applyLevelUp,
  maxRankAtLevel,
  type LevelChoiceSpec,
  type LevelUpSubmission
} from '@/engine/levelup';
import { ATTR_IDS } from '@/engine/character';

/**
 * Wizard isolado que lê o plano do próximo nível e aplica com as escolhas
 * do jogador. Não renderiza nada se não há nível-alvo ou se o personagem
 * ainda não bateu o marco de XP.
 */
export function LevelUpWizard({ ctx }: { ctx: DataContext }) {
  const character = useBuilderStore((s) => s.character);
  const replaceCharacter = useBuilderStore((s) => s.replaceCharacter);
  const [open, setOpen] = useState(false);

  const plan = useMemo(() => nextLevelPlan(ctx, character), [ctx, character]);

  if (!ctx.levelGrants) return null;
  if (plan.targetLevel === null) {
    return (
      <div className="rounded border border-ink-700 bg-ink-900/50 p-3 text-sm text-ink-300">
        Nível máximo atingido. Lendário.
      </div>
    );
  }

  const xpMissing = plan.xpMissing ?? 0;
  const canLevel = plan.canLevelUp;

  if (!canLevel) {
    return (
      <div className="rounded border border-ink-700 bg-ink-900/50 p-3 text-sm">
        <p className="text-ink-200">
          Próximo nível: <strong className="text-ember-400">{plan.targetLevel}</strong>
        </p>
        <p className="text-ink-400 text-xs mt-1">
          Faltam <span className="font-mono text-blood-400">{xpMissing}</span> XP para o marco{' '}
          <span className="font-mono">{plan.xpRequiredForTarget}</span>.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="rounded border border-ember-400/40 bg-ember-400/5 p-3 text-sm space-y-2">
        <p className="text-ember-300">
          <strong>Marco atingido!</strong> Pode subir para o nível {plan.targetLevel}.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded border border-ember-400/60 text-ember-400 hover:bg-ember-400/10"
        >
          Subir de nível
        </button>
      </div>
    );
  }

  if (!plan.entry) {
    return (
      <div className="rounded border border-blood-400/50 bg-blood-400/5 p-3 text-sm text-blood-300">
        Plano do nível {plan.targetLevel} não encontrado em levelup-grants.json.
      </div>
    );
  }

  return (
    <LevelUpForm
      ctx={ctx}
      onCancel={() => setOpen(false)}
      onSubmit={(submission) => {
        const result = applyLevelUp(ctx, character, submission);
        if (result.violations.length > 0) {
          // eslint-disable-next-line no-alert
          alert('Não pude aplicar: ' + result.violations.join('\n'));
          return;
        }
        // Sobe o level do personagem ao target. replaceCharacter já toca updatedAt.
        replaceCharacter(result.character);
        setOpen(false);
      }}
      plan={plan.entry}
    />
  );
}

function LevelUpForm({
  ctx,
  plan,
  onCancel,
  onSubmit
}: {
  ctx: DataContext;
  plan: NonNullable<ReturnType<typeof nextLevelPlan>['entry']>;
  onCancel: () => void;
  onSubmit: (submission: LevelUpSubmission) => void;
}) {
  const [choices, setChoices] = useState<LevelUpSubmission['choices']>(
    plan.choices.map((c) => emptyChoice(c))
  );

  const updateChoice = (i: number, patch: Partial<LevelUpSubmission['choices'][number]>) =>
    setChoices((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const maxRank = maxRankAtLevel(ctx.levelGrants, plan.level);
  const profList = ctx.proficiencies.proficiencies ?? [];
  const canSubmit = choices.every((c) => !!c.targetId);

  return (
    <form
      className="rounded border border-ember-400/40 bg-ink-900/80 p-3 text-sm space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ plan, choices });
      }}
    >
      <div>
        <p className="text-ember-300 font-serif text-base">Nível {plan.level}</p>
        {plan.narrative && (
          <p className="text-ink-300 text-xs italic mt-0.5">{plan.narrative}</p>
        )}
      </div>

      {plan.grants.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-1">
            Grants automáticos
          </p>
          <ul className="text-xs text-ink-200 space-y-0.5 font-mono">
            {plan.grants.map((g, i) => (
              <li key={i}>• {grantLabel(g)}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.choices.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Escolhas</p>
          {plan.choices.map((spec, i) => (
            <div key={i} className="rounded bg-ink-800/60 p-2">
              <p className="text-xs text-ink-100 mb-1">{spec.label}</p>
              {spec.kind === 'attributePoint' ? (
                <select
                  className="bg-ink-900 border border-ink-700 text-ink-100 text-xs rounded px-2 py-1 w-full"
                  value={choices[i]?.targetId ?? ''}
                  onChange={(e) => updateChoice(i, { targetId: e.target.value })}
                >
                  <option value="">— escolha um atributo —</option>
                  {ATTR_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="bg-ink-900 border border-ink-700 text-ink-100 text-xs rounded px-2 py-1 w-full"
                  value={choices[i]?.targetId ?? ''}
                  onChange={(e) => updateChoice(i, { targetId: e.target.value })}
                >
                  <option value="">— escolha proficiência —</option>
                  {profList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.attribute ? `(${p.attribute})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {spec.kind === 'proficiencyRank' && (
                <p className="text-[10px] text-ink-400 mt-1 font-mono">
                  Rank máximo no nível {plan.level}: {maxRank}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded border border-ink-700 text-ink-300 hover:text-ink-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1 text-xs rounded border border-ember-400/60 text-ember-400 disabled:opacity-40 hover:bg-ember-400/10"
        >
          Confirmar nível {plan.level}
        </button>
      </div>
    </form>
  );
}

function emptyChoice(spec: LevelChoiceSpec): LevelUpSubmission['choices'][number] {
  return {
    kind: spec.kind,
    targetId: '',
    delta: spec.delta
  };
}

function grantLabel(g: {
  kind: string;
  formula?: string;
  delta?: number;
  tier?: number;
  xp?: number;
}): string {
  switch (g.kind) {
    case 'hitDieInitial':
      return `HP inicial (${g.formula ?? ''})`;
    case 'hitDieRoll':
      return `HP: ${g.formula ?? '+1d + CON/2'}`;
    case 'usosMagiaDelta':
      return `+${g.delta ?? 0} uso(s) de magia`;
    case 'energiaDelta':
      return `Energia ${g.formula ?? '+RES'}`;
    case 'talentTierUnlock':
      return `Desbloqueia Tier ${g.tier ?? '?'} de talentos`;
    case 'talentXp':
      return `+${g.xp ?? 0} XP para talentos`;
    default:
      return g.kind;
  }
}

