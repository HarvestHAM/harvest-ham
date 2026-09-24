-- Harvest HAM Radio Practice
-- Teacher-only learner management controls

create or replace function public.teacher_reset_learner_progress(
  p_learner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'Teacher access required';
  end if;

  if not exists (
    select 1 from public.learners where id = p_learner_id
  ) then
    raise exception 'Learner not found';
  end if;

  delete from public.reward_events
  where learner_id = p_learner_id;

  delete from public.subgroup_bests
  where learner_id = p_learner_id;

  delete from public.attempts
  where learner_id = p_learner_id;

  delete from public.points_ledger
  where learner_id = p_learner_id;

  delete from public.exam_results
  where learner_id = p_learner_id;
end;
$$;

create or replace function public.teacher_delete_learner(
  p_learner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'Teacher access required';
  end if;

  if not exists (
    select 1 from public.learners where id = p_learner_id
  ) then
    raise exception 'Learner not found';
  end if;

  delete from public.learners
  where id = p_learner_id;
end;
$$;

revoke all on function public.teacher_reset_learner_progress(uuid) from public;
revoke all on function public.teacher_delete_learner(uuid) from public;

grant execute on function public.teacher_reset_learner_progress(uuid) to authenticated;
grant execute on function public.teacher_delete_learner(uuid) to authenticated;
