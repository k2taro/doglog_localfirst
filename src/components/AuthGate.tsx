import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  HardDrive,
  KeyRound,
  LogOut,
  Mail,
  PawPrint,
  UserPlus,
  Users,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  createFamilyGroup,
  joinFamilyByInviteCode,
  normalizeInviteCode,
} from '../lib/familyService';
import { FamilyContextData } from '../types/family';

interface AuthGateProps {
  user: User | null;
  initialInviteCode: string | null;
  defaultDisplayName: string;
  onFamilyReady: (context: FamilyContextData) => void;
  onContinueLocal: () => void;
  onSignOut: () => Promise<void>;
}

export function AuthGate({
  user,
  initialInviteCode,
  defaultDisplayName,
  onFamilyReady,
  onContinueLocal,
  onSignOut,
}: AuthGateProps) {
  // Auth form states
  const [email, setEmail] = useState('');
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [googleAuthUrl, setGoogleAuthUrl] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Family onboarding states
  const [onboardingTab, setOnboardingTab] = useState<'create' | 'join'>(
    initialInviteCode ? 'join' : 'create',
  );
  const [familyName, setFamilyName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState(initialInviteCode ?? '');
  const [displayName, setDisplayName] = useState(defaultDisplayName || '飼い主');
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);

  useEffect(() => {
    if (initialInviteCode) {
      setOnboardingTab('join');
      setInviteCodeInput(initialInviteCode);
    }
  }, [initialInviteCode]);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleGoogleSignIn = async () => {
    if (!supabase || authLoading) return;
    setAuthError(null);
    setAuthLoading(true);
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      if (isInIframe) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          setGoogleAuthUrl(data.url);
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Googleログインの開始に失敗しました',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || authLoading) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setAuthError(null);
    setAuthLoading(true);
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      setOtpSentTo(trimmedEmail);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : '認証メールの送信に失敗しました',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !otpSentTo || authLoading) return;
    const token = otpCode.trim();
    if (!token) return;

    setAuthError(null);
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: otpSentTo,
        token,
        type: 'email',
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : '認証コードの確認に失敗しました',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || familyLoading) return;
    setFamilyError(null);
    setFamilyLoading(true);
    try {
      const context = await createFamilyGroup(familyName, displayName, user.id);
      onFamilyReady(context);
    } catch (err) {
      setFamilyError(
        err instanceof Error ? err.message : '家族グループの作成に失敗しました',
      );
    } finally {
      setFamilyLoading(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || familyLoading) return;
    setFamilyError(null);
    setFamilyLoading(true);
    try {
      const context = await joinFamilyByInviteCode(
        inviteCodeInput,
        displayName,
        user.id,
      );
      onFamilyReady(context);
    } catch (err) {
      setFamilyError(
        err instanceof Error ? err.message : '招待コードでの参加に失敗しました',
      );
    } finally {
      setFamilyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#F6F7F9]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="space-y-2">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <PawPrint className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            WanSync
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            家族みんなで愛犬のお世話記録をリアルタイム共有。オフラインでもローカルに保存されます。
          </p>
        </div>

        {/* 招待コード検出時の案内 */}
        {initialInviteCode && (
          <div className="rounded-xl bg-sky-50 border border-sky-200/80 px-3.5 py-2.5 text-xs text-sky-900">
            招待コード <strong className="font-mono-num font-bold">{initialInviteCode}</strong>{' '}
            が検出されました。{user ? '下のフォームから参加できます。' : 'ログインすると家族グループへ参加できます。'}
          </div>
        )}

        {/* Case 1: Supabase未設定時 */}
        {!isSupabaseConfigured && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-950 space-y-1.5 leading-relaxed">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Supabase環境変数が未設定です</span>
              </div>
              <p>
                家族共有・ログインを有効にするには、環境変数{' '}
                <code className="font-mono-num bg-white/80 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code>{' '}
                と{' '}
                <code className="font-mono-num bg-white/80 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>{' '}
                を設定し、<code className="font-mono-num bg-white/80 px-1 py-0.5 rounded">supabase/schema.sql</code>{' '}
                を実行してください。
              </p>
            </div>

            <button
              type="button"
              onClick={onContinueLocal}
              className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <HardDrive className="w-4 h-4" aria-hidden="true" />
              <span>ローカルモードで記録を始める</span>
            </button>
          </div>
        )}

        {/* Case 2: Supabase設定済み & 未ログイン */}
        {isSupabaseConfigured && !user && (
          <div className="space-y-5">
            {authError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            {/* Googleログイン */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-sm font-semibold text-slate-900 inline-flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Googleでログイン</span>
              </button>

              {googleAuthUrl && (
                <a
                  href={googleAuthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-900 flex items-center justify-center gap-1.5 hover:bg-sky-100 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>新しいタブでGoogle認証画面を開く</span>
                </a>
              )}
            </div>

            <div className="relative flex items-center">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-xs text-slate-400">またはメールでログイン</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* マジックリンク / OTP */}
            {!otpSentTo ? (
              <form onSubmit={handleSendMagicLink} className="space-y-3">
                <div>
                  <label
                    htmlFor="auth-email-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    メールアドレス（マジックリンク）
                  </label>
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading || !email.trim()}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span>{authLoading ? '送信中...' : 'ログインメールを送信'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>認証メールを送信しました</span>
                  </div>
                  <p>
                    <strong className="font-medium">{otpSentTo}</strong> 宛のリンクを開くか、メール内の認証コードを入力してください。
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="auth-otp-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    認証コード（6桁など）
                  </label>
                  <input
                    id="auth-otp-input"
                    type="text"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 text-sm font-mono-num tracking-widest text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSentTo(null);
                      setOtpCode('');
                    }}
                    className="min-h-[46px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    メール変更
                  </button>
                  <button
                    type="submit"
                    disabled={authLoading || !otpCode.trim()}
                    className="flex-1 min-h-[46px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-4 h-4" aria-hidden="true" />
                    <span>コードでログイン</span>
                  </button>
                </div>
              </form>
            )}

            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onContinueLocal}
                className="min-h-[40px] px-3 text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2"
              >
                ログインせずにローカルのみで使う
              </button>
            </div>
          </div>
        )}

        {/* Case 3: ログイン済み・家族未所属 */}
        {isSupabaseConfigured && user && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="text-slate-500">ログイン中</div>
                <div className="font-semibold text-slate-900 truncate">
                  {user.email || user.id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>ログアウト</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setOnboardingTab('create');
                  setFamilyError(null);
                }}
                className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  onboardingTab === 'create'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                新しい家族を作成
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnboardingTab('join');
                  setFamilyError(null);
                }}
                className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  onboardingTab === 'join'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                招待コードで参加
              </button>
            </div>

            {familyError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{familyError}</span>
              </div>
            )}

            {onboardingTab === 'create' ? (
              <form onSubmit={handleCreateFamily} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    家族グループ名
                  </label>
                  <input
                    type="text"
                    required
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="例：田中家、ポチのお世話チーム"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    あなたの表示名（記録者名）
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="例：パパ、ママ"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={familyLoading || !familyName.trim()}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Users className="w-4 h-4" aria-hidden="true" />
                  <span>{familyLoading ? '作成中...' : '家族グループを作成する'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinFamily} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    招待コード（8桁英数字）
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(normalizeInviteCode(e.target.value))}
                    placeholder="例：AB12CD34"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 text-sm font-mono-num tracking-wider uppercase text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    あなたの表示名（記録者名）
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="例：ママ、ばぁば"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={familyLoading || inviteCodeInput.trim().length < 4}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>{familyLoading ? '参加処理中...' : '家族グループに参加する'}</span>
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onContinueLocal}
                className="min-h-[40px] px-3 text-xs font-medium text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
              >
                <span>あとで設定してローカルで使う</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
