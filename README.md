# CRM Cadena

CRM web da Cadena para gestão de leads, atendimento, follow-ups, equipe, visitas, propostas e relatórios.

## Stack

- Next.js 15
- React 19
- TypeScript
- Supabase Auth + PostgreSQL + RLS
- `@supabase/ssr` para sessão baseada em cookies
- XLS/XLSX/CSV para importação de leads

## Variáveis de ambiente

### Browser / Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` continua aceito como compatibilidade legada, mas a chave publishable é a configuração recomendada.

### Servidor

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

A service role nunca deve ser prefixada com `NEXT_PUBLIC_` nem enviada ao navegador.

## Banco de dados

A ordem histórica para um banco novo é:

1. `supabase/schema.sql`
2. `database-leads-management.sql`
3. `supabase/migrations/0001_hardening.sql`
4. `supabase/crm-modules.sql`
5. `supabase/security-and-team.sql`

O banco já existente do projeto Cadena possui as quatro primeiras etapas históricas aplicadas. A migration `0001_hardening.sql` deve ser executada no banco atual para corrigir a coluna de importação e garantir a função `set_updated_at`.

Para novos ambientes, o objetivo é manter novas alterações exclusivamente em `supabase/migrations/` com nomes numerados.

## Desenvolvimento

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

O CI executa typecheck, lint e build em cada push/PR para `main`.

## Estrutura importante

- `app/` — páginas e rotas do CRM
- `components/` — componentes compartilhados
- `lib/supabase/client.ts` — cliente Supabase do navegador
- `lib/supabase/server.ts` — cliente Supabase do servidor
- `middleware.ts` — proteção de rotas e sessão
- `supabase/` — SQL e migrations
