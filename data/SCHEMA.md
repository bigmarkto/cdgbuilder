# CDG Data Schema (v0)

All extracted entities are JSON. Use these conventions so the rules engine and wiki can share the same data.

## Common Fields (every entity)

```json
{
  "id": "kebab-case-slug",
  "name": "Nome no jogo",
  "source": "CDG_Xxx.md",
  "description": "Markdown livre com a explicação/lore.",
  "tags": ["opcional", "classificadores"]
}
```

`id` é derivado do nome. Sem acentos, minúsculo, separado por hífen. Deve ser único dentro da coleção.

## Common: Mechanical Blocks

Quando a entidade tem efeitos mecânicos, use:

```json
{
  "prerequisites": [
    { "type": "attribute", "attr": "POT", "min": 14 },
    { "type": "proficiency", "id": "luta-armada", "minRank": 2 },
    { "type": "level", "min": 3 },
    { "type": "race", "id": "humano" },
    { "type": "vertente", "id": "feitica", "minRank": 1 },
    { "type": "talent", "id": "algum-talento" },
    { "type": "custom", "text": "Condição livre em PT-BR" }
  ],
  "modifiers": [
    { "type": "attribute", "attr": "POT", "value": 2 },
    { "type": "derived", "target": "HP_MAX", "value": 5 },
    { "type": "derived", "target": "DP", "value": 1 },
    { "type": "proficiency", "id": "atirar", "rankDelta": 1 },
    { "type": "speed", "value": 3 },
    { "type": "resistance", "damageType": "fogo", "value": "half" },
    { "type": "immunity", "damageType": "veneno" },
    { "type": "grant", "target": "talent|power|feature", "id": "x" },
    { "type": "custom", "text": "Efeito em PT-BR quando não cabe em nenhum tipo" }
  ]
}
```

**Regra de ouro:** quando em dúvida, use `"type": "custom"` com texto em português. É melhor capturar a regra como texto do que perdê-la.

## Entity Types

### Race (`data/races/*.json`)
```json
{
  "id": "humano",
  "name": "Humano",
  "source": "CDG_RacasDef.md",
  "description": "...",
  "subtypes": [
    { "id": "humano-imperial", "name": "Imperial", "description": "...", "modifiers": [...] }
  ],
  "traits": [
    { "id": "versatilidade", "name": "Versatilidade", "description": "...", "modifiers": [...] }
  ],
  "weaknesses": [
    { "id": "fragilidade", "name": "Fragilidade", "description": "..." }
  ],
  "baseSpeed": 9,
  "size": "medio",
  "ageRange": { "maturity": 16, "average": 80 }
}
```

### Proficiency (`data/proficiencies/index.json`)
```json
{
  "attributes": ["CON","POT","AGI","PER","INT","ENG","RES","FOC","PRE"],
  "attributeGroups": {
    "CORPO": ["CON","POT","AGI"],
    "MENTE": ["PER","INT","ENG"],
    "ESPIRITO": ["RES","FOC","PRE"]
  },
  "ranks": [
    { "id": "nenhum", "name": "Nenhum", "bonus": -4 },
    { "id": "assertivo", "name": "Assertivo", "bonus": 0 },
    { "id": "aprendiz", "name": "Aprendiz", "bonus": 2 },
    { "id": "treinado", "name": "Treinado", "bonus": 4 },
    { "id": "profissional", "name": "Profissional", "bonus": 6 },
    { "id": "expert", "name": "Expert", "bonus": 8 },
    { "id": "mestre", "name": "Mestre", "bonus": 10 }
  ],
  "proficiencies": [
    {
      "id": "luta-armada",
      "name": "Luta Armada",
      "attribute": "POT",
      "description": "...",
      "usedFor": ["ataques corpo a corpo com armas"]
    }
  ],
  "subProficiencies": [
    {
      "id": "esgrima",
      "name": "Esgrima",
      "parent": "luta-armada",
      "description": "...",
      "prerequisites": [...],
      "effects": [...]
    }
  ]
}
```

