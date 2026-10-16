import { db, logAuditEvent } from '../db/pvtDb';
import type { LocalUser, UserRole } from '../types';

const SESSION_KEY = 'pvt_current_user_id';

// Hash string with Web Crypto SHA-256
export async function hashPassword(plainText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getCurrentUser(): Promise<LocalUser | null> {
  const storedId = sessionStorage.getItem(SESSION_KEY);
  if (storedId) {
    const user = await db.localUsers.get(storedId);
    if (user && user.isActive) return user;
  }
  // Default to first active admin if no session yet
  const firstAdmin = await db.localUsers.where('role').equals('Administrator').first();
  if (firstAdmin && firstAdmin.isActive) {
    sessionStorage.setItem(SESSION_KEY, firstAdmin.id);
    return firstAdmin;
  }
  const anyUser = await db.localUsers.toCollection().first();
  return anyUser || null;
}

export function setCurrentUser(user: LocalUser | null) {
  if (user) {
    sessionStorage.setItem(SESSION_KEY, user.id);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export async function authenticateLocalUser(username: string, plainPassword: string): Promise<LocalUser | null> {
  const user = await db.localUsers.where('username').equalsIgnoreCase(username).first();
  if (!user || !user.isActive) return null;

  const inputHash = await hashPassword(plainPassword);
  if (inputHash === user.passwordHash) {
    // Record login
    await db.localUsers.update(user.id, { lastLogin: new Date().toISOString() });
    await logAuditEvent({
      userId: user.id,
      userName: user.fullName,
      actionType: 'LOGIN',
      entityType: 'UserSession',
      entityId: user.id,
      details: `Successful local login for user '${user.username}' (${user.role}).`,
    });
    setCurrentUser(user);
    return user;
  }
  return null;
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

