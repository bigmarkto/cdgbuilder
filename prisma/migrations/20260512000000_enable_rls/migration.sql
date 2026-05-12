-- Segurança: Row Level Security em todas as tabelas do schema public.
--
-- Por quê:
--   O Supabase expõe automaticamente todo o schema `public` via PostgREST
--   (REST API com chaves anon/service_role). Sem RLS, qualquer pessoa com
--   a ANON KEY do projeto consegue bater no endpoint e ler `Account.access_token`,
--   `VerificationToken.token`, comentários ocultos por moderação, audit log etc.
--   O Supabase Advisor flagou isso ("RLS Disabled in Public" + "Sensitive
--   Columns Exposed" em Account/VerificationToken).
--
-- Como nosso app não usa essa API:
--   • Todo CRUD vai via Prisma, conectado como role `postgres` (superuser
--     com BYPASSRLS). RLS não interfere nessas queries.
--   • Não usamos Supabase Auth nem o cliente Supabase JS pra dados — só
--     pro Storage, que tem policies próprias separadas deste schema.
--
-- Efeito: "RLS on, zero policies" significa que PostgREST (anon/authenticated)
-- vê zero rows em todas essas tabelas. Prisma continua exatamente igual.
--
-- Se algum dia migrarmos parte do CRUD pro cliente Supabase JS, aí sim vamos
-- precisar escrever CREATE POLICY ... FOR SELECT/INSERT etc. específicas.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Revision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FileUpload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Tabela interna do Prisma — também é exposta pelo PostgREST por estar no
-- schema `public`. Lockdown também.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
