-- Jalankan seluruh file ini di Supabase SQL Editor sebelum memulai aplikasi.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null default '',
  email text not null default '',
  nomor_hp text not null default '',
  alamat text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  nama_produk text not null,
  deskripsi text not null default '',
  harga integer not null check (harga >= 0),
  gambar text not null default '',
  kategori text not null default 'Bouquet',
  rating numeric(2, 1) not null default 5.0 check (rating >= 0 and rating <= 5),
  stok integer not null default 0 check (stok >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.cart (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  ukuran text not null check (ukuran in ('Small', 'Medium', 'Large')),
  warna text not null,
  jumlah integer not null check (jumlah > 0),
  pesan_ucapan text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, product_id, ukuran, warna)
);

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nomor_pesanan text not null unique,
  nama_penerima text not null,
  nomor_hp text not null,
  alamat text not null,
  total_harga integer not null check (total_harga >= 0),
  metode_pembayaran text not null,
  status text not null default 'Menunggu Pembayaran'
    check (status in ('Menunggu Pembayaran', 'Diproses', 'Dikirim', 'Selesai')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  nama_produk text not null,
  ukuran text not null,
  warna text not null,
  jumlah integer not null check (jumlah > 0),
  harga integer not null check (harga >= 0),
  pesan_ucapan text not null default ''
);

create index if not exists cart_user_id_idx on public.cart(user_id);
create index if not exists wishlist_user_id_idx on public.wishlist(user_id);
create index if not exists orders_user_id_created_at_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

create or replace function public.create_flovely_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nama, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nama', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set nama = excluded.nama, email = excluded.email;
  return new;
end;
$$;

drop trigger if exists create_flovely_profile_after_signup on auth.users;
create trigger create_flovely_profile_after_signup
after insert or update of email on auth.users
for each row execute function public.create_flovely_profile();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.cart enable row level security;
alter table public.wishlist enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products" on public.products
  for select to anon, authenticated using (true);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage own cart" on public.cart;
create policy "Users manage own cart" on public.cart
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own wishlist" on public.wishlist;
create policy "Users manage own wishlist" on public.wishlist
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users read own order items" on public.order_items;
create policy "Users read own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = (select auth.uid())
    )
  );

-- Harga Medium = 1.25x dan Large = 1.5x harga dasar, dibulatkan ke Rp1.000.
create or replace function public.create_flovely_order(
  p_nama_penerima text,
  p_nomor_hp text,
  p_alamat text,
  p_pesan_tambahan text,
  p_metode_pembayaran text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_total integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if nullif(trim(p_nama_penerima), '') is null
    or nullif(trim(p_nomor_hp), '') is null
    or nullif(trim(p_alamat), '') is null
    or p_metode_pembayaran not in ('Transfer Bank', 'COD', 'QRIS') then
    raise exception 'INVALID_ORDER';
  end if;

  if not exists (select 1 from public.cart where user_id = v_user_id) then
    raise exception 'EMPTY_CART';
  end if;
  if exists (
    select 1 from public.cart c
    join public.products p on p.id = c.product_id
    where c.user_id = v_user_id and p.stok < c.jumlah
  ) then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  select sum(
    c.jumlah * case c.ukuran
      when 'Medium' then round(p.harga * 1.25 / 1000) * 1000
      when 'Large' then round(p.harga * 1.5 / 1000) * 1000
      else p.harga
    end
  )::integer into v_total
  from public.cart c
  join public.products p on p.id = c.product_id
  where c.user_id = v_user_id;

  insert into public.orders (
    user_id, nomor_pesanan, nama_penerima, nomor_hp, alamat,
    total_harga, metode_pembayaran, status
  ) values (
    v_user_id,
    'FLV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    trim(p_nama_penerima), trim(p_nomor_hp), trim(p_alamat),
    v_total, p_metode_pembayaran, 'Menunggu Pembayaran'
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, nama_produk, ukuran, warna, jumlah, harga, pesan_ucapan
  )
  select
    v_order_id, p.id, p.nama_produk, c.ukuran, c.warna, c.jumlah,
    case c.ukuran
      when 'Medium' then round(p.harga * 1.25 / 1000) * 1000
      when 'Large' then round(p.harga * 1.5 / 1000) * 1000
      else p.harga
    end::integer,
    concat_ws(E'\n', nullif(c.pesan_ucapan, ''), nullif(trim(p_pesan_tambahan), ''))
  from public.cart c
  join public.products p on p.id = c.product_id
  where c.user_id = v_user_id;

  update public.products p
  set stok = p.stok - cart_totals.jumlah
  from (
    select product_id, sum(jumlah)::integer as jumlah
    from public.cart
    where user_id = v_user_id
    group by product_id
  ) as cart_totals
  where p.id = cart_totals.product_id;

  delete from public.cart where user_id = v_user_id;
  return v_order_id;
end;
$$;

revoke all on function public.create_flovely_order(text, text, text, text, text) from public, anon;
grant execute on function public.create_flovely_order(text, text, text, text, text) to authenticated;

-- Data contoh. Gambar menggunakan foto bouquet dari Unsplash.
insert into public.products (nama_produk, deskripsi, harga, gambar, kategori, rating, stok)
select seed.nama_produk, seed.deskripsi, seed.harga, seed.gambar, 'Bouquet', seed.rating, seed.stok
from (values
  ('Blue Serenity', 'Rangkaian bunga biru lembut yang menenangkan, cocok untuk momen istimewa.', 275000, 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=900&q=85', 4.9, 12),
  ('Pure White', 'Bouquet serba putih yang anggun dan penuh makna tulus.', 250000, 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=900&q=85', 4.8, 8),
  ('Pink Delight', 'Perpaduan warna pink manis untuk menyampaikan rasa sayang.', 285000, 'https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=900&q=85', 5.0, 15),
  ('Red Passion', 'Mawar merah pilihan untuk ungkapan cinta yang berkesan.', 320000, 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=900&q=85', 4.9, 10),
  ('Sweet Lavender', 'Nuansa lavender lembut untuk hadiah penuh perhatian.', 265000, 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85', 4.7, 7),
  ('Baby Blue', 'Bunga bernuansa biru muda yang segar dan playful.', 240000, 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=85', 4.8, 9)
) as seed(nama_produk, deskripsi, harga, gambar, rating, stok)
where not exists (
  select 1 from public.products existing where existing.nama_produk = seed.nama_produk
);
