// Agregador do pacote de regras Vale Desperto v2.0 (port).
// Expõe tipos + resolvedores em um único ponto.

export * from './degrees';
export * from './conditions';
export * from './cover';
export * from './trauma';
export * from './fall';
export * from './sizes';

import type { DegreesOfSuccessTable } from './degrees';
import type { ConditionsTable } from './conditions';
import type { CoverTable } from './cover';
import type { TraumaTable } from './trauma';
import type { FallTable } from './fall';
import type { SizesTable } from './sizes';

/** Bundle de todas as tabelas de regras carregadas. Todos os campos são opcionais:
 *  se um arquivo estiver ausente, o resolvedor correspondente não é utilizável. */
export interface RulesBundle {
  degrees?: DegreesOfSuccessTable;
  conditions?: ConditionsTable;
  cover?: CoverTable;
  trauma?: TraumaTable;
  fall?: FallTable;
  sizes?: SizesTable;
}
