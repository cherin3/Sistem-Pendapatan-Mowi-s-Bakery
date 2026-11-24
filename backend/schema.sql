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
drop policy if exists "Public insert customers" on public.customers;
drop policy if exists "Public update customers" on public.customers;
drop policy if exists "Public delete customers" on public.customers;
drop policy if exists "Public read products" on public.products;
drop policy if exists "Public insert products" on public.products;
drop policy if exists "Public update products" on public.products;
drop policy if exists "Public delete products" on public.products;
drop policy if exists "Public read sales" on public.sales;
drop policy if exists "Public read sale items" on public.sale_items;
drop policy if exists "Authenticated read customers" on public.customers;
drop policy if exists "Authenticated insert customers" on public.customers;
drop policy if exists "Authenticated update customers" on public.customers;
drop policy if exists "Authenticated delete customers" on public.customers;
drop policy if exists "Authenticated read products" on public.products;
drop policy if exists "Authenticated insert products" on public.products;
drop policy if exists "Authenticated update products" on public.products;
drop policy if exists "Authenticated delete products" on public.products;
drop policy if exists "Authenticated read sales" on public.sales;
drop policy if exists "Authenticated read sale items" on public.sale_items;

create policy "Authenticated read customers" on public.customers for select to authenticated using (true);
create policy "Authenticated insert customers" on public.customers for insert to authenticated with check (true);
create policy "Authenticated update customers" on public.customers for update to authenticated using (true) with check (true);
create policy "Authenticated delete customers" on public.customers for delete to authenticated using (true);
create policy "Authenticated read products" on public.products for select to authenticated using (true);
create policy "Authenticated insert products" on public.products for insert to authenticated with check (true);
create policy "Authenticated update products" on public.products for update to authenticated using (true) with check (true);
create policy "Authenticated delete products" on public.products for delete to authenticated using (true);
create policy "Authenticated read sales" on public.sales for select to authenticated using (true);
create policy "Authenticated read sale items" on public.sale_items for select to authenticated using (true);

grant usage on schema public to authenticated;
revoke all on public.customers, public.products, public.sales, public.sale_items from anon;
grant select, insert, update, delete on public.customers, public.products to authenticated;
grant select on public.sales, public.sale_items to authenticated;

