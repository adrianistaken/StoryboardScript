-- Apply in the Supabase SQL editor before enabling the client environment variables.
create table public.storyboard_projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null,
  manifest jsonb not null,
  revision uuid not null,
  updated_at timestamptz not null default now(),
  constraint project_id_matches check (metadata->>'id' = id::text and manifest->'project'->>'id' = id::text),
  constraint manifest_size check (octet_length(manifest::text) <= 10485760)
);
create index storyboard_projects_owner_updated on public.storyboard_projects(owner_id, updated_at desc);
alter table public.storyboard_projects enable row level security;
revoke all on public.storyboard_projects from anon;
grant select, insert, update, delete on public.storyboard_projects to authenticated;
create policy "Read own scripts" on public.storyboard_projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Create own scripts" on public.storyboard_projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own scripts" on public.storyboard_projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete own scripts" on public.storyboard_projects for delete to authenticated using ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('storyboard-images', 'storyboard-images', false, 10485760, array['image/png','image/jpeg','image/webp']);
create policy "Read own references" on storage.objects for select to authenticated
using (bucket_id = 'storyboard-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own references" on storage.objects for insert to authenticated
with check (bucket_id = 'storyboard-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own references" on storage.objects for delete to authenticated
using (bucket_id = 'storyboard-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy: reference IDs point to immutable blobs, including across undo/redo.
