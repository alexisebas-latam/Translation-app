-- Add hourly/fixed pricing without changing existing projects.
alter table public.plazo_app_projects add column pricing_mode text not null default 'word' check(pricing_mode in ('word','hour','fixed')), add column hours numeric(10,2) not null default 0 check(hours between 0 and 1000000);
alter table public.plazo_app_projects add constraint consistent_quote check(pricing_mode='fixed' or quoted_minor=round(rate * (case pricing_mode when 'word' then words::numeric else hours end) * (case currency when 'CLP' then 1 else 100 end)));
create or replace function public.plazo_import_backup(payload jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
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
 insert into public.plazo_app_projects(id,owner_id,client_id,name,language,service,words,rate,pricing_mode,hours,quoted_minor,paid_minor,currency,status,due_at,paid_date,notes,legacy_id)
 values((row->>'id')::uuid,owner,(mapping->>(row->>'client_id'))::uuid,row->>'name',coalesce(row->>'language',''),coalesce(row->>'service','Traducción'),(row->>'words')::integer,(row->>'rate')::numeric,coalesce(row->>'pricing_mode','word'),coalesce((row->>'hours')::numeric,0),(row->>'quoted_minor')::bigint,(row->>'paid_minor')::bigint,row->>'currency',row->>'status',(row->>'due_at')::timestamptz,(row->>'paid_date')::date,coalesce(row->>'notes',''),row->>'legacy_id')
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
