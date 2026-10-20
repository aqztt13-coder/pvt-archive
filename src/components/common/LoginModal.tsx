import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  X,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Sparkles,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import {
  authenticateLocalUser,
  changePasswordByEmail,
  changeUserSecretCode,
  logoutCurrentUser,
  DEFAULT_SECRET_CODE,
} from '../../services/authService';
import type { LocalUser, Language } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: LocalUser | null;
  onUserChanged: (user: LocalUser | null) => void;
  lang: Language;
}

export const LoginModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'change-code' | 'profile'>('login');
  
  // Login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Change code states
  const [targetEmail, setTargetEmail] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showNewCode, setShowNewCode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setPassword('');
      setCurrentCode('');
      setNewCode('');
      setConfirmCode('');
      setShowPassword(false);
      setShowNewCode(false);

      if (currentUser) {
        setEmail(currentUser.email || currentUser.username);
        setTargetEmail(currentUser.email || currentUser.username);
        if (currentUser.isDefaultPassword) {
          setActiveTab('change-code');
        } else {
          setActiveTab('profile');
        }
      } else {
        setEmail('ddzek258@gmail.com');
        setTargetEmail('ddzek258@gmail.com');
        setActiveTab('login');
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await authenticateLocalUser(email, password);
      if (res.success && res.user) {
        onUserChanged(res.user);
        if (res.isDefaultPassword) {
          setSuccessMsg(
            lang === 'ar'
              ? 'تم تسجيل الدخول بنجاح! تنبيه: أنت تستخدم الرمز الافتراضي (123456). يُرجى تغييره الآن لحماية حسابك بحيث لا يكون ظاهراً للعلن.'
              : 'Signed in successfully! Notice: You are using the default code (123456). Please change it now to keep it confidential.'
          );
          setTargetEmail(res.user.email || email);
          setCurrentCode(password);
          setActiveTab('change-code');
        } else {
          onClose();
        }
      } else {
        setErrorMsg(
          res.error ||
            (lang === 'ar'
              ? 'فشل تسجيل الدخول. يرجى التأكد من البريد الإلكتروني والرمز السري.'
              : 'Authentication failed. Please verify your email and secret code.')
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newCode !== confirmCode) {
      setErrorMsg(
        lang === 'ar'
          ? 'الرمز السري الجديد وتأكيده غير متطابقين.'
          : 'New secret code and confirmation do not match.'
      );
      return;
    }

    if (newCode.length < 4) {
      setErrorMsg(
        lang === 'ar'
          ? 'يجب أن يكون الرمز السري الجديد 4 خانات على الأقل.'
          : 'New secret code must be at least 4 characters.'
      );
      return;
    }

    if (newCode === DEFAULT_SECRET_CODE) {
      setErrorMsg(
        lang === 'ar'
          ? 'لا يمكن استخدام الرمز الافتراضي (123456) كرمز سري جديد. اختر رمزاً خاصاً بك.'
          : 'You cannot use the default code (123456) as your new secret code. Choose a unique private code.'
      );
      return;
    }

    setLoading(true);

    try {
      let res;
      if (currentUser && (targetEmail === currentUser.email || targetEmail === currentUser.username)) {
        res = await changeUserSecretCode(currentUser.id, currentCode, newCode);
      } else {
        res = await changePasswordByEmail(targetEmail, currentCode, newCode);
      }

      if (res.success && res.user) {
        onUserChanged(res.user);
        setSuccessMsg(
          lang === 'ar'
            ? 'تم حفظ وتأمين رمزك السري الجديد بنجاح! أصبح رمزك الآن مشفراً وخاصاً بك وغير ظاهر للعلن.'
            : 'Your new secret code has been encrypted and secured successfully! It is now strictly confidential.'
        );
        setCurrentCode('');
        setNewCode('');
        setConfirmCode('');
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMsg(
          res.error ||
            (lang === 'ar'
              ? 'تعذر تغيير الرمز السري. يرجى التحقق من الرمز الحالي أو الافتراضي.'
              : 'Failed to update secret code. Verify your current/default code.')
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating secret code');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutCurrentUser();
    onUserChanged(null);
    setActiveTab('login');
    setPassword('');
    setSuccessMsg(
      lang === 'ar' ? 'تم تسجيل الخروج بنجاح.' : 'Logged out successfully.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {lang === 'ar' ? 'الدخول والرمز السري الخاص' : 'User Access & Secret Code'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'تسجيل الدخول بواسطة جيميل ورمز سري خاص'
                  : 'Authenticated via Gmail & private secret code'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => {
              setActiveTab('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'login'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
          </button>

          <button
            onClick={() => {
              setActiveTab('change-code');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'change-code'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'تغيير الرمز السري' : 'Change Secret Code'}</span>
          </button>

          {currentUser && (
            <button
              onClick={() => {
                setActiveTab('profile');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'profile'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {lang === 'ar' ? 'بيانات الحساب' : 'Account Profile'}
            </button>
          )}
        </div>

        {/* Alerts */}
        <div className="px-6 pt-4 space-y-2">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}
        </div>

        {/* Tab 1: Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {lang === 'ar' ? 'البريد الإلكتروني (جيميل):' : 'Gmail / Email Address:'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ddzek258@gmail.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pl-10 text-sm text-slate-800 focus:border-sky-500 focus:outline-none transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {lang === 'ar' ? 'الرمز السري:' : 'Secret Code / Password:'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetEmail(email);
                    setActiveTab('change-code');
                  }}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                >
                  {lang === 'ar' ? 'تغيير الرمز السري؟' : 'Change Secret Code?'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pl-10 pr-10 text-sm text-slate-800 focus:border-sky-500 focus:outline-none transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Hint Notice */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1 leading-relaxed">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>
                  {lang === 'ar' ? 'دخول آمن بالرمز السري الافتراضي:' : 'Default Secret Code Info:'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                {lang === 'ar'
                  ? 'أدخل بريدك جيميل والرمز السري الافتراضي (123456)، وبعد الدخول يمكنك تغيير الرمز ليصبح خاصاً بك ومحمياً وغير ظاهر للعلن.'
                  : 'Enter your Gmail and the default code (123456). Once signed in, you can change your code so it remains private and hidden.'}
              </p>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-sky-600 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                {loading
                  ? (lang === 'ar' ? 'جارٍ التحقق...' : 'Verifying...')
                  : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In')}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Change Secret Code Form */}
        {activeTab === 'change-code' && (
          <form onSubmit={handleChangeCode} className="p-6 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ar' ? 'البريد الإلكتروني (جيميل):' : 'Gmail / Email Address:'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={targetEmail}
                  onChange={e => setTargetEmail(e.target.value)}
                  placeholder="ddzek258@gmail.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pl-9 text-xs text-slate-800 focus:border-sky-500 focus:outline-none transition"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ar' ? 'الرمز السري الحالي أو الافتراضي (123456):' : 'Current or Default Code (123456):'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={currentCode}
                  onChange={e => setCurrentCode(e.target.value)}
                  placeholder={lang === 'ar' ? 'أدخل الرمز الحالي أو 123456' : 'Enter current code or 123456'}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pl-9 text-xs text-slate-800 focus:border-sky-500 focus:outline-none transition"
                />
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'الرمز السري الجديد الخاص:' : 'New Private Secret Code:'}
                </label>
                <div className="relative">
                  <input
                    type={showNewCode ? 'text' : 'password'}
                    required
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pl-8 pr-8 text-xs text-slate-800 focus:border-sky-500 focus:outline-none transition"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowNewCode(!showNewCode)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showNewCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'تأكيد الرمز السري الجديد:' : 'Confirm New Code:'}
                </label>
                <div className="relative">
                  <input
                    type={showNewCode ? 'text' : 'password'}
                    required
                    value={confirmCode}
                    onChange={e => setConfirmCode(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pl-8 text-xs text-slate-800 focus:border-sky-500 focus:outline-none transition"
                  />
                  <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Privacy note */}
            <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-3 text-[11px] text-sky-900 flex items-start gap-2">
              <Shield className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                {lang === 'ar'
                  ? 'يتم تشفير الرمز السري الجديد بتقنية SHA-256 محلياً في جهازك ولن يظهر للعلن إطلاقاً بعد حفظه.'
                  : 'Your new secret code will be locally hashed with SHA-256 and will never be displayed in plain text.'}
              </span>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {lang === 'ar' ? 'رجوع لتسجيل الدخول' : 'Back to Login'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-sky-600 py-2 text-xs font-semibold text-white shadow-md hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
              >
                <Key className="w-4 h-4" />
                {loading
                  ? (lang === 'ar' ? 'جارٍ التحديث...' : 'Saving...')
                  : (lang === 'ar' ? 'تأمين وحفظ الرمز' : 'Save & Secure Code')}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Logged in profile */}
        {activeTab === 'profile' && currentUser && (
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white font-bold text-lg shadow-md">
                  {(currentUser.username || currentUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{currentUser.fullName}</h4>
                  <p className="text-xs text-slate-500">{currentUser.email || currentUser.username}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                        currentUser.role === 'Administrator'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : currentUser.role === 'Engineer'
                          ? 'bg-sky-100 text-sky-800 border-sky-200'
                          : 'bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                    {currentUser.isDefaultPassword ? (
                      <span className="rounded-md bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                        {lang === 'ar' ? 'الرمز الحالي: افتراضي' : 'Default Code Active'}
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
                        {lang === 'ar' ? 'الرمز سري ومحمي' : 'Private Code Secured'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {currentUser.isDefaultPassword && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {lang === 'ar' ? 'تنبيه أمان هـام:' : 'Important Security Notice:'}
                    </span>
                    <p className="mt-0.5">
                      {lang === 'ar'
                        ? 'أنت تستخدم الرمز السري الافتراضي. انقر على الزر أدناه لتغييره الآن ليكون رمزك السري خاصاً بك وغير ظاهر للعلن.'
                        : 'You are using the default secret code. Click below to change it now to your own private code.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setTargetEmail(currentUser.email || currentUser.username);
                  setActiveTab('change-code');
                }}
                className="w-full rounded-xl bg-sky-50 border border-sky-200 py-2.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تغيير الرمز السري الخاص بي' : 'Change My Secret Code'}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-rose-200 bg-white py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
