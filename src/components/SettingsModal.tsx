import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  LogIn,
  LogOut,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { LocalProfile, SyncStatusInfo } from '../types/dogLog';
import { FamilyContextData } from '../types/family';
import { exportCrdtSnapshot, getCrdtMetadata } from '../lib/crdtStore';
import { buildInviteUrl } from '../lib/familyService';
import { isSupabaseConfigured } from '../lib/supabase';

interface SettingsModalProps {
  profile: LocalProfile;
  status: SyncStatusInfo;
  familyContext: FamilyContextData | null;
  userEmail?: string | null;
  onSaveProfile: (profile: LocalProfile) => Promise<void>;
  onResetAllLogs: () => Promise<void>;
  onOpenAuthGate: () => void;
  onSignOut: () => Promise<void>;
  onLeaveFamily: () => Promise<void>;
  onClose: () => void;
}

const PRESET_ROLES = ['飼い主', 'パパ', 'ママ', '家族'];

export function SettingsModal({
  profile,
  status,
  familyContext,
  userEmail,
  onSaveProfile,
  onResetAllLogs,
  onOpenAuthGate,
  onSignOut,
  onLeaveFamily,
  onClose,
}: SettingsModalProps) {
  const [dogName, setDogName] = useState(profile.dogName);
  const [authorName, setAuthorName] = useState(profile.authorName);
  const [dailyWaterGoalMl, setDailyWaterGoalMl] = useState(profile.dailyWaterGoalMl);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copiedType, setCopiedType] = useState<'link' | 'code' | null>(null);

  const crdtMeta = getCrdtMetadata();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveProfile({
      dogName: dogName.trim() || '愛犬',
      authorName: authorName.trim() || '飼い主',
      dailyWaterGoalMl: Math.max(0, Number(dailyWaterGoalMl) || 0),
    });
    onClose();
  };

  const handleCopyInvite = async (type: 'link' | 'code') => {
    if (!familyContext) return;
    const text =
      type === 'link'
        ? buildInviteUrl(familyContext.family.invite_code)
        : familyContext.family.invite_code;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => {
        setCopiedType((prev) => (prev === type ? null : prev));
      }, 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleDownloadSnapshot = () => {
    const bytes = exportCrdtSnapshot();
    const bufferCopy = new Uint8Array(bytes).buffer;
    const blob = new Blob([bufferCopy], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dog-care-snapshot-${new Date().toISOString().slice(0, 10)}.loro`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 id="settings-modal-title" className="text-base font-bold text-slate-900">
            家族設定・プロフィール
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Family Group & Invite Link Section (Step 2) */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <span className="text-xs font-bold text-slate-900">家族グループ共有</span>
              </div>
              {userEmail && (
                <span className="text-xs text-slate-500 truncate max-w-[160px]">
                  {userEmail}
                </span>
              )}
            </div>

            {familyContext ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {familyContext.family.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      メンバー {familyContext.members.length}人 · 招待コード{' '}
                      <strong className="font-mono-num text-slate-800">
                        {familyContext.family.invite_code}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 1-tap copy invite link (?invite=XXXX) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyInvite('link')}
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedType === 'link' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                        <span>招待リンクをコピーしました</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        <span>招待リンク（?invite=）をコピー</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyInvite('code')}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    {copiedType === 'code' ? 'コピー済' : 'コード'}
                  </button>
                </div>

                {familyContext.members.length > 0 && (
                  <ul className="pt-2 border-t border-slate-200/70 space-y-1">
                    {familyContext.members.map((member) => (
                      <li
                        key={member.user_id}
                        className="text-xs text-slate-700 flex items-center justify-between"
                      >
                        <span className="font-medium">
                          {member.display_name || 'メンバー'}
                        </span>
                        <span className="text-slate-400">
                          {member.role === 'admin' ? '管理者' : 'メンバー'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await onLeaveFamily();
                    }}
                    className="min-h-[38px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-600"
                  >
                    グループ変更
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onSignOut();
                      onClose();
                    }}
                    className="min-h-[38px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1 ml-auto"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>ログアウト</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isSupabaseConfigured
                    ? 'ログインして家族グループを作成または招待コードで参加すると、招待リンクを発行できます。'
                    : '現在はローカルモードで動作中です。Supabase設定後に家族ログイン・招待リンク共有が有効になります。'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthGate();
                  }}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>ログイン・家族グループ設定へ</span>
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                愛犬の名前
              </label>
              <input
                type="text"
                value={dogName}
                onChange={(e) => setDogName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                1日の目標飲水量（ml）
              </label>
              <input
                type="number"
                min={0}
                max={3000}
                step={50}
                value={dailyWaterGoalMl}
                onChange={(e) => setDailyWaterGoalMl(Number(e.target.value) || 0)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                この端末の記録者名
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setAuthorName(role)}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      authorName === role
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              プロフィールを保存
            </button>
          </form>

          {/* Local Loro CRDT + IndexedDB Storage Info */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-xs font-semibold text-slate-700">
              ローカルデータベース（Loro Wasm CRDT + IndexedDB）
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-3 border border-slate-200/70">
              <div>
                <dt className="text-slate-500">記録件数</dt>
                <dd className="font-semibold text-slate-900 font-mono-num mt-0.5">
                  {status.logCount} 件
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">スナップショットサイズ</dt>
                <dd className="font-semibold text-slate-900 font-mono-num mt-0.5">
                  {(status.snapshotBytes / 1024).toFixed(2)} KB
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">CRDT 操作数</dt>
                <dd className="font-semibold text-slate-900 font-mono-num mt-0.5">
                  {crdtMeta.opCount} ops
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Peer ID</dt>
                <dd className="font-semibold text-slate-900 font-mono-num mt-0.5 truncate">
                  {crdtMeta.peerId}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDownloadSnapshot}
                className="w-full min-h-[44px] px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>CRDTバイナリスナップショット（.loro）を書き出す</span>
              </button>

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="w-full min-h-[44px] px-4 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-700 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>ローカル記録をすべて削除</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetAllLogs();
                      setConfirmReset(false);
                      onClose();
                    }}
                    className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                  >
                    本当に削除する
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
