create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('chat','writing','coding','documents','summarizer','translation','research')),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_owner_updated_idx on public.conversations(owner_id, updated_at desc);

create table if not exists public.saved_prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create table if not exists public.usage_records (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete set null,
  tool text not null,
  provider text not null,
  status text not null check (status in ('success','error')),
  created_at timestamptz not null default now()
);
create index if not exists usage_records_created_idx on public.usage_records(created_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free','pro','premium')),
  status text not null check (status in ('pending','active','past_due','canceled','incomplete')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.saved_prompts enable row level security;
alter table public.projects enable row level security;
alter table public.usage_records enable row level security;
alter table public.subscriptions enable row level security;
alter table public.platform_settings enable row level security;

drop policy if exists "profile owner read" on public.profiles;
create policy "profile owner read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profile owner update" on public.profiles;
create policy "profile owner update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "conversation owner access" on public.conversations;
create policy "conversation owner access" on public.conversations for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (project_id is null or exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    ))
  );
drop policy if exists "prompt owner access" on public.saved_prompts;
create policy "prompt owner access" on public.saved_prompts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "project owner access" on public.projects;
create policy "project owner access" on public.projects for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "usage owner read" on public.usage_records;
create policy "usage owner read" on public.usage_records for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "usage owner insert" on public.usage_records;
create policy "usage owner insert" on public.usage_records for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "subscription owner read" on public.subscriptions;
create policy "subscription owner read" on public.subscriptions for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.platform_settings from anon, authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (email) on public.profiles to authenticated;

insert into public.platform_settings (key, value)
values ('usage_limit_free', '20'::jsonb), ('usage_limit_pro', '500'::jsonb), ('usage_limit_premium', '2500'::jsonb)
on conflict (key) do nothing;