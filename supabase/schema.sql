-- Harvest HAM Radio Practice database scaffold
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  pin_hash text not null,
  role text not null check (role in ('learner','teacher')),
  team text check (team in ('boys','girls','parents')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists attempts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  question_id text not null,
  subgroup text not null,
  section text not null,
  correct boolean not null,
  mode text not null check (mode in ('practice','exam','missed')),
  attempted_at timestamptz not null default now()
);

create table if not exists points_ledger (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  points integer not null,
  reason text not null,
  source text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists exam_results (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  score integer not null,
  total integer not null default 35,
  passed boolean not null,
  completed_at timestamptz not null default now()
);

-- Security policies will be added after the Supabase project is created,
-- because the final auth approach determines the exact RLS rules.
