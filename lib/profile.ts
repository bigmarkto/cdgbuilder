/**
 * Validação + persistência de perfil do usuário.
 *
 * Campos editáveis por conta própria: handle, name, bio.
 * Campos NÃO editáveis pelo próprio usuário: role, bannedAt (só admin).
 *
 * handle é único, lowercase, 3-24 chars, [a-z0-9_-]+. Serve como "@nome"
 * público (ex: /u/marquinhos). O Prisma já garante unicidade via @unique.
 */

const HANDLE_RE = /^[a-z0-9_-]{3,24}$/;

export type ProfileInput = {
  handle?: string | null;
  name?: string | null;
  bio?: string | null;
};

export type ProfileError = {
  field: 'handle' | 'name' | 'bio' | 'form';
  message: string;
};

/**
 * Normaliza + valida o input. Retorna `{ data }` ou `{ error }` — nunca os dois.
 * Trim e lowercase aplicados ao handle; null se vier vazio (usuário limpou o campo).
 */
export function validateProfile(
  raw: ProfileInput
): { data: ProfileInput } | { error: ProfileError } {
  const handle = raw.handle?.trim().toLowerCase() || null;
  const name = raw.name?.trim() || null;
  const bio = raw.bio?.trim() || null;

  if (handle !== null) {
    if (!HANDLE_RE.test(handle)) {
      return {
        error: {
          field: 'handle',
          message:
            'Nickname deve ter 3-24 caracteres e usar apenas letras minúsculas, números, _ ou -.'
        }
      };
    }
  }

  if (name !== null && name.length > 60) {
    return { error: { field: 'name', message: 'Nome com no máximo 60 caracteres.' } };
  }

  if (bio !== null && bio.length > 500) {
    return { error: { field: 'bio', message: 'Bio com no máximo 500 caracteres.' } };
  }

  return { data: { handle, name, bio } };
}
