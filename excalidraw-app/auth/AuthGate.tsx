import { createContext, useContext, useEffect, useState } from "react";

import type { FormEvent, ReactNode } from "react";

import {
  fetchAuthStatus,
  fetchCurrentUser,
  getStoredToken,
  loginWithPassword,
  logoutBackend,
  onUnauthorized,
} from "./api";

import type { AuthUser } from "./types";

import "./AuthGate.scss";

type AuthGateProps = {
  children: ReactNode;
};

type AuthState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous"; errorMessage?: string };

type AuthContextValue = {
  authState: AuthState;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => useContext(AuthContext);

export const AuthGate = ({ children }: AuthGateProps) => {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setAuthState({
          status: "anonymous",
          errorMessage: error instanceof Error ? error.message : "认证初始化失败",
        });
      }
    };

    initialize();

    const unsubscribe = onUnauthorized(() => {
      logoutBackend();
      setAuthState({
        status: "anonymous",
        errorMessage: "登录已失效，请重新登录",
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleLogout = () => {
    logoutBackend();
    setAuthState({ status: "anonymous" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await loginWithPassword(username, password);
      const user = await fetchCurrentUser();
      setAuthState({ status: "authenticated", user });
      setPassword("");
    } catch (error) {
      setAuthState({
        status: "anonymous",
        errorMessage: error instanceof Error ? error.message : "登录失败",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = authState.status === "disabled";
  const isAuthenticated = authState.status === "authenticated";
  const showOverlay = !isDisabled && !isAuthenticated;
  const dialogContentStyle = {
    position: "relative" as const,
    zIndex: 2,
    width: "100%",
    maxWidth: "calc(100vw - 3rem)",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "auto" as const,
  };
  const dialogPanelStyle = {
    width: "34rem",
    maxWidth: "calc(100vw - 3rem)",
    boxSizing: "border-box" as const,
    backgroundColor: "#ffffff",
    border: "1px solid rgba(31, 31, 37, 0.12)",
    outline: "1px solid rgba(31, 31, 37, 0.04)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.14)",
    borderRadius: "16px",
    padding: "24px",
    overflow: "hidden" as const,
    opacity: 1,
    filter: "none",
    transform: "none",
  };
  const dialogStyle = {
    display: "grid",
    gap: "1rem",
    width: "100%",
    minWidth: 0,
  } as const;
  const titleStyle = {
    margin: "0 0 1.25rem",
    padding: "0 0 0.9rem",
    fontSize: "1.25rem",
    fontWeight: 700,
    lineHeight: 1.2,
    color: "#1f1f25",
    borderBottom: "1px solid rgba(31, 31, 37, 0.1)",
  } as const;
  const fieldStyle = {
    display: "grid",
    gap: "0.45rem",
  } as const;
  const labelStyle = {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#1f1f25",
  } as const;
  const inputShellStyle = {
    boxSizing: "border-box" as const,
    display: "flex",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    height: "3rem",
    minHeight: "3rem",
    maxHeight: "3rem",
    border: "1.5px solid #c9ccdc",
    borderRadius: "10px",
    background: "#f5f7fb",
    padding: "0 0.85rem",
    overflow: "hidden" as const,
    marginTop: "0",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 2px rgba(15, 23, 42, 0.04)",
  };
  const inputStyle = {
    display: "block",
    width: "100%",
    minWidth: 0,
    height: "1.5rem",
    minHeight: "1.5rem",
    maxHeight: "1.5rem",
    padding: 0,
    margin: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    boxShadow: "none",
    color: "#1f1f25",
    fontFamily: "Assistant, system-ui, sans-serif",
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 1.5,
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    borderRadius: 0,
    flex: "1 1 auto",
    opacity: 1,
  };
  const formStyle = {
    display: "grid",
    gap: "1rem",
  } as const;
  const submitStyle = {
    width: "100%",
    minHeight: "3rem",
    border: "1px solid #6965db",
    background: "#6965db",
    color: "#ffffff",
    borderRadius: "10px",
    fontSize: "1rem",
    fontWeight: 600,
  } as const;
  const authContextValue = {
    authState,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <>
        {children}
        {showOverlay && (
          <div className="backend-auth-overlay" role="dialog" aria-modal="true">
            <div className="backend-auth-overlay__backdrop" />
            <div
              className="backend-auth-overlay__content"
              tabIndex={-1}
              style={dialogContentStyle}
            >
              <div style={dialogPanelStyle}>
                <div className="backend-auth-dialog__title" style={titleStyle}>
                  登录后继续使用 Excalidraw
                </div>
                <div className="backend-auth-dialog" style={dialogStyle}>
                  {authState.status === "loading" ? (
                    <div className="backend-auth-dialog__loading">
                      正在检查登录状态...
                    </div>
                  ) : (
                    <form
                      className="backend-auth-dialog__form"
                      onSubmit={handleSubmit}
                      style={formStyle}
                    >
                      <div className="backend-auth-dialog__field" style={fieldStyle}>
                        <label htmlFor="backend-auth-username" style={labelStyle}>
                          用户名
                        </label>
                        <div
                          className="backend-auth-dialog__input-shell"
                          style={inputShellStyle}
                        >
                          <input
                            id="backend-auth-username"
                            autoComplete="username"
                            placeholder="请输入用户名"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            required
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <div className="backend-auth-dialog__field" style={fieldStyle}>
                        <label htmlFor="backend-auth-password" style={labelStyle}>
                          密码
                        </label>
                        <div
                          className="backend-auth-dialog__input-shell"
                          style={inputShellStyle}
                        >
                          <input
                            id="backend-auth-password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="请输入密码"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      {authState.status === "anonymous" &&
                        authState.errorMessage && (
                          <div className="backend-auth-dialog__error">
                            {authState.errorMessage}
                          </div>
                        )}
                      <div className="backend-auth-dialog__actions">
                        <button
                          className="backend-auth-dialog__submit"
                          type="submit"
                          disabled={isSubmitting}
                          style={submitStyle}
                        >
                          {isSubmitting ? "登录中..." : "登录"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    </AuthContext.Provider>
  );
};
