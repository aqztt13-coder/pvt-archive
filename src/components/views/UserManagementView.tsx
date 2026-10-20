import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  X,
  Lock,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { db, logAuditEvent } from '../../db/pvtDb';
import {
  hashPassword,
  canAdminister,
  resetUserToDefaultCode,
  DEFAULT_SECRET_CODE,
} from '../../services/authService';
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  requestConfirm,
} from '../../services/notificationService';
import { translations } from '../../i18n/translations';
import type { Language, LocalUser, UserRole } from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
}

export const UserManagementView: React.FC<Props> = ({ lang, currentUser }) => {
  const t = translations[lang];
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('Engineer');
  const [department, setDepartment] = useState('Reservoir Fluids Division');
  const [useDefaultPassword, setUseDefaultPassword] = useState(true);
  const [password, setPassword] = useState(DEFAULT_SECRET_CODE);
  const [confirmPassword, setConfirmPassword] = useState(DEFAULT_SECRET_CODE);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const list = await db.localUsers.toArray();
    setUsers(list);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!canAdminister(currentUser)) {
      setErrorMsg(
        lang === 'ar'
          ? 'فقط مدير النظام يملك صلاحية إضافة مستخدمين.'
          : 'Only administrators can create users.'
      );
      return;
    }

    const chosenPassword = useDefaultPassword ? DEFAULT_SECRET_CODE : password;
    const chosenConfirm = useDefaultPassword ? DEFAULT_SECRET_CODE : confirmPassword;

    if (chosenPassword !== chosenConfirm) {
      setErrorMsg(lang === 'ar' ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.');
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    const existingUsername = await db.localUsers.where('username').equalsIgnoreCase(trimmedUsername).first();
    if (existingUsername) {
      setErrorMsg(lang === 'ar' ? 'اسم المستخدم مسجل مسبقاً.' : 'Username already exists.');
      return;
    }

    if (trimmedEmail) {
      const existingEmail = await db.localUsers.where('email').equalsIgnoreCase(trimmedEmail).first();
      if (existingEmail) {
        setErrorMsg(lang === 'ar' ? 'البريد الإلكتروني مسجل مسبقاً.' : 'Email already exists.');
        return;
      }
    }

    const passwordHash = await hashPassword(chosenPassword);
    const id = `USR-${Date.now()}`;
    const newUser: LocalUser = {
      id,
      username: trimmedUsername,
      email: trimmedEmail || `${trimmedUsername}@gmail.com`,
      fullName: fullName.trim(),
      role,
      department: department.trim(),
      passwordHash,
      isActive: true,
      isDefaultPassword: useDefaultPassword || chosenPassword === DEFAULT_SECRET_CODE,
      createdAt: new Date().toISOString(),
    };

    await db.localUsers.add(newUser);

    await logAuditEvent({
      userId: currentUser?.id || 'USR-ADMIN',
      userName: currentUser?.fullName || 'Administrator',
      actionType: 'USER_MANAGEMENT',
      entityType: 'LocalUser',
      entityId: id,
      details: `Created new local user account: ${newUser.username} (${newUser.email || 'no-email'}) with role '${newUser.role}'`,
    });

    await loadUsers();
    setShowAddModal(false);
    setUsername('');
    setEmail('');
    setFullName('');
    setPassword(DEFAULT_SECRET_CODE);
    setConfirmPassword(DEFAULT_SECRET_CODE);
    setUseDefaultPassword(true);
    notifySuccess(
      lang === 'ar'
        ? `تم إنشاء حساب المستخدم "${newUser.fullName}" بنجاح.`
        : `User account "${newUser.fullName}" created successfully.`
    );
  };

  const toggleUserActive = (user: LocalUser) => {
    if (!canAdminister(currentUser)) {
      notifyError(
        lang === 'ar'
          ? 'فقط مدير النظام يملك صلاحية إدارة المستخدمين.'
          : 'Only administrators can manage users.'
      );
      return;
    }

    if (user.id === currentUser?.id) {
      notifyWarning(
        lang === 'ar'
          ? 'لا يمكنك تعطيل حسابك النشط حالياً.'
          : 'You cannot disable your active account.'
      );
      return;
    }

    const updatedStatus = !user.isActive;
    requestConfirm({
      title:
        lang === 'ar'
          ? updatedStatus
            ? 'تفعيل الحساب'
            : 'تعطيل الحساب'
          : updatedStatus
          ? 'Activate Account'
          : 'Disable Account',
      message:
        lang === 'ar'
          ? `هل أنت متأكد من ${updatedStatus ? 'تفعيل' : 'تعطيل'} حساب المستخدم: "${user.fullName}" (${user.username})؟`
          : `Are you sure you want to ${updatedStatus ? 'activate' : 'disable'} account: "${user.fullName}" (${user.username})?`,
      confirmText: lang === 'ar' ? (updatedStatus ? 'تفعيل' : 'تعطيل') : updatedStatus ? 'Activate' : 'Disable',
      cancelText: lang === 'ar' ? 'إلغاء' : 'Cancel',
      isDestructive: !updatedStatus,
      onConfirm: async () => {
        await db.localUsers.update(user.id, { isActive: updatedStatus });

        await logAuditEvent({
          userId: currentUser?.id || 'USR',
          userName: currentUser?.fullName || 'Administrator',
          actionType: 'USER_MANAGEMENT',
          entityType: 'LocalUser',
          entityId: user.id,
          details: `Account ${user.username} set to ${updatedStatus ? 'Active' : 'Disabled'}.`,
        });

        await loadUsers();
        notifySuccess(
          lang === 'ar'
            ? `تم ${updatedStatus ? 'تفعيل' : 'تعطيل'} الحساب بنجاح.`
            : `Account ${updatedStatus ? 'activated' : 'disabled'} successfully.`
        );
      },
    });
  };

  const handleResetPassword = (user: LocalUser) => {
    if (!canAdminister(currentUser)) {
      notifyError(
        lang === 'ar'
          ? 'فقط مدير النظام يملك صلاحية إعادة تعيين الرمز السري.'
          : 'Only administrators can reset user credentials.'
      );
      return;
    }

    requestConfirm({
      title: lang === 'ar' ? 'إعادة تعيين الرمز السري' : 'Reset Secret Code to Default',
      message:
        lang === 'ar'
          ? `هل أنت متأكد من إعادة تعيين الرمز السري للمستخدم "${user.fullName}" (${user.email || user.username}) إلى الرمز الافتراضي (123456)؟ سيطلب من المستخدم تغيير رمزه ليكون خاصاً به عند الدخول.`
          : `Are you sure you want to reset secret code for "${user.fullName}" to the default code (123456)? The user will be prompted to set their private code.`,
      confirmText: lang === 'ar' ? 'إعادة التعيين' : 'Reset Code',
      cancelText: lang === 'ar' ? 'إلغاء' : 'Cancel',
      isDestructive: false,
      onConfirm: async () => {
        const res = await resetUserToDefaultCode(user.id, currentUser);
        if (res.success) {
          await loadUsers();
          notifySuccess(
            lang === 'ar'
              ? `تمت إعادة تعيين الرمز السري بنجاح إلى: 123456`
              : `Secret code reset successfully to: 123456`
          );
        } else {
          notifyError(res.error || 'Failed to reset code');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.users.title}</h2>
          <p className="text-xs text-slate-500">
            {lang === 'ar'
              ? 'إدارة حسابات المستخدمين والبريد الإلكتروني والرموز السرية وصلاحيات النظام'
              : 'User accounts, Gmail addresses, confidential secret codes, and RBAC permissions'}
          </p>
        </div>

        {canAdminister(currentUser) && (
          <button
            onClick={() => {
              setErrorMsg('');
              setUsername('');
              setEmail('');
              setFullName('');
              setPassword(DEFAULT_SECRET_CODE);
              setConfirmPassword(DEFAULT_SECRET_CODE);
              setUseDefaultPassword(true);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.users.addUser}</span>
          </button>
        )}
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900 space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-purple-800">
            <Shield className="w-4 h-4" />
            Administrator
          </span>
          <p className="text-[11px] text-purple-700 leading-relaxed">{t.users.roleAdminDesc}</p>
        </div>

        <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 text-xs text-sky-900 space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-sky-800">
            <UserCheck className="w-4 h-4" />
            Engineer
          </span>
          <p className="text-[11px] text-sky-700 leading-relaxed">{t.users.roleEngineerDesc}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-900 space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-slate-800">
            <Users className="w-4 h-4" />
            Read Only
          </span>
          <p className="text-[11px] text-slate-600 leading-relaxed">{t.users.roleReadOnlyDesc}</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <table className="w-full text-xs text-start">
          <thead>
            <tr className="bg-slate-900 text-white font-semibold">
              <th className="p-3.5 text-start">{t.users.fullName}</th>
              <th className="p-3.5 text-start">{lang === 'ar' ? 'البريد الإلكتروني (جيميل)' : 'Gmail / Email'}</th>
              <th className="p-3.5 text-start">{t.users.role}</th>
              <th className="p-3.5 text-start">{lang === 'ar' ? 'حالة الرمز السري' : 'Secret Code Status'}</th>
              <th className="p-3.5 text-start">{t.users.status}</th>
              <th className="p-3.5 text-end">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition">
                <td className="p-3.5 font-semibold text-slate-900">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                      {(u.username || u.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span>{u.fullName}</span>
                  </div>
                </td>
                <td className="p-3.5 font-mono text-slate-600">{u.email || u.username}</td>
                <td className="p-3.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                      u.role === 'Administrator'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : u.role === 'Engineer'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-3.5">
                  {u.isDefaultPassword ? (
                    <span className="rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {lang === 'ar' ? 'رمز افتراضي (123456)' : 'Default (123456)'}
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {lang === 'ar' ? 'رمز سري خاص ومحمي' : 'Confidential Code'}
                    </span>
                  )}
                </td>
                <td className="p-3.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                      u.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {u.isActive ? t.users.active : t.users.inactive}
                  </span>
                </td>
                <td className="p-3.5 text-end">
                  <div className="flex items-center justify-end gap-2">
                    {canAdminister(currentUser) && (
                      <button
                        onClick={() => handleResetPassword(u)}
                        title={
                          lang === 'ar'
                            ? 'إعادة تعيين الرمز السري للافتراضي (123456)'
                            : 'Reset secret code to default (123456)'
                        }
                        className="rounded-lg p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canAdminister(currentUser) && u.id !== currentUser?.id && (
                      <button
                        onClick={() => toggleUserActive(u)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition ${
                          u.isActive
                            ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {u.isActive ? t.users.inactive : t.users.active}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security notice */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
        <p>{t.users.securityNotice}</p>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">{t.users.addUser}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'البريد الإلكتروني (جيميل) *' : 'Gmail / Email Address *'}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="engineer@gmail.com"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (!username && e.target.value.includes('@')) {
                        setUsername(e.target.value.split('@')[0]);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 pl-8 text-slate-800"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.users.fullName} *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Eng. Sarah Al-Ali"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.users.username} *</label>
                  <input
                    type="text"
                    required
                    placeholder="sarah.ali"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.users.role} *</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Engineer">Engineer</option>
                    <option value="ReadOnly">ReadOnly</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.users.department}</label>
                  <input
                    type="text"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Secret code setup */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={useDefaultPassword}
                    onChange={e => setUseDefaultPassword(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>
                    {lang === 'ar'
                      ? 'استخدام الرمز السري الافتراضي (123456)'
                      : 'Use default initial secret code (123456)'}
                  </span>
                </label>
                <p className="text-[11px] text-slate-500">
                  {lang === 'ar'
                    ? 'سيتمكن المستخدم من تسجيل الدخول بالرمز الافتراضي (123456) ثم تغييره لرمز سري خاص به بحيث لا يكون ظاهراً للعلن.'
                    : 'The user will be able to log in with 123456 and change it to their private code.'}
                </p>

                {!useDefaultPassword && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'الرمز السري المخصص *' : 'Custom Code *'}
                      </label>
                      <input
                        type="password"
                        required={!useDefaultPassword}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'تأكيد الرمز *' : 'Confirm Code *'}
                      </label>
                      <input
                        type="password"
                        required={!useDefaultPassword}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 shadow-sm"
                >
                  {t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
