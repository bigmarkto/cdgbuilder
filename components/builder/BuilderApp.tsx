'use client';

import { useMemo } from 'react';
import type { DataContext } from '@/engine/context';
import type { Vertente } from '@/lib/types';
import { overallValidation } from '@/engine/validation';
import { useBuilderStore } from '@/lib/store';
import { StepNav } from './StepNav';
import { LiveSidebar } from './LiveSidebar';
import { TopBar } from './TopBar';
import { TutorialGuide } from './TutorialGuide';
import { StepConceito } from './steps/StepConceito';
import { StepRaca } from './steps/StepRaca';
import { StepAtributos } from './steps/StepAtributos';
import { StepProficiencias } from './steps/StepProficiencias';
import { StepPoderOriginal } from './steps/StepPoderOriginal';
import { StepMagias } from './steps/StepMagias';
import { StepTalentos } from './steps/StepTalentos';
import { StepDerivados } from './steps/StepDerivados';
import { StepEquipamento } from './steps/StepEquipamento';
import { StepCicatrizes } from './steps/StepCicatrizes';
import { StepPersonalidade } from './steps/StepPersonalidade';

/** Shape esperado por StepMagias.  Mantido aqui para o loader tipar o JSON.  */
export interface VertenteSystem {
  effects: Array<{ id: string; name: string; description?: string; costModifier?: number }>;
  forms: Array<{
    id: string;
    name: string;
    description?: string;
    costModifier?: number;
    ignoresRange?: boolean;
  }>;
  ranges: Array<{
    id: string;
    name: string;
    description?: string;
    costModifier?: number;
    meters?: number;
  }>;
  intensities: Array<{
    id: string;
    name: string;
    description?: string;
    costModifier?: number;
    dice?: string;
    controlDT?: number;
  }>;
  caps?: Record<string, { max: number | null; requirement?: string }>;
  costFormula?: string;
  /** Balanceamento 1.1: regras de conjuração não-treinada (sobretaxa + DT de controle). */
  untrainedCasting?: {
    trainedThreshold?: number;
    manaSurchargeByIntensity?: Record<string, number>;
  };
}

export function BuilderApp({
  ctx,
  vertentes,
  vertenteSystem
}: {
  ctx: DataContext;
  vertentes: Vertente[];
  vertenteSystem: VertenteSystem | null;
}) {
  const character = useBuilderStore((s) => s.character);
  const currentStep = useBuilderStore((s) => s.currentStep);
  const steps = useMemo(() => overallValidation(ctx, character), [ctx, character]);
  const active = steps.find((s) => s.step === currentStep) ?? steps[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <TopBar ctx={ctx} steps={steps} />
      <TutorialGuide steps={steps} />
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-6 mt-4">
        <StepNav steps={steps} />
        <main className="min-w-0">
          <h2 className="font-serif text-2xl text-ink-50 mb-1">{active.label}</h2>
          {active.issues.length > 0 && (
            <ul className="text-xs text-blood-400 mb-4 space-y-0.5">
              {active.issues.map((issue, i) => (
                <li key={i}>• {issue}</li>
              ))}
            </ul>
          )}
          <StepContent
            step={active.step}
            ctx={ctx}
            vertentes={vertentes}
            vertenteSystem={vertenteSystem}
          />
        </main>
        <LiveSidebar ctx={ctx} />
      </div>
    </div>
  );
}

function StepContent({
  step,
  ctx,
  vertentes,
  vertenteSystem
}: {
  step: string;
  ctx: DataContext;
  vertentes: Vertente[];
  vertenteSystem: VertenteSystem | null;
}) {
  switch (step) {
    case 'conceito':
      return <StepConceito />;
    case 'raca':
      return <StepRaca ctx={ctx} />;
    case 'atributos':
      return <StepAtributos ctx={ctx} />;
    case 'proficiencias':
      return <StepProficiencias ctx={ctx} />;
    case 'poder':
      return <StepPoderOriginal ctx={ctx} />;
    case 'magias':
      return <StepMagias vertentes={vertentes} system={vertenteSystem} />;
    case 'talentos':
      return <StepTalentos ctx={ctx} />;
    case 'derivados':
      return <StepDerivados ctx={ctx} />;
    case 'equipamento':
      return <StepEquipamento ctx={ctx} />;
    case 'cicatrizes':
      return <StepCicatrizes />;
    case 'personalidade':
      return <StepPersonalidade />;
    default:
      return null;
  }
}
