create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.user_role as enum ('admin', 'agent');
create type public.property_purpose as enum ('sale', 'rent');
create type public.property_status as enum ('draft', 'published', 'archived');
create type public.lead_status as enum (
  'New',
  'Contacted',
  'Viewing Scheduled',
  'Negotiation',
  'Closed',
  'Lost'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.user_role not null default 'agent',
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '',
  location text not null check (char_length(trim(location)) between 1 and 300),
  price numeric(14, 2) not null check (price >= 0),
  purpose public.property_purpose not null,
  property_type text not null check (char_length(trim(property_type)) between 1 and 100),
  bedrooms smallint check (bedrooms is null or bedrooms >= 0),
  bathrooms smallint check (bathrooms is null or bathrooms >= 0),
  area numeric(12, 2) check (area is null or area > 0),
  image_urls text[] not null default '{}' check (cardinality(image_urls) <= 30),
  status public.property_status not null default 'draft',
  assigned_agent_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(trim(client_name)) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) between 7 and 32),
  property_id uuid references public.properties (id) on delete set null,
  assigned_agent_id uuid references public.profiles (id) on delete set null,
  status public.lead_status not null default 'New',
  message text check (message is null or char_length(message) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(trim(action)) between 1 and 100),
  description text not null check (char_length(trim(description)) between 1 and 500),
  change_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index properties_public_status_created_idx
  on public.properties (created_at desc)
  where status = 'published';
create index properties_agent_status_idx
  on public.properties (assigned_agent_id, status);
create index leads_agent_status_created_idx
  on public.leads (assigned_agent_id, status, created_at desc);
create index leads_property_id_idx on public.leads (property_id);
create index activity_logs_lead_created_idx
  on public.activity_logs (lead_id, created_at desc);
create index activity_logs_property_created_idx
  on public.activity_logs (property_id, created_at desc);
create index activity_logs_actor_created_idx
  on public.activity_logs (actor_user_id, created_at desc);

create table private.public_enquiry_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);
create index public_enquiry_rate_limits_window_idx
  on private.public_enquiry_rate_limits (window_started_at);
alter table private.public_enquiry_rate_limits enable row level security;
revoke all on private.public_enquiry_rate_limits from public, anon, authenticated, service_role;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'::public.user_role
  );
$$;

create function private.can_access_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.properties
      where id = p_property_id
        and assigned_agent_id = (select auth.uid())
    );
$$;

create function private.can_access_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.leads
      where id = p_lead_id
        and assigned_agent_id = (select auth.uid())
    );
$$;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_access_property(uuid) to authenticated;
grant execute on function private.can_access_lead(uuid) to authenticated;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120),
    'agent'::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, role)
select
  id,
  left(trim(coalesce(raw_user_meta_data ->> 'full_name', '')), 120),
  'agent'::public.user_role
from auth.users
on conflict (id) do nothing;

create function public.set_profile_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found'
      using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_profile_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_profile_role(uuid, public.user_role) to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create function public.log_record_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_details jsonb;
  v_lead_id uuid;
  v_property_id uuid;
  v_action text;
  v_description text;
  v_tracked_fields text[];
begin
  v_new := to_jsonb(new);
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;

  if tg_table_name = 'leads' then
    v_lead_id := (v_new ->> 'id')::uuid;
    v_tracked_fields := array['status', 'assigned_agent_id', 'property_id'];
    v_action := case when tg_op = 'INSERT' then 'lead.created' else 'lead.updated' end;
    v_description := case when tg_op = 'INSERT' then 'Lead created' else 'Lead updated' end;
  else
    v_property_id := (v_new ->> 'id')::uuid;
    v_tracked_fields := array[
      'title', 'location', 'price', 'purpose', 'property_type', 'status', 'assigned_agent_id'
    ];
    v_action := case when tg_op = 'INSERT' then 'property.created' else 'property.updated' end;
    v_description := case when tg_op = 'INSERT' then 'Property created' else 'Property updated' end;
  end if;

  if tg_op = 'INSERT' then
    select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
    into v_details
    from jsonb_each(v_new) as entry(key, value)
    where entry.key = any(v_tracked_fields);
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

    if v_details = '{}'::jsonb then
      return new;
    end if;
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
revoke all on function public.log_record_activity() from public, anon, authenticated;

create trigger leads_log_activity
  after insert or update on public.leads
  for each row execute function public.log_record_activity();
create trigger properties_log_activity
  after insert or update on public.properties
  for each row execute function public.log_record_activity();

