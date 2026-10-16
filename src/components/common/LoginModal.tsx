import React, { useState, useEffect } from 'react';
import { UserCheck, Key, Shield, X, AlertCircle } from 'lucide-react';
import { db } from '../../db/pvtDb';
import { authenticateLocalUser } from '../../services/authService';
import type { LocalUser, Language } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: LocalUser | null;
  onUserChanged: (user: LocalUser) => void;
  lang: Language;
}

export const LoginModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  lang,
}) => {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      db.localUsers.toArray().then(loaded => {
        setUsers(loaded);
        if (currentUser) {
          setSelectedUsername(currentUser.username);
        } else if (loaded.length > 0) {
          setSelectedUsername(loaded[0].username);
        }
      });
      setPassword('');
      setErrorMsg('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const user = await authenticateLocalUser(selectedUsername, password);
      if (user) {
        onUserChanged(user);
        onClose();
      } else {
        setErrorMsg(
          lang === 'ar'
            ? 'كلمة المرور غير صحيحة أو الحساب غير مفعل.'
            : 'Incorrect password or account is inactive.'
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Administrator':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Engineer':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {lang === 'ar' ? 'المصادقة وتبديل المستخدم المحلي' : 'Local User Authentication'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'نظام تشغيل بدون خادم سحابي' : 'Offline RBAC Identity'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {lang === 'ar' ? 'اختر حساب المستخدم:' : 'Select User Account:'}
            </label>
            <select
              value={selectedUsername}
              onChange={e => setSelectedUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
            >
              {users.map(u => (
                <option key={u.id} value={u.username}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {lang === 'ar' ? 'كلمة المرور المحلية:' : 'Local Password:'}
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={lang === 'ar' ? 'أدخل كلمة المرور...' : 'Enter password...'}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pl-10 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Quick Credential hint for evaluation */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-700">
              {lang === 'ar' ? 'حسابات النظام الافتراضية للاختبار:' : 'Default Local Test Accounts:'}
            </div>
            <div className="flex justify-between">
              <span>admin</span>
              <span className="font-mono text-sky-600">admin123</span>
            </div>
            <div className="flex justify-between">
              <span>engineer</span>
              <span className="font-mono text-sky-600">engineer123</span>
            </div>
            <div className="flex justify-between">
              <span>viewer</span>
              <span className="font-mono text-sky-600">readonly123</span>
            </div>
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
      </div>
    </div>
  );
};
