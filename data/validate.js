#!/usr/bin/env node
// Validador para os JSONs de dados do CDG.
// Regras:
//   - JSON válido.
//   - Campos obrigatórios no nível do arquivo: id, name, source.
//   - Campos obrigatórios em entidades nested (traits, subtypes, conjurations etc.): id, name.
//     `source` pode ser herdado do arquivo pai.
//   - IDs únicos por escopo (coleção + sub-key). "toque" pode ser forma E alcance.
//   - IDs em kebab-case sem acento.

const fs = require('fs');
const path = require('path');

const root = __dirname;
const collections = ['races', 'proficiencies', 'vertentes', 'pactos', 'scars', 'trees', 'progression', 'meta', 'rules'];

const errors = [];
const warnings = [];
const scopeIds = new Map(); // scope key -> Map(id -> file)
const fileCount = new Map(); // collection -> count

function kebab(s) {
  if (typeof s !== 'string') return false;
  // Aceita kebab-case (entidades) OU UPPER_SNAKE_CASE / UPPER (códigos e constantes: CON, HP_MAX).
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(s);
}

function addId(scope, id, rel) {
  if (!scopeIds.has(scope)) scopeIds.set(scope, new Map());
  const m = scopeIds.get(scope);
  if (m.has(id)) errors.push(`[${scope}] id duplicado '${id}' em ${rel} (já declarado em ${m.get(id)})`);
  else m.set(id, rel);
}

function checkEntity(e, rel, scope, { requireSource = false } = {}) {
  if (!e || typeof e !== 'object') return;
  if (!e.id) { errors.push(`${rel}: entidade sem 'id' em escopo ${scope}`); return; }
  if (!kebab(e.id)) warnings.push(`${rel}: id '${e.id}' não é kebab-case sem acento (${scope})`);
  if (!e.name) warnings.push(`${rel}: '${e.id}' sem 'name' em ${scope}`);
  if (requireSource && !e.source) warnings.push(`${rel}: '${e.id}' sem 'source' no topo do arquivo`);
  addId(scope, e.id, rel);
}

function walkNested(value, rel, scope) {
  // Recursively find arrays of objects with `id` and treat them as nested entity lists.
  if (Array.isArray(value)) {
    let hasIds = false;
    for (const item of value) if (item && typeof item === 'object' && item.id) { hasIds = true; break; }
    if (hasIds) {
      for (const item of value) if (item && typeof item === 'object' && item.id) checkEntity(item, rel, scope);
    }
    // Recurse regardless, in case items contain further nested arrays.
    for (const item of value) if (item && typeof item === 'object') recurseObject(item, rel, scope);
  } else if (value && typeof value === 'object') {
    recurseObject(value, rel, scope);
  }
}

function recurseObject(obj, rel, parentScope) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'modifiers' || k === 'prerequisites' || k === 'effects') continue;
    if (Array.isArray(v) || (v && typeof v === 'object')) {
      const childScope = `${parentScope}.${k}`;
      walkNested(v, rel, childScope);
    }
  }
}

function processFile(p, col) {
  const rel = path.relative(root, p);
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (err) { errors.push(`${rel}: JSON inválido — ${err.message}`); return; }

  fileCount.set(col, (fileCount.get(col) || 0) + 1);

  // Top-level record with id/name/source
  if (data && !Array.isArray(data) && data.id) {
    checkEntity(data, rel, col, { requireSource: true });
  }
  // If top-level is an array of entities
  if (Array.isArray(data)) {
    for (const e of data) checkEntity(e, rel, col, { requireSource: true });
  }
  // Recurse to find nested entity lists.
  recurseObject(Array.isArray(data) ? { _items: data } : data, rel, col);
}

function walk(dir, col) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, col);
    else if (e.endsWith('.json')) processFile(p, col);
  }
}

for (const c of collections) walk(path.join(root, c), c);

// Report
console.log('\n=== CDG DATA VALIDATION ===');
for (const c of collections) {
  const files = fileCount.get(c) || 0;
  const ids = [...scopeIds.entries()].filter(([s]) => s === c || s.startsWith(c + '.'))
    .reduce((acc, [, m]) => acc + m.size, 0);
  console.log(`  ${c.padEnd(15)} ${files} arquivo(s), ${ids} id(s) únicos`);
}

if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  warnings.slice(0, 30).forEach(w => console.log('  - ' + w));
  if (warnings.length > 30) console.log(`  ... +${warnings.length - 30} mais`);
}
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\nOK — sem erros bloqueantes.');
