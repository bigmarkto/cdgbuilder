// Modelo genérico de ficha CDG em HTML standalone.
//
// Objetivo: um arquivo .html único, sem dependências externas, que o jogador
// pode baixar, abrir no navegador, e:
//   1. Preencher os campos à mão (imprimível / editável).
//   2. Importar um Character.json (exportado do Builder ou escrito à mão)
//      para preencher automaticamente os campos conhecidos.
//
// Diferença do renderSheetHtml: aquela função produz a ficha de UM personagem
// específico já resolvido pelo engine (derivados calculados). Esta aqui emite
// um esqueleto em branco com slots identificados por `data-cdg-field`, e um
// script inline em vanilla-JS que mapeia JSON → DOM.
//
// Os campos "derivados" (HP, DP, Iniciativa, Pool Cósmica, etc.) e o XP gasto
// ficam em branco se o JSON for um Character cru — o Builder continua sendo
// a fonte canônica para esses cálculos. Para uma ficha com derivados prontos,
// use `renderSheetHtml` via "Baixar ficha HTML".

import type { DataContext } from '../context';
import { ATTR_IDS } from '../character';
import { SHEET_CSS } from './render';

function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplateHtml(ctx: DataContext): string {
  const sysAttrs = ctx.system.attributes ?? [];

  const attrGrid = ATTR_IDS.map((id) => {
    const meta = sysAttrs.find((x) => x.id === id);
    return `
      <li>
        <p class="cdg-eyebrow">${esc(meta?.group ?? '')}</p>
        <div class="cdg-attr-row">
          <span class="cdg-attr-key">${esc(id)}</span>
          <span class="cdg-attr-val" data-cdg-field="attributes.${id}.total">—</span>
        </div>
        <p class="cdg-attr-note">
          base <span data-cdg-field="attributes.${id}.base">—</span>
          <span data-cdg-field="attributes.${id}.racial"></span>
        </p>
      </li>
    `;
  }).join('');

  const derivedKeys: Array<[string, string]> = [
    ['HP', 'HP_MAX'],
    ['DP', 'DP'],
    ['Iniciativa', 'INICIATIVA'],
    ['Per. Passiva', 'PER_PASSIVA'],
    ['Movimento', 'MOVIMENTO'],
    ['Dado de Vida', 'hitDie'],
    ['Carga', 'CARGA'],
    ['Pool Cósmica', 'POOL_ENERGIA_COSMICA'],
    ['Usos Energia', 'USOS_ENERGIA'],
    ['Mana Arcana', 'MANA_ARCANA'],
    ['Mana Divina', 'MANA_DIVINA'],
    ['Foco Corpo', 'FOCO_CORPO'],
    ['Foco Primal', 'FOCO_PRIMAL'],
    ['Mana Magitech', 'MANA_MAGITECH'],
    ['Grimório', 'GRIMORIO'],
    ['Esp. Conjuração', 'ESPACOS_CONJURACAO']
  ];
  const derivedGrid = derivedKeys
    .map(
      ([label, key]) => `
      <li>
        <span class="cdg-stat-label">${esc(label)}</span>
        <span class="cdg-stat-val" data-cdg-field="derived.${key}">—</span>
      </li>
    `
    )
    .join('');

  // Script vanilla embedado. Mantido como template string cuidadosamente
  // escapado para não conflitar com os crases externos. Responsável por:
  //  - File picker + drag-drop
  //  - Leitura JSON → parse → fill DOM
  //  - Renderização de listas (profs, subs, talentos, conjurações, cicatrizes)
  const SCRIPT = String.raw`
(function() {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function setField(path, value) {
    $$('[data-cdg-field="' + path + '"]').forEach(function (el) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = value == null ? '' : String(value);
      } else {
        el.textContent = value == null || value === '' ? '—' : String(value);
      }
    });
  }

  function clearLists() {
    $$('[data-cdg-list]').forEach(function (el) { el.innerHTML = ''; });
  }

  function renderProfs(character) {
    var box = $('[data-cdg-list="proficiencies"]');
    if (!box) return;
    var entries = Object.entries(character.proficiencies || {})
      .filter(function (kv) { return (kv[1] || 0) > 0; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
    if (entries.length === 0) { box.innerHTML = '<li class="cdg-empty">(vazio)</li>'; return; }
    box.innerHTML = entries.map(function (kv) {
      return '<li><span>' + kv[0] + '</span><span class="cdg-rank">R' + kv[1] + '</span></li>';
    }).join('');
  }

  function renderSubs(character) {
    var box = $('[data-cdg-list="subs"]');
    if (!box) return;
    var entries = Object.entries(character.subProficiencies || {})
      .filter(function (kv) { return (kv[1] || 0) > 0; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
    if (entries.length === 0) { box.innerHTML = '<li class="cdg-empty">(vazio)</li>'; return; }
    box.innerHTML = entries.map(function (kv) {
      return '<li><span>' + kv[0] + '</span><span class="cdg-rank">R' + kv[1] + '</span></li>';
    }).join('');
  }

  function renderTalents(character) {
    var box = $('[data-cdg-list="talents"]');
    if (!box) return;
    var ts = character.talents || [];
    if (ts.length === 0) { box.innerHTML = '<li class="cdg-empty">(nenhum talento)</li>'; return; }
    box.innerHTML = ts.map(function (t) {
      var tier = t.tier != null ? 'T' + t.tier + ' ' : '';
      var tree = t.treeId ? '[' + t.treeId + '] ' : '';
      return '<li>' + tree + tier + (t.abilityId || '(sem id)') + '</li>';
    }).join('');
  }

  function renderConjurations(character) {
    var box = $('[data-cdg-list="conjurations"]');
    if (!box) return;
    var cs = character.conjurations || [];
    if (cs.length === 0) { box.innerHTML = '<li class="cdg-empty">(nenhuma conjuração)</li>'; return; }
    box.innerHTML = cs.map(function (c) {
      var parts = [c.vertenteId, c.form, c.range, c.intensity].filter(Boolean).join(' · ');
      return '<li><div class="cdg-conj-head"><strong>' + (c.name || '(sem nome)') +
        '</strong><span class="cdg-conj-cost">custo ' + (c.cost != null ? c.cost : '?') + '</span></div>' +
        '<p class="cdg-conj-meta">' + parts + '</p></li>';
    }).join('');
  }

  function renderOriginalPower(character) {
    var op = character.originalPower || {};
    setField('op.concept', op.concept || '');
    setField('op.trigger', op.trigger || '');
    setField('op.costSource', op.costSource || '');
    setField('op.effect', op.effect || '');
    setField('op.condition', op.condition || '');
    setField('op.weakness', op.weakness || '');
    setField('op.rank', op.rank != null ? op.rank : '');

    var box = $('[data-cdg-list="opAbilities"]');
    if (!box) return;
    var abs = (op.abilities || []).filter(function (a) { return (a.name || '').trim() || (a.description || '').trim(); });
    if (abs.length === 0) { box.innerHTML = '<li class="cdg-empty">(nenhuma habilidade)</li>'; return; }
    box.innerHTML = abs.map(function (a, i) {
      return '<li><span class="cdg-slot-idx">' + (i + 1) + '</span><div>' +
        '<p class="cdg-slot-head"><strong>' + (a.name || '(sem nome)') + '</strong>' +
        (a.unlockedAt ? '<span class="cdg-slot-tag">' + a.unlockedAt + '</span>' : '') + '</p>' +
        (a.description ? '<p class="cdg-slot-desc">' + a.description.replace(/\n/g, '<br>') + '</p>' : '') +
        '</div></li>';
    }).join('');
  }

  function renderScars(character) {
    var box = $('[data-cdg-list="scars"]');
    if (!box) return;
    var scars = character.scars || [];
    if (scars.length === 0) { box.innerHTML = '<li class="cdg-empty">(sem cicatrizes)</li>'; return; }
    box.innerHTML = scars.map(function (s) {
      return '<li><strong>' + (s.name || '(sem nome)') + '</strong>' +
        (s.note ? '<span> — ' + s.note + '</span>' : '') + '</li>';
    }).join('');
  }

  function applyCharacter(character) {
    if (!character || typeof character !== 'object') return;

    setField('name', character.name);
    setField('level', character.level);
    setField('concept', character.concept);
    setField('raceId', character.raceId);
    setField('subtypeId', character.subtypeId);
    setField('xp.total', character.xp);
    setField('notes', character.notes);
    setField('equipmentPackageId', character.equipmentPackageId);
    setField('equipmentNotes', character.equipmentNotes);

    if (character.personality) {
      setField('personality.motivation', character.personality.motivation);
      setField('personality.appearance', character.personality.appearance);
      setField('personality.history', character.personality.history);
      setField('personality.bonds', character.personality.bonds);
    }

    if (character.attributesBase) {
      Object.keys(character.attributesBase).forEach(function (attr) {
        setField('attributes.' + attr + '.base', character.attributesBase[attr]);
      });
    }

    clearLists();
    renderProfs(character);
    renderSubs(character);
    renderTalents(character);
    renderConjurations(character);
    renderOriginalPower(character);
    renderScars(character);

    var banner = $('#cdg-import-status');
    if (banner) {
      banner.textContent = 'Ficha carregada: ' + (character.name || '(sem nome)') + ' — Nível ' + (character.level || '?');
      banner.className = 'cdg-import-ok';
    }
  }

  function handleFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        // Aceita tanto um Character cru quanto um export com { character: {...} }.
        var character = data && data.character ? data.character : data;
        applyCharacter(character);
      } catch (err) {
        var banner = $('#cdg-import-status');
        if (banner) {
          banner.textContent = 'Erro ao ler JSON: ' + (err && err.message ? err.message : 'inválido');
          banner.className = 'cdg-import-err';
        }
      }
    };
    reader.onerror = function () {
      var banner = $('#cdg-import-status');
      if (banner) {
        banner.textContent = 'Falha ao abrir arquivo.';
        banner.className = 'cdg-import-err';
      }
    };
    reader.readAsText(file);
  }

  function setupUI() {
    var input = $('#cdg-import-file');
    if (input) {
      input.addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) handleFile(f);
      });
    }

    var drop = $('#cdg-import-drop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (evt) {
        drop.addEventListener(evt, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('cdg-drop-active'); });
      });
      ['dragleave', 'drop'].forEach(function (evt) {
        drop.addEventListener(evt, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove('cdg-drop-active'); });
      });
      drop.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleFile(f);
      });
    }

    var pasteBtn = $('#cdg-paste-btn');
    var pasteArea = $('#cdg-paste-area');
    if (pasteBtn && pasteArea) {
      pasteBtn.addEventListener('click', function () {
        try {
          var data = JSON.parse(pasteArea.value);
          var character = data && data.character ? data.character : data;
          applyCharacter(character);
        } catch (err) {
          var banner = $('#cdg-import-status');
          if (banner) {
            banner.textContent = 'Erro ao ler JSON colado: ' + (err && err.message ? err.message : 'inválido');
            banner.className = 'cdg-import-err';
          }
        }
      });
    }

    var printBtn = $('#cdg-print-btn');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUI);
  } else {
    setupUI();
  }
})();
`;

  const importUI = `
    <section class="cdg-import-panel" aria-label="Importar ficha JSON">
      <h2>Importar Dados</h2>
      <p class="cdg-note" style="margin-bottom: 8px;">
        Abra um <code>Character.json</code> exportado do CDG Builder, ou cole o conteúdo abaixo.
        Campos básicos (identidade, atributos base, proficiências, talentos, conjurações,
        cicatrizes, personalidade, notas) são preenchidos automaticamente. Derivados e
        breakdown de XP ficam em branco — para ficha com derivados calculados, use o
        botão "Baixar ficha HTML" dentro do Builder.
      </p>
      <div id="cdg-import-drop" class="cdg-import-drop">
        <label class="cdg-import-label">
          <span>Arquivo <code>.json</code></span>
          <input id="cdg-import-file" type="file" accept=".json,application/json">
        </label>
        <p class="cdg-note">ou arraste um arquivo aqui</p>
      </div>
      <details class="cdg-import-paste">
        <summary>ou colar JSON…</summary>
        <textarea id="cdg-paste-area" rows="6" placeholder='{"name": "…", "level": 3, …}'></textarea>
        <button id="cdg-paste-btn" type="button">Aplicar JSON</button>
      </details>
      <p id="cdg-import-status" class="cdg-import-status">Aguardando dados…</p>
      <button id="cdg-print-btn" type="button" class="cdg-print-btn">Imprimir / Salvar PDF</button>
    </section>
  `;

  const body = `
    <header class="cdg-header">
      <p class="cdg-eyebrow">Cicatrizes do Gatilho · Ficha de Personagem (modelo)</p>
      <div class="cdg-title-row">
        <h1 data-cdg-field="name">—</h1>
        <p class="cdg-subtitle">
          Nível <span data-cdg-field="level">—</span> ·
          <span data-cdg-field="raceId">—</span>
          <span data-cdg-field="subtypeId"></span>
        </p>
      </div>
      <p class="cdg-concept" data-cdg-field="concept"></p>
    </header>

    <section class="cdg-block">
      <h2>Atributos</h2>
      <ul class="cdg-attr-grid">${attrGrid}</ul>
    </section>

    <section class="cdg-block">
      <h2>Derivados</h2>
      <ul class="cdg-derived-grid">${derivedGrid}</ul>
      <p class="cdg-note">* derivados exigem cálculo via engine — preencha à mão se importou só o JSON cru do Character.</p>
    </section>

    <section class="cdg-block">
      <h2>Proficiências</h2>
      <ul class="cdg-two-col" data-cdg-list="proficiencies"><li class="cdg-empty">(vazio)</li></ul>
    </section>

    <section class="cdg-block">
      <h2>Sub-Proficiências</h2>
      <ul class="cdg-two-col" data-cdg-list="subs"><li class="cdg-empty">(vazio)</li></ul>
    </section>

    <section class="cdg-block">
      <h2>Talentos</h2>
      <ul class="cdg-talent-list" data-cdg-list="talents"><li class="cdg-empty">(nenhum talento)</li></ul>
    </section>

    <section class="cdg-block">
      <h2>Poder Original</h2>
      <div class="cdg-op-core">
        <p class="cdg-kv"><strong>Conceito:</strong> <span data-cdg-field="op.concept"></span></p>
        <p class="cdg-kv"><strong>Gatilho:</strong> <span data-cdg-field="op.trigger"></span></p>
        <p class="cdg-kv"><strong>Custo:</strong> <span data-cdg-field="op.costSource"></span></p>
        <p class="cdg-kv"><strong>Efeito:</strong> <span data-cdg-field="op.effect"></span></p>
        <p class="cdg-kv"><strong>Condição:</strong> <span data-cdg-field="op.condition"></span></p>
        <p class="cdg-kv"><strong>Fraqueza:</strong> <span data-cdg-field="op.weakness"></span></p>
        <p class="cdg-kv"><strong>Rank:</strong> <span data-cdg-field="op.rank"></span></p>
      </div>
      <p class="cdg-eyebrow cdg-slots-title">Habilidades / Slots</p>
      <ol class="cdg-op-slots" data-cdg-list="opAbilities"><li class="cdg-empty">(nenhuma habilidade)</li></ol>
    </section>

    <section class="cdg-block">
      <h2>Conjurações</h2>
      <ul class="cdg-conj-list" data-cdg-list="conjurations"><li class="cdg-empty">(nenhuma conjuração)</li></ul>
    </section>

    <section class="cdg-block">
      <h2>XP</h2>
      <ul class="cdg-two-col">
        <li><span>Total</span><span class="cdg-rank" data-cdg-field="xp.total">—</span></li>
      </ul>
      <p class="cdg-note">breakdown de XP gasto requer o Builder. Preencha à mão se necessário.</p>
    </section>

    <section class="cdg-block">
      <h2>Equipamento</h2>
      <p class="cdg-kv"><strong>Pacote:</strong> <span data-cdg-field="equipmentPackageId"></span></p>
      <p class="cdg-notes" data-cdg-field="equipmentNotes"></p>
    </section>

    <section class="cdg-block">
      <h2>Cicatrizes</h2>
      <ul class="cdg-scars" data-cdg-list="scars"><li class="cdg-empty">(sem cicatrizes)</li></ul>
    </section>

    <section class="cdg-block">
      <h2>Personalidade</h2>
      <div class="cdg-personality">
        <p class="cdg-kv"><strong>Motivação:</strong> <span data-cdg-field="personality.motivation"></span></p>
        <p class="cdg-kv"><strong>Aparência:</strong> <span data-cdg-field="personality.appearance"></span></p>
        <p class="cdg-kv"><strong>História:</strong> <span data-cdg-field="personality.history"></span></p>
        <p class="cdg-kv"><strong>Laços:</strong> <span data-cdg-field="personality.bonds"></span></p>
      </div>
    </section>

    <section class="cdg-block">
      <h2>Notas</h2>
      <p class="cdg-notes" data-cdg-field="notes"></p>
    </section>

    <footer class="cdg-footer">
      <p>CDG Builder · modelo genérico · importe um <code>Character.json</code> para preencher.</p>
    </footer>
  `;

  const extraCss = `
.cdg-import-panel {
  margin-bottom: 20px;
  padding: 12px 14px;
  border: 1px dashed var(--ember-400);
  background: rgba(214, 140, 44, 0.04);
}
.cdg-import-drop {
  border: 1px dashed var(--ink-500);
  padding: 12px;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}
.cdg-drop-active { border-color: var(--ember-400); background: rgba(214, 140, 44, 0.08); }
.cdg-import-label { display: inline-flex; gap: 8px; align-items: center; cursor: pointer; color: var(--ember-400); }
.cdg-import-label code { font-family: 'Menlo', 'Consolas', monospace; color: var(--ember-300); }
.cdg-import-paste { margin-top: 8px; }
.cdg-import-paste summary { cursor: pointer; color: var(--ink-200); font-size: 12px; }
.cdg-import-paste textarea {
  width: 100%; margin-top: 6px;
  background: var(--ink-900); color: var(--ink-50);
  border: 1px solid var(--ink-500); padding: 6px; font-family: 'Menlo', 'Consolas', monospace; font-size: 12px;
}
.cdg-import-paste button, .cdg-print-btn {
  margin-top: 6px;
  background: transparent; color: var(--ember-400);
  border: 1px solid var(--ember-400); padding: 4px 10px; cursor: pointer;
  font-family: inherit;
}
.cdg-import-paste button:hover, .cdg-print-btn:hover { background: rgba(214, 140, 44, 0.08); }
.cdg-print-btn { margin-top: 10px; }
.cdg-import-status { margin: 8px 0 0; font-size: 11px; color: var(--ink-300); font-family: 'Menlo', 'Consolas', monospace; }
.cdg-import-ok { color: var(--ember-300) !important; }
.cdg-import-err { color: var(--blood-400) !important; }
.cdg-empty { font-style: italic; color: var(--ink-400); font-size: 12px; }
[data-cdg-field]:empty::before { content: '—'; color: var(--ink-400); }
@media print {
  .cdg-import-panel { display: none !important; }
}
`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CDG — Modelo de Ficha</title>
  <style>${SHEET_CSS}${extraCss}</style>
</head>
<body>
  <main class="cdg-sheet">
    ${importUI}
    ${body}
  </main>
  <script>${SCRIPT}</script>
</body>
</html>`;
}
