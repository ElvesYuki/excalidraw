import { useEffect, useRef, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";

import { useAuth } from "./AuthGate";
import {
  adminResetUserPassword,
  fetchAdminUsers,
  fetchMyScenes,
  updateAdminUserStatus,
} from "./api";

import type { AdminUserListItem, AuthSceneHistoryItem } from "./types";

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

const formatAdminUserTime = (value?: number) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getSceneDisplayName = (item: AuthSceneHistoryItem) =>
  item.sceneName?.trim() || item.roomId;

export const AuthUserMenu = () => {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<
    null | "admin-users" | "my-scenes" | "update-profile" | "change-password" | "reset-password"
  >(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUserListItem[]>([]);
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminUserStatusFilter, setAdminUserStatusFilter] = useState<
    "all" | "active" | "disabled"
  >("all");
  const [adminResetResult, setAdminResetResult] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);
  const [adminUsersMessage, setAdminUsersMessage] = useState("");
  const [isAdminUsersLoading, setIsAdminUsersLoading] = useState(false);
  const [adminActingUserId, setAdminActingUserId] = useState<number | null>(null);
  const [myScenes, setMyScenes] = useState<AuthSceneHistoryItem[]>([]);
  const [mySceneSearch, setMySceneSearch] = useState("");
  const [myScenesMessage, setMyScenesMessage] = useState("");
  const [isMyScenesLoading, setIsMyScenesLoading] = useState(false);
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
        setIsHistoryOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsHistoryOpen(false);
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
  const isAdmin = user.role.toLowerCase() === "admin";
  const displayName = user.displayName || user.username || "当前用户";
  const badgeLabel = displayName.trim().charAt(0).toUpperCase() || "U";
  const normalizedRole = user.role ? user.role.toUpperCase() : "MEMBER";

  const closeDialog = () => {
    setActiveDialog(null);
    setIsHistoryOpen(false);
    setEditingDisplayName("");
    setOldPassword("");
    setNewPassword("");
    setResetUsername("");
    setDialogMessage("");
    setDialogMessageType("info");
    setIsDialogSubmitting(false);
    setAdminUserSearch("");
    setAdminUserStatusFilter("all");
    setAdminResetResult(null);
    setAdminUsersMessage("");
    setAdminActingUserId(null);
    setMySceneSearch("");
    setMyScenesMessage("");
    setIsMyScenesLoading(false);
  };

  const loadAdminUsers = async () => {
    setIsAdminUsersLoading(true);
    setAdminUsersMessage("");
    setAdminResetResult(null);
    try {
      const result = await fetchAdminUsers();
      setAdminUsers(result.items);
    } catch (error) {
      setAdminUsersMessage(
        error instanceof Error ? error.message : "加载用户列表失败",
      );
    } finally {
      setIsAdminUsersLoading(false);
    }
  };

  const loadMyScenes = async () => {
    setIsMyScenesLoading(true);
    setMyScenesMessage("");
    try {
      const result = await fetchMyScenes();
      setMyScenes(result.items);
    } catch (error) {
      setMyScenesMessage(
        error instanceof Error ? error.message : "加载历史记录失败",
      );
    } finally {
      setIsMyScenesLoading(false);
    }
  };

  const changePasswordError = getChangePasswordError(oldPassword, newPassword);
  const resetUsernameError = getResetUsernameError(resetUsername);
  const updateProfileError = !editingDisplayName.trim() ? "请输入显示名称" : "";
  const changePasswordSubmitDisabled =
    isDialogSubmitting || Boolean(changePasswordError);
  const resetPasswordSubmitDisabled =
    isDialogSubmitting || Boolean(resetUsernameError);
  const updateProfileSubmitDisabled =
    isDialogSubmitting || Boolean(updateProfileError);
  const normalizedAdminUserSearch = adminUserSearch.trim().toLowerCase();
  const filteredAdminUsers = adminUsers.filter((item) => {
    if (
      adminUserStatusFilter !== "all" &&
      item.status !== adminUserStatusFilter
    ) {
      return false;
    }
    if (!normalizedAdminUserSearch) {
      return true;
    }
    const searchableText = [
      item.username,
      item.displayName,
      item.role,
      item.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchableText.includes(normalizedAdminUserSearch);
  });
  const normalizedMySceneSearch = mySceneSearch.trim().toLowerCase();
  const filteredMyScenes = myScenes.filter((item) => {
    if (!normalizedMySceneSearch) {
      return true;
    }
    const searchableText = [item.sceneName, item.roomId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchableText.includes(normalizedMySceneSearch);
  });

  return (
    <div className="backend-auth-userpanel" ref={menuRef}>
      <div className="backend-auth-userpanel__popover">
        <button
          className="backend-auth-userpanel__trigger backend-auth-userpanel__trigger--toolbar backend-auth-userpanel__trigger--history"
          type="button"
          aria-haspopup="menu"
          aria-expanded={isHistoryOpen}
          aria-label="历史"
          title="历史"
          onClick={async () => {
            const nextOpen = !isHistoryOpen;
            setIsOpen(false);
            setIsHistoryOpen(nextOpen);
            if (nextOpen) {
              await loadMyScenes();
            }
          }}
        >
          <span className="backend-auth-userpanel__trigger-text">历史</span>
        </button>
        {isHistoryOpen && (
          <div
            className="backend-auth-userpanel__menu backend-auth-userpanel__menu--history"
            role="menu"
          >
            <div className="backend-auth-userpanel__menu-header">
              <div className="backend-auth-userpanel__menu-name">历史</div>
              <div className="backend-auth-userpanel__menu-meta">
                最近创建或编辑的画布
              </div>
            </div>
            <label className="backend-auth-native-dialog__label">
              <span>搜索画布</span>
              <input
                className="backend-auth-native-dialog__input"
                type="text"
                value={mySceneSearch}
                onChange={(event) => setMySceneSearch(event.target.value)}
                placeholder="按画布名称或 roomId 搜索"
              />
            </label>
            {myScenesMessage && (
              <div className="backend-auth-native-dialog__message backend-auth-native-dialog__message--error">
                {myScenesMessage}
              </div>
            )}
            <div className="backend-auth-history-panel__list">
              {filteredMyScenes.map((item) => (
                <button
                  key={item.sceneRecordId}
                  className="backend-auth-history-panel__item"
                  type="button"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    const collabHash = item.roomKey?.trim()
                      ? `/#room=${encodeURIComponent(item.roomId)},${encodeURIComponent(item.roomKey)}`
                      : `/#room=${encodeURIComponent(item.roomId)}`;
                    window.location.assign(collabHash);
                  }}
                >
                  <span className="backend-auth-history-panel__name">
                    {getSceneDisplayName(item)}
                  </span>
                  <span className="backend-auth-history-panel__meta">
                    roomId {item.roomId}
                  </span>
                  <span className="backend-auth-history-panel__meta">
                    更新：{formatAdminUserTime(item.updatedAt)}
                  </span>
                </button>
              ))}
              {!isMyScenesLoading && filteredMyScenes.length === 0 && !myScenesMessage && (
                <div className="backend-auth-native-dialog__hint">
                  {myScenes.length === 0
                    ? "你还没有可展示的历史记录。"
                    : "没有匹配的画布，请换个关键词试试。"}
                </div>
              )}
              {isMyScenesLoading && (
                <div className="backend-auth-native-dialog__hint">历史记录加载中...</div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="backend-auth-userpanel__popover">
      <button
        className="backend-auth-userpanel__trigger backend-auth-userpanel__trigger--toolbar"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`当前用户：${displayName}`}
        title={displayName}
        onClick={() => {
          setIsHistoryOpen(false);
          setIsOpen((open) => !open);
        }}
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
            {isAdmin && (
              <button
                className="backend-auth-userpanel__secondary"
                type="button"
                onClick={async () => {
                  setIsOpen(false);
                  setActiveDialog("admin-users");
                  await loadAdminUsers();
                }}
              >
                用户管理
              </button>
            )}
            <button
              className="backend-auth-userpanel__secondary"
              type="button"
              onClick={() => {
                setIsOpen(false);
                setDialogMessage("");
                setEditingDisplayName(
                  displayName || user.displayName || user.username,
                );
                setActiveDialog("update-profile");
              }}
            >
              修改昵称
            </button>
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
      </div>
      {activeDialog === "my-scenes" && (
        <Dialog
          size="small"
          title="我的历史"
          onCloseRequest={closeDialog}
          className="backend-auth-native-dialog"
        >
          <div className="backend-auth-native-dialog__form">
            <div className="backend-auth-admin-dialog__toolbar">
              <div className="backend-auth-native-dialog__hint">
                这里展示你最近创建或编辑过的画布记录。
              </div>
              <DialogActionButton
                label={isMyScenesLoading ? "刷新中..." : "刷新"}
                actionType="primary"
                onClick={() => void loadMyScenes()}
                disabled={isMyScenesLoading}
              />
            </div>
            <label className="backend-auth-native-dialog__label">
              <span>搜索画布</span>
              <input
                className="backend-auth-native-dialog__input"
                type="text"
                value={mySceneSearch}
                onChange={(event) => setMySceneSearch(event.target.value)}
                placeholder="按画布名称或 roomId 搜索"
              />
            </label>
            {myScenesMessage && (
              <div className="backend-auth-native-dialog__message backend-auth-native-dialog__message--error">
                {myScenesMessage}
              </div>
            )}
            <div className="backend-auth-history-dialog__list">
              {filteredMyScenes.map((item) => (
                <div
                  key={item.sceneRecordId}
                  className="backend-auth-history-dialog__item"
                >
                  <div className="backend-auth-history-dialog__identity">
                    <div className="backend-auth-history-dialog__room">
                      {getSceneDisplayName(item)}
                    </div>
                    <div className="backend-auth-history-dialog__summary">
                      <span className="backend-auth-history-dialog__meta">
                        roomId {item.roomId}
                      </span>
                      <span className="backend-auth-history-dialog__meta">
                        版本 {item.version}
                      </span>
                      <span className="backend-auth-history-dialog__meta">
                        大小 {Math.max(1, Math.round(item.size / 1024))} KB
                      </span>
                      <span className="backend-auth-history-dialog__meta">
                        更新：{formatAdminUserTime(item.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="backend-auth-userpanel__secondary backend-auth-history-dialog__open"
                    type="button"
                    onClick={() => {
                      window.location.assign(`/#room=${encodeURIComponent(item.roomId)}`);
                    }}
                  >
                    打开
                  </button>
                </div>
              ))}
              {!isMyScenesLoading && filteredMyScenes.length === 0 && !myScenesMessage && (
                <div className="backend-auth-native-dialog__hint">
                  {myScenes.length === 0
                    ? "你还没有可展示的历史记录。"
                    : "没有匹配的画布，请换个关键词试试。"}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {activeDialog === "admin-users" && (
        <Dialog
          size="wide"
          title="用户管理"
          onCloseRequest={closeDialog}
          className="backend-auth-native-dialog backend-auth-admin-dialog"
        >
          <div className="backend-auth-native-dialog__form">
            <div className="backend-auth-admin-dialog__toolbar">
              <div className="backend-auth-native-dialog__hint">
                仅管理员可查看与操作用户列表。
              </div>
              <DialogActionButton
                label={isAdminUsersLoading ? "刷新中..." : "刷新"}
                actionType="primary"
                onClick={() => void loadAdminUsers()}
                disabled={isAdminUsersLoading}
              />
            </div>
            <label className="backend-auth-native-dialog__label">
              <span>搜索用户</span>
              <input
                className="backend-auth-native-dialog__input"
                type="text"
                value={adminUserSearch}
                onChange={(event) => setAdminUserSearch(event.target.value)}
                placeholder="按用户名、显示名、角色或状态筛选"
              />
            </label>
            <label className="backend-auth-native-dialog__label">
              <span>状态筛选</span>
              <select
                className="backend-auth-native-dialog__input backend-auth-native-dialog__select"
                value={adminUserStatusFilter}
                onChange={(event) =>
                  setAdminUserStatusFilter(
                    event.target.value as "all" | "active" | "disabled",
                  )
                }
              >
                <option value="all">全部</option>
                <option value="active">只看 active</option>
                <option value="disabled">只看 disabled</option>
              </select>
            </label>
            {adminUsersMessage && (
              <div
                className={`backend-auth-native-dialog__message ${
                  adminUsersMessage.includes("已复制")
                    ? "backend-auth-native-dialog__message--success"
                    : "backend-auth-native-dialog__message--error"
                }`}
              >
                {adminUsersMessage}
              </div>
            )}
            {adminResetResult && (
              <div className="backend-auth-admin-dialog__result">
                <div className="backend-auth-admin-dialog__result-title">
                  已重置用户 {adminResetResult.username} 的密码
                </div>
                <div className="backend-auth-admin-dialog__result-row">
                  <code className="backend-auth-admin-dialog__result-code">
                    {adminResetResult.temporaryPassword}
                  </code>
                  <button
                    className="backend-auth-userpanel__secondary backend-auth-admin-dialog__copy"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          adminResetResult.temporaryPassword,
                        );
                        setAdminUsersMessage("临时密码已复制到剪贴板");
                      } catch (error) {
                        setAdminUsersMessage(
                          error instanceof Error
                            ? error.message
                            : "复制临时密码失败",
                        );
                      }
                    }}
                  >
                    复制密码
                  </button>
                </div>
              </div>
            )}
            <div className="backend-auth-admin-dialog__list">
              {filteredAdminUsers.map((item) => {
                const isActing = adminActingUserId === item.userId;
                const isCurrentUser = item.userId === user.userId;
                const nextStatus = item.status === "active" ? "disabled" : "active";
                const disableStatusAction = isActing || isCurrentUser;

                return (
                  <div
                    key={item.userId}
                    className="backend-auth-admin-dialog__item"
                  >
                    <div className="backend-auth-admin-dialog__identity">
                      <div className="backend-auth-admin-dialog__name">
                        {item.displayName || item.username}
                        {isCurrentUser && (
                          <span className="backend-auth-admin-dialog__current-badge">
                            当前账号
                          </span>
                        )}
                      </div>
                      <div className="backend-auth-admin-dialog__summary">
                        <span className="backend-auth-admin-dialog__meta">
                          {item.username}
                        </span>
                        <span className="backend-auth-admin-dialog__badge">
                          {item.role}
                        </span>
                        <span
                          className={`backend-auth-admin-dialog__badge ${
                            item.status === "active"
                              ? "backend-auth-admin-dialog__badge--success"
                              : "backend-auth-admin-dialog__badge--muted"
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="backend-auth-admin-dialog__meta">
                          创建：{formatAdminUserTime(item.createdAt)}
                        </span>
                        <span className="backend-auth-admin-dialog__meta">
                          更新：{formatAdminUserTime(item.updatedAt)}
                        </span>
                      </div>
                      {isCurrentUser && (
                        <div className="backend-auth-admin-dialog__tip">
                          当前账号不可禁用
                        </div>
                      )}
                    </div>
                    <div className="backend-auth-admin-dialog__item-actions">
                      <button
                        className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action"
                        type="button"
                        disabled={disableStatusAction}
                        title={
                          isCurrentUser
                            ? "当前账号不可禁用"
                            : undefined
                        }
                        onClick={async () => {
                          setAdminActingUserId(item.userId);
                          setAdminUsersMessage("");
                          try {
                            const updated = await updateAdminUserStatus(
                              item.userId,
                              nextStatus as "active" | "disabled",
                            );
                            setAdminUsers((prev) =>
                              prev.map((userItem) =>
                                userItem.userId === updated.userId ? updated : userItem,
                              ),
                            );
                          } catch (error) {
                            setAdminUsersMessage(
                              error instanceof Error
                                ? error.message
                                : "更新用户状态失败",
                            );
                          } finally {
                            setAdminActingUserId(null);
                          }
                        }}
                      >
                        {item.status === "active" ? "禁用" : "启用"}
                      </button>
                      <button
                        className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action"
                        type="button"
                        disabled={isActing}
                        onClick={async () => {
                          setAdminActingUserId(item.userId);
                          setAdminUsersMessage("");
                          setAdminResetResult(null);
                          try {
                            const result = await adminResetUserPassword(item.userId);
                            setAdminUsers((prev) =>
                              prev.map((userItem) =>
                                userItem.userId === result.user.userId
                                  ? result.user
                                  : userItem,
                              ),
                            );
                            setAdminResetResult({
                              username: result.user.username,
                              temporaryPassword: result.temporaryPassword,
                            });
                          } catch (error) {
                            setAdminUsersMessage(
                              error instanceof Error
                                ? error.message
                                : "重置用户密码失败",
                            );
                          } finally {
                            setAdminActingUserId(null);
                          }
                        }}
                      >
                        重置密码
                      </button>
                    </div>
                  </div>
                );
              })}
              {!isAdminUsersLoading &&
                filteredAdminUsers.length === 0 &&
                !adminUsersMessage && (
                <div className="backend-auth-native-dialog__hint">
                  {adminUsers.length === 0
                    ? "当前还没有可管理的用户记录。"
                    : "没有匹配的用户，请换个关键词试试。"}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {activeDialog === "update-profile" && (
        <Dialog
          size="small"
          title="修改昵称"
          onCloseRequest={closeDialog}
          className="backend-auth-native-dialog"
        >
          <form
            className="backend-auth-native-dialog__form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (updateProfileError) {
                setDialogMessage(updateProfileError);
                setDialogMessageType("error");
                return;
              }
              setIsDialogSubmitting(true);
              setDialogMessage("");
              try {
                await auth.updateProfile(editingDisplayName);
                setDialogMessage("昵称修改成功");
                setDialogMessageType("success");
              } catch (error) {
                setDialogMessage(
                  error instanceof Error ? error.message : "修改昵称失败",
                );
                setDialogMessageType("error");
              } finally {
                setIsDialogSubmitting(false);
              }
            }}
          >
            <label className="backend-auth-native-dialog__label">
              <span>显示名称</span>
              <input
                className="backend-auth-native-dialog__input"
                type="text"
                autoFocus
                value={editingDisplayName}
                onChange={(event) => setEditingDisplayName(event.target.value)}
                placeholder="请输入显示名称"
              />
            </label>
            {updateProfileError && (
              <div className="backend-auth-native-dialog__field-error">
                {updateProfileError}
              </div>
            )}
            {dialogMessage && (
              <div
                className={`backend-auth-native-dialog__message backend-auth-native-dialog__message--${dialogMessageType}`}
              >
                {dialogMessage}
              </div>
            )}
            <div className="backend-auth-native-dialog__actions">
              <DialogActionButton
                label="取消"
                actionType="primary"
                onClick={closeDialog}
              />
              <DialogActionButton
                label={isDialogSubmitting ? "提交中..." : "保存"}
                actionType="primary"
                onClick={() => undefined}
                type="submit"
                disabled={updateProfileSubmitDisabled}
              />
            </div>
          </form>
        </Dialog>
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
