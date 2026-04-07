import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from "./session";

import type {
  AuthChangePasswordPayload,
  AuthRegisterPayload,
  AuthResetPasswordPayload,
  AuthResetPasswordResult,
  AuthUser,
} from "./types";

const API_PREFIX = "/api/v1";
const AUTH_UNAUTHORIZED_EVENT = "backend-auth-unauthorized";

const getBackendBaseUrl = () =>
  import.meta.env.VITE_APP_STORAGE_BACKEND_URL?.trim() ||
  import.meta.env.VITE_APP_BACKEND_URL?.trim() ||
  window.location.origin;

const createBackendUrl = (path: string) => new URL(path, getBackendBaseUrl()).toString();

export const getAuthStatusUrl = () =>
  import.meta.env.VITE_APP_BACKEND_AUTH_STATUS_URL?.trim() ||
  createBackendUrl(`${API_PREFIX}/auth/status`);

export const getAuthLoginUrl = () =>
  import.meta.env.VITE_APP_BACKEND_AUTH_LOGIN_URL?.trim() ||
  createBackendUrl(`${API_PREFIX}/auth/login`);

export const getAuthRegisterUrl = () =>
  import.meta.env.VITE_APP_BACKEND_AUTH_REGISTER_URL?.trim() ||
  createBackendUrl(`${API_PREFIX}/auth/register`);

export const getAuthMeUrl = () =>
  import.meta.env.VITE_APP_BACKEND_AUTH_ME_URL?.trim() ||
  createBackendUrl(`${API_PREFIX}/auth/me`);

export const getAuthChangePasswordUrl = () =>
  import.meta.env.VITE_APP_BACKEND_AUTH_CHANGE_PASSWORD_URL?.trim() ||
  createBackendUrl(`${API_PREFIX}/auth/change-password`);

export const getAuthResetPasswordUrl = () =>
  import.meta.env.VITE_APP_BACKEND_AUTH_RESET_PASSWORD_URL?.trim() ||
  createBackendUrl(`${API_PREFIX}/auth/reset-password`);

export const getStoredToken = () => getStoredAuthToken();

const emitUnauthorized = (message?: string) => {
  window.dispatchEvent(
    new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
      detail: { message },
    }),
  );
};

export const onUnauthorized = (listener: (message?: string) => void) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ message?: string }>;
    listener(customEvent.detail?.message);
  };
  window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handler as EventListener);
  return () =>
    window.removeEventListener(
      AUTH_UNAUTHORIZED_EVENT,
      handler as EventListener,
    );
};

export const requireAuthToken = (message: string) => {
  const token = getStoredAuthToken();
  if (!token) {
    emitUnauthorized(message);
    throw new Error(message);
  }
  return token;
};

export const fetchAuthStatus = async () => {
  const response = await fetch(getAuthStatusUrl());
  if (!response.ok) {
    throw new Error(`Failed to load auth status: ${response.status}`);
  }
  const json = await response.json();
  return Boolean(json?.data?.authEnabled);
};

export const loginWithPassword = async (username: string, password: string) => {
  const response = await fetch(getAuthLoginUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    let message = "登录失败";
    try {
      const json = await response.json();
      message = json?.error || json?.msg || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  const json = await response.json();
  const token = json?.data?.token;
  if (typeof token !== "string" || !token) {
    throw new Error("登录成功但未返回 token");
  }
  setStoredAuthToken(token);
  return token;
};

export const registerWithPassword = async (
  payload: AuthRegisterPayload,
): Promise<AuthUser> => {
  const response = await fetch(getAuthRegisterUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "注册失败";
    try {
      const json = await response.json();
      message = json?.error || json?.msg || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  const json = await response.json();
  return json?.data?.user as AuthUser;
};

export const logoutBackend = () => {
  clearStoredAuthToken();
};

export const authorizedFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const token = getStoredAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearStoredAuthToken();
    emitUnauthorized();
  }

  return response;
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const response = await authorizedFetch(getAuthMeUrl());
  if (!response.ok) {
    throw new Error(`Failed to load current user: ${response.status}`);
  }
  const json = await response.json();
  return json?.data as AuthUser;
};

export const changePassword = async (payload: AuthChangePasswordPayload) => {
  const response = await authorizedFetch(getAuthChangePasswordUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "修改密码失败";
    try {
      const json = await response.json();
      message = json?.error || json?.msg || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }
};

export const resetPassword = async (
  payload: AuthResetPasswordPayload,
): Promise<AuthResetPasswordResult> => {
  const response = await fetch(getAuthResetPasswordUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "重置密码失败";
    try {
      const json = await response.json();
      message = json?.error || json?.msg || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  const json = await response.json();
  return json?.data as AuthResetPasswordResult;
};

export const buildAuthorizedWsUrl = async (url: string) => {
  const token = getStoredAuthToken();
  if (!token) {
    emitUnauthorized("进入实时协作前，请先登录");
    throw new Error("进入实时协作前，请先登录");
  }
  const wsUrl = new URL(url, window.location.origin);
  wsUrl.searchParams.set("token", token);
  return wsUrl.toString();
};
