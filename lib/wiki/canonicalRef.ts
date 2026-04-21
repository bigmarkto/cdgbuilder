/**
 * parseCanonicalRef — valida referência "<section>/<id>" contra o sistema
 * canônico (JSON local). Server-only porque `@/lib/data` usa fs/path.
 *
 * Formato:
 *   • "<section>/<id>"
 *   • <section> ∈ COLLECTIONS
 *   • <id> existe em collectionSummary(<section>)
 */
import { COLLECTIONS, type CollectionId } from '@/lib/types';
import { collectionSummary } from '@/lib/data';
import { isValidSlug } from './slug';

export function parseCanonicalRef(
  raw: string
): { section: CollectionId; id: string } | null {
  const parts = raw.split('/');
  if (parts.length !== 2) return null;
  const [section, id] = parts;
  if (!COLLECTIONS.includes(section as CollectionId)) return null;
  if (!isValidSlug(id) && !/^[a-z0-9-]+$/.test(id)) return null;
  const entries = collectionSummary(section as CollectionId);
  if (!entries.some((e) => e.id === id)) return null;
  return { section: section as CollectionId, id };
}
