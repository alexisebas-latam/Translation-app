-- Plazo 2.0: minimal single-owner encrypted vault schema.
-- NO business plaintext stored on the server. Sensitive labels, rates, project content
-- and financial details must be encrypted in the browser before uploading.
-- Auth is provided by auth.users; payment / subscription tables are NOT part of this migration.
-- Initial model: one workspace per authenticated user. Team support requires new threat model.

create table public.plazo_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint plazo_workspaces_one_per_user unique (owner_id),
  constraint plazo_workspaces_id_owner_unique unique (id, owner_id)
);

create table public.plazo_vaults (
  workspace_id uuid primary key,
  owner_id uuid not null default auth.uid(),
  format_version smallint not null default 1 check (format_version = 1),
  cipher text not null default 'AES-256-GCM' check (cipher = 'AES-256-GCM'),
  nonce text not null check (length(nonce) = 16 and nonce ~ '^[A-Za-z0-9_-]+$'),
  wrapped_key text not null check (length(wrapped_key) = 64 and wrapped_key ~ '^[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now(),
  constraint plazo_vaults_workspace_owner_fkey
    foreign key (workspace_id, owner_id)
    references public.plazo_workspaces(id, owner_id) on delete cascade
);

create table public.plazo_encrypted_records (
  workspace_id uuid not null,
  owner_id uuid not null default auth.uid(),
  record_id text not null check (length(record_id) between 1 and 100 and record_id ~ '^[A-Za-z0-9_-]+$'),
  format_version smallint not null default 1 check (format_version = 1),
  record_version integer not null default 1 check (record_version >= 1),
  nonce text not null check (length(nonce) = 16 and nonce ~ '^[A-Za-z0-9_-]+$'),
  ciphertext text not null check (length(ciphertext) between 24 and 7000000 and ciphertext ~ '^[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plazo_encrypted_records_pkey primary key (workspace_id, record_id),
  constraint plazo_encrypted_records_workspace_owner_fkey
    foreign key (workspace_id, owner_id)
    references public.plazo_workspaces(id, owner_id) on delete cascade
);

create index plazo_encrypted_records_owner_idx
  on public.plazo_encrypted_records(owner_id, updated_at desc);

alter table public.plazo_workspaces enable row level security;
alter table public.plazo_vaults enable row level security;
alter table public.plazo_encrypted_records enable row level security;

-- Supabase projects can have broad default grants in public. Remove them first.
revoke all on public.plazo_workspaces from public, anon, authenticated;
revoke all on public.plazo_vaults from public, anon, authenticated;
revoke all on public.plazo_encrypted_records from public, anon, authenticated;

-- The client may create and read its own workspace and vault, not replace vault keys.
grant select, insert on public.plazo_workspaces to authenticated;
grant select, insert on public.plazo_vaults to authenticated;
grant select, insert, delete on public.plazo_encrypted_records to authenticated;
grant update (nonce, ciphertext, record_version, updated_at)
  on public.plazo_encrypted_records to authenticated;

create policy "plazo_workspaces_select_own"
  on public.plazo_workspaces for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "plazo_workspaces_insert_own"
  on public.plazo_workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "plazo_vaults_select_own"
  on public.plazo_vaults for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "plazo_vaults_insert_own"
  on public.plazo_vaults for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "plazo_records_select_own"
  on public.plazo_encrypted_records for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "plazo_records_insert_own"
  on public.plazo_encrypted_records for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "plazo_records_update_own"
  on public.plazo_encrypted_records for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "plazo_records_delete_own"
  on public.plazo_encrypted_records for delete to authenticated
  using (owner_id = (select auth.uid()));

comment on table public.plazo_workspaces is 'Plazo account workspace. One per authenticated owner; no business plaintext.';
comment on table public.plazo_vaults is 'Wrapped client-only vault key. Recovery secret and raw encryption key are never stored here.';
comment on table public.plazo_encrypted_records is 'Opaque, client-encrypted content. Record metadata still reveals traffic and counts.';
