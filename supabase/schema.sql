-- ============================================================
-- Marketplace Growth AI — Supabase (Postgres) sxemasi
-- ============================================================
-- Ishlatish: Supabase loyihangizda -> SQL Editor -> shu faylni
-- to'liq nusxalab -> Run tugmasini bosing.
-- ============================================================

-- 1. PROFILES — har bir auth.users yozuviga mos rol (admin/seller)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  email text,
  full_name text,
  store_name text,
  phone text,
  plan text default 'trial' check (plan in ('trial', 'starter', 'growth', 'agency')),
  created_at timestamptz not null default now()
);

-- Yangi auth user yaratilganda avtomatik profil qatori qo'shish
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (new.id, 'seller', coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. SKUS — sellerning mahsulotlari (CSV import orqali yoki keyinchalik API orqali to'ldiriladi)
create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  sku_code text not null,
  name text,
  price numeric,
  cost numeric,
  stock int,
  competitor_price numeric,
  unanswered_reviews int default 0,
  last_sale_at date,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, sku_code)
);

-- 3. IMPORTS — har bir CSV yuklash tarixi (audit trail)
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  filename text,
  row_count int default 0,
  source text default 'csv' check (source in ('csv', 'api')),
  created_at timestamptz not null default now()
);

-- 4. ACTIONS — "shu 5 ta narsani hoziroq qiling" ro'yxati
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  sku_id uuid references public.skus(id) on delete set null,
  type text not null,               -- masalan: 'low_margin', 'out_of_stock', 'price_gap', 'unanswered_review'
  title text not null,
  description text,
  impact int not null default 3 check (impact between 1 and 5),
  confidence int not null default 3 check (confidence between 1 and 5),
  effort int not null default 3 check (effort between 1 and 5),
  score numeric generated always as (round((impact * confidence)::numeric / greatest(effort, 1), 2)) stored,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- 5. REPORTS — haftalik/oylik hisobot snapshotlari (Telegram/PDF uchun ham manba bo'ladi)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — seller faqat o'zinikini ko'radi, admin hammasini
-- ============================================================

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

alter table public.profiles enable row level security;
alter table public.skus enable row level security;
alter table public.imports enable row level security;
alter table public.actions enable row level security;
alter table public.reports enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- skus
drop policy if exists "skus_all" on public.skus;
create policy "skus_all" on public.skus
  for all using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

-- imports
drop policy if exists "imports_all" on public.imports;
create policy "imports_all" on public.imports
  for all using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

-- actions
drop policy if exists "actions_all" on public.actions;
create policy "actions_all" on public.actions
  for all using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

-- reports
drop policy if exists "reports_all" on public.reports;
create policy "reports_all" on public.reports
  for all using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

-- ============================================================
-- Birinchi admin foydalanuvchini belgilash (SQL Editor'da qo'lda ishga tushiring)
-- ============================================================
-- update public.profiles set role = 'admin' where id = '<sizning auth.users.id>';
