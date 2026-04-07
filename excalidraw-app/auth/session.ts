const AUTH_TOKEN_STORAGE_KEY = "excalidraw-backend-auth-token";

export const getStoredAuthToken = () => {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredAuthToken = (token: string) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
};

export const clearStoredAuthToken = () => {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // noop
  }
};
