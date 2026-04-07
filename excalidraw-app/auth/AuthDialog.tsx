import { useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";

import { useAuth } from "./AuthGate";

import "./AuthGate.scss";

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

export const AuthDialog = () => {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [touchedFields, setTouchedFields] = useState<{
    username: boolean;
    password: boolean;
  }>({
    username: false,
    password: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!auth || !auth.isAuthDialogOpen) {
    return null;
  }

  const resetForm = () => {
    setUsername("");
    setDisplayName("");
    setPassword("");
    setTouchedFields({
      username: false,
      password: false,
    });
  };

  const closeDialog = () => {
    auth.closeAuthDialog();
    resetForm();
  };

  const switchMode = (mode: "login" | "register") => {
    auth.setAuthDialogMode(mode);
    auth.clearAuthMessage();
    resetForm();
  };

  const usernameError = getUsernameError(username);
  const passwordError = getPasswordError(password);
  const submitDisabled =
    isSubmitting || Boolean(usernameError) || Boolean(passwordError);

  return (
    <Dialog
      size="small"
      title={auth.authDialogMode === "login" ? "登录" : "注册账号"}
      onCloseRequest={closeDialog}
      className="backend-auth-native-dialog"
    >
      <form
        className="backend-auth-native-dialog__form"
        onSubmit={async (event) => {
          event.preventDefault();
          setTouchedFields({
            username: true,
            password: true,
          });
          setIsSubmitting(true);
          try {
            if (auth.authDialogMode === "login") {
              await auth.login(username, password);
              resetForm();
            } else {
              await auth.register({
                username,
                password,
                displayName,
              });
              resetForm();
            }
          } catch {
            // message is handled in auth context
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        {auth.authDialogMode === "register" && (
          <label className="backend-auth-native-dialog__label">
            <span>显示名称</span>
            <input
              className="backend-auth-native-dialog__input"
              autoComplete="nickname"
              placeholder="可选，不填则使用用户名"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                auth.clearAuthMessage();
              }}
            />
          </label>
        )}

        <label className="backend-auth-native-dialog__label">
          <span>用户名</span>
          <input
            className="backend-auth-native-dialog__input"
            autoComplete="username"
            placeholder="请输入用户名"
            value={username}
            onBlur={() =>
              setTouchedFields((current) => ({
                ...current,
                username: true,
              }))
            }
            onChange={(event) => {
              setUsername(event.target.value);
              auth.clearAuthMessage();
            }}
            required
          />
        </label>
        {touchedFields.username && usernameError ? (
          <div className="backend-auth-native-dialog__field-error">
            {usernameError}
          </div>
        ) : auth.authDialogMode === "register" ? (
          <div className="backend-auth-native-dialog__hint">
            仅支持字母、数字或常见用户名组合，至少 3 个字符。
          </div>
        ) : null}

        <label className="backend-auth-native-dialog__label">
          <span>密码</span>
          <input
            className="backend-auth-native-dialog__input"
            type="password"
            autoComplete={
              auth.authDialogMode === "login" ? "current-password" : "new-password"
            }
            placeholder="请输入密码"
            value={password}
            onBlur={() =>
              setTouchedFields((current) => ({
                ...current,
                password: true,
              }))
            }
            onChange={(event) => {
              setPassword(event.target.value);
              auth.clearAuthMessage();
            }}
            required
          />
        </label>
        {touchedFields.password && passwordError ? (
          <div className="backend-auth-native-dialog__field-error">
            {passwordError}
          </div>
        ) : (
          <div className="backend-auth-native-dialog__hint">
            密码至少 8 个字符。
          </div>
        )}

        {auth.authMessage && (
          <div
            className={`backend-auth-native-dialog__message backend-auth-native-dialog__message--${auth.authMessage.type}`}
          >
            {auth.authMessage.text}
          </div>
        )}

        <div className="backend-auth-native-dialog__actions backend-auth-native-dialog__actions--spread">
          <DialogActionButton
            label={auth.authDialogMode === "login" ? "去注册" : "返回登录"}
            onClick={() =>
              switchMode(auth.authDialogMode === "login" ? "register" : "login")
            }
            disabled={isSubmitting}
          />
          <DialogActionButton
            label={auth.authDialogMode === "login" ? "登录" : "注册"}
            type="submit"
            actionType="primary"
            isLoading={isSubmitting}
            disabled={submitDisabled}
          />
        </div>
      </form>
    </Dialog>
  );
};
