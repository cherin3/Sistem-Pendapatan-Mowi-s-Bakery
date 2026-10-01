-- Mowi's Bakery: four-entity income schema for Supabase (PostgreSQL)
create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'Lainnya',
  price numeric(12, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  payment_method text not null default 'Tunai',
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored
);

create index if not exists sales_created_at_idx on public.sales(created_at desc);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

drop policy if exists "Public read customers" on public.customers;
create policy "Public read customers" on public.customers for select to anon using (true);
drop policy if exists "Public insert customers" on public.customers;
create policy "Public insert customers" on public.customers for insert to anon with check (true);

drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products for select to anon using (true);
drop policy if exists "Public insert products" on public.products;
create policy "Public insert products" on public.products for insert to anon with check (true);
drop policy if exists "Public update customers" on public.customers;
create policy "Public update customers" on public.customers for update to anon using (true) with check (true);
drop policy if exists "Public delete customers" on public.customers;
create policy "Public delete customers" on public.customers for delete to anon using (true);
drop policy if exists "Public update products" on public.products;
create policy "Public update products" on public.products for update to anon using (true) with check (true);
drop policy if exists "Public delete products" on public.products;
create policy "Public delete products" on public.products for delete to anon using (true);
drop policy if exists "Public read sales" on public.sales;
create policy "Public read sales" on public.sales for select to anon using (true);
drop policy if exists "Public read sale items" on public.sale_items;
create policy "Public read sale items" on public.sale_items for select to anon using (true);

grant usage on schema public to anon;
grant select, insert, update, delete on public.customers, public.products to anon;
grant select on public.sales, public.sale_items to anon;

-- Records each sale and decrements inventory atomically. Call via Supabase RPC.
create or replace function public.create_sale(sale_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_sale_id uuid;
  item jsonb;
  selected_product public.products%rowtype;
  requested_quantity integer;
  calculated_total numeric(12, 2) := 0;
begin
  if sale_payload is null or jsonb_typeof(sale_payload->'items') <> 'array'
     or jsonb_array_length(sale_payload->'items') = 0 then
    raise exception 'Pesanan harus memiliki setidaknya satu item.';
  end if;

  if nullif(sale_payload->>'customer_id', '') is not null
     and not exists (select 1 from public.customers where id = (sale_payload->>'customer_id')::uuid) then
    raise exception 'Pelanggan tidak ditemukan.';
  end if;

  insert into public.sales (customer_id, payment_method)
  values (
    nullif(sale_payload->>'customer_id', '')::uuid,
    coalesce(nullif(sale_payload->>'payment_method', ''), 'Tunai')
  )
  returning id into new_sale_id;

  for item in select value from jsonb_array_elements(sale_payload->'items') loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity < 1 then
      raise exception 'Jumlah item harus lebih dari nol.';
    end if;

    select * into selected_product
    from public.products
    where id = (item->>'product_id')::uuid and is_active = true
    for update;

    if not found then
      raise exception 'Produk tidak ditemukan atau tidak aktif.';
    end if;
    if selected_product.stock < requested_quantity then
      raise exception 'Stok % tidak mencukupi.', selected_product.name;
    end if;

    update public.products
    set stock = stock - requested_quantity
    where id = selected_product.id;

    insert into public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    values (new_sale_id, selected_product.id, selected_product.name, requested_quantity, selected_product.price);

    calculated_total := calculated_total + (selected_product.price * requested_quantity);
  end loop;

  update public.sales set total_amount = calculated_total where id = new_sale_id;
  return new_sale_id;
end;
$$;

revoke all on function public.create_sale(jsonb) from public;
grant execute on function public.create_sale(jsonb) to anon;

create or replace function public.update_sale(sale_id uuid, sale_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  selected_product public.products%rowtype;
  requested_quantity integer;
  calculated_total numeric(12, 2) := 0;
begin
  perform 1 from public.sales where id = sale_id for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan.';
  end if;
  if sale_payload is null or jsonb_typeof(sale_payload->'items') <> 'array'
     or jsonb_array_length(sale_payload->'items') = 0 then
    raise exception 'Pesanan harus memiliki setidaknya satu item.';
  end if;
  if nullif(sale_payload->>'customer_id', '') is not null
     and not exists (select 1 from public.customers where id = (sale_payload->>'customer_id')::uuid) then
    raise exception 'Pelanggan tidak ditemukan.';
  end if;

  update public.products as product
  set stock = product.stock + prior.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.sale_items
    where sale_items.sale_id = update_sale.sale_id and product_id is not null
    group by product_id
  ) as prior
  where product.id = prior.product_id;

  delete from public.sale_items where sale_items.sale_id = update_sale.sale_id;
  update public.sales
  set customer_id = nullif(sale_payload->>'customer_id', '')::uuid,
      payment_method = coalesce(nullif(sale_payload->>'payment_method', ''), 'Tunai'),
      total_amount = 0
  where id = update_sale.sale_id;

  for item in select value from jsonb_array_elements(sale_payload->'items') loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity < 1 then
      raise exception 'Jumlah item harus lebih dari nol.';
    end if;
    select * into selected_product
    from public.products
    where id = (item->>'product_id')::uuid and is_active = true
    for update;
    if not found then
      raise exception 'Produk tidak ditemukan atau tidak aktif.';
    end if;
    if selected_product.stock < requested_quantity then
      raise exception 'Stok % tidak mencukupi.', selected_product.name;
    end if;
    update public.products set stock = stock - requested_quantity where id = selected_product.id;
    insert into public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    values (update_sale.sale_id, selected_product.id, selected_product.name, requested_quantity, selected_product.price);
    calculated_total := calculated_total + (selected_product.price * requested_quantity);
  end loop;
  update public.sales set total_amount = calculated_total where id = update_sale.sale_id;
end;
$$;

create or replace function public.delete_sale(sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.sales where id = sale_id for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan.';
  end if;
  update public.products as product
  set stock = product.stock + prior.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.sale_items
    where sale_items.sale_id = delete_sale.sale_id and product_id is not null
    group by product_id
  ) as prior
  where product.id = prior.product_id;
  delete from public.sales where id = delete_sale.sale_id;
end;
$$;

revoke all on function public.update_sale(uuid, jsonb) from public;
revoke all on function public.delete_sale(uuid) from public;
grant execute on function public.update_sale(uuid, jsonb) to anon;
grant execute on function public.delete_sale(uuid) to anon;
