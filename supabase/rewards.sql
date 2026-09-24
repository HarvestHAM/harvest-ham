-- Harvest HAM Radio Practice - automatic rewards
create table if not exists public.reward_events (
  id bigint generated always as identity primary key,
  learner_id uuid not null references public.learners(id) on delete cascade,
  event_key text not null,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (learner_id, event_key)
);

create table if not exists public.subgroup_bests (
  learner_id uuid not null references public.learners(id) on delete cascade,
  subgroup text not null,
  best_percent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (learner_id, subgroup)
);

alter table public.reward_events enable row level security;
alter table public.subgroup_bests enable row level security;

drop policy if exists "learner reads own reward events" on public.reward_events;
create policy "learner reads own reward events"
on public.reward_events for select
using (
  learner_id in (select id from public.learners where auth_user_id = auth.uid())
  or public.is_teacher()
);

drop policy if exists "teachers manage reward events" on public.reward_events;
create policy "teachers manage reward events"
on public.reward_events for all
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists "learner reads own subgroup bests" on public.subgroup_bests;
create policy "learner reads own subgroup bests"
on public.subgroup_bests for select
using (
  learner_id in (select id from public.learners where auth_user_id = auth.uid())
  or public.is_teacher()
);

drop policy if exists "teachers manage subgroup bests" on public.subgroup_bests;
create policy "teachers manage subgroup bests"
on public.subgroup_bests for all
using (public.is_teacher())
with check (public.is_teacher());

