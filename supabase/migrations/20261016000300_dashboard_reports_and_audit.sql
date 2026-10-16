create or replace function public.log_record_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_details jsonb := '{}'::jsonb;
  v_lead_id uuid;
  v_property_id uuid;
  v_action text;
  v_description text;
  v_tracked_fields text[];
begin
  if tg_table_name = 'leads' then
    v_lead_id := (v_new ->> 'id')::uuid;
    if tg_op = 'INSERT' then
      v_tracked_fields := array['status', 'assigned_agent_id', 'property_id'];
      v_action := 'lead.created';
      v_description := case
        when auth.uid() is null then 'Public enquiry received'
        else 'Lead created'
      end;
    else
      v_tracked_fields := array['status', 'assigned_agent_id', 'property_id'];
      select coalesce(
        jsonb_object_agg(
          current_entry.key,
          jsonb_build_object('old', previous_entry.value, 'new', current_entry.value)
        ),
        '{}'::jsonb
      )
      into v_details
      from jsonb_each(v_new) as current_entry(key, value)
      join jsonb_each(v_old) as previous_entry(key, value) using (key)
      where current_entry.key = any(v_tracked_fields)
        and current_entry.value is distinct from previous_entry.value;

      if v_details = '{}'::jsonb then return new; end if;
      if v_details ? 'status' and v_details ? 'assigned_agent_id' then
        v_action := 'lead.stage_and_assignment_changed';
        v_description := 'Lead stage and assignment changed';
      elsif v_details ? 'status' then
        v_action := 'lead.stage_changed';
        v_description := 'Lead pipeline stage changed';
      elsif v_details ? 'assigned_agent_id' then
        v_action := 'lead.assignment_changed';
        v_description := 'Lead assignment changed';
      else
        v_action := 'lead.property_changed';
        v_description := 'Lead property link changed';
      end if;
    end if;
  elsif tg_table_name = 'properties' then
    v_property_id := (v_new ->> 'id')::uuid;
    v_tracked_fields := array[
      'title', 'description', 'location', 'price', 'purpose', 'property_type',
      'bedrooms', 'bathrooms', 'area', 'image_urls', 'status', 'assigned_agent_id'
    ];
    if tg_op = 'INSERT' then
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
      into v_details
      from jsonb_each(v_new) as entry(key, value)
      where entry.key = any(v_tracked_fields);
      v_action := 'property.created';
      v_description := 'Property listing created';
    else
      select coalesce(
        jsonb_object_agg(
          current_entry.key,
          jsonb_build_object('old', previous_entry.value, 'new', current_entry.value)
        ),
        '{}'::jsonb
      )
      into v_details
      from jsonb_each(v_new) as current_entry(key, value)
      join jsonb_each(v_old) as previous_entry(key, value) using (key)
      where current_entry.key = any(v_tracked_fields)
        and current_entry.value is distinct from previous_entry.value;

      if v_details = '{}'::jsonb then return new; end if;
      if v_details ? 'status' and v_details -> 'status' ->> 'new' = 'published' then
        v_action := 'property.published';
        v_description := 'Property listing published';
      elsif v_details ? 'status' and v_details -> 'status' ->> 'new' = 'archived' then
        v_action := 'property.archived';
        v_description := 'Property listing archived';
      elsif v_details ? 'assigned_agent_id' then
        v_action := 'property.assignment_changed';
        v_description := 'Property assignment changed';
      else
        v_action := 'property.updated';
        v_description := 'Property listing updated';
      end if;
    end if;
  else
    return new;
  end if;

  insert into public.activity_logs (
    lead_id,
    property_id,
    actor_user_id,
    action,
    description,
    change_details
  )
  values (
    v_lead_id,
    v_property_id,
    auth.uid(),
    v_action,
    v_description,
    v_details
  );
  return new;
end;
$$;

create function public.log_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role is distinct from new.role then
    insert into public.activity_logs (
      actor_user_id,
      action,
      description,
      change_details
    )
    values (
      auth.uid(),
      'staff.role_changed',
      'Staff role changed',
      jsonb_build_object(
        'profile_id', new.id,
        'old_role', old.role,
        'new_role', new.role
      )
    );
  end if;
  return new;
end;
$$;
revoke all on function public.log_profile_role_change() from public, anon, authenticated;

