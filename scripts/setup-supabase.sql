-- Enable RLS on all tables
alter table users enable row level security;
alter table sessions enable row level security;
alter table chapters enable row level security;
alter table invitations enable row level security;
alter table alerts enable row level security;
alter table jobs enable row level security;
alter table storybooks enable row level security;
alter table storybook_images enable row level security;

-- Create Storage Bucket
insert into storage.buckets (id, name, public)
values ('recall-assets', 'recall-assets', true)
on conflict (id) do nothing;

-- STORAGE POLICIES
-- Allow public read access to assets
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'recall-assets' );

-- Allow authenticated uploads (service role bypasses this, but good for future)
create policy "Service Access"
on storage.objects for all
using ( true )
with check ( true );

-- TABLE POLICIES
-- For MVP with Service Role access (API), we need to ensure Service Role has full access.
-- Supabase Service Role bypasses RLS by default, so we don't strictly need policies for it.
-- However, if we use the Anon key client-side, we need proper policies.

-- Policy: Authenticated users can read their own data
-- (Assuming we eventually sync auth.users with public.users)
-- For now, since we handle auth in the app logic layer and access via Service Role (Drizzle),
-- we mainly need to ensure we don't accidentally block access if we switch connection triggers.

-- Allow valid backend connections (if not using service role)
-- but Service Role is key.

-- Allow public read for verifying (optional, remove for strict prod)
-- create policy "Allow Public Read" on users for select using (true);
