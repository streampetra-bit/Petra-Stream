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

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  notifyAuthChange();
}

export function notifyAuthChange() {
  window.dispatchEvent(new Event("auth-changed"));
}