create trigger profiles_log_role_change
  after update of role on public.profiles
  for each row execute function public.log_profile_role_change();

create function public.get_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_is_admin boolean;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Staff profile required'
      using errcode = '42501';
  end if;
  v_is_admin := v_role = 'admin'::public.user_role;

  select jsonb_build_object(
    'publishedPropertyTotal', (
      select count(*)::integer
      from public.properties p
      where p.status = 'published'::public.property_status
        and (v_is_admin or p.assigned_agent_id = v_user_id)
    ),
    'totalLeads', (
      select count(*)::integer
      from public.leads l
      where v_is_admin or l.assigned_agent_id = v_user_id
    ),
    'newLeads', (
      select count(*)::integer
      from public.leads l
      where l.status = 'New'::public.lead_status
        and (v_is_admin or l.assigned_agent_id = v_user_id)
    ),
    'closedLeads', (
      select count(*)::integer
      from public.leads l
      where l.status = 'Closed'::public.lead_status
        and (v_is_admin or l.assigned_agent_id = v_user_id)
    ),
    'lostLeads', (
      select count(*)::integer
      from public.leads l
      where l.status = 'Lost'::public.lead_status
        and (v_is_admin or l.assigned_agent_id = v_user_id)
    ),
    'leadsByStage', (
      select jsonb_object_agg(stage.status::text, stage.total)
      from (
        select status.status, count(lead.id)::integer as total
        from unnest(enum_range(null::public.lead_status)) as status(status)
        left join public.leads lead
          on lead.status = status.status
          and (v_is_admin or lead.assigned_agent_id = v_user_id)
        group by status.status
      ) as stage
    ),
    'leadsByAgent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', agent.id,
        'name', agent.full_name,
        'total', agent.total,
        'closed', agent.closed,
        'lost', agent.lost
      ) order by agent.full_name), '[]'::jsonb)
        || case
          when v_is_admin then (
            select case when count(*) > 0 then jsonb_build_array(jsonb_build_object(
              'id', null,
              'name', 'Unassigned',
              'total', count(*)::integer,
              'closed', count(*) filter (where status = 'Closed'::public.lead_status)::integer,
              'lost', count(*) filter (where status = 'Lost'::public.lead_status)::integer
            )) else '[]'::jsonb end
            from public.leads
            where assigned_agent_id is null
          )
          else '[]'::jsonb
        end
      from (
        select p.id,
          coalesce(nullif(p.full_name, ''), 'Unnamed agent') as full_name,
          count(l.id)::integer as total,
          count(l.id) filter (where l.status = 'Closed'::public.lead_status)::integer as closed,
          count(l.id) filter (where l.status = 'Lost'::public.lead_status)::integer as lost
        from public.profiles p
        left join public.leads l
          on l.assigned_agent_id = p.id
          and (v_is_admin or l.assigned_agent_id = v_user_id)
        where p.role = 'agent'::public.user_role
          and (v_is_admin or p.id = v_user_id)
        group by p.id, p.full_name
      ) as agent
    ),
    'recentActivity', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', recent.id,
        'lead_id', recent.lead_id,
        'property_id', recent.property_id,
        'actor_user_id', recent.actor_user_id,
        'actor_name', recent.actor_name,
        'action', recent.action,
        'description', recent.description,
        'change_details', recent.change_details,
        'created_at', recent.created_at
      ) order by recent.created_at desc), '[]'::jsonb)
      from (
        select activity.id, activity.lead_id, activity.property_id,
          activity.actor_user_id,
          actor.full_name as actor_name,
          activity.action, activity.description, activity.change_details,
          activity.created_at
        from public.activity_logs activity
        left join public.profiles actor on actor.id = activity.actor_user_id
        where v_is_admin
          or (
            activity.lead_id is not null
            and exists (
              select 1 from public.leads lead
              where lead.id = activity.lead_id
                and lead.assigned_agent_id = v_user_id
            )
          )
          or (
            activity.property_id is not null
            and exists (
              select 1 from public.properties property
              where property.id = activity.property_id
                and property.assigned_agent_id = v_user_id
            )
          )
        order by activity.created_at desc
        limit 20
      ) as recent
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_metrics() from public, anon;
grant execute on function public.get_dashboard_metrics() to authenticated;
