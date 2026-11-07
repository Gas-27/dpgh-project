-- Enable RLS on api_users table if not already enabled
alter table public.api_users enable row level security;

-- Policy to allow users to insert their own API user record
create policy "Users can insert own api_user" 
  on public.api_users 
  for insert 
  with check (identity_id = auth.uid());

-- Policy to allow users to view their own API user record
create policy "Users can view own api_user"
  on public.api_users
  for select
  using (identity_id = auth.uid());

-- Policy to allow users to update their own API user record
create policy "Users can update own api_user"
  on public.api_users
  for update
  using (identity_id = auth.uid());

-- Policy to allow admins to manage all api_users
create policy "Admins can manage all api_users"
  on public.api_users
  for all
  using (public.has_role(auth.uid(), 'admin'));
