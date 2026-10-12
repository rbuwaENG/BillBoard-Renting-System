create extension if not exists postgis;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  phone text,
  photo_url text,
  role text not null default 'renter' check (role in ('renter','rentor','admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table public.sizes (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  width numeric not null,
  height numeric not null
);

create table public.billboards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category_id uuid references public.categories(id),
  size_id uuid references public.sizes(id),
  lat double precision not null,
  lng double precision not null,
  geom geography(Point,4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  address text not null default '',
  city text not null default '',
  price_per_day numeric not null check (price_per_day >= 0),
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive','flagged')),
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billboards_geom_idx on public.billboards using gist (geom);
create index billboards_status_category_idx on public.billboards (status, category_id);
create index billboards_owner_idx on public.billboards (owner_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  billboard_id uuid not null references public.billboards(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  renter_id uuid not null references public.profiles(id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  creative_url text,
  price_quoted numeric not null check (price_quoted >= 0),
  status text not null default 'pending_owner_review' check (status in (
    'pending_owner_review','approved','rejected','payment_pending',
    'confirmed','active','completed','cancelled'
  )),
  payment_id uuid,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decision_at timestamptz
);
create index bookings_owner_status_idx on public.bookings (owner_id, status);
create index bookings_renter_status_idx on public.bookings (renter_id, status);
create index bookings_billboard_idx on public.bookings (billboard_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  renter_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.profiles(id),
  stripe_payment_intent_id text,
  amount numeric not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  created_at timestamptz not null default now()
);

alter table public.bookings
  add constraint bookings_payment_id_fkey foreign key (payment_id) references public.payments(id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  billboard_id uuid not null references public.billboards(id) on delete cascade,
  renter_id uuid not null references public.profiles(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  ref_id uuid,
  created_at timestamptz not null default now()
);

insert into public.categories (name) values
  ('Highway'), ('Digital'), ('Transit'), ('Rooftop'), ('Mall frontage');

insert into public.sizes (label, width, height) values
  ('6 x 10 ft', 6, 10),
  ('20 x 50 ft', 20, 50),
  ('LED 10 x 20 ft', 10, 20),
  ('30 x 40 ft', 30, 40);
