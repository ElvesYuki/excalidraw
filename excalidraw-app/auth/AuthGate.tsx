import { createContext, useContext, useEffect, useState } from "react";

import type { ReactNode } from "react";

import {
  changePassword,
  fetchAuthStatus,
  fetchCurrentUser,
  getStoredToken,
  loginWithPassword,
  logoutBackend,
  onUnauthorized,
  registerWithPassword,
  resetPassword,
} from "./api";

import type { AuthResetPasswordResult, AuthUser } from "./types";

type AuthGateProps = {
  children: ReactNode;
};

type AuthState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous"; errorMessage?: string; successMessage?: string };

type AuthDialogMessage = {
  type: "error" | "success";
  text: string;
};

type AuthContextValue = {
  authState: AuthState;
  logout: () => void;
  refreshCurrentUser: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (username: string) => Promise<AuthResetPasswordResult>;
  authDialogMode: "login" | "register";
  isAuthDialogOpen: boolean;
  authMessage?: AuthDialogMessage;
  openAuthDialog: (mode?: "login" | "register") => void;
  promptLogin: (message: string) => void;
  closeAuthDialog: () => void;
  setAuthDialogMode: (mode: "login" | "register") => void;
  clearAuthMessage: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: {
    username: string;
    password: string;
    displayName?: string;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 8;

const getUsernameError = (value: string) => {
  if (!value.trim()) {
    return "请输入用户名";
  }
  if (value.trim().length < MIN_USERNAME_LENGTH) {
    return `用户名至少需要 ${MIN_USERNAME_LENGTH} 个字符`;
  }
  return "";
};

const getPasswordError = (value: string) => {
  if (!value.trim()) {
    return "请输入密码";
  }
  if (value.trim().length < MIN_PASSWORD_LENGTH) {
    return `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`;
  }
  return "";
};

export const useAuth = () => useContext(AuthContext);

export const AuthGate = ({ children }: AuthGateProps) => {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [authDialogMode, setAuthDialogMode] = useState<"login" | "register">(
    "login",
  );
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState<AuthDialogMessage | undefined>(
    undefined,
  );

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const authEnabled = await fetchAuthStatus();
        if (!isMounted) {
          return;
        }
        if (!authEnabled) {
          setAuthState({ status: "disabled" });
          return;
        }

        if (!getStoredToken()) {
          setAuthState({ status: "anonymous" });
          return;
        }

        try {
          const user = await fetchCurrentUser();
          if (!isMounted) {
            return;
          }
          setAuthState({ status: "authenticated", user });
        } catch {
          if (!isMounted) {
            return;
          }
          setAuthState({ status: "anonymous" });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "认证初始化失败";
        setAuthState({
          status: "anonymous",
          errorMessage: message,
        });
        setAuthMessage({ type: "error", text: message });
      }
    };

    initialize();

    const unsubscribe = onUnauthorized((message) => {
      logoutBackend();
      const errorMessage = message || "登录已失效，请重新登录";
      setAuthState({
        status: "anonymous",
        errorMessage,
      });
      setAuthMessage({ type: "error", text: errorMessage });
      setAuthDialogMode("login");
      setIsAuthDialogOpen(true);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const refreshCurrentUser = async () => {
    const user = await fetchCurrentUser();
    setAuthState({ status: "authenticated", user });
  };

  const openAuthDialog = (mode: "login" | "register" = "login") => {
    setAuthDialogMode(mode);
    setIsAuthDialogOpen(true);
  };

  const promptLogin = (message: string) => {
    setAuthMessage({ type: "error", text: message });
    setAuthDialogMode("login");
    setIsAuthDialogOpen(true);
  };

  const closeAuthDialog = () => {
    setIsAuthDialogOpen(false);
  };

  const clearAuthMessage = () => {
    setAuthMessage(undefined);
    if (authState.status === "anonymous") {
      setAuthState({ status: "anonymous" });
    }
  };

  const handleLogout = () => {
    logoutBackend();
    setAuthState({ status: "anonymous", successMessage: "你已退出登录" });
    setAuthMessage({ type: "success", text: "你已退出登录" });
    setAuthDialogMode("login");
  };

  const login = async (username: string, password: string) => {
    const usernameError = getUsernameError(username);
    const passwordError = getPasswordError(password);

    if (usernameError) {
      setAuthState({ status: "anonymous", errorMessage: usernameError });
      setAuthMessage({ type: "error", text: usernameError });
      throw new Error(usernameError);
    }
    if (passwordError) {
      setAuthState({ status: "anonymous", errorMessage: passwordError });
      setAuthMessage({ type: "error", text: passwordError });
      throw new Error(passwordError);
    }

    try {
      await loginWithPassword(username, password);
      await refreshCurrentUser();
      setAuthMessage(undefined);
      setIsAuthDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setAuthState({ status: "anonymous", errorMessage: message });
      setAuthMessage({ type: "error", text: message });
      throw error;
    }
  };

  const register = async (payload: {
    username: string;
    password: string;
    displayName?: string;
  }) => {
    const usernameError = getUsernameError(payload.username);
    const passwordError = getPasswordError(payload.password);

    if (usernameError) {
      setAuthState({ status: "anonymous", errorMessage: usernameError });
      setAuthMessage({ type: "error", text: usernameError });
      throw new Error(usernameError);
    }
    if (passwordError) {
      setAuthState({ status: "anonymous", errorMessage: passwordError });
      setAuthMessage({ type: "error", text: passwordError });
      throw new Error(passwordError);
    }

    try {
      const createdUser = await registerWithPassword(payload);
      const successMessage = `注册成功，请使用账号 ${createdUser.username} 登录`;
      setAuthState({ status: "anonymous", successMessage });
      setAuthMessage({ type: "success", text: successMessage });
      setAuthDialogMode("login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "注册失败";
      setAuthState({ status: "anonymous", errorMessage: message });
      setAuthMessage({ type: "error", text: message });
      throw error;
    }
  };

  const authContextValue = {
    authState,
    logout: handleLogout,
    refreshCurrentUser,
    changePassword: async (oldPassword: string, newPassword: string) => {
      await changePassword({ oldPassword, newPassword });
    },
    resetPassword: async (resetUsername: string) => {
      return resetPassword({ username: resetUsername });
    },
    authDialogMode,
    isAuthDialogOpen,
    authMessage,
    openAuthDialog,
    promptLogin,
    closeAuthDialog,
    setAuthDialogMode,
    clearAuthMessage,
    login,
    register,
  };

  return (
    <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>
  );
};
