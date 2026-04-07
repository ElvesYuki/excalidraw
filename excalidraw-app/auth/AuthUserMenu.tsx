import { useEffect, useRef, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";

import { useAuth } from "./AuthGate";

import "./AuthGate.scss";

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 8;

const getChangePasswordError = (
  oldPassword: string,
  newPassword: string,
) => {
  if (!oldPassword.trim()) {
    return "请输入当前密码";
  }
  if (!newPassword.trim()) {
    return "请输入新密码";
  }
  if (newPassword.trim().length < MIN_PASSWORD_LENGTH) {
    return `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`;
  }
  if (oldPassword === newPassword) {
    return "新密码不能与当前密码相同";
  }
  return "";
};

const getResetUsernameError = (username: string) => {
  if (!username.trim()) {
    return "请输入用户名";
  }
  if (username.trim().length < MIN_USERNAME_LENGTH) {
    return `用户名至少需要 ${MIN_USERNAME_LENGTH} 个字符`;
  }
  return "";
};

export const AuthUserMenu = () => {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<
    null | "change-password" | "reset-password"
  >(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogMessageType, setDialogMessageType] = useState<
    "success" | "error" | "info"
  >("info");
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!auth || auth.authState.status === "loading") {
    return null;
  }

  if (
    auth.authState.status === "anonymous" ||
    auth.authState.status === "disabled"
  ) {
    return (
      <div className="backend-auth-userpanel">
        <button
          className="backend-auth-userpanel__trigger backend-auth-userpanel__trigger--toolbar backend-auth-userpanel__trigger--anonymous"
          type="button"
          aria-label="登录"
          title="登录"
          onClick={() => auth.openAuthDialog("login")}
        >
          <span className="backend-auth-userpanel__trigger-label">登录</span>
        </button>
      </div>
    );
  }

  const { user } = auth.authState;
  const displayName = user.displayName || user.username || "当前用户";
  const badgeLabel = displayName.trim().charAt(0).toUpperCase() || "U";
  const normalizedRole = user.role ? user.role.toUpperCase() : "MEMBER";

  const closeDialog = () => {
    setActiveDialog(null);
    setOldPassword("");
    setNewPassword("");
    setResetUsername("");
    setDialogMessage("");
    setDialogMessageType("info");
    setIsDialogSubmitting(false);
  };

  const changePasswordError = getChangePasswordError(oldPassword, newPassword);
  const resetUsernameError = getResetUsernameError(resetUsername);
  const changePasswordSubmitDisabled =
    isDialogSubmitting || Boolean(changePasswordError);
  const resetPasswordSubmitDisabled =
    isDialogSubmitting || Boolean(resetUsernameError);

  return (
    <div className="backend-auth-userpanel" ref={menuRef}>
      <button
        className="backend-auth-userpanel__trigger backend-auth-userpanel__trigger--toolbar"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`当前用户：${displayName}`}
        title={displayName}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="backend-auth-userpanel__trigger-badge">{badgeLabel}</span>
      </button>
      {isOpen && (
        <div className="backend-auth-userpanel__menu" role="menu">
          <div className="backend-auth-userpanel__menu-header">
            <div className="backend-auth-userpanel__menu-name">{displayName}</div>
            <div className="backend-auth-userpanel__menu-meta">{normalizedRole}</div>
          </div>
          <div className="backend-auth-userpanel__actions">
            <button
              className="backend-auth-userpanel__secondary"
              type="button"
              onClick={() => {
                setIsOpen(false);
                setDialogMessage("");
                setActiveDialog("change-password");
              }}
            >
              修改密码
            </button>
            <button
              className="backend-auth-userpanel__secondary"
              type="button"
              onClick={() => {
                setIsOpen(false);
                setDialogMessage("");
                setResetUsername(user.username);
                setActiveDialog("reset-password");
              }}
            >
              重置密码
            </button>
            <button
              className="backend-auth-userpanel__logout"
              type="button"
              onClick={auth.logout}
            >
              退出登录
            </button>
          </div>
        </div>
      )}
      {activeDialog === "change-password" && (
        <Dialog
          size="small"
          title="修改密码"
          onCloseRequest={closeDialog}
          className="backend-auth-native-dialog"
        >
          <form
            className="backend-auth-native-dialog__form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (changePasswordError) {
                setDialogMessage(changePasswordError);
                setDialogMessageType("error");
                return;
              }
              setIsDialogSubmitting(true);
              setDialogMessage("");
              try {
                await auth.changePassword(oldPassword, newPassword);
                setDialogMessage("密码修改成功，请使用新密码继续登录。");
                setDialogMessageType("success");
                setOldPassword("");
                setNewPassword("");
              } catch (error) {
                setDialogMessage(
                  error instanceof Error ? error.message : "修改密码失败",
                );
                setDialogMessageType("error");
              } finally {
                setIsDialogSubmitting(false);
              }
            }}
          >
            <label className="backend-auth-native-dialog__label">
              <span>当前密码</span>
              <input
                className="backend-auth-native-dialog__input"
                type="password"
                value={oldPassword}
                onChange={(event) => {
                  setOldPassword(event.target.value);
                  if (dialogMessage) {
                    setDialogMessage("");
                  }
                }}
                disabled={isDialogSubmitting}
                required
              />
            </label>
            <label className="backend-auth-native-dialog__label">
              <span>新密码</span>
              <input
                className="backend-auth-native-dialog__input"
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  if (dialogMessage) {
                    setDialogMessage("");
                  }
                }}
                minLength={MIN_PASSWORD_LENGTH}
                disabled={isDialogSubmitting}
                required
              />
            </label>
            <div className="backend-auth-native-dialog__hint">
              新密码至少 8 个字符，且不能与当前密码相同。
            </div>
            {dialogMessage && (
              <div
                className={`backend-auth-native-dialog__message backend-auth-native-dialog__message--${dialogMessageType}`}
              >
                {dialogMessage}
              </div>
            )}
            <div className="backend-auth-native-dialog__actions">
              <DialogActionButton
                label="关闭"
                onClick={closeDialog}
                disabled={isDialogSubmitting}
              />
              <DialogActionButton
                label="确认修改"
                type="submit"
                actionType="primary"
                isLoading={isDialogSubmitting}
                disabled={changePasswordSubmitDisabled}
              />
            </div>
          </form>
        </Dialog>
      )}
      {activeDialog === "reset-password" && (
        <Dialog
          size="small"
          title="重置密码"
          onCloseRequest={closeDialog}
          className="backend-auth-native-dialog"
        >
          <form
            className="backend-auth-native-dialog__form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (resetUsernameError) {
                setDialogMessage(resetUsernameError);
                setDialogMessageType("error");
                return;
              }
              setIsDialogSubmitting(true);
              setDialogMessage("");
              try {
                const result = await auth.resetPassword(resetUsername);
                setDialogMessage(
                  `用户 ${result.username} 已重置为默认密码：${result.temporaryPassword}`,
                );
                setDialogMessageType("success");
              } catch (error) {
                setDialogMessage(
                  error instanceof Error ? error.message : "重置密码失败",
                );
                setDialogMessageType("error");
              } finally {
                setIsDialogSubmitting(false);
              }
            }}
          >
            <label className="backend-auth-native-dialog__label">
              <span>用户名</span>
              <input
                className="backend-auth-native-dialog__input"
                value={resetUsername}
                onChange={(event) => {
                  setResetUsername(event.target.value);
                  if (dialogMessage) {
                    setDialogMessage("");
                  }
                }}
                disabled={isDialogSubmitting}
                required
              />
            </label>
            <div className="backend-auth-native-dialog__hint">
              将直接把该账号密码重置为默认值 `Aa123456`，当前不做额外校验。
            </div>
            {dialogMessage && (
              <div
                className={`backend-auth-native-dialog__message backend-auth-native-dialog__message--${dialogMessageType}`}
              >
                {dialogMessage}
              </div>
            )}
            <div className="backend-auth-native-dialog__actions">
              <DialogActionButton
                label="关闭"
                onClick={closeDialog}
                disabled={isDialogSubmitting}
              />
              <DialogActionButton
                label="确认重置"
                type="submit"
                actionType="primary"
                isLoading={isDialogSubmitting}
                disabled={resetPasswordSubmitDisabled}
              />
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
