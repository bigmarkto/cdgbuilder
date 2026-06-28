'use client';

/**
 * ShareControls — liga/desliga o compartilhamento da ficha ativa e mantém o
 * link vivo (2.1).
 *
 * Comportamento:
 *   • No load, pergunta ao servidor se a ficha já tem link (shareStatus).
 *   • "Compartilhar" cria a row SHARE e revela o link + botão copiar.
 *   • Enquanto compartilhada, observa o Character no store e re-sincroniza
 *     (debounce 1.5s após a última edição) via syncShare — é o "vivo".
 *   • "Parar" remove a row; o link deixa de resolver.
 *
 * Estado de combate/efêmero não importa aqui — sincronizamos o Character salvo.
 * Não-logado vê um CTA pra entrar (sharing exige conta).
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useBuilderStore } from '@/lib/store';
import {
  enableShare,
  disableShare,
  syncShare,
  shareStatus
} from '@/lib/builder/shareActions';

type Status = 'loading' | 'anon' | 'idle' | 'shared';

const SYNC_DEBOUNCE_MS = 1500;

export function ShareControls() {
  const character = useBuilderStore((s) => s.character);
  const localId = character.id;

  const [status, setStatus] = useState<Status>('loading');
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  // Snapshot serializado da ficha — dispara o sync quando muda.
  const serialized = JSON.stringify(character);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Evita sincronizar imediatamente após enable (já gravou) ou ao trocar de ficha.
  const lastSyncedLocalId = useRef<string | null>(null);

  // Status inicial por ficha.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    setCopied(false);
    shareStatus({ localId }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setStatus('anon');
        return;
      }
      if (!res.loggedIn) setStatus('anon');
      else if (res.shared) {
        setStatus('shared');
        setSlug(res.slug);
        lastSyncedLocalId.current = localId; // já está em dia
      } else {
        setStatus('idle');
        setSlug(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [localId]);

  // Sincronização viva: re-grava quando a ficha muda e está compartilhada.
  useEffect(() => {
    if (status !== 'shared') return;
    // Pula o primeiro disparo logo após (re)entrar em 'shared' pra essa ficha.
    if (lastSyncedLocalId.current === localId && syncTimer.current === null) {
      // marca que daqui pra frente mudanças sincronizam
      lastSyncedLocalId.current = `${localId}:armed`;
      return;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      syncShare({ localId, character: JSON.parse(serialized) }).then((res) => {
        if (!res.ok) setError(res.error);
      });
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
    };
    // serialized é a dependência real (muda a cada edição da ficha).
  }, [serialized, status, localId]);

  const onEnable = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await enableShare({ localId, character: JSON.parse(JSON.stringify(character)) });
      if (res.ok) {
        setStatus('shared');
        setSlug(res.slug);
        lastSyncedLocalId.current = localId;
      } else {
        setError(res.error);
      }
    });
  }, [localId, character]);

  const onDisable = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await disableShare({ localId });
      if (res.ok) {
        setStatus('idle');
        setSlug(null);
      } else {
        setError(res.error);
      }
    });
  }, [localId]);

  const shareUrl =
    slug && typeof window !== 'undefined' ? `${window.location.origin}/ficha/${slug}` : '';

  const onCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [shareUrl]);

  return (
    <section className="rounded border border-ink-500 bg-ink-900/40 p-3 text-sm space-y-2 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Compartilhar</p>
          <p className="font-serif text-base text-ink-50">
            {status === 'shared' ? 'Link ativo' : 'Ficha privada'}
          </p>
        </div>
        {status === 'idle' && (
          <button
            type="button"
            onClick={onEnable}
            className="px-2.5 py-1 text-[11px] rounded border border-ember-400/60 text-ember-300 hover:bg-ember-400/10"
          >
            Compartilhar
          </button>
        )}
        {status === 'shared' && (
          <button
            type="button"
            onClick={onDisable}
            className="px-2.5 py-1 text-[11px] rounded border border-ink-600 text-ink-300 hover:text-blood-300 hover:border-blood-400/50"
          >
            Parar
          </button>
        )}
      </div>

      {status === 'loading' && <p className="text-xs text-ink-400">Carregando…</p>}

      {status === 'anon' && (
        <p className="text-xs text-ink-300">
          <Link href="/login" className="text-ember-400 hover:underline">
            Entre
          </Link>{' '}
          para gerar um link público desta ficha.
        </p>
      )}

      {status === 'shared' && shareUrl && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs text-ink-200 font-mono"
            />
            <button
              type="button"
              onClick={onCopy}
              className="px-2 py-1 text-[11px] rounded border border-ink-600 text-ink-200 hover:border-ember-400/60 hover:text-ember-300 whitespace-nowrap"
            >
              {copied ? 'copiado!' : 'copiar'}
            </button>
          </div>
          <p className="text-[10px] text-ink-500">
            Link vivo — suas edições aparecem automaticamente pra quem abrir.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-blood-300">{error}</p>}
    </section>
  );
}