create or replace function public.sync_rewards(
  p_subgroup text default null,
  p_group_total integer default null,
  p_session_score integer default null,
  p_session_total integer default null
)
returns table (points_added integer, messages text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner uuid;
  v_total integer := 0;
  v_bucket integer := 0;
  v_i integer;
  v_event bigint;
  v_added integer := 0;
  v_messages text[] := array[]::text[];
  v_day date;
  v_cursor date;
  v_start date;
  v_streak integer := 0;
  v_seen integer := 0;
  v_correct integer := 0;
  v_pct integer := 0;
  v_best integer;
  v_session_pct integer;
  v_exam record;
begin
  select id into v_learner
  from public.learners
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_learner is null then
    raise exception 'Learner account required';
  end if;

  select count(*) into v_total from public.attempts where learner_id = v_learner;
  v_bucket := floor(v_total / 5.0);
  if v_bucket > 0 then
    for v_i in 1..v_bucket loop
      v_event := null;
      insert into public.reward_events(learner_id,event_key,points,reason)
      values(v_learner,'practice5:'||v_i,1,'Answered another 5 questions')
      on conflict(learner_id,event_key) do nothing
      returning id into v_event;
      if v_event is not null then
        insert into public.points_ledger(learner_id,points,reason,source)
        values(v_learner,1,'Answered another 5 questions','system');
        v_added := v_added + 1;
        v_messages := array_append(v_messages,'+1: 5 questions practiced');
      end if;
    end loop;
  end if;

  for v_day in
    select distinct timezone('America/Denver',attempted_at)::date
    from public.attempts where learner_id = v_learner
  loop
    v_event := null;
    insert into public.reward_events(learner_id,event_key,points,reason)
    values(v_learner,'practice_day:'||v_day::text,3,'Practiced on a new day')
    on conflict(learner_id,event_key) do nothing
    returning id into v_event;
    if v_event is not null then
      insert into public.points_ledger(learner_id,points,reason,source)
      values(v_learner,3,'Practiced on a new day','system');
      v_added := v_added + 3;
      v_messages := array_append(v_messages,'+3: practice day');
    end if;
  end loop;

  v_cursor := timezone('America/Denver',now())::date;
  if not exists (
    select 1 from public.attempts
    where learner_id=v_learner
      and timezone('America/Denver',attempted_at)::date=v_cursor
  ) then
    v_cursor := v_cursor - 1;
  end if;

  if exists (
    select 1 from public.attempts
    where learner_id=v_learner
      and timezone('America/Denver',attempted_at)::date=v_cursor
  ) then
    loop
      exit when not exists (
        select 1 from public.attempts
        where learner_id=v_learner
          and timezone('America/Denver',attempted_at)::date=v_cursor
      );
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    end loop;
    v_start := v_cursor + 1;
  end if;

  if v_streak >= 3 then
    v_event := null;
    insert into public.reward_events(learner_id,event_key,points,reason)
    values(v_learner,'streak3:'||v_start::text,5,'Three-day practice streak')
    on conflict(learner_id,event_key) do nothing
    returning id into v_event;
    if v_event is not null then
      insert into public.points_ledger(learner_id,points,reason,source)
      values(v_learner,5,'Three-day practice streak','system');
      v_added := v_added + 5;
      v_messages := array_append(v_messages,'+5: 3-day streak');
    end if;
  end if;

  if v_streak >= 5 then
    v_event := null;
    insert into public.reward_events(learner_id,event_key,points,reason)
    values(v_learner,'streak5:'||v_start::text,10,'Five-day practice streak')
    on conflict(learner_id,event_key) do nothing
    returning id into v_event;
    if v_event is not null then
      insert into public.points_ledger(learner_id,points,reason,source)
      values(v_learner,10,'Five-day practice streak','system');
      v_added := v_added + 10;
      v_messages := array_append(v_messages,'+10: 5-day streak');
    end if;
  end if;

  if p_subgroup is not null and p_group_total is not null and p_group_total > 0 then
    with latest as (
      select distinct on(question_id) question_id,correct
      from public.attempts
      where learner_id=v_learner and subgroup=p_subgroup
      order by question_id,attempted_at desc,id desc
    )
    select count(*),count(*) filter(where correct)
      into v_seen,v_correct
    from latest;

    v_pct := round(100.0*v_correct/p_group_total);

    if v_seen >= p_group_total then
      v_event := null;
      insert into public.reward_events(learner_id,event_key,points,reason)
      values(v_learner,'complete:'||p_subgroup,5,'Completed subgroup '||p_subgroup)
      on conflict(learner_id,event_key) do nothing
      returning id into v_event;
      if v_event is not null then
        insert into public.points_ledger(learner_id,points,reason,source)
        values(v_learner,5,'Completed subgroup '||p_subgroup,'system');
        v_added := v_added + 5;
        v_messages := array_append(v_messages,'+5: subgroup completed');
      end if;

      if v_pct >= 80 then
        v_event := null;
        insert into public.reward_events(learner_id,event_key,points,reason)
        values(v_learner,'master:'||p_subgroup,5,'Mastered subgroup '||p_subgroup)
        on conflict(learner_id,event_key) do nothing
        returning id into v_event;
        if v_event is not null then
          insert into public.points_ledger(learner_id,points,reason,source)
          values(v_learner,5,'Mastered subgroup '||p_subgroup,'system');
          v_added := v_added + 5;
          v_messages := array_append(v_messages,'+5: subgroup mastered');
        end if;
      end if;

      if v_pct = 100 then
        v_event := null;
        insert into public.reward_events(learner_id,event_key,points,reason)
        values(v_learner,'perfect:'||p_subgroup,5,'Perfect subgroup '||p_subgroup)
        on conflict(learner_id,event_key) do nothing
        returning id into v_event;
        if v_event is not null then
          insert into public.points_ledger(learner_id,points,reason,source)
          values(v_learner,5,'Perfect subgroup '||p_subgroup,'system');
          v_added := v_added + 5;
          v_messages := array_append(v_messages,'+5: perfect subgroup');
        end if;
      end if;
    end if;

    if p_session_score is not null and p_session_total is not null and p_session_total > 0 then
      v_session_pct := round(100.0*p_session_score/p_session_total);
      select best_percent into v_best
      from public.subgroup_bests
      where learner_id=v_learner and subgroup=p_subgroup;

      if not found then
        insert into public.subgroup_bests(learner_id,subgroup,best_percent)
        values(v_learner,p_subgroup,v_session_pct)
        on conflict(learner_id,subgroup) do update
          set best_percent=greatest(public.subgroup_bests.best_percent,excluded.best_percent),
              updated_at=now();
      elsif v_session_pct > v_best then
        if v_session_pct >= v_best + 10 then
          v_event := null;
          insert into public.reward_events(learner_id,event_key,points,reason)
          values(v_learner,'improve:'||p_subgroup||':'||v_session_pct::text,3,'Improved '||p_subgroup||' score')
          on conflict(learner_id,event_key) do nothing
          returning id into v_event;
          if v_event is not null then
            insert into public.points_ledger(learner_id,points,reason,source)
            values(v_learner,3,'Improved '||p_subgroup||' score','system');
            v_added := v_added + 3;
            v_messages := array_append(v_messages,'+3: improved subgroup score');
          end if;
        end if;
        update public.subgroup_bests
        set best_percent=v_session_pct,updated_at=now()
        where learner_id=v_learner and subgroup=p_subgroup;
      end if;
    end if;
  end if;

  for v_exam in
    select id from public.exam_results
    where learner_id=v_learner and passed=true
  loop
    v_event := null;
    insert into public.reward_events(learner_id,event_key,points,reason)
    values(v_learner,'exam_pass:'||v_exam.id::text,10,'Passed a Technician practice exam')
    on conflict(learner_id,event_key) do nothing
    returning id into v_event;
    if v_event is not null then
      insert into public.points_ledger(learner_id,points,reason,source)
      values(v_learner,10,'Passed a Technician practice exam','system');
      v_added := v_added + 10;
      v_messages := array_append(v_messages,'+10: passed practice exam');
    end if;
  end loop;

  points_added := v_added;
  messages := v_messages;
  return next;
end;
$$;

revoke all on function public.sync_rewards(text,integer,integer,integer) from public;
grant execute on function public.sync_rewards(text,integer,integer,integer) to authenticated;
