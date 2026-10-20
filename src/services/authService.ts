import { db, logAuditEvent } from '../db/pvtDb';
import type { LocalUser, UserRole } from '../types';

const SESSION_KEY = 'pvt_current_user_id';
const PENDING_VERIFICATION_PREFIX = 'pvt_email_code_';

// Hash string with Web Crypto SHA-256
export async function hashPassword(plainText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_SECRET_CODE = '123456';

export interface EmailDispatchRecord {
  to: string;
  subject: string;
  code: string;
  timestamp: string;
  body: string;
}

let lastDispatchedEmail: EmailDispatchRecord | null = null;

export function getLastDispatchedEmail(): EmailDispatchRecord | null {
  return lastDispatchedEmail;
}

export async function getCurrentUser(): Promise<LocalUser | null> {
  const storedId = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (storedId) {
    const user = await db.localUsers.get(storedId);
    if (user && user.isActive) return user;
  }
  return null;
}

export function setCurrentUser(user: LocalUser | null) {
  if (user) {
    sessionStorage.setItem(SESSION_KEY, user.id);
    localStorage.setItem(SESSION_KEY, user.id);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }
}

export function logoutCurrentUser(): void {
  setCurrentUser(null);
}

export async function findUserByIdentifier(identifier: string): Promise<LocalUser | null> {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;

  // 1. Try exact email match
  let user = await db.localUsers.where('email').equalsIgnoreCase(clean).first();
  if (user) return user;

  // 2. Try exact username match
  user = await db.localUsers.where('username').equalsIgnoreCase(clean).first();
  if (user) return user;

  // 3. Try appending @gmail.com if no domain was entered
  if (!clean.includes('@')) {
    user = await db.localUsers.where('email').equalsIgnoreCase(`${clean}@gmail.com`).first();
    if (user) return user;
  }

  // 4. Try stripping @gmail.com for username
  if (clean.endsWith('@gmail.com')) {
    const prefix = clean.replace('@gmail.com', '');
    user = await db.localUsers.where('username').equalsIgnoreCase(prefix).first();
    if (user) return user;
  }

  return null;
}

export async function sendEmailVerificationForNewCode(
  email: string
): Promise<{ success: boolean; code?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'البريد الإلكتروني مطلوب.' };
  }

  // Generate secure 6-digit random verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  const payload = {
    email: cleanEmail,
    code,
    expiresAt,
  };

  try {
    sessionStorage.setItem(PENDING_VERIFICATION_PREFIX + cleanEmail, JSON.stringify(payload));
    localStorage.setItem(PENDING_VERIFICATION_PREFIX + cleanEmail, JSON.stringify(payload));

    const record: EmailDispatchRecord = {
      to: cleanEmail,
      subject: 'شعبة الموائع المكمنية: رمز تعيين الرمز السري الجديد',
      code,
      timestamp: new Date().toLocaleTimeString(),
      body: `مرحباً،\nتم استلام طلب تسجيل الدخول بالرمز الافتراضي لحسابك (${cleanEmail}).\nرمز التحقق لتأكيد هويتك وتعيين رمزك السري الجديد هو:\n\n[ ${code} ]\n\nيرجى إدخال هذا الرمز في شاشة التحقق، ثم إدخال رمزك السري الجديد وتأكيده ليصبح حسابك خاصاً وغير ظاهر للعلن.\nصلاحية الرمز: 15 دقيقة.`,
    };

    lastDispatchedEmail = record;

    await logAuditEvent({
      userId: 'AUTH',
      userName: cleanEmail,
      actionType: 'USER_MANAGEMENT',
      entityType: 'EmailVerification',
      entityId: cleanEmail,
      details: `Verification code sent to email '${cleanEmail}' to establish a new private secret code.`,
    });

    return { success: true, code };
  } catch (err: any) {
    console.error('Failed to store verification code:', err);
    return { success: false, error: 'تعذر إرسال رمز التحقق إلى البريد.' };
  }
}

