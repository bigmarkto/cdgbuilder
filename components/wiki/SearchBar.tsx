'use client';

/**
 * SearchBar — formulário de busca full-text em páginas community.
 *
 * Client component por dois motivos:
 *   1. Permite submit via Enter com `router.push('/wiki/c/search?q=...')`
 *      sem full reload (Next faz streaming da results page).
 *   2. Permite default value controlado pra preservar o termo quando o
 *      usuário volta à results page.
 *
 * A busca em si é SSR na results page (`/wiki/c/search`) — aqui só navegamos.
 * Não fazemos debounce/typeahead por enquanto: manda server action ou SQL
 * em cada keystroke é caro, e a UX com results-page dedicada é suficiente
 * pro MVP.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function SearchBar({
  defaultValue,
  placeholder = 'Buscar páginas…',
  className = ''
}: {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // Se não veio defaultValue explícito, lê do query (?q=) pra refletir o
  // termo atual quando a SearchBar é renderizada na própria results page.
  const initial = defaultValue ?? params.get('q') ?? '';
  const [value, setValue] = useState(initial);

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const q = value.trim();
    if (!q) return;
    // searchParams encode faz o escape certinho de espaços e acentos.
    const qs = new URLSearchParams({ q });
    router.push(`/wiki/c/search?${qs.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className={`flex gap-2 ${className}`} role="search">
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar páginas community"
        className="flex-1 min-w-0 px-3 py-1.5 rounded bg-ink-900 border border-ink-700 text-ink-50 text-sm placeholder:text-ink-500 focus:outline-none focus:border-ember-500"
      />
      <button
        type="submit"
        className="px-3 py-1.5 rounded bg-ink-800 border border-ink-700 text-ink-100 text-sm hover:bg-ink-700 hover:text-ink-50 whitespace-nowrap"
      >
        Buscar
      </button>
    </form>
  );
}
