-- WanSync / BabySync Supabase Schema & RLS (Step 2 & Step 3)
-- Supabase SQL Editor でそのまま実行できます。

-- 1. 家族グループテーブル
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_at timestamptz default now()
);

-- 2. 家族メンバー紐付けテーブル
create table if not exists public.family_members (
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member', -- 'admin' | 'member'
  display_name text,
  joined_at timestamptz default now(),
  primary key (family_id, user_id)
);

-- 3. Wasm (CRDT) 差分データ保存テーブル（Step 3 で使用）
create table if not exists public.crdt_updates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade not null,
  sender_id uuid references auth.users(id) not null,
  update_data text not null, -- Base64エンコードされたLoroのバイナリ差分
  created_at timestamptz default now()
);

-- RLS 有効化
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.crdt_updates enable row level security;

-- 自分の所属 family_id を返すヘルパー（RLS無限再帰を防止）
create or replace function public.get_my_family_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

-- families ポリシー
create policy "Members can view their families"
  on public.families for select
  using (id in (select public.get_my_family_ids()));

create policy "Authenticated users can create families"
  on public.families for insert
  to authenticated
  with check (true);

-- family_members ポリシー
create policy "Members can view family members"
  on public.family_members for select
  using (family_id in (select public.get_my_family_ids()));

create policy "Users can insert their own membership"
  on public.family_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own membership"
  on public.family_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own membership"
  on public.family_members for delete
  to authenticated
  using (user_id = auth.uid());

-- crdt_updates ポリシー
create policy "Members can access their family updates"
  on public.crdt_updates for all
  using (family_id in (select public.get_my_family_ids()))
  with check (
    family_id in (select public.get_my_family_ids())
    and sender_id = auth.uid()
  );

-- 家族作成 RPC（作成 + admin登録をアトミックに実行）
create or replace function public.create_family_with_admin(
  p_name text,
  p_invite_code text,
  p_display_name text
)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_family public.families;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.families (name, invite_code)
  values (trim(p_name), upper(trim(p_invite_code)))
  returning * into v_family;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (v_family.id, v_user_id, 'admin', nullif(trim(p_display_name), ''));

  return v_family;
end;
$$;

-- 招待コード参加 RPC（他家族の招待コードを一覧公開せずに参加可能にする）
create or replace function public.join_family_by_invite_code(
  p_invite_code text,
  p_display_name text
)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_family public.families;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_family
  from public.families
  where upper(invite_code) = upper(trim(p_invite_code))
  limit 1;

  if v_family.id is null then
    raise exception '招待コードが見つかりませんでした';
  end if;

  insert into public.family_members (family_id, user_id, role, display_name)
  values (v_family.id, v_user_id, 'member', nullif(trim(p_display_name), ''))
  on conflict (family_id, user_id) do update
    set display_name = coalesce(nullif(trim(p_display_name), ''), public.family_members.display_name);

  return v_family;
end;
$$;
