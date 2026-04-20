import type { Character } from './character';
import type { DataContext } from './context';
import { pointBuyStatus } from './attributes';
import { proficiencyBudgetStatus } from './proficiencies';

export interface StepStatus {
  step: string;
  label: string;
  complete: boolean;
  valid: boolean;
  issues: string[];
}

export function overallValidation(ctx: DataContext, character: Character): StepStatus[] {
  const pb = pointBuyStatus(ctx, character);
  const pr = proficiencyBudgetStatus(ctx, character);

  return [
    {
      step: 'conceito',
      label: 'Conceito',
      complete: character.name.trim().length > 0,
      valid: true,
      issues: character.name.trim() ? [] : ['Dê um nome ao personagem.']
    },
    {
      step: 'raca',
      label: 'Raça',
      complete: !!character.raceId,
      valid: true,
      issues: character.raceId ? [] : ['Escolha uma raça.']
    },
    {
      step: 'atributos',
      label: 'Atributos',
      complete: pb.remaining === 0,
      valid: pb.valid,
      issues: [
        ...(pb.remaining > 0 ? [`Faltam ${pb.remaining} ponto(s) para distribuir.`] : []),
        ...pb.violations
      ]
    },
    {
      step: 'proficiencias',
      label: 'Proficiências',
      complete: pr.remaining === 0,
      valid: pr.valid,
      issues: [
        ...(pr.remaining > 0 ? [`Faltam ${pr.remaining} ponto(s) de proficiência.`] : []),
        ...pr.violations
      ]
    },
    {
      step: 'poder',
      label: 'Poder Original',
      complete: !!character.originalPower?.concept?.trim(),
      valid: true,
      issues: character.originalPower?.concept?.trim() ? [] : ['Descreva o conceito do Poder Original (min. 1 frase).']
    },
    {
      step: 'magias',
      label: 'Conjurações',
      // Etapa opcional — nem todo personagem usa magia. Sempre válida e
      // "completa" (não bloqueia o progresso). A UI exibe o total de conjurações.
      complete: true,
      valid: true,
      issues: []
    },
    {
      step: 'talentos',
      label: 'Talentos',
      // Opcional: talentos abrem de verdade no nível 2. Nível 1 dispensa.
      complete: true,
      valid: true,
      issues: []
    },
    {
      step: 'derivados',
      label: 'Valores Derivados',
      complete: true,
      valid: true,
      issues: []
    },
    {
      step: 'equipamento',
      label: 'Equipamento',
      complete: !!character.equipmentPackageId,
      valid: true,
      issues: character.equipmentPackageId ? [] : ['Escolha um pacote inicial.']
    },
    {
      step: 'cicatrizes',
      label: 'Cicatrizes',
      complete: true,
      valid: true,
      issues: []
    },
    {
      step: 'personalidade',
      label: 'Personalidade',
      complete: character.personality.motivation.trim().length > 0,
      valid: true,
      issues: character.personality.motivation.trim() ? [] : ['Descreva ao menos uma motivação.']
    }
  ];
}

export function isCharacterComplete(ctx: DataContext, character: Character): boolean {
  return overallValidation(ctx, character).every((s) => s.complete && s.valid);
}
