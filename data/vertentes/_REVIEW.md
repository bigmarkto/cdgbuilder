# Vertentes — Pendentes de Revisão

Status (2026-04-18): **Vertentes serão revisadas pelo autor em breve.**

Enquanto a revisão não chega, o conteúdo atual de `data/vertentes/` é uma extração literal de `CDG_Energia_Cosmica.md` e deve ser tratado como **provisório**.

## O que está aqui hoje

- `system.json` — regras gerais de Energia Cósmica: formas, alcances, intensidades, caps por tipo de vertente (normal 4 / dupla 5 / tripla 6 / anciânica e abissal sem teto), fórmula de pool, fórmula de custo, 9 conjurações de exemplo, 28 híbridas duplas, 16 híbridas triplas.
- 9 vertentes: `feitica`, `dogmatica`, `sacrificial`, `primal`, `tecnomagia`, `braseira`, `ancianica`, `alem`, `abissal`. Cada arquivo contém a descrição e regras específicas; `conjurations: []` está vazio porque o sistema é **modular** (jogador monta cada conjuração com Forma + Alcance + Intensidade) — não há lista canônica de feitiços prontos na fonte original.

## O que NÃO fazer antes da revisão

- Não escrever UI de wiki/builder que dependa de conjurações nomeadas por vertente — o modelo é modular, não um catálogo.
- Não criar regras da engine que assumam catálogo fechado de magias.

## O que fazer antes da revisão

- Tratar vertentes como um sistema paramétrico: o builder deve **gerar** conjurações a partir de {Vertente, Forma, Alcance, Intensidade}, não escolhê-las de uma lista.
- Quando o autor entregar a revisão, atualizar os 10 arquivos e remover esta nota.

**Nada em outros domínios (raças, proficiências, cicatrizes, pactos, árvores, progressão) depende de mudanças aqui.**
