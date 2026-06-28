'use client';

/**
 * TutorialGuide — guia de criação interativo pra novos jogadores (2.5).
 *
 * Em vez de coachmarks frágeis (posicionados sobre o DOM), é um painel que
 * rastreia o progresso REAL da ficha: cada passo mostra uma explicação curta,
 * se já está completo (usa a validação do engine) e um botão "ir" que pula
 * direto pra aquela etapa do builder.
 *
 * Dispensável (persistido em localStorage). Depois de dispensar, vira um botão
 * discreto "✦ Guia" que reabre sob demanda — nunca some de vez.
 */

import { useEffect, useState } from 'react';
import type { StepStatus } from '@/engine/validation';
import { useBuilderStore } from '@/lib/store';

const DISMISS_KEY = 'cdg-tutorial-dismissed-v1';

// Explicações pensadas pra quem nunca montou ficha no sistema.
const STEP_HELP: Record<string, string> = {
  conceito: 'Dê um nome e descreva em uma frase quem é o personagem.',
  raca: 'Escolha a raça — define bônus de atributo, traços e tamanho.',
  atributos: 'Distribua seus pontos nos 9 atributos. Eles alimentam HP, defesa, mana e testes.',
  proficiencias: 'No que ele é treinado? Rank maior = melhor nos testes daquela perícia.',
  poder: 'Defina o Poder Original: a habilidade única e marcante do personagem.',
  magias: 'Opcional — monte conjurações se for um conjurador de Vertentes.',
  talentos: 'Opcional — talentos de árvore abrem a partir do nível 2.',
  derivados: 'Valores calculados sozinhos (HP, defesa, mana). Só confira.',
  equipamento: 'Escolha um pacote inicial de equipamento.',
  cicatrizes: 'Opcional — cicatrizes dão ganchos de história e efeitos.',
  personalidade: 'Aparência, motivação e vínculos. Dê alma ao personagem.'
};

// Etapas que não bloqueiam a ficha (a validação as marca sempre "complete").
const OPTIONAL_STEPS = new Set(['magias', 'talentos', 'derivados', 'cicatrizes']);

export function TutorialGuide({ steps }: { steps: StepStatus[] }) {
  const setStep = useBuilderStore((s) => s.setStep);
  const currentStep = useBuilderStore((s) => s.currentStep);

  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const dismissed = typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
    setOpen(!dismissed);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const essentials = steps.filter((s) => !OPTIONAL_STEPS.has(s.step));
  const doneEssentials = essentials.filter((s) => s.complete && s.valid).length;
  const pct = essentials.length > 0 ? Math.round((doneEssentials / essentials.length) * 100) : 0;

  // Evita flash/mismatch antes da hidratação do estado de dispensa.
  if (!hydrated) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-ink-700 text-xs text-ink-300 hover:text-ember-300 hover:border-ember-400/50"
      >
        <span className="text-ember-400">✦</span> Guia de criação
      </button>
    );
  }

  return (
    <section className="mt-3 rounded-lg border border-ember-400/30 bg-ember-400/[0.03] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-serif text-lg text-ink-50 flex items-center gap-2">
            <span className="text-ember-400">✦</span> Guia de criação
          </h2>
          <p className="text-xs text-ink-400 mt-0.5">
            Siga os passos essenciais. Os opcionais você preenche se quiser.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-ink-400 hover:text-ink-200"
            title="Recolher (continua acessível pelo botão Guia)"
          >
            recolher
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-ink-500 hover:text-blood-300"
            title="Não mostrar automaticamente"
          >
            dispensar
          </button>
        </div>
      </div>

      {/* Barra de progresso dos essenciais */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] text-ink-400 mb-1">
          <span>Progresso essencial</span>
          <span className="font-mono">
            {doneEssentials}/{essentials.length}
          </span>
        </div>
        <div className="h-2 rounded bg-ink-800 overflow-hidden">
          <div
            className="h-full bg-ember-500/70 transition-[width]"
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        </div>
      </div>

      <ol className="space-y-1">
        {steps.map((s, i) => {
          const optional = OPTIONAL_STEPS.has(s.step);
          const done = s.complete && s.valid && !optional;
          const isCurrent = s.step === currentStep;
          return (
            <li
              key={s.step}
              className={[
                'flex items-start gap-2.5 rounded px-2 py-1.5 transition-colors',
                isCurrent ? 'bg-ink-800/60' : 'hover:bg-ink-800/30'
              ].join(' ')}
            >
              <StatusDot done={done} optional={optional} index={i + 1} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-100">{s.label}</span>
                  {optional && (
                    <span className="text-[9px] uppercase tracking-wider text-ink-500">
                      opcional
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[9px] uppercase tracking-wider text-ember-400">
                      aqui
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-400 leading-snug">{STEP_HELP[s.step] ?? ''}</p>
              </div>
              {!isCurrent && (
                <button
                  type="button"
                  onClick={() => {
                    setStep(s.step);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="shrink-0 text-xs text-ember-300 hover:text-ember-200 px-1.5 py-0.5"
                >
                  ir →
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StatusDot({
  done,
  optional,
  index
}: {
  done: boolean;
  optional: boolean;
  index: number;
}) {
  if (done) {
    return (
      <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-ember-500/20 border border-ember-400/60 text-ember-300 text-xs flex items-center justify-center">
        ✓
      </span>
    );
  }
  return (
    <span
      className={[
        'mt-0.5 w-5 h-5 shrink-0 rounded-full border text-[10px] flex items-center justify-center font-mono',
        optional
          ? 'border-ink-700 text-ink-500'
          : 'border-ink-500 text-ink-300'
      ].join(' ')}
    >
      {index}
    </span>
  );
}
