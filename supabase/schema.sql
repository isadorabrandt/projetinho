-- Minhas Finanças: estrutura do banco no Supabase
-- Cole este arquivo inteiro em: Supabase → SQL Editor → New query → Run.
-- Pode rodar de novo sem problema: ele não apaga dados.

-- Configuração de cada pessoa (contas, cartões, categorias, renda, metas, contas fixas)
create table if not exists public.finance_config (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  config     jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lançamentos agrupados por mês ("AAAA-MM")
create table if not exists public.finance_months (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month      text not null check (month ~ '^\d{4}-\d{2}$'),
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- Cada pessoa só lê e escreve os próprios dados
alter table public.finance_config enable row level security;
alter table public.finance_months enable row level security;

drop policy if exists "config: só a dona" on public.finance_config;
create policy "config: só a dona" on public.finance_config
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "meses: só a dona" on public.finance_months;
create policy "meses: só a dona" on public.finance_months
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Ninguém sem login acessa nada
revoke all on public.finance_config from anon;
revoke all on public.finance_months from anon;
grant select, insert, update, delete on public.finance_config to authenticated;
grant select, insert, update, delete on public.finance_months to authenticated;
