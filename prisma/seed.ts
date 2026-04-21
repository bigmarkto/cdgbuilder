/**
 * Seed — popula o banco com páginas community de exemplo para você testar
 * a Fase 2 sem esperar o editor. Idempotente: usa upsert pelo slug.
 *
 * Rodar:   npx prisma db seed
 * Requer:  um User já existente (criado via magic-link). O seed pega o
 *          primeiro User encontrado como "autor de exemplo".
 *
 * O que cria:
 *   1. /wiki/c/bem-vindo                 — artigo solto
 *   2. /wiki/c/notas-sobre-agouros       — canonicalRef="races/agouro",
 *                                          aparece como bloco "Notas da
 *                                          comunidade" na página canonical.
 *   3. /wiki/c/guia-incendiario-basico   — GUIDE, com wikilink pra canonical.
 *
 * Remove: Nada. Se quiser limpar, rode `npx prisma db execute` com DELETE.
 */
import { PrismaClient } from '@prisma/client';
import type { DocNode } from '../lib/wiki/doc';

const db = new PrismaClient();

const welcome: DocNode = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Bem-vindo à comunidade CDG' }]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Este é o espaço dos jogadores. Aqui você encontra guias, lore expandida, builds recomendadas e verbetes escritos por quem joga. O conteúdo canônico do sistema continua em ' },
        { type: 'text', text: 'seções próprias', marks: [{ type: 'link', attrs: { href: '/wiki' } }] },
        { type: 'text', text: ' — esta camada é complementar.' }
      ]
    },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Como funciona' }]
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Qualquer conta logada pode ler. Editar exige promoção a EDITOR.' }] }]
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Toda edição gera uma revisão imutável. Histórico é público.' }] }]
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Links estilo ' },
                { type: 'text', text: '[[wiki]]', marks: [{ type: 'code' }] },
                { type: 'text', text: ' viram atalhos internos. Exemplo: ' },
                { type: 'text', text: '[[races/agouro|Agouros]]' },
                { type: 'text', text: ' ou ' },
                { type: 'text', text: '[[guia-incendiario-basico]]' },
                { type: 'text', text: '.' }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Moderação aparece na Fase 6. Até lá, comporte-se.', marks: [{ type: 'italic' }] }
          ]
        }
      ]
    }
  ]
};

const agouroNotes: DocNode = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Nas mesas que joguei, ' },
        { type: 'text', text: 'Agouros', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' costumam brilhar em campanhas longas. O custo de XP deles é alto no início, mas o retorno escala rápido depois do nível 6.' }
      ]
    },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Sinergias testadas' }]
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Combina muito com ' },
                { type: 'text', text: '[[vertentes/adivinhacao|Adivinhação]]' },
                { type: 'text', text: ' — dobra de vantagem em previsão.' }
              ]
            }
          ]
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Evite se o mestre puxa pro pé-no-chão; o traço é narrativo antes de mecânico.' }
              ]
            }
          ]
        }
      ]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Rolou diferente na sua mesa? Edita essa página depois da Fase 3.', marks: [{ type: 'italic' }] }
      ]
    }
  ]
};

const guideIncendiario: DocNode = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Um guia rápido de Incendiário pra quem tá começando. Assumimos que você leu a página canônica em ' },
        { type: 'text', text: '[[proficiencies/incendiario]]' },
        { type: 'text', text: '.' }
      ]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Atributo base' }]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Investir em PER primeiro. Depois CON pra não virar biscoito.' }
      ]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Primeiras 3 cicatrizes recomendadas' }]
    },
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Chama Persistente (nível 2)' }] }]
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Flagelo Menor (nível 4)' }] }]
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Juramento da Fornalha (nível 6)' }] }]
        }
      ]
    },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Aviso', marks: [{ type: 'bold' }] },
            { type: 'text', text: ': não estocar dano de fogo. O sistema aplica resistência cumulativa em inimigos do ' },
            { type: 'text', text: 'mesmo tipo', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' depois do segundo turno.' }
          ]
        }
      ]
    }
  ]
};

async function main() {
  // Pega primeiro User como "autor" do seed — você, provavelmente.
  const author = await db.user.findFirst({
    orderBy: { createdAt: 'asc' }
  });
  if (!author) {
    console.error(
      '[seed] Nenhum User encontrado. Faça login pelo menos 1x (magic-link) antes de rodar o seed.'
    );
    process.exit(1);
  }
  console.log(`[seed] Usando autor: ${author.email ?? author.id}`);

  const pages = [
    {
      slug: 'bem-vindo',
      title: 'Bem-vindo à comunidade',
      kind: 'ARTICLE' as const,
      canonicalRef: null,
      body: welcome,
      summary: 'Página inicial de boas-vindas (seed).'
    },
    {
      slug: 'notas-sobre-agouros',
      title: 'Notas sobre Agouros',
      kind: 'ARTICLE' as const,
      canonicalRef: 'races/agouro',
      body: agouroNotes,
      summary: 'Notas da comunidade para a raça Agouro (seed).'
    },
    {
      slug: 'guia-incendiario-basico',
      title: 'Guia rápido: Incendiário',
      kind: 'GUIDE' as const,
      canonicalRef: null,
      body: guideIncendiario,
      summary: 'Build recomendada de Incendiário (seed).'
    }
  ];

  for (const p of pages) {
    // Upsert pela slug. Se a página existe, só anexamos uma nova revisão
    // (não sobrescrevemos a anterior — histórico fica preservado).
    const existing = await db.page.findUnique({ where: { slug: p.slug } });

    if (!existing) {
      const page = await db.page.create({
        data: {
          slug: p.slug,
          title: p.title,
          kind: p.kind,
          canonicalRef: p.canonicalRef,
          authorId: author.id
        }
      });
      const revision = await db.revision.create({
        data: {
          pageId: page.id,
          authorId: author.id,
          body: p.body as unknown as object, // Json do Prisma aceita any object
          summary: p.summary,
          status: 'PUBLISHED'
        }
      });
      await db.page.update({
        where: { id: page.id },
        data: { currentRevisionId: revision.id }
      });
      console.log(`[seed] criou /wiki/c/${p.slug}`);
    } else {
      console.log(`[seed] já existe /wiki/c/${p.slug} — deixando como está`);
    }
  }

  console.log('[seed] pronto.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
