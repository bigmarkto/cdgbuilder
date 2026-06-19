import {
  loadCreation,
  loadDerived,
  loadLevelGrants,
  loadProficiencyIndex,
  loadProgression,
  loadRaces,
  loadRulesBundle,
  loadSystem,
  loadTrees,
  loadVertentes
} from '@/lib/data';
import { PrintSheetView } from '@/components/builder/PrintSheetView';
import type { DataContext, ProgressionTable } from '@/engine/context';
import type { LevelGrantsTable } from '@/engine/levelup';
import type {
  ActionsTable,
  CombatTable,
  ConditionsTable,
  CoverTable,
  DegreesOfSuccessTable,
  FallTable,
  RulesBundle,
  SizesTable,
  TraumaTable
} from '@/engine/rules';

export const dynamic = 'force-static';

export default function SheetPrintPage() {
  const system = loadSystem();
  const derived = loadDerived();
  const creation = loadCreation();
  const races = loadRaces();
  const proficiencies = loadProficiencyIndex();
  const progression = loadProgression() as ProgressionTable | null;
  const levelGrants = loadLevelGrants() as LevelGrantsTable | null;
  const trees = loadTrees();
  const vertentes = loadVertentes();
  const rulesRaw = loadRulesBundle();
  const rules: RulesBundle = {
    ...(rulesRaw.degrees ? { degrees: rulesRaw.degrees as unknown as DegreesOfSuccessTable } : {}),
    ...(rulesRaw.conditions ? { conditions: rulesRaw.conditions as unknown as ConditionsTable } : {}),
    ...(rulesRaw.cover ? { cover: rulesRaw.cover as unknown as CoverTable } : {}),
    ...(rulesRaw.trauma ? { trauma: rulesRaw.trauma as unknown as TraumaTable } : {}),
    ...(rulesRaw.fall ? { fall: rulesRaw.fall as unknown as FallTable } : {}),
    ...(rulesRaw.sizes ? { sizes: rulesRaw.sizes as unknown as SizesTable } : {}),
    ...(rulesRaw.acoes ? { acoes: rulesRaw.acoes as unknown as ActionsTable } : {}),
    ...(rulesRaw.combate ? { combate: rulesRaw.combate as unknown as CombatTable } : {})
  };

  if (!system || !derived || !creation || !proficiencies) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-serif text-3xl text-ink-50 mb-2">Preview indisponível</h1>
        <p className="text-ink-300">Dados de sistema ausentes.</p>
      </div>
    );
  }

  const ctx: DataContext = {
    system,
    derived,
    creation,
    races,
    proficiencies,
    ...(progression ? { progression } : {}),
    ...(levelGrants ? { levelGrants } : {}),
    ...(trees.length > 0 ? { trees } : {}),
    ...(vertentes.length > 0 ? { vertentes } : {}),
    ...(Object.keys(rules).length > 0 ? { rules } : {})
  };
  return <PrintSheetView ctx={ctx} />;
}
