create table private.public_enquiry_requests (
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  request_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ip_hash, request_id)
);

alter table private.public_enquiry_requests enable row level security;
revoke all on private.public_enquiry_requests
  from public, anon, authenticated, service_role;

drop function public.create_public_enquiry(text, text, text, uuid, text);

create function public.create_public_enquiry(
  p_request_id uuid,
  p_ip_hash text,
  p_payload_hash text,
  p_client_name text,
  p_email text,
  p_phone text,
  p_property_id uuid,
  p_message text
)
returns table (
  lead_id uuid,
  duplicate boolean,
  rate_limited boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.public_enquiry_requests%rowtype;
  v_lead_id uuid;
begin
  if p_request_id is null
    or p_ip_hash is null
    or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_payload_hash is null
    or p_payload_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid enquiry request'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_ip_hash || p_request_id::text, 0)
  );

  delete from private.public_enquiry_requests as old_request
  where old_request.created_at < now() - interval '24 hours';

  select request.*
  into v_existing
  from private.public_enquiry_requests as request
  where request.ip_hash = p_ip_hash
    and request.request_id = p_request_id;

  if found then
    if v_existing.payload_hash <> p_payload_hash then
      raise exception 'Idempotency key was already used for a different enquiry'
        using errcode = '22000';
    end if;

    return query select v_existing.lead_id, true, false;
    return;
  end if;

  if char_length(trim(coalesce(p_client_name, ''))) not between 1 and 120
    or char_length(trim(coalesce(p_email, ''))) not between 3 and 254
    or char_length(trim(coalesce(p_phone, ''))) <> 14
    or trim(coalesce(p_phone, '')) !~ '^\+234[789][0-9]{9}$'
    or char_length(trim(coalesce(p_message, ''))) not between 1 and 3000
  then
    raise exception 'Invalid enquiry details'
      using errcode = '22023';
  end if;

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

  if not private.consume_public_enquiry_quota(p_ip_hash) then
    return query select null::uuid, false, true;
    return;
  end if;

  insert into public.leads (
    client_name,
    email,
    phone,
    property_id,
    status,
    message
  )
  values (
    trim(p_client_name),
    lower(trim(p_email)),
    trim(p_phone),
    p_property_id,
    'New'::public.lead_status,
    trim(p_message)
  )
  returning id into v_lead_id;

  insert into private.public_enquiry_requests (
    ip_hash,
    request_id,
    payload_hash,
    lead_id
  )
  values (p_ip_hash, p_request_id, p_payload_hash, v_lead_id);

  return query select v_lead_id, false, false;
end;
$$;

revoke all on function public.create_public_enquiry(uuid, text, text, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_public_enquiry(uuid, text, text, text, text, text, uuid, text)
  to service_role;
