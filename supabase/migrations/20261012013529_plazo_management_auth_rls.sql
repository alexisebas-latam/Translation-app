-- Additive product schema. Encrypted beta tables remain intact.
create table public.plazo_app_clients (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120), type text not null default 'Cliente' check(length(type)<=80),
 email text not null default '' check(length(email)<=254), notes text not null default '' check(length(notes)<=4000),
 legacy_id text, revision integer not null default 1, created_at timestamptz not null default now(),
 unique(id,owner_id), unique(owner_id,legacy_id)
);
create table public.plazo_app_projects (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid, name text not null check(length(trim(name)) between 1 and 180),
 language text not null default '' check(length(language)<=100), service text not null default 'Traducción' check(length(service)<=80),
 words integer not null default 0 check(words between 0 and 100000000), rate numeric(16,6) not null default 0 check(rate>=0),
 quoted_minor bigint not null default 0 check(quoted_minor between 0 and 9007199254740991),
 paid_minor bigint not null default 0 check(paid_minor between 0 and quoted_minor),
 currency text not null default 'USD' check(currency in ('USD','EUR','CLP')),
 status text not null default 'pending' check(status in ('pending','active','delivered','cancelled')),
 due_at timestamptz, paid_date date, notes text not null default '' check(length(notes)<=4000),
 legacy_id text, revision integer not null default 1, created_at timestamptz not null default now(),
 check((paid_minor=0 and paid_date is null) or (paid_minor>0 and paid_date is not null)),
 foreign key(client_id,owner_id) references public.plazo_app_clients(id,owner_id), unique(owner_id,legacy_id)
);
create table public.plazo_app_entries (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid, concept text not null check(length(trim(concept)) between 1 and 180),
 type text not null check(type in ('income','expense')), amount_minor bigint not null check(amount_minor between 1 and 9007199254740991),
 currency text not null default 'USD' check(currency in ('USD','EUR','CLP')), date date not null,
 notes text not null default '' check(length(notes)<=4000), legacy_id text, revision integer not null default 1,
 created_at timestamptz not null default now(), foreign key(client_id,owner_id) references public.plazo_app_clients(id,owner_id), unique(owner_id,legacy_id)
);
create table public.plazo_app_settings (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80), currency text not null default 'USD' check(currency in ('USD','EUR','CLP')),
 goal_minor bigint not null default 0 check(goal_minor between 0 and 9007199254740991)
);
create index plazo_app_projects_owner_due on public.plazo_app_projects(owner_id,due_at);
create index plazo_app_projects_owner_client on public.plazo_app_projects(owner_id,client_id);
create index plazo_app_entries_owner_date on public.plazo_app_entries(owner_id,date);
create index plazo_app_entries_owner_client on public.plazo_app_entries(owner_id,client_id);
do $$ declare tab text; begin
 foreach tab in array array['plazo_app_clients','plazo_app_projects','plazo_app_entries','plazo_app_settings'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from anon, authenticated',tab);
 execute format('grant select, insert, update, delete on public.%I to authenticated',tab);
 execute format('create policy owner_access on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',tab);
 end loop;
end $$;
-- Atomic, additive import. Same backup IDs are skipped; existing rows are never overwritten.
-- SECURITY INVOKER retains all RLS and composite ownership constraints.
create function public.plazo_import_backup(payload jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare row jsonb; added_c integer:=0; added_p integer:=0; added_e integer:=0; n integer; actual uuid; mapping jsonb:='{}'; owner uuid:=auth.uid();
begin
 if owner is null then raise exception 'Authentication required'; end if;
 if payload->>'app' is distinct from 'Plazo' or payload->>'version' is distinct from '3' then raise exception 'Unsupported backup'; end if;
 if jsonb_typeof(payload->'clients') is distinct from 'array' or jsonb_typeof(payload->'projects') is distinct from 'array' or jsonb_typeof(payload->'entries') is distinct from 'array' then raise exception 'Invalid collections'; end if;
 if jsonb_array_length(payload->'clients')>5000 or jsonb_array_length(payload->'projects')>5000 or jsonb_array_length(payload->'entries')>5000 then raise exception 'Backup too large'; end if;
 for row in select value from jsonb_array_elements(payload->'clients') loop
 insert into public.plazo_app_clients(id,owner_id,name,type,email,notes,legacy_id)
 values((row->>'id')::uuid,owner,row->>'name',coalesce(row->>'type','Cliente'),coalesce(row->>'email',''),coalesce(row->>'notes',''),row->>'legacy_id')
 on conflict do nothing; get diagnostics n=row_count; added_c:=added_c+n;
 select id into actual from public.plazo_app_clients where owner_id=owner and (id=(row->>'id')::uuid or legacy_id=row->>'legacy_id') order by (id=(row->>'id')::uuid) desc limit 1;
 if actual is null then raise exception 'Client could not be imported'; end if;
 mapping:=mapping || jsonb_build_object(row->>'id',actual::text);
 end loop;
 for row in select value from jsonb_array_elements(payload->'projects') loop
 if row->>'client_id' is not null and mapping->>(row->>'client_id') is null then raise exception 'Missing client'; end if;
 insert into public.plazo_app_projects(id,owner_id,client_id,name,language,service,words,rate,quoted_minor,paid_minor,currency,status,due_at,paid_date,notes,legacy_id)
 values((row->>'id')::uuid,owner,(mapping->>(row->>'client_id'))::uuid,row->>'name',coalesce(row->>'language',''),coalesce(row->>'service','Traducción'),(row->>'words')::integer,(row->>'rate')::numeric,(row->>'quoted_minor')::bigint,(row->>'paid_minor')::bigint,row->>'currency',row->>'status',(row->>'due_at')::timestamptz,(row->>'paid_date')::date,coalesce(row->>'notes',''),row->>'legacy_id')
 on conflict do nothing; get diagnostics n=row_count; added_p:=added_p+n;
 end loop;
 for row in select value from jsonb_array_elements(payload->'entries') loop
 if row->>'client_id' is not null and mapping->>(row->>'client_id') is null then raise exception 'Missing client'; end if;
 insert into public.plazo_app_entries(id,owner_id,client_id,concept,type,amount_minor,currency,date,notes,legacy_id)
 values((row->>'id')::uuid,owner,(mapping->>(row->>'client_id'))::uuid,row->>'concept',row->>'type',(row->>'amount_minor')::bigint,row->>'currency',(row->>'date')::date,coalesce(row->>'notes',''),row->>'legacy_id')
 on conflict do nothing; get diagnostics n=row_count; added_e:=added_e+n;
 end loop;
 return jsonb_build_object('clients',added_c,'projects',added_p,'entries',added_e);
end $$;
revoke all on function public.plazo_import_backup(jsonb) from public,anon;
grant execute on function public.plazo_import_backup(jsonb) to authenticated;