create function private.consume_public_enquiry_quota(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key'
      using errcode = '22023';
  end if;

  delete from private.public_enquiry_rate_limits
  where window_started_at < now() - interval '1 day';

  insert into private.public_enquiry_rate_limits as current_limit (
    ip_hash,
    window_started_at,
    request_count
  )
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
  set window_started_at = case
        when current_limit.window_started_at <= now() - interval '15 minutes' then now()
        else current_limit.window_started_at
      end,
      request_count = case
        when current_limit.window_started_at <= now() - interval '15 minutes' then 1
        else current_limit.request_count + 1
      end
  returning request_count into v_request_count;

  return v_request_count <= 5;
end;
$$;
revoke all on function private.consume_public_enquiry_quota(text) from public, anon, authenticated;

create function public.consume_public_enquiry_quota(p_ip_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.consume_public_enquiry_quota(p_ip_hash);
$$;
revoke all on function public.consume_public_enquiry_quota(text) from public, anon, authenticated;
grant execute on function public.consume_public_enquiry_quota(text) to service_role;

create function public.create_public_enquiry(
  p_client_name text,
  p_email text,
  p_phone text,
  p_property_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  if p_property_id is not null
    and not exists (
      select 1
      from public.properties
      where id = p_property_id
        and status = 'published'::public.property_status
    )
  then
    raise exception 'Property is not available'
      using errcode = '22023';
  end if;

  insert into public.leads (client_name, email, phone, property_id, message)
  values (
    trim(p_client_name),
    lower(trim(p_email)),
    nullif(trim(p_phone), ''),
    p_property_id,
    nullif(trim(p_message), '')
  )
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;
revoke all on function public.create_public_enquiry(text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_public_enquiry(text, text, text, uuid, text)
  to service_role;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.activity_logs enable row level security;

revoke all on public.profiles, public.properties, public.leads, public.activity_logs
  from public, anon, authenticated;

create policy "Profiles are visible to self and administrators"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy "Profiles can be updated by self or administrators"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

create policy "Published properties are public"
  on public.properties for select to anon
  using (status = 'published');
create policy "Users can read published or assigned properties"
  on public.properties for select to authenticated
  using (
    status = 'published'
    or assigned_agent_id = (select auth.uid())
    or private.is_admin()
  );
create policy "Agents can create assigned properties and administrators can create any"
  on public.properties for insert to authenticated
  with check (
    assigned_agent_id = (select auth.uid())
    or private.is_admin()
  );
create policy "Agents can update assigned properties and administrators can update any"
  on public.properties for update to authenticated
  using (
    assigned_agent_id = (select auth.uid())
    or private.is_admin()
  )
  with check (
    assigned_agent_id = (select auth.uid())
    or private.is_admin()
  );
create policy "Only administrators can delete properties"
  on public.properties for delete to authenticated
  using (private.is_admin());

create policy "Agents can read assigned leads and administrators can read all"
  on public.leads for select to authenticated
  using (
    assigned_agent_id = (select auth.uid())
    or private.is_admin()
  );
create policy "Only administrators can create leads"
  on public.leads for insert to authenticated
  with check (private.is_admin());
create policy "Agents can update assigned leads and administrators can update any"
  on public.leads for update to authenticated
  using (
    assigned_agent_id = (select auth.uid())
    or private.is_admin()
  )
  with check (
    assigned_agent_id = (select auth.uid())
    or private.is_admin()
  );
create policy "Only administrators can delete leads"
  on public.leads for delete to authenticated
  using (private.is_admin());

create policy "Users can read related activity and administrators can read all"
  on public.activity_logs for select to authenticated
  using (
    private.is_admin()
    or (
      lead_id is not null
      and private.can_access_lead(lead_id)
    )
    or (
      property_id is not null
      and private.can_access_property(property_id)
    )
  );

grant usage on schema public to anon, authenticated, service_role;
grant usage on type public.user_role, public.property_purpose, public.property_status,
  public.lead_status to anon, authenticated, service_role;

grant select on public.properties to anon;
grant select, delete on public.properties to authenticated;
grant insert (
  title, description, location, price, purpose, property_type,
  bedrooms, bathrooms, area, image_urls, status, assigned_agent_id
) on public.properties to authenticated;
grant update (
  title, description, location, price, purpose, property_type,
  bedrooms, bathrooms, area, image_urls, status, assigned_agent_id
) on public.properties to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, delete on public.leads to authenticated;
grant insert (
  client_name, email, phone, property_id, assigned_agent_id, status, message
) on public.leads to authenticated;
grant update (
  client_name, email, phone, property_id, assigned_agent_id, status, message
) on public.leads to authenticated;
grant select on public.activity_logs to authenticated;

grant all on public.profiles, public.properties, public.leads, public.activity_logs
  to service_role;
grant usage, select on all sequences in schema public to service_role;
