export type AuthUser = {
  id?: string;
  username?: string;
  email?: string;
  address?: string;
  displayName?: string;
};

export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_USER_KEY = "auth_user";

export function readAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function writeAuth(user: AuthUser, token?: string | null) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  notifyAuthChange();
}

export function updateAuthUser(user: AuthUser) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  notifyAuthChange();
}

function isAddressLike(value?: string) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]+$/.test(trimmed)) return false;
  return trimmed.length >= 8;
}

function preferText(next?: string, current?: string) {
  if (next && next.trim()) return next;
  return current;
}

export function mergeAuthUser(current: AuthUser | null, next: AuthUser): AuthUser {
  if (!current) return next;
  const nextDisplay = isAddressLike(next.displayName) ? undefined : next.displayName;
  const currentDisplay = isAddressLike(current.displayName) ? undefined : current.displayName;
  return {
    ...current,
    ...next,
    id: preferText(next.id, current.id),
    username: preferText(next.username, current.username),
    email: preferText(next.email, current.email),
    address: preferText(next.address, current.address),
    displayName: preferText(nextDisplay, currentDisplay) || preferText(next.displayName, current.displayName),
  };
}

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  notifyAuthChange();
}

export function notifyAuthChange() {
  window.dispatchEvent(new Event("auth-changed"));
}