### Vertente de Poder (`data/vertentes/*.json`)
```json
{
  "id": "feitica",
  "name": "Feitiça",
  "source": "CDG_Energia_Cosmica.md",
  "description": "...",
  "governingAttribute": "INT",
  "maxRankNormal": 4,
  "unlockCondition": "...",
  "tags": ["magica"],
  "conjurations": [
    {
      "id": "bola-de-fogo",
      "name": "Bola de Fogo",
      "rank": 2,
      "description": "...",
      "forms": ["projetil","explosao"],
      "ranges": ["curto","medio"],
      "intensity": "moderado",
      "cost": 2,
      "effects": [...],
      "prerequisites": [...]
    }
  ]
}
```

### Sistema de Energia Cósmica (`data/vertentes/system.json`)
```json
{
  "forms": [ { "id": "projetil", "name": "Projétil", "costModifier": 0 } ],
  "ranges": [ { "id": "toque", "name": "Toque", "meters": 0, "costModifier": 0 } ],
  "intensities": [ { "id": "leve", "name": "Leve", "dice": "1d6", "costModifier": 0 } ],
  "caps": { "normal": 4, "dupla": 5, "tripla": 6, "ancianica": null, "abissal": null },
  "poolFormula": "maiorAtribPrincipal + nivel + bonusArvore",
  "usesFormula": "RES * 3"
}
```

### Poder Original (`data/powers/*.json`)
```json
{
  "id": "poder-x",
  "name": "Poder Original X",
  "source": "CDG_Poderes_Originais.md",
  "description": "...",
  "category": "...",
  "cost": "...",
  "prerequisites": [...],
  "effects": [...]
}
```

### Pacto (`data/pactos/*.json`)
```json
{
  "id": "pacto-sombra",
  "name": "Pacto da Sombra",
  "source": "CDG_Pactos.md",
  "patron": "...",
  "description": "...",
  "boons": [ { "id": "...", "name": "...", "description": "...", "modifiers": [...] } ],
  "costs": [ { "id": "...", "name": "...", "description": "..." } ],
  "prerequisites": [...]
}
```

### Cicatriz (`data/scars/*.json`)
```json
{
  "id": "cicatriz-do-silencio",
  "name": "Cicatriz do Silêncio",
  "source": "CDG_Cicatrizes.md",
  "trigger": "...",
  "description": "...",
  "effects": [...],
  "severity": "leve|moderada|grave|terminal"
}
```

### Árvore de Habilidades (`data/trees/*.json`)
```json
{
  "id": "corpo",
  "name": "Corpo",
  "description": "...",
  "tiers": [
    {
      "tier": 1,
      "slots": 10,
      "abilities": [
        {
          "id": "musculatura-rigida",
          "name": "Musculatura Rígida",
          "cost": 1,
          "description": "...",
          "prerequisites": [...],
          "modifiers": [...]
        }
      ]
    }
  ]
}
```

### Progressão (`data/progression/*.json`)
```json
{
  "id": "niveis",
  "levels": [
    {
      "level": 1,
      "xpRequired": 0,
      "proficiencyPoints": 12,
      "features": ["..."],
      "notes": "..."
    }
  ]
}
```

Para fases (P1–P4), crie um arquivo por fase descrevendo as regras de progressão daquela fase.

### Meta (`data/meta/*.json`)
Regras "de sistema" que não encaixam nas categorias acima: economia de ações, testes de morte, condições de sobrevivência (fome/sede/fadiga), economia de carga, DP, etc.

```json
{
  "id": "economia-de-acoes",
  "name": "Economia de Ações",
  "source": "CDG_Livro_Core.md",
  "description": "...",
  "rules": [
    { "id": "acao-principal", "name": "Ação Principal", "perTurn": 1 }
  ]
}
```

## Extraction Rules for Subagents

1. **Não invente.** Se o documento não especifica, não preencha. Omita o campo.
2. **Preserve o texto em PT-BR** na `description`. Pode condensar, mas não traduza/edite regras.
3. **Prefira `custom` a perder informação.** Se uma regra não cabe nos tipos estruturados, coloque em `modifiers` como `{ "type": "custom", "text": "..." }`.
4. **IDs:** normalize (sem acento, minúsculo, hífen). Ex: "Feitiça" → `feitica`. "Ancestralidade Cósmica" → `ancestralidade-cosmica`.
5. **Um arquivo por entidade grande** (uma raça por arquivo). Listas pequenas (proficiências) podem ficar em `index.json`.
6. **Sempre inclua `source`** apontando para o .md de origem, para rastreabilidade.
7. **Validação:** ao terminar, rode `node data/validate.js` (será criado depois) ou garanta que cada arquivo é JSON válido.
