/**
 * Validação e normalização de slugs do wiki.
 *
 * slug de Page:
 *   • 3..80 chars
 *   • [a-z0-9-]+ (sem espaços, sem underscores, sem /)
 *   • não começa nem termina com "-"
 *   • não tem "--" em sequência
 *
 * Por que slugs do community não podem ter "/": o namespace da URL é
 * /wiki/c/<slug>. Permitir "/" quebraria o router.
 *
 * IMPORTANTE: este módulo é puro (sem Node APIs) pra poder ser importado
 * por client components. `parseCanonicalRef` vive em `./canonicalRef` porque
 * precisa acessar o sistema de dados canônico (fs/path).
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 80) return false;
  return SLUG_RE.test(slug);
}

/**
 * Slugify: converte título livre em slug válido.
 * Mantém lowercase, remove acentos, substitui não-alfanumérico por "-",
 * colapsa "-" repetidos, trim. Se ficar vazio, devolve string vazia.
 */
export function slugify(input: string): string {
  const noAccents = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove diacríticos
  const kebab = noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return kebab.slice(0, 80);
}
