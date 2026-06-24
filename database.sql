-- ProjectFlow Pro V2.1 — Supabase/Postgres schema + RLS
-- 1. Créer un projet Supabase
-- 2. Coller ce script dans SQL Editor
-- 3. Copier supabase-config.example.js en supabase-config.js avec URL + anon key

create extension if not exists "pgcrypto";

create type app_role as enum ('membre','chef_projet','gestionnaire_portfolio','directeur_programme','pmo','admin');
create type rag_status as enum ('green','amber','red');
create type work_status as enum ('todo','doing','review','done','open','pending','accepted','rejected','watch','planned','at_risk');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role app_role not null default 'membre',
  created_at timestamptz not null default now()
);

create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner text,
  budget numeric default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references portfolios(id) on delete cascade,
  name text not null,
  director text,
  rag rag_status default 'green',
  created_at timestamptz not null default now()
);
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id) on delete cascade,
  name text not null,
  lead text,
  status text default 'Cadrage',
  start date,
  "end" date,
  budget numeric default 0,
  spent numeric default 0,
  progress int default 0 check(progress between 0 and 100),
  rag rag_status default 'green',
  created_at timestamptz not null default now()
);
create table if not exists project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role app_role not null default 'membre',
  primary key(project_id,user_id)
);
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  status text default 'todo',
  start date,
  "end" date,
  progress int default 0 check(progress between 0 and 100),
  owner text,
  priority int default 1,
  cost numeric default 0,
  depends_on uuid references tasks(id),
  tags text[] default '{}',
  created_at timestamptz not null default now()
);
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  date date,
  status text default 'planned'
);
create table if not exists risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  probability int check(probability between 1 and 5),
  impact int check(impact between 1 and 5),
  owner text,
  mitigation text,
  status text default 'open'
);
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  status text default 'pending',
  owner text,
  due date
);
create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  owner text,
  due date,
  status text default 'open'
);
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity numeric default 5,
  role app_role default 'membre'
);
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,
  object_id uuid not null,
  body text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null,
  filters jsonb default '{}',
  created_by uuid references profiles(id)
);
create table if not exists audit (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  label text,
  user_email text,
  at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''), 'membre')
  on conflict(id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table profiles enable row level security;
alter table portfolios enable row level security;
alter table programs enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table tasks enable row level security;
alter table milestones enable row level security;
alter table risks enable row level security;
alter table decisions enable row level security;
alter table actions enable row level security;
alter table resources enable row level security;
alter table comments enable row level security;
alter table views enable row level security;
alter table audit enable row level security;

create or replace function current_app_role()
returns app_role language sql stable security definer as $$
  select coalesce((select role from profiles where id = auth.uid()), 'membre'::app_role);
$$;
create or replace function is_project_member(pid uuid)
returns boolean language sql stable security definer as $$
  select exists(select 1 from project_members where project_id=pid and user_id=auth.uid())
     or current_app_role() in ('gestionnaire_portfolio','directeur_programme','pmo','admin');
$$;
create or replace function can_manage_project()
returns boolean language sql stable security definer as $$
  select current_app_role() in ('chef_projet','directeur_programme','pmo','admin');
$$;
create or replace function can_manage_portfolio()
returns boolean language sql stable security definer as $$
  select current_app_role() in ('gestionnaire_portfolio','directeur_programme','pmo','admin');
$$;
create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select current_app_role()='admin';
$$;

create policy "profiles read self" on profiles for select using (id=auth.uid() or is_admin());
create policy "profiles update self" on profiles for update using (id=auth.uid() or is_admin());

create policy "portfolio read" on portfolios for select using (auth.uid() is not null);
create policy "portfolio write" on portfolios for all using (can_manage_portfolio()) with check (can_manage_portfolio());
create policy "program read" on programs for select using (auth.uid() is not null);
create policy "program write" on programs for all using (can_manage_portfolio()) with check (can_manage_portfolio());
create policy "project read" on projects for select using (auth.uid() is not null and is_project_member(id));
create policy "project write" on projects for all using (can_manage_project()) with check (can_manage_project());
create policy "membership read" on project_members for select using (user_id=auth.uid() or can_manage_project());
create policy "membership write" on project_members for all using (can_manage_project()) with check (can_manage_project());

create policy "tasks read" on tasks for select using (is_project_member(project_id));
create policy "tasks write" on tasks for all using (is_project_member(project_id) and current_app_role() in ('membre','chef_projet','directeur_programme','pmo','admin')) with check (is_project_member(project_id));
create policy "milestones read" on milestones for select using (is_project_member(project_id));
create policy "milestones write" on milestones for all using (can_manage_project()) with check (can_manage_project());
create policy "risks read" on risks for select using (is_project_member(project_id));
create policy "risks write" on risks for all using (can_manage_project()) with check (can_manage_project());
create policy "decisions read" on decisions for select using (is_project_member(project_id));
create policy "decisions write" on decisions for all using (current_app_role() in ('directeur_programme','pmo','admin')) with check (current_app_role() in ('directeur_programme','pmo','admin'));
create policy "actions read" on actions for select using (is_project_member(project_id));
create policy "actions write" on actions for all using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy "resources read" on resources for select using (auth.uid() is not null);
create policy "resources write" on resources for all using (is_admin()) with check (is_admin());
create policy "comments read" on comments for select using (auth.uid() is not null);
create policy "comments write" on comments for insert with check (auth.uid() is not null);
create policy "views read" on views for select using (created_by=auth.uid() or is_admin());
create policy "views write" on views for all using (created_by=auth.uid() or is_admin()) with check (created_by=auth.uid() or is_admin());
create policy "audit read" on audit for select using (is_admin() or current_app_role() in ('directeur_programme','gestionnaire_portfolio','admin'));
create policy "audit insert" on audit for insert with check (auth.uid() is not null);

-- Seed facultatif à adapter après création d'utilisateurs réels.
