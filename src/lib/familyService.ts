import { get, set, del } from 'idb-keyval';
import { FamilyContextData, FamilyGroup, FamilyMember } from '../types/family';
import { supabase } from './supabase';

const PENDING_INVITE_KEY = 'wanlog_pending_invite_code_v1';

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function extractInviteCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('invite');
  if (!code) return null;
  const normalized = normalizeInviteCode(code);
  return normalized.length >= 4 ? normalized : null;
}

export function buildInviteUrl(inviteCode: string): string {
  if (typeof window === 'undefined') return `?invite=${inviteCode}`;
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('invite', inviteCode);
  return url.toString();
}

export async function savePendingInviteCode(code: string): Promise<void> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return;
  await set(PENDING_INVITE_KEY, normalized);
}

export async function loadPendingInviteCode(): Promise<string | null> {
  const fromUrl = extractInviteCodeFromUrl();
  if (fromUrl) {
    await savePendingInviteCode(fromUrl);
    return fromUrl;
  }
  const stored = await get<string>(PENDING_INVITE_KEY);
  return stored ?? null;
}

export async function clearPendingInviteCode(): Promise<void> {
  await del(PENDING_INVITE_KEY);
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (url.searchParams.has('invite')) {
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', url.toString());
    }
  }
}

export async function fetchMyFamilyContext(userId: string): Promise<FamilyContextData | null> {
  if (!supabase) return null;

  const { data: membershipRows, error: membershipError } = await supabase
    .from('family_members')
    .select('family_id, user_id, role, display_name, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1);

  if (membershipError) {
    throw new Error(`家族情報の取得に失敗しました: ${membershipError.message}`);
  }

  const membership = (membershipRows?.[0] as FamilyMember | undefined) ?? null;
  if (!membership) return null;

  const [{ data: familyRow, error: familyError }, { data: memberRows, error: membersError }] =
    await Promise.all([
      supabase
        .from('families')
        .select('id, name, invite_code, created_at')
        .eq('id', membership.family_id)
        .single(),
      supabase
        .from('family_members')
        .select('family_id, user_id, role, display_name, joined_at')
        .eq('family_id', membership.family_id)
        .order('joined_at', { ascending: true }),
    ]);

  if (familyError || !familyRow) {
    throw new Error(`家族グループ情報の取得に失敗しました: ${familyError?.message ?? '不明なエラー'}`);
  }

  if (membersError) {
    throw new Error(`メンバー一覧の取得に失敗しました: ${membersError.message}`);
  }

  return {
    family: familyRow as FamilyGroup,
    membership,
    members: (memberRows as FamilyMember[]) ?? [membership],
  };
}

export async function createFamilyGroup(
  familyName: string,
  displayName: string,
  userId: string,
): Promise<FamilyContextData> {
  if (!supabase) {
    throw new Error('Supabaseが設定されていません');
  }

  const cleanName = familyName.trim();
  if (!cleanName) {
    throw new Error('家族グループ名を入力してください');
  }

  const cleanDisplayName = displayName.trim() || '飼い主';
  const inviteCode = generateInviteCode(8);

  // Use atomic security-definer RPC when deployed, fall back to direct inserts
  const { data: rpcFamily, error: rpcError } = await supabase.rpc(
    'create_family_with_admin',
    {
      p_name: cleanName,
      p_invite_code: inviteCode,
      p_display_name: cleanDisplayName,
    },
  );

  if (!rpcError && rpcFamily) {
    const family = rpcFamily as FamilyGroup;
    const context = await fetchMyFamilyContext(userId);
    if (context) return context;
    return {
      family,
      membership: {
        family_id: family.id,
        user_id: userId,
        role: 'admin',
        display_name: cleanDisplayName,
        joined_at: new Date().toISOString(),
      },
      members: [],
    };
  }

  // Fallback if RPC is not installed yet
  const { data: insertedFamily, error: insertFamilyErr } = await supabase
    .from('families')
    .insert({ name: cleanName, invite_code: inviteCode })
    .select('id, name, invite_code, created_at')
    .single();

  if (insertFamilyErr || !insertedFamily) {
    throw new Error(
      `家族グループの作成に失敗しました: ${insertFamilyErr?.message ?? rpcError?.message ?? '不明なエラー'}`,
    );
  }

  const family = insertedFamily as FamilyGroup;
  const { error: insertMemberErr } = await supabase.from('family_members').insert({
    family_id: family.id,
    user_id: userId,
    role: 'admin',
    display_name: cleanDisplayName,
  });

  if (insertMemberErr) {
    throw new Error(`メンバー登録に失敗しました: ${insertMemberErr.message}`);
  }

  const context = await fetchMyFamilyContext(userId);
  if (!context) {
    throw new Error('作成した家族グループの読み込みに失敗しました');
  }
  return context;
}

export async function joinFamilyByInviteCode(
  rawInviteCode: string,
  displayName: string,
  userId: string,
): Promise<FamilyContextData> {
  if (!supabase) {
    throw new Error('Supabaseが設定されていません');
  }

  const inviteCode = normalizeInviteCode(rawInviteCode);
  if (inviteCode.length < 4) {
    throw new Error('正しい招待コードを入力してください');
  }

  const cleanDisplayName = displayName.trim() || '家族';

  const { data: rpcFamily, error: rpcError } = await supabase.rpc(
    'join_family_by_invite_code',
    {
      p_invite_code: inviteCode,
      p_display_name: cleanDisplayName,
    },
  );

  if (!rpcError && rpcFamily) {
    await clearPendingInviteCode();
    const context = await fetchMyFamilyContext(userId);
    if (context) return context;
  }

  if (rpcError && rpcError.message.includes('見つかりません')) {
    throw new Error('招待コードが見つかりませんでした。コードをご確認ください。');
  }

  // Fallback for setups without RPC
  const { data: familyRow, error: lookupError } = await supabase
    .from('families')
    .select('id, name, invite_code, created_at')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`招待コードの確認に失敗しました: ${lookupError.message}`);
  }

  if (!familyRow) {
    throw new Error('招待コードが見つかりませんでした。コードをご確認ください。');
  }

  const family = familyRow as FamilyGroup;
  const { error: joinError } = await supabase.from('family_members').upsert(
    {
      family_id: family.id,
      user_id: userId,
      role: 'member',
      display_name: cleanDisplayName,
    },
    { onConflict: 'family_id,user_id' },
  );

  if (joinError) {
    throw new Error(`グループ参加に失敗しました: ${joinError.message}`);
  }

  await clearPendingInviteCode();
  const context = await fetchMyFamilyContext(userId);
  if (!context) {
    throw new Error('参加した家族グループの読み込みに失敗しました');
  }
  return context;
}

export async function updateMyFamilyDisplayName(
  familyId: string,
  userId: string,
  displayName: string,
): Promise<void> {
  if (!supabase) return;
  const clean = displayName.trim();
  const { error } = await supabase
    .from('family_members')
    .update({ display_name: clean || '飼い主' })
    .eq('family_id', familyId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`表示名の更新に失敗しました: ${error.message}`);
  }
}

export async function leaveFamilyGroup(familyId: string, userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`グループからの退出に失敗しました: ${error.message}`);
  }
}