export async function verifyEmailAndSetNewSecretCode(
  email: string,
  enteredCode: string,
  newPassword: string
): Promise<{ success: boolean; user?: LocalUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const rawPending =
    sessionStorage.getItem(PENDING_VERIFICATION_PREFIX + cleanEmail) ||
    localStorage.getItem(PENDING_VERIFICATION_PREFIX + cleanEmail);

  if (!rawPending) {
    return {
      success: false,
      error: 'انتهت صلاحية رمز التحقق أو لم يتم إرسال رمز. يرجى إعادة المحاولة.',
    };
  }

  try {
    const pending = JSON.parse(rawPending);
    if (Date.now() > pending.expiresAt) {
      sessionStorage.removeItem(PENDING_VERIFICATION_PREFIX + cleanEmail);
      localStorage.removeItem(PENDING_VERIFICATION_PREFIX + cleanEmail);
      return { success: false, error: 'انتهت صلاحية رمز التحقق (15 دقيقة). يرجى طلب رمز جديد.' };
    }

    if (pending.code !== enteredCode.trim()) {
      return { success: false, error: 'رمز التحقق المدخل غير صحيح. يرجى التحقق من الرسالة المستلمة على بريدك.' };
    }

    if (newPassword.trim().length < 4) {
      return { success: false, error: 'يجب أن يتكون الرمز السري الجديد من 4 خانات على الأقل.' };
    }

    if (newPassword.trim() === DEFAULT_SECRET_CODE) {
      return {
        success: false,
        error: 'لا يمكن استخدام الرمز الافتراضي كرمز سري جديد. يُرجى اختيار رمز خاص بك.',
      };
    }

    const user = await findUserByIdentifier(cleanEmail);
    if (!user) {
      return { success: false, error: 'تعذر العثور على الحساب المرتبط بهذا البريد الإلكتروني.' };
    }

    const newHash = await hashPassword(newPassword.trim());
    await db.localUsers.update(user.id, {
      passwordHash: newHash,
      isDefaultPassword: false,
      lastLogin: new Date().toISOString(),
    });

    sessionStorage.removeItem(PENDING_VERIFICATION_PREFIX + cleanEmail);
    localStorage.removeItem(PENDING_VERIFICATION_PREFIX + cleanEmail);

    const updatedUser: LocalUser = {
      ...user,
      passwordHash: newHash,
      isDefaultPassword: false,
      lastLogin: new Date().toISOString(),
    };

    setCurrentUser(updatedUser);

    await logAuditEvent({
      userId: user.id,
      userName: user.fullName,
      actionType: 'USER_MANAGEMENT',
      entityType: 'LocalUser',
      entityId: user.id,
      details: `User '${user.email || user.username}' successfully verified email and set their private secret code.`,
    });

    return { success: true, user: updatedUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ أثناء تأكيد الرمز.' };
  }
}

export async function authenticateLocalUser(
  identifier: string,
  plainPassword: string
): Promise<{
  success: boolean;
  user?: LocalUser;
  error?: string;
  requiresEmailVerification?: boolean;
  email?: string;
}> {
  const clean = identifier.trim().toLowerCase();
  if (!clean) {
    return { success: false, error: 'يرجى إدخال البريد الإلكتروني.' };
  }
  if (!plainPassword.trim()) {
    return { success: false, error: 'يرجى إدخال الرمز السري.' };
  }

  let user = await findUserByIdentifier(clean);

  // If user does not exist yet and typed a valid email with the default password
  if (!user && (clean.includes('@gmail.com') || clean.includes('@'))) {
    if (plainPassword.trim() === DEFAULT_SECRET_CODE || plainPassword.trim() === 'admin123') {
      const isFirstAdmin = (await db.localUsers.count()) === 0 || clean.includes('ddzek258');
      const prefix = clean.split('@')[0];
      const defaultHash = await hashPassword(DEFAULT_SECRET_CODE);
      const newUser: LocalUser = {
        id: `USR-${Date.now()}`,
        username: prefix,
        email: clean,
        fullName: clean === 'ddzek258@gmail.com' ? 'Dr. Tariq Al-Husseini (Admin)' : prefix.charAt(0).toUpperCase() + prefix.slice(1),
        role: isFirstAdmin ? 'Administrator' : 'Engineer',
        passwordHash: defaultHash,
        department: 'Reservoir Fluids Division',
        isActive: true,
        isDefaultPassword: true,
        createdAt: new Date().toISOString(),
      };
      await db.localUsers.add(newUser);
      user = newUser;
    }
  }

  if (!user) {
    return {
      success: false,
      error: 'البريد الإلكتروني أو الرمز السري غير صحيح. يرجى التحقق من صحة البيانات المدخلة.',
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      error: 'هذا الحساب معطل حالياً. يرجى مراجعة مسؤول النظام.',
    };
  }

  const inputHash = await hashPassword(plainPassword.trim());
  const defaultHash = await hashPassword(DEFAULT_SECRET_CODE);
  const legacyAdminHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

  const matchesDefault =
    plainPassword.trim() === DEFAULT_SECRET_CODE ||
    plainPassword.trim() === 'admin123' ||
    (user.isDefaultPassword && (inputHash === defaultHash || inputHash === legacyAdminHash));

  const matchesCustomHash = !user.isDefaultPassword && inputHash === user.passwordHash;

  // Case 1: Entering email with the default password -> Sends email with verification code to set new private code!
  if (matchesDefault && user.isDefaultPassword) {
    const userEmail = user.email || clean;
    await sendEmailVerificationForNewCode(userEmail);
    return {
      success: true,
      requiresEmailVerification: true,
      email: userEmail,
      user,
    };
  }

  // Case 2: Entering email with custom private secret code -> Authenticated and logged in directly
  if (matchesCustomHash) {
    await db.localUsers.update(user.id, {
      lastLogin: new Date().toISOString(),
      isDefaultPassword: false,
    });
    user.lastLogin = new Date().toISOString();
    user.isDefaultPassword = false;

    await logAuditEvent({
      userId: user.id,
      userName: user.fullName,
      actionType: 'LOGIN',
      entityType: 'UserSession',
      entityId: user.id,
      details: `Successful local authentication for '${user.email || user.username}' (${user.role}).`,
    });

    setCurrentUser(user);
    return { success: true, requiresEmailVerification: false, user };
  }

  return {
    success: false,
    error: 'البريد الإلكتروني أو الرمز السري غير صحيح. يرجى التحقق من صحة البيانات المدخلة.',
  };
}

export async function changeUserSecretCode(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; user?: LocalUser; error?: string }> {
  const user = await db.localUsers.get(userId);
  if (!user) {
    return { success: false, error: 'تعذر العثور على المستخدم.' };
  }

  if (newPassword.trim().length < 4) {
    return { success: false, error: 'يجب أن يتكون الرمز السري الجديد من 4 خانات على الأقل.' };
  }

  const inputHash = await hashPassword(currentPassword.trim());
  const defaultHash = await hashPassword(DEFAULT_SECRET_CODE);
  const legacyAdminHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

  const matchesCurrent =
    inputHash === user.passwordHash ||
    (user.isDefaultPassword && (currentPassword.trim() === DEFAULT_SECRET_CODE || currentPassword.trim() === 'admin123')) ||
    inputHash === defaultHash ||
    inputHash === legacyAdminHash;

  if (!matchesCurrent) {
    return { success: false, error: 'الرمز السري الحالي غير صحيح.' };
  }

  const newHash = await hashPassword(newPassword.trim());
  await db.localUsers.update(user.id, {
    passwordHash: newHash,
    isDefaultPassword: false,
  });

  const updatedUser = { ...user, passwordHash: newHash, isDefaultPassword: false };
  setCurrentUser(updatedUser);

  await logAuditEvent({
    userId: user.id,
    userName: user.fullName,
    actionType: 'USER_MANAGEMENT',
    entityType: 'LocalUser',
    entityId: user.id,
    details: `User '${user.email || user.username}' changed their secret code successfully. Password is now confidential.`,
  });

  return { success: true, user: updatedUser };
}

export async function changePasswordByEmail(
  emailOrUsername: string,
  currentOrDefaultPassword: string,
  newPassword: string
): Promise<{ success: boolean; user?: LocalUser; error?: string }> {
  const user = await findUserByIdentifier(emailOrUsername);
  if (!user) {
    return { success: false, error: 'البريد الإلكتروني المدخل غير مسجل بالنظام.' };
  }
  return changeUserSecretCode(user.id, currentOrDefaultPassword, newPassword);
}

export async function resetUserToDefaultCode(
  targetUserId: string,
  adminUser: LocalUser | null
): Promise<{ success: boolean; error?: string }> {
  assertCanAdminister(adminUser, 'reset user secret code');
  const user = await db.localUsers.get(targetUserId);
  if (!user) return { success: false, error: 'المستخدم غير موجود.' };

  const defaultHash = await hashPassword(DEFAULT_SECRET_CODE);
  await db.localUsers.update(targetUserId, {
    passwordHash: defaultHash,
    isDefaultPassword: true,
  });

  await logAuditEvent({
    userId: adminUser?.id || 'USR-ADMIN',
    userName: adminUser?.fullName || 'Administrator',
    actionType: 'USER_MANAGEMENT',
    entityType: 'LocalUser',
    entityId: targetUserId,
    details: `Administrator reset secret code for user '${user.username}' to default.`,
  });

  return { success: true };
}

export function canCreateOrEdit(user: LocalUser | null): boolean {
  if (!user) return false;
  return user.role === 'Administrator' || user.role === 'Engineer';
}

export function canAdminister(user: LocalUser | null): boolean {
  if (!user) return false;
  return user.role === 'Administrator';
}

export function canArchiveRecords(user: LocalUser | null): boolean {
  if (!user) return false;
  return user.role === 'Administrator';
}

export function assertCanEdit(user: LocalUser | null, action = 'modify'): void {
  if (!canCreateOrEdit(user)) {
    throw new Error(`Permission Denied: Current user (${user?.role || 'Guest'}) cannot ${action} records.`);
  }
}

export function assertCanAdminister(user: LocalUser | null, action = 'perform administrative operation'): void {
  if (!canAdminister(user)) {
    throw new Error(`Permission Denied: Administrator privileges required to ${action}.`);
  }
}