-- Records each sale and decrements inventory atomically. Call via Supabase RPC.
CREATE OR REPLACE FUNCTION public.create_sale(sale_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_sale_id uuid;
  item jsonb;
  selected_product public.products%rowtype;
  requested_quantity integer;
  calculated_subtotal numeric(12,2) := 0;
  calculated_pb1 numeric(12,2);
  calculated_total numeric(12,2);
BEGIN
  IF sale_payload IS NULL
     OR jsonb_typeof(sale_payload->'items') <> 'array'
     OR jsonb_array_length(sale_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Pesanan harus memiliki setidaknya satu item.';
  END IF;

  IF nullif(sale_payload->>'customer_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.customers
       WHERE id = (sale_payload->>'customer_id')::uuid
     ) THEN
    RAISE EXCEPTION 'Pelanggan tidak ditemukan.';
  END IF;

  INSERT INTO public.sales (customer_id, payment_method)
  VALUES (
    nullif(sale_payload->>'customer_id', '')::uuid,
    coalesce(nullif(sale_payload->>'payment_method', ''), 'Tunai')
  )
  RETURNING id INTO new_sale_id;

  FOR item IN SELECT value FROM jsonb_array_elements(sale_payload->'items')
  LOOP
    requested_quantity := (item->>'quantity')::integer;

    IF requested_quantity < 1 THEN
      RAISE EXCEPTION 'Jumlah item harus lebih dari nol.';
    END IF;

    SELECT * INTO selected_product
    FROM public.products
    WHERE id = (item->>'product_id')::uuid
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk tidak ditemukan atau tidak aktif.';
    END IF;

    IF selected_product.stock < requested_quantity THEN
      RAISE EXCEPTION 'Stok % tidak mencukupi.', selected_product.name;
    END IF;

    UPDATE public.products
    SET stock = stock - requested_quantity
    WHERE id = selected_product.id;

    INSERT INTO public.sale_items
      (sale_id, product_id, product_name, quantity, unit_price)
    VALUES
      (new_sale_id, selected_product.id, selected_product.name,
       requested_quantity, selected_product.price);

    calculated_subtotal := calculated_subtotal
      + (selected_product.price * requested_quantity);
  END LOOP;

  calculated_pb1 := ROUND(calculated_subtotal * 0.10, 2);
  calculated_total := calculated_subtotal + calculated_pb1;

  UPDATE public.sales
  SET subtotal_amount = calculated_subtotal,
      pb1_amount = calculated_pb1,
      total_amount = calculated_total
  WHERE id = new_sale_id;

  RETURN new_sale_id;
END;
$$;

revoke all on function public.create_sale(jsonb) from public;
revoke all on function public.create_sale(jsonb) from anon;
grant execute on function public.create_sale(jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.update_sale(sale_id uuid, sale_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  selected_product public.products%rowtype;
  requested_quantity integer;
  calculated_subtotal numeric(12,2) := 0;
  calculated_pb1 numeric(12,2);
  calculated_total numeric(12,2);
BEGIN
  PERFORM 1 FROM public.sales
  WHERE id = sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan.';
  END IF;

  IF sale_payload IS NULL
     OR jsonb_typeof(sale_payload->'items') <> 'array'
     OR jsonb_array_length(sale_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Pesanan harus memiliki setidaknya satu item.';
  END IF;

  IF nullif(sale_payload->>'customer_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.customers
       WHERE id = (sale_payload->>'customer_id')::uuid
     ) THEN
    RAISE EXCEPTION 'Pelanggan tidak ditemukan.';
  END IF;

  UPDATE public.products AS product
  SET stock = product.stock + prior.quantity
  FROM (
    SELECT product_id, SUM(quantity)::integer AS quantity
    FROM public.sale_items
    WHERE sale_items.sale_id = update_sale.sale_id
      AND product_id IS NOT NULL
    GROUP BY product_id
  ) AS prior
  WHERE product.id = prior.product_id;

  DELETE FROM public.sale_items
  WHERE sale_items.sale_id = update_sale.sale_id;

  UPDATE public.sales
  SET customer_id = nullif(sale_payload->>'customer_id', '')::uuid,
      payment_method = coalesce(
        nullif(sale_payload->>'payment_method', ''), 'Tunai'
      ),
      subtotal_amount = 0,
      pb1_amount = 0,
      total_amount = 0
  WHERE id = update_sale.sale_id;

  FOR item IN SELECT value FROM jsonb_array_elements(sale_payload->'items')
  LOOP
    requested_quantity := (item->>'quantity')::integer;

    IF requested_quantity < 1 THEN
      RAISE EXCEPTION 'Jumlah item harus lebih dari nol.';
    END IF;

    SELECT * INTO selected_product
    FROM public.products
    WHERE id = (item->>'product_id')::uuid
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk tidak ditemukan atau tidak aktif.';
    END IF;

    IF selected_product.stock < requested_quantity THEN
      RAISE EXCEPTION 'Stok % tidak mencukupi.', selected_product.name;
    END IF;

    UPDATE public.products
    SET stock = stock - requested_quantity
    WHERE id = selected_product.id;

    INSERT INTO public.sale_items
      (sale_id, product_id, product_name, quantity, unit_price)
    VALUES
      (update_sale.sale_id, selected_product.id,
       selected_product.name, requested_quantity, selected_product.price);

    calculated_subtotal := calculated_subtotal
      + (selected_product.price * requested_quantity);
  END LOOP;

  calculated_pb1 := ROUND(calculated_subtotal * 0.10, 2);
  calculated_total := calculated_subtotal + calculated_pb1;

  UPDATE public.sales
  SET subtotal_amount = calculated_subtotal,
      pb1_amount = calculated_pb1,
      total_amount = calculated_total
  WHERE id = update_sale.sale_id;
END;
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
revoke all on function public.update_sale(uuid, jsonb) from anon;
revoke all on function public.delete_sale(uuid) from anon;
grant execute on function public.update_sale(uuid, jsonb) to authenticated;
grant execute on function public.delete_sale(uuid) to authenticated;
