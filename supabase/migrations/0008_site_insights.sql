alter table public.billboards
  add column district text,
  add column traffic_level text check (traffic_level in ('light','moderate','heavy'));

create table public.district_profiles (
  district text primary key,
  province text not null,
  area_km2 numeric not null,
  population integer not null,
  population_density numeric generated always as (population / area_km2) stored
);

alter table public.district_profiles enable row level security;
create policy district_profiles_select_public on public.district_profiles
  for select using (true);

insert into public.district_profiles (district, province, area_km2, population) values
  ('Ampara', 'Eastern', 4415, 649402),
  ('Anuradhapura', 'North Central', 7179, 860575),
  ('Badulla', 'Uva', 2861, 815405),
  ('Batticaloa', 'Eastern', 2854, 526567),
  ('Colombo', 'Western', 699, 2324349),
  ('Galle', 'Southern', 1652, 1063334),
  ('Gampaha', 'Western', 1387, 2304833),
  ('Hambantota', 'Southern', 2609, 599903),
  ('Jaffna', 'Northern', 1025, 583882),
  ('Kalutara', 'Western', 1598, 1221948),
  ('Kandy', 'Central', 1940, 1375382),
  ('Kegalle', 'Sabaragamuwa', 1693, 840648),
  ('Kilinochchi', 'Northern', 1279, 113510),
  ('Kurunegala', 'North Western', 4816, 1618465),
  ('Mannar', 'Northern', 1996, 99570),
  ('Matale', 'Central', 1993, 484531),
  ('Matara', 'Southern', 1283, 814048),
  ('Monaragala', 'Uva', 5639, 451058),
  ('Mullaitivu', 'Northern', 2617, 92238),
  ('Nuwara Eliya', 'Central', 1741, 711644),
  ('Polonnaruwa', 'North Central', 3293, 406088),
  ('Puttalam', 'North Western', 3072, 762396),
  ('Ratnapura', 'Sabaragamuwa', 3275, 1088007),
  ('Trincomalee', 'Eastern', 2727, 379541),
  ('Vavuniya', 'Northern', 1967, 172115);
