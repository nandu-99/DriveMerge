-- Migration: create connected_accounts table
-- Run this migration with your Supabase tools or push it with your deployment process

create table if not exists public.connected_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  used_space numeric default 0,
  total_space numeric default 15,
  provider text default 'mock',
  created_at timestamptz default now()
);
