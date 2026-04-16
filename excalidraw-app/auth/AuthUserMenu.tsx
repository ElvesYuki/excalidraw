import { useEffect, useRef, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";

import { useAuth } from "./AuthGate";
import {
  createUserScene,
  adminResetUserPassword,
  fetchAdminUsers,
  fetchMyScenes,
  fetchUserScenes,
  openSceneCollab,
  renameUserScene,
  setUserSceneFavorite,
  updateAdminUserStatus,
} from "./api";
import { buildSceneCollabUrl } from "./sceneSession";
import { fetchSceneDetail } from "../scene/api";

import type {
  AdminUserListItem,
  AuthSceneHistoryItem,
  SceneDetailRecord,
  SceneRecord,
} from "./types";

import "./AuthGate.scss";

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 8;
const USER_SCENES_SORT_STORAGE_KEY = "backend-user-scenes-sort";
const USER_SCENES_STATUS_FILTER_STORAGE_KEY =
  "backend-user-scenes-status-filter";

const readStoredUserScenesSort = () => {
  try {
    const value = window.localStorage.getItem(USER_SCENES_SORT_STORAGE_KEY);
    if (
      value === "recent-opened" ||
      value === "favorite-first" ||
      value === "recent-updated" ||
      value === "name"
    ) {
      return value;
    }
  } catch {
    // ignore localStorage read failures
  }
  return "recent-opened" as const;
};

const readStoredUserScenesStatusFilter = () => {
  try {
    const value = window.localStorage.getItem(
      USER_SCENES_STATUS_FILTER_STORAGE_KEY,
    );
    if (
      value === "all" ||
      value === "favorite" ||
      value === "collab-enabled" ||
      value === "collab-disabled"
    ) {
      return value;
    }
  } catch {
    // ignore localStorage read failures
  }
  return "all" as const;
};

const getChangePasswordError = (oldPassword: string, newPassword: string) => {
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

const getRecentSceneTimeInfo = (scene: SceneRecord) => {
  const recentOpenedAt = scene.lastOpenedAt || scene.lastActivatedAt;
  if (!recentOpenedAt) {
    return {
      label: "未打开",
      detail: "还没有打开记录",
    };
  }
  const diff = Date.now() - recentOpenedAt;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const threeDays = 3 * oneDay;

  if (diff < 10 * 60 * 1000) {
    return {
      label: "刚刚打开",
      detail: formatAdminUserTime(recentOpenedAt),
    };
  }
  if (diff < oneHour) {
    return {
      label: "1 小时内打开",
      detail: formatAdminUserTime(recentOpenedAt),
    };
  }
  if (diff < oneDay) {
    return {
      label: "今天打开过",
      detail: formatAdminUserTime(recentOpenedAt),
    };
  }
  if (diff < threeDays) {
    return {
      label: "最近 3 天打开过",
      detail: formatAdminUserTime(recentOpenedAt),
    };
  }
  return {
    label: "最近打开过",
    detail: formatAdminUserTime(recentOpenedAt),
  };
};

const getSceneDisplayName = (item: AuthSceneHistoryItem) =>
  item.sceneName?.trim() || item.roomId;

const isHistoryItemReadonly = (item: AuthSceneHistoryItem) =>
  !item.canOpenCollab;

const getHistoryGroupSummary = (
  items: AuthSceneHistoryItem[],
  emptyLabel: string,
) => {
  if (items.length === 0) {
    return emptyLabel;
  }
  const openableCount = items.filter((item) => item.canOpenCollab).length;
  if (openableCount === items.length) {
    return `${items.length} 个可快速切换`;
  }
  if (openableCount === 0) {
    return `${items.length} 个只读记录`;
  }
  return `${openableCount} 个可切换，${items.length - openableCount} 个只读`;
};

const getHistoryTimeLabel = (item: AuthSceneHistoryItem) =>
  formatAdminUserTime(item.lastVisitedAt || item.updatedAt);

const getHistorySourceLabel = (item: AuthSceneHistoryItem) =>
  item.historySource === "owned" ? "我的画布" : "协作参与";

const getSceneAccessErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const normalized = error.message.trim().toLowerCase();
  if (
    normalized.includes("forbidden") ||
    normalized.includes("无权") ||
    normalized.includes("权限")
  ) {
    return "你当前无权访问这个画布，已请使用仍可访问的画布继续操作。";
  }
  if (normalized.includes("not found") || normalized.includes("不存在")) {
    return "这个画布已经不存在或已失效，请换一个画布试试。";
  }
  return error.message || fallback;
};

type AuthUserMenuProps = {
  onSceneReady?: (scene: SceneRecord) => void;
  currentSceneId?: number | null;
  onSceneDetailRequest?: (scene: SceneDetailRecord) => void;
  onSceneDialogOpen?: () => void;
  sceneDetailSnapshot?: SceneDetailRecord | null;
  sceneSnapshot?: SceneRecord | null;
};

export const AuthUserMenu = ({
  onSceneReady,
  currentSceneId,
  onSceneDetailRequest,
  onSceneDialogOpen,
  sceneDetailSnapshot,
  sceneSnapshot,
}: AuthUserMenuProps) => {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<
    | null
    | "admin-users"
    | "user-scenes"
    | "update-profile"
    | "change-password"
    | "reset-password"
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
  const [adminActingUserId, setAdminActingUserId] = useState<number | null>(
    null,
  );
  const [myScenes, setMyScenes] = useState<AuthSceneHistoryItem[]>([]);
  const [userScenes, setUserScenes] = useState<SceneRecord[]>([]);
  const [userScenesSearch, setUserScenesSearch] = useState("");
  const [userScenesSort, setUserScenesSort] = useState<
    "recent-opened" | "favorite-first" | "recent-updated" | "name"
  >(readStoredUserScenesSort);
  const [userScenesStatusFilter, setUserScenesStatusFilter] = useState<
    "all" | "favorite" | "collab-enabled" | "collab-disabled"
  >(readStoredUserScenesStatusFilter);
  const [userScenesMessage, setUserScenesMessage] = useState("");
  const [isUserScenesLoading, setIsUserScenesLoading] = useState(false);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [editingSceneName, setEditingSceneName] = useState("");
  const [recentlyOpenedSceneId, setRecentlyOpenedSceneId] = useState<
    number | null
  >(null);
  const [recentlyVisitedHistorySceneId, setRecentlyVisitedHistorySceneId] =
    useState<number | null>(null);
  const [mySceneSearch, setMySceneSearch] = useState("");
  const [myScenesMessage, setMyScenesMessage] = useState("");
  const [isMyScenesLoading, setIsMyScenesLoading] = useState(false);
  const [openingSceneId, setOpeningSceneId] = useState<number | null>(null);
  const [openingSceneDetailId, setOpeningSceneDetailId] = useState<number | null>(
    null,
  );
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogMessageType, setDialogMessageType] = useState<
    "success" | "error" | "info"
  >("info");
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen && !isHistoryOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".Dialog")) {
        return;
      }
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
  }, [isHistoryOpen, isOpen]);

  useEffect(() => {
    if (!recentlyOpenedSceneId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyOpenedSceneId(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlyOpenedSceneId]);

  useEffect(() => {
    if (!recentlyVisitedHistorySceneId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyVisitedHistorySceneId(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlyVisitedHistorySceneId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        USER_SCENES_SORT_STORAGE_KEY,
        userScenesSort,
      );
    } catch {
      // ignore localStorage write failures
    }
  }, [userScenesSort]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        USER_SCENES_STATUS_FILTER_STORAGE_KEY,
        userScenesStatusFilter,
      );
    } catch {
      // ignore localStorage write failures
    }
  }, [userScenesStatusFilter]);

  useEffect(() => {
    if (!sceneDetailSnapshot) {
      return;
    }

    setUserScenes((prev) =>
      prev.map((item) =>
        item.sceneId === sceneDetailSnapshot.sceneId
          ? {
              ...item,
              sceneName: sceneDetailSnapshot.sceneName,
              collabAccessMode: sceneDetailSnapshot.collabAccessMode,
              currentRoomId: sceneDetailSnapshot.currentRoomId,
              isCollabEnabled: sceneDetailSnapshot.isCollabEnabled,
              isFavorite: sceneDetailSnapshot.isFavorite,
              latestSceneRecordId: sceneDetailSnapshot.latestSceneRecordId,
              lastActivatedAt: sceneDetailSnapshot.lastActivatedAt,
              lastOpenedAt: sceneDetailSnapshot.lastOpenedAt,
              updatedAt: sceneDetailSnapshot.updatedAt,
              memberCount: sceneDetailSnapshot.memberCount,
            }
          : item,
      ),
    );
  }, [sceneDetailSnapshot]);

  useEffect(() => {
    if (!sceneSnapshot) {
      return;
    }

    setUserScenes((prev) =>
      prev.map((item) =>
        item.sceneId === sceneSnapshot.sceneId
          ? {
              ...item,
              ...sceneSnapshot,
            }
          : item,
      ),
    );

    setMyScenes((prev) =>
      prev.map((item) =>
        item.sceneId === sceneSnapshot.sceneId
          ? {
              ...item,
              sceneName: sceneSnapshot.sceneName,
              isFavorite: sceneSnapshot.isFavorite,
              isCollabEnabled: sceneSnapshot.isCollabEnabled,
              updatedAt: sceneSnapshot.updatedAt,
              lastVisitedAt:
                sceneSnapshot.lastOpenedAt ||
                sceneSnapshot.lastActivatedAt ||
                item.lastVisitedAt,
              canOpenCollab:
                item.canOpenCollab ||
                Boolean(sceneSnapshot.currentRoomId || sceneSnapshot.isCollabEnabled),
            }
          : item,
      ),
    );
  }, [sceneSnapshot]);

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
    setUserScenesSearch("");
    setUserScenesSort("recent-opened");
    setUserScenesStatusFilter("all");
    setUserScenesMessage("");
    setIsUserScenesLoading(false);
    setIsCreatingScene(false);
    setEditingSceneId(null);
    setEditingSceneName("");
    setMyScenesMessage("");
    setIsMyScenesLoading(false);
    setOpeningSceneId(null);
    setOpeningSceneDetailId(null);
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

  const loadUserScenes = async () => {
    setIsUserScenesLoading(true);
    setUserScenesMessage("");
    try {
      const result = await fetchUserScenes();
      setUserScenes(result.items);
    } catch (error) {
      setUserScenesMessage(
        error instanceof Error ? error.message : "加载我的画布失败",
      );
    } finally {
      setIsUserScenesLoading(false);
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
  const normalizedUserScenesSearch = userScenesSearch.trim().toLowerCase();
  const filteredMyScenes = myScenes.filter((item) => {
    if (!normalizedMySceneSearch) {
      return true;
    }
    const searchableText = [
      item.sceneName,
      item.roomId,
      item.historySource === "owned" ? "我的" : "协作参与",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchableText.includes(normalizedMySceneSearch);
  });
  const ownedHistoryScenes = filteredMyScenes.filter(
    (item) => item.historySource === "owned",
  );
  const collabHistoryScenes = filteredMyScenes.filter(
    (item) => item.historySource !== "owned",
  );
  const filteredUserScenes = userScenes
    .filter((item) => {
      if (
        userScenesStatusFilter === "favorite" &&
        !item.isFavorite
      ) {
        return false;
      }
      if (
        userScenesStatusFilter === "collab-enabled" &&
        !item.isCollabEnabled
      ) {
        return false;
      }
      if (
        userScenesStatusFilter === "collab-disabled" &&
        item.isCollabEnabled
      ) {
        return false;
      }
      if (!normalizedUserScenesSearch) {
        return true;
      }
      const searchableText = [
        item.sceneName,
        item.currentRoomId,
        String(item.sceneId),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedUserScenesSearch);
    })
    .sort((left, right) => {
      if (userScenesSort === "favorite-first") {
        if (left.isFavorite !== right.isFavorite) {
          return left.isFavorite ? -1 : 1;
        }
      }

      if (userScenesSort === "name") {
        const compareResult = (left.sceneName || "").localeCompare(
          right.sceneName || "",
          "zh-CN",
          {
            numeric: true,
            sensitivity: "base",
          },
        );
        if (compareResult !== 0) {
          return compareResult;
        }
      }

      if (userScenesSort === "recent-updated") {
        if (right.updatedAt !== left.updatedAt) {
          return right.updatedAt - left.updatedAt;
        }
      }

      const leftOpenedAt = left.lastOpenedAt || left.lastActivatedAt || 0;
      const rightOpenedAt = right.lastOpenedAt || right.lastActivatedAt || 0;
      if (rightOpenedAt !== leftOpenedAt) {
        return rightOpenedAt - leftOpenedAt;
      }
      if (right.updatedAt !== left.updatedAt) {
        return right.updatedAt - left.updatedAt;
      }
      return right.sceneId - left.sceneId;
    });

  const openUserScene = async (scene: SceneRecord) => {
    setOpeningSceneId(scene.sceneId);
    setUserScenesMessage("");
    try {
      const collabRoom = await openSceneCollab(scene.sceneId);
      const openedAt = Date.now();
      const nextScene: SceneRecord = {
        ...scene,
        sceneName: collabRoom.sceneName || scene.sceneName,
        currentRoomId: collabRoom.roomId,
        isCollabEnabled: true,
        lastActivatedAt: openedAt,
        lastOpenedAt: openedAt,
      };
      setUserScenes((prev) =>
        prev.map((item) => (item.sceneId === nextScene.sceneId ? nextScene : item)),
      );
      setRecentlyOpenedSceneId(nextScene.sceneId);
      onSceneReady?.(nextScene);
      setActiveDialog(null);
      window.location.assign(
        buildSceneCollabUrl({
          sceneId: collabRoom.sceneId,
          roomId: collabRoom.roomId,
          roomKey: collabRoom.roomKey,
        }),
      );
    } catch (error) {
      setUserScenesMessage(getSceneAccessErrorMessage(error, "打开画布失败"));
    } finally {
      setOpeningSceneId(null);
    }
  };

  const createAndOpenScene = async () => {
    setIsCreatingScene(true);
    setUserScenesMessage("");
    try {
      const createdScene = await createUserScene("未命名画布");
      setUserScenes((prev) => [createdScene, ...prev]);
      onSceneReady?.(createdScene);
      await openUserScene(createdScene);
    } catch (error) {
      setUserScenesMessage(
        error instanceof Error ? error.message : "新建画布失败",
      );
    } finally {
      setIsCreatingScene(false);
    }
  };

  const renameScene = async () => {
    const normalizedSceneName = editingSceneName.trim();
    if (!editingSceneId) {
      return;
    }
    if (!normalizedSceneName) {
      setUserScenesMessage("请输入画布名称");
      return;
    }

    setIsDialogSubmitting(true);
    setUserScenesMessage("");
    try {
      const updatedScene = await renameUserScene(
        editingSceneId,
        normalizedSceneName,
      );
      setUserScenes((prev) =>
        prev.map((item) =>
          item.sceneId === updatedScene.sceneId ? updatedScene : item,
        ),
      );
      onSceneReady?.(updatedScene);
      setEditingSceneId(null);
      setEditingSceneName("");
      setUserScenesMessage("画布名称已更新");
    } catch (error) {
      setUserScenesMessage(
        error instanceof Error ? error.message : "修改画布名称失败",
      );
    } finally {
      setIsDialogSubmitting(false);
    }
  };

  const openSceneFromHistory = async (item: AuthSceneHistoryItem) => {
    const fallbackSceneId = item.sceneId > 0 ? item.sceneId : null;
    setOpeningSceneId(fallbackSceneId ?? item.sceneRecordId);
    setMyScenesMessage("");
    try {
      if (!fallbackSceneId) {
        const roomHash = item.roomKey
          ? `#room=${encodeURIComponent(item.roomId)},${encodeURIComponent(
              item.roomKey,
            )}`
          : `#room=${encodeURIComponent(item.roomId)}`;
        window.location.assign(`/${roomHash}`);
        return;
      }

      const collabRoom = await openSceneCollab(item.sceneId);
      const openedAt = Date.now();
      setRecentlyVisitedHistorySceneId(item.sceneId);
      setRecentlyOpenedSceneId(item.sceneId);
      setMyScenes((prev) =>
        prev.map((historyItem) =>
          historyItem.sceneId === item.sceneId
            ? {
                ...historyItem,
                sceneName: collabRoom.sceneName || historyItem.sceneName,
                roomId: collabRoom.roomId || historyItem.roomId,
                canOpenCollab: true,
                isCollabEnabled: true,
                lastVisitedAt: openedAt,
                updatedAt: Math.max(historyItem.updatedAt, openedAt),
              }
            : historyItem,
        ),
      );
      setUserScenes((prev) =>
        prev.map((scene) =>
          scene.sceneId === item.sceneId
            ? {
                ...scene,
                sceneName: collabRoom.sceneName || scene.sceneName,
                currentRoomId: collabRoom.roomId,
                isCollabEnabled: true,
                lastActivatedAt: openedAt,
                lastOpenedAt: openedAt,
                updatedAt: Math.max(scene.updatedAt, openedAt),
              }
            : scene,
        ),
      );
      setActiveDialog(null);
      onSceneReady?.({
        sceneId: collabRoom.sceneId,
        ownerUserId: 0,
        sceneName: collabRoom.sceneName,
        status: "active",
        collabAccessMode: "private",
        currentRoomId: collabRoom.roomId,
        isCollabEnabled: true,
        isFavorite: false,
        memberCount: 0,
        latestSceneRecordId: item.sceneRecordId,
        createdAt: item.createdAt,
        updatedAt: Math.max(item.updatedAt, openedAt),
        lastActivatedAt: openedAt,
        lastOpenedAt: openedAt,
      });
      window.location.assign(
        buildSceneCollabUrl({
          sceneId: collabRoom.sceneId,
          roomId: collabRoom.roomId,
          roomKey: collabRoom.roomKey,
        }),
      );
    } catch (error) {
      setMyScenesMessage(getSceneAccessErrorMessage(error, "打开协作房间失败"));
    } finally {
      setOpeningSceneId(null);
    }
  };

  const openSceneDetailFromList = async (sceneId: number) => {
    if (!onSceneDetailRequest || !onSceneDialogOpen) {
      return;
    }
    setOpeningSceneDetailId(sceneId);
    setUserScenesMessage("");
    try {
      const sceneDetail = await fetchSceneDetail(sceneId);
      onSceneDetailRequest(sceneDetail);
      onSceneDialogOpen();
      setActiveDialog(null);
    } catch (error) {
      setUserScenesMessage(
        error instanceof Error ? error.message : "加载画布详情失败",
      );
    } finally {
      setOpeningSceneDetailId(null);
    }
  };

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
            </div>
            <label className="backend-auth-native-dialog__label">
              <input
                className="backend-auth-native-dialog__input"
                type="text"
                value={mySceneSearch}
                onChange={(event) => setMySceneSearch(event.target.value)}
                placeholder="搜索画布名称或 roomId"
              />
            </label>
            {myScenesMessage && (
              <div className="backend-auth-native-dialog__message backend-auth-native-dialog__message--error">
                {myScenesMessage}
              </div>
            )}
            <div className="backend-auth-history-panel__list">
              {ownedHistoryScenes.length > 0 && (
                <div className="backend-auth-history-panel__group">
                  <div className="backend-auth-history-panel__group-header">
                    <div className="backend-auth-history-panel__group-title">
                      我的画布
                    </div>
                    <div className="backend-auth-history-panel__group-meta">
                      {getHistoryGroupSummary(
                        ownedHistoryScenes,
                        "还没有我的画布记录",
                      )}
                    </div>
                  </div>
                  {ownedHistoryScenes.map((item) => {
                    const isReadonly = isHistoryItemReadonly(item);
                    return (
                      <button
                        key={item.sceneRecordId}
                        className={`backend-auth-history-panel__item ${
                          item.historySource === "owned"
                            ? "backend-auth-history-panel__item--owned"
                            : "backend-auth-history-panel__item--collab"
                        } ${
                          recentlyVisitedHistorySceneId === item.sceneId
                            ? "backend-auth-history-panel__item--highlighted"
                            : ""
                        } ${
                          isReadonly
                            ? "backend-auth-history-panel__item--readonly"
                            : ""
                        }`}
                        type="button"
                        disabled={isReadonly || openingSceneId === item.sceneId}
                        onClick={() => void openSceneFromHistory(item)}
                      >
                        <div className="backend-auth-history-panel__item-head">
                          <span className="backend-auth-history-panel__name">
                            {getSceneDisplayName(item)}
                          </span>
                          <div className="backend-auth-history-panel__badges">
                            <span
                              className={`backend-auth-history-panel__badge ${
                                item.historySource === "owned"
                                  ? "backend-auth-history-panel__badge--owned"
                                  : "backend-auth-history-panel__badge--collab"
                              }`}
                            >
                              {getHistorySourceLabel(item)}
                            </span>
                            <span
                              className={`backend-auth-history-panel__badge ${
                                isReadonly
                                  ? "backend-auth-history-panel__badge--readonly"
                                  : "backend-auth-history-panel__badge--openable"
                              }`}
                            >
                              {isReadonly ? "只读" : "可打开"}
                            </span>
                            {item.historySource === "owned" &&
                              item.isFavorite && (
                                <span className="backend-auth-history-panel__badge backend-auth-history-panel__badge--favorite">
                                  收藏
                                </span>
                              )}
                            {item.historySource === "owned" &&
                              item.isCollabEnabled && (
                                <span className="backend-auth-history-panel__badge backend-auth-history-panel__badge--active">
                                  协作中
                                </span>
                              )}
                          </div>
                        </div>
                        <span className="backend-auth-history-panel__meta">
                          roomId {item.roomId || "未绑定"}
                        </span>
                        <div className="backend-auth-history-panel__foot">
                          <span className="backend-auth-history-panel__meta backend-auth-history-panel__meta--time">
                            {openingSceneId === item.sceneId
                              ? "正在切换..."
                              : `最近访问 ${getHistoryTimeLabel(item)}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {collabHistoryScenes.length > 0 && (
                <div className="backend-auth-history-panel__group">
                  <div className="backend-auth-history-panel__group-header">
                    <div className="backend-auth-history-panel__group-title">
                      协作参与
                    </div>
                    <div className="backend-auth-history-panel__group-meta">
                      {getHistoryGroupSummary(
                        collabHistoryScenes,
                        "还没有协作参与记录",
                      )}
                    </div>
                  </div>
                  {collabHistoryScenes.map((item) => {
                    const isReadonly = isHistoryItemReadonly(item);
                    return (
                      <button
                        key={item.sceneRecordId}
                        className={`backend-auth-history-panel__item ${
                          item.historySource === "owned"
                            ? "backend-auth-history-panel__item--owned"
                            : "backend-auth-history-panel__item--collab"
                        } ${
                          recentlyVisitedHistorySceneId === item.sceneId
                            ? "backend-auth-history-panel__item--highlighted"
                            : ""
                        } ${
                          isReadonly
                            ? "backend-auth-history-panel__item--readonly"
                            : ""
                        }`}
                        type="button"
                        disabled={isReadonly || openingSceneId === item.sceneId}
                        onClick={() => void openSceneFromHistory(item)}
                      >
                        <div className="backend-auth-history-panel__item-head">
                          <span className="backend-auth-history-panel__name">
                            {getSceneDisplayName(item)}
                          </span>
                          <div className="backend-auth-history-panel__badges">
                            <span
                              className={`backend-auth-history-panel__badge ${
                                item.historySource === "owned"
                                  ? "backend-auth-history-panel__badge--owned"
                                  : "backend-auth-history-panel__badge--collab"
                              }`}
                            >
                              {getHistorySourceLabel(item)}
                            </span>
                            <span
                              className={`backend-auth-history-panel__badge ${
                                isReadonly
                                  ? "backend-auth-history-panel__badge--readonly"
                                  : "backend-auth-history-panel__badge--openable"
                              }`}
                            >
                              {isReadonly ? "只读" : "可打开"}
                            </span>
                            {item.historySource === "owned" &&
                              item.isFavorite && (
                                <span className="backend-auth-history-panel__badge backend-auth-history-panel__badge--favorite">
                                  收藏
                                </span>
                              )}
                            {item.historySource === "owned" &&
                              item.isCollabEnabled && (
                                <span className="backend-auth-history-panel__badge backend-auth-history-panel__badge--active">
                                  协作中
                                </span>
                              )}
                          </div>
                        </div>
                        <span className="backend-auth-history-panel__meta">
                          roomId {item.roomId || "未绑定"}
                        </span>
                        <div className="backend-auth-history-panel__foot">
                          <span className="backend-auth-history-panel__meta backend-auth-history-panel__meta--time">
                            {openingSceneId === item.sceneId
                              ? "正在切换..."
                              : `最近访问 ${getHistoryTimeLabel(item)}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {!isMyScenesLoading &&
                filteredMyScenes.length === 0 &&
                !myScenesMessage && (
                  <div className="backend-auth-native-dialog__hint">
                    {myScenes.length === 0
                      ? "你还没有可展示的历史记录。"
                      : "没有匹配的画布，请换个关键词试试。"}
                  </div>
                )}
              {isMyScenesLoading && (
                <div className="backend-auth-native-dialog__hint">
                  历史记录加载中...
                </div>
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
            setIsOpen((open) => !open);
          }}
        >
          <span className="backend-auth-userpanel__trigger-badge">
            {badgeLabel}
          </span>
        </button>
        {isOpen && (
          <div className="backend-auth-userpanel__menu" role="menu">
            <div className="backend-auth-userpanel__menu-header">
              <div className="backend-auth-userpanel__menu-name">
                {displayName}
              </div>
              <div className="backend-auth-userpanel__menu-meta">
                {normalizedRole}
              </div>
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
                onClick={async () => {
                  setIsOpen(false);
                  setActiveDialog("user-scenes");
                  await loadUserScenes();
                }}
              >
                我的画布
              </button>
              <button
                className="backend-auth-userpanel__secondary"
                type="button"
                onClick={async () => {
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
      {activeDialog === "user-scenes" && (
        <Dialog
          size="wide"
          title="我的画布"
          onCloseRequest={closeDialog}
          className="backend-auth-native-dialog backend-auth-admin-dialog"
        >
          <div className="backend-auth-native-dialog__form">
            <div className="backend-auth-admin-dialog__toolbar">
              <div className="backend-auth-native-dialog__hint">
                这里展示当前账号下的正式画布列表。画布是正式 Scene
                对象；历史记录则包含你自己的画布和参与过协作的画布。
              </div>
              <DialogActionButton
                label={isUserScenesLoading ? "刷新中..." : "刷新"}
                actionType="primary"
                onClick={() => void loadUserScenes()}
                disabled={isUserScenesLoading}
              />
            </div>
            <label className="backend-auth-native-dialog__label">
              <span>搜索画布</span>
              <input
                className="backend-auth-native-dialog__input"
                type="text"
                value={userScenesSearch}
                onChange={(event) => setUserScenesSearch(event.target.value)}
                placeholder="按画布名称、sceneId 或当前 roomId 搜索"
              />
            </label>
            <div className="backend-auth-admin-dialog__toolbar backend-auth-admin-dialog__toolbar--scene-filters">
              <div className="backend-auth-native-dialog__hint">
                共 {filteredUserScenes.length} 个结果，默认按最近打开排序。
              </div>
              <div className="backend-auth-admin-dialog__filters">
                <label className="backend-auth-native-dialog__label backend-auth-admin-dialog__filter">
                  <span>状态筛选</span>
                  <select
                    className="backend-auth-native-dialog__input backend-auth-native-dialog__select"
                    value={userScenesStatusFilter}
                    onChange={(event) =>
                      setUserScenesStatusFilter(
                        event.target.value as
                          | "all"
                          | "favorite"
                          | "collab-enabled"
                          | "collab-disabled",
                      )
                    }
                  >
                    <option value="all">全部画布</option>
                    <option value="favorite">仅看收藏</option>
                    <option value="collab-enabled">仅看协作中</option>
                    <option value="collab-disabled">仅看未开启协作</option>
                  </select>
                </label>
                <label className="backend-auth-native-dialog__label backend-auth-admin-dialog__filter">
                  <span>排序方式</span>
                  <select
                    className="backend-auth-native-dialog__input backend-auth-native-dialog__select"
                    value={userScenesSort}
                    onChange={(event) =>
                      setUserScenesSort(
                        event.target.value as
                          | "recent-opened"
                          | "favorite-first"
                          | "recent-updated"
                          | "name",
                      )
                    }
                  >
                    <option value="recent-opened">最近打开优先</option>
                    <option value="favorite-first">收藏优先</option>
                    <option value="recent-updated">最近更新优先</option>
                    <option value="name">按名称排序</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="backend-auth-native-dialog__actions backend-auth-native-dialog__actions--spread">
              <div className="backend-auth-native-dialog__hint">
                你可以在这里新建画布、修改名称，或直接打开进入协作。
              </div>
              <DialogActionButton
                label={isCreatingScene ? "创建中..." : "新建画布"}
                actionType="primary"
                onClick={() => void createAndOpenScene()}
                disabled={isCreatingScene}
              />
            </div>
            {userScenesMessage && (
              <div
                className={`backend-auth-native-dialog__message ${
                  userScenesMessage.includes("已更新")
                    ? "backend-auth-native-dialog__message--success"
                    : "backend-auth-native-dialog__message--error"
                }`}
              >
                {userScenesMessage}
              </div>
            )}
            <div className="backend-auth-admin-dialog__list">
              {filteredUserScenes.map((item) => {
                const recentTimeInfo = getRecentSceneTimeInfo(item);
                return (
                  <div
                    key={item.sceneId}
                    className={`backend-auth-admin-dialog__item ${
                      currentSceneId === item.sceneId
                        ? "backend-auth-admin-dialog__item--current"
                        : ""
                    } ${
                      recentlyOpenedSceneId === item.sceneId
                        ? "backend-auth-admin-dialog__item--highlighted"
                        : ""
                    }`}
                  >
                    <div className="backend-auth-admin-dialog__identity">
                      <div className="backend-auth-admin-dialog__title-row">
                        <div className="backend-auth-admin-dialog__name">
                          {editingSceneId === item.sceneId ? (
                            <input
                              className="backend-auth-native-dialog__input"
                              type="text"
                              autoFocus
                              value={editingSceneName}
                              onChange={(event) =>
                                setEditingSceneName(event.target.value)
                              }
                              placeholder="请输入画布名称"
                            />
                          ) : (
                            item.sceneName || `未命名画布 #${item.sceneId}`
                          )}
                        </div>
                        {currentSceneId === item.sceneId && (
                          <span className="backend-auth-admin-dialog__current-badge">
                            当前画布
                          </span>
                        )}
                        {recentlyOpenedSceneId === item.sceneId && (
                          <span className="backend-auth-admin-dialog__badge backend-auth-admin-dialog__badge--recent">
                            刚刚打开
                          </span>
                        )}
                      </div>
                      <div className="backend-auth-admin-dialog__summary">
                        <span className="backend-auth-admin-dialog__meta">
                          sceneId {item.sceneId}
                        </span>
                        <span className="backend-auth-admin-dialog__meta">
                          成员 {item.memberCount > 0 ? `${item.memberCount} 人` : "仅自己"}
                        </span>
                        {item.isFavorite && (
                          <span className="backend-auth-admin-dialog__badge backend-auth-admin-dialog__badge--favorite">
                            收藏
                          </span>
                        )}
                        <span
                          className={`backend-auth-admin-dialog__badge ${
                            item.isCollabEnabled
                              ? "backend-auth-admin-dialog__badge--success"
                              : "backend-auth-admin-dialog__badge--muted"
                          }`}
                        >
                          {item.isCollabEnabled ? "协作中" : "未开启协作"}
                        </span>
                        <span className="backend-auth-admin-dialog__timeline-status">
                          {recentTimeInfo.label}
                        </span>
                        <span className="backend-auth-admin-dialog__timeline-secondary">
                          打开 {recentTimeInfo.detail}
                        </span>
                        <span className="backend-auth-admin-dialog__timeline-secondary">
                          更新 {formatAdminUserTime(item.updatedAt)}
                        </span>
                        {item.currentRoomId && (
                          <span className="backend-auth-admin-dialog__timeline-secondary">
                            roomId {item.currentRoomId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`backend-auth-admin-dialog__item-actions ${
                        currentSceneId === item.sceneId
                          ? "backend-auth-admin-dialog__item-actions--current"
                          : ""
                      }`}
                    >
                      {editingSceneId === item.sceneId ? (
                        <>
                          <button
                            className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action"
                            type="button"
                            disabled={isDialogSubmitting}
                            onClick={() => {
                              setEditingSceneId(null);
                              setEditingSceneName("");
                              setUserScenesMessage("");
                            }}
                          >
                            取消
                          </button>
                          <button
                            className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action backend-auth-admin-dialog__action--primary"
                            type="button"
                            disabled={isDialogSubmitting}
                            onClick={() => void renameScene()}
                          >
                            {isDialogSubmitting ? "保存中..." : "保存"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action"
                            type="button"
                            disabled={openingSceneDetailId === item.sceneId}
                            onClick={() => void openSceneDetailFromList(item.sceneId)}
                          >
                            {openingSceneDetailId === item.sceneId ? "加载中..." : "详情"}
                          </button>
                          <button
                            className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action"
                            type="button"
                            disabled={isDialogSubmitting}
                            onClick={async () => {
                              setIsDialogSubmitting(true);
                              setUserScenesMessage("");
                              try {
                                const result = await setUserSceneFavorite(
                                  item.sceneId,
                                  !item.isFavorite,
                                );
                                setUserScenes((prev) =>
                                  prev.map((scene) =>
                                    scene.sceneId === item.sceneId
                                      ? {
                                          ...scene,
                                          isFavorite: result.isFavorite,
                                        }
                                      : scene,
                                  ),
                                );
                                setUserScenesMessage(
                                  result.isFavorite ? "已加入收藏" : "已取消收藏",
                                );
                              } catch (error) {
                                setUserScenesMessage(
                                  error instanceof Error
                                    ? error.message
                                    : "更新收藏状态失败",
                                );
                              } finally {
                                setIsDialogSubmitting(false);
                              }
                            }}
                          >
                            {item.isFavorite ? "取消收藏" : "收藏"}
                          </button>
                          <button
                            className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action"
                            type="button"
                            onClick={() => {
                              setEditingSceneId(item.sceneId);
                              setEditingSceneName(item.sceneName || "");
                              setUserScenesMessage("");
                            }}
                          >
                            改名
                          </button>
                          <button
                            className="backend-auth-userpanel__secondary backend-auth-admin-dialog__action backend-auth-admin-dialog__action--primary"
                            type="button"
                            disabled={
                              openingSceneId === item.sceneId ||
                              currentSceneId === item.sceneId
                            }
                            onClick={() => void openUserScene(item)}
                          >
                            {openingSceneId === item.sceneId
                              ? "打开中..."
                              : currentSceneId === item.sceneId
                                ? "当前画布"
                                : "打开"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {!isUserScenesLoading &&
                filteredUserScenes.length === 0 &&
                !userScenesMessage && (
                  <div className="backend-auth-native-dialog__hint">
                    {userScenes.length === 0
                      ? "你还没有正式画布，先新建一个吧。"
                      : "没有匹配的画布，请换个关键词试试。"}
                  </div>
                )}
              {isUserScenesLoading && (
                <div className="backend-auth-native-dialog__hint">
                  画布列表加载中...
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
                const nextStatus =
                  item.status === "active" ? "disabled" : "active";
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
                        title={isCurrentUser ? "当前账号不可禁用" : undefined}
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
                                userItem.userId === updated.userId
                                  ? updated
                                  : userItem,
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
                            const result = await adminResetUserPassword(
                              item.userId,
                            );
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
