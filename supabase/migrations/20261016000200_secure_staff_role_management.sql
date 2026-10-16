create or replace function public.set_profile_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.user_role;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('primeview-staff-role-management', 0)
  );

  select role
  into v_target_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found'
      using errcode = 'P0002';
  end if;

  if v_target_role = 'admin'::public.user_role
    and p_role = 'agent'::public.user_role
    and (
      select count(*)
      from public.profiles
      where role = 'admin'::public.user_role
    ) <= 1
  then
    raise exception 'The final administrator cannot be demoted'
      using errcode = '23514';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;
end;
$$;

revoke all on function public.set_profile_role(uuid, public.user_role)
  from public, anon;
grant execute on function public.set_profile_role(uuid, public.user_role)
  to authenticated;

create function public.record_lead_follow_up(
  p_lead_id uuid,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_id uuid;
begin
  if auth.uid() is null or not private.can_access_lead(p_lead_id) then
    raise exception 'Lead access required'
      using errcode = '42501';
  end if;

  if p_description is null
    or char_length(trim(p_description)) not between 1 and 500
  then
    raise exception 'Follow-up note must contain 1 to 500 characters'
      using errcode = '22023';
  end if;

  insert into public.activity_logs (
    lead_id,
    actor_user_id,
    action,
    description,
    change_details
  )
  values (
    p_lead_id,
    auth.uid(),
    'lead.follow_up',
    trim(p_description),
    '{}'::jsonb
  )
  returning id into v_activity_id;

  return v_activity_id;
end;
$$;

revoke all on function public.record_lead_follow_up(uuid, text)
  from public, anon;
grant execute on function public.record_lead_follow_up(uuid, text)
  to authenticated;

create function private.require_agent_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_agent_id is not null
    and not exists (
      select 1
      from public.profiles
      where id = new.assigned_agent_id
        and role = 'agent'::public.user_role
    )
  then
    raise exception 'Assignments must target an agent profile'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.require_agent_assignment()
  from public, anon, authenticated;

create trigger leads_require_agent_assignment
  before insert or update of assigned_agent_id on public.leads
  for each row execute function private.require_agent_assignment();

create trigger properties_require_agent_assignment
  before insert or update of assigned_agent_id on public.properties
  for each row execute function private.require_agent_assignment();
