import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";

import {
  addUserSceneMember,
  openSceneCollab,
  renameUserScene,
  removeUserSceneMember,
  setUserSceneCollabAccessMode,
  setUserSceneFavorite,
  updateUserSceneMemberRole,
} from "../auth/api";
import { buildSceneCollabUrl } from "../auth/sceneSession";

import type { SceneDetailRecord } from "../auth/types";

type CurrentSceneDialogProps = {
  currentScene: SceneDetailRecord;
  currentUserId?: number;
  isOpen: boolean;
  nameDraft: string;
  memberUsernameDraft: string;
  message: string;
  isSubmitting: boolean;
  onNameDraftChange: (value: string) => void;
  onMemberUsernameDraftChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmittingChange: (value: boolean) => void;
  onCurrentSceneChange: (scene: SceneDetailRecord) => void;
  onClose: () => void;
};

const formatSceneTime = (value: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const getRecentOpenedLabel = (value?: number) => {
  if (!value) {
    return "未打开";
  }

  const diff = Date.now() - value;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const threeDays = 3 * oneDay;

  if (diff < 10 * 60 * 1000) {
    return "刚刚打开";
  }
  if (diff < oneHour) {
    return "1 小时内";
  }
  if (diff < oneDay) {
    return "今天打开过";
  }
  if (diff < threeDays) {
    return "最近 3 天打开过";
  }
  return formatSceneTime(value);
};

const getMemberRolePresentation = (
  relationType: string,
  role: string,
): {
  label: string;
  className:
    | "backend-auth-native-dialog__member-role-badge--owner"
    | "backend-auth-native-dialog__member-role-badge--viewer"
    | "backend-auth-native-dialog__member-role-badge--editor";
} => {
  if (relationType === "owner" || role === "owner") {
    return {
      label: "拥有者",
      className: "backend-auth-native-dialog__member-role-badge--owner",
    };
  }
  if (role === "viewer") {
    return {
      label: "只读",
      className: "backend-auth-native-dialog__member-role-badge--viewer",
    };
  }
  return {
    label: "可编辑",
    className: "backend-auth-native-dialog__member-role-badge--editor",
  };
};

export const CurrentSceneDialog = ({
  currentScene,
  currentUserId,
  isOpen,
  nameDraft,
  memberUsernameDraft,
  message,
  isSubmitting,
  onNameDraftChange,
  onMemberUsernameDraftChange,
  onMessageChange,
  onSubmittingChange,
  onCurrentSceneChange,
  onClose,
}: CurrentSceneDialogProps) => {
  if (!isOpen) {
    return null;
  }

  const isOwner = currentUserId === currentScene.ownerUserId;
  const relationLabel =
    currentScene.ownershipType === "owner" ? "我的画布" : "协作参与";
  const roleLabel =
    currentScene.viewerRole === "viewer"
      ? "只读成员"
      : currentScene.viewerRole === "owner"
        ? "拥有者"
        : "可编辑成员";
  const favoriteLabel = currentScene.isFavorite ? "已收藏" : "未收藏";
  const recentOpenedLabel = getRecentOpenedLabel(
    currentScene.lastOpenedAt || currentScene.lastActivatedAt,
  );
  const memberCountLabel =
    currentScene.memberCount > 0 ? `${currentScene.memberCount} 人` : "仅当前成员";
  const sortedMembers = [...currentScene.members].sort((left, right) => {
    const leftOwner = left.relationType === "owner" || left.role === "owner";
    const rightOwner = right.relationType === "owner" || right.role === "owner";
    if (leftOwner !== rightOwner) {
      return leftOwner ? -1 : 1;
    }

    const leftCurrent = currentUserId === left.userId;
    const rightCurrent = currentUserId === right.userId;
    if (leftCurrent !== rightCurrent) {
      return leftCurrent ? -1 : 1;
    }

    const leftVisitedAt = left.lastVisitedAt || 0;
    const rightVisitedAt = right.lastVisitedAt || 0;
    if (rightVisitedAt !== leftVisitedAt) {
      return rightVisitedAt - leftVisitedAt;
    }

    const leftName = (left.displayName || left.username || "").trim();
    const rightName = (right.displayName || right.username || "").trim();
    const compareName = leftName.localeCompare(rightName, "zh-CN", {
      numeric: true,
      sensitivity: "base",
    });
    if (compareName !== 0) {
      return compareName;
    }

    return left.userId - right.userId;
  });

  return (
    <Dialog
      size="small"
      title="当前画布"
      onCloseRequest={onClose}
      className="backend-auth-native-dialog backend-auth-native-dialog--scene-detail"
    >
      <div className="backend-auth-native-dialog__form">
        <div className="backend-auth-native-dialog__hint backend-auth-native-dialog__hint--intro">
          这里展示当前正在编辑的正式画布信息，你可以修改名称或直接进入协作房间。
        </div>
        <div className="backend-auth-native-dialog__hero">
          <div className="backend-auth-native-dialog__hero-main">
            <div className="backend-auth-native-dialog__section-header">
              <div>
                <div className="backend-auth-native-dialog__section-title">
                  画布概览
                </div>
                <div className="backend-auth-native-dialog__section-subtitle">
                  当前画布的归属、收藏状态和协作模式都汇总在这里。
                </div>
              </div>
              <div className="backend-auth-native-dialog__chips">
                <span className="backend-auth-native-dialog__chip">
                  {relationLabel}
                </span>
                <span className="backend-auth-native-dialog__chip">
                  {roleLabel}
                </span>
                {currentScene.isFavorite && (
                  <span className="backend-auth-native-dialog__chip backend-auth-native-dialog__chip--favorite">
                    已收藏
                  </span>
                )}
              </div>
            </div>
            <label className="backend-auth-native-dialog__label">
              <span>画布名称</span>
              <input
                className="backend-auth-native-dialog__input"
                type="text"
                value={nameDraft}
                onChange={(event) => onNameDraftChange(event.target.value)}
                placeholder="请输入画布名称"
              />
            </label>
          </div>
          <div className="backend-auth-native-dialog__hero-side">
            <div className="backend-auth-native-dialog__meta-grid backend-auth-native-dialog__meta-grid--compact-cards">
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  所属关系
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {relationLabel}
                </span>
              </div>
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  我的角色
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {roleLabel}
                </span>
              </div>
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  收藏状态
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {favoriteLabel}
                </span>
              </div>
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  成员概览
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {memberCountLabel}
                </span>
              </div>
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  最近打开
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {recentOpenedLabel}
                </span>
              </div>
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  最近更新
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {formatSceneTime(currentScene.updatedAt)}
                </span>
              </div>
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  创建时间
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {formatSceneTime(currentScene.createdAt)}
                </span>
              </div>
              <div className="backend-auth-native-dialog__meta-item backend-auth-native-dialog__meta-item--compact-card">
                <span className="backend-auth-native-dialog__meta-label">
                  当前 roomId
                </span>
                <span className="backend-auth-native-dialog__meta-value">
                  {currentScene.currentRoomId || "尚未开启协作"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="backend-auth-native-dialog__panel-grid">
          <div className="backend-auth-native-dialog__panel">
            <div className="backend-auth-native-dialog__meta-item">
              <span className="backend-auth-native-dialog__meta-label">
                sceneId
              </span>
              <span className="backend-auth-native-dialog__meta-value">
                {currentScene.sceneId}
              </span>
            </div>
          </div>
          <div className="backend-auth-native-dialog__panel">
            <div className="backend-auth-native-dialog__meta-item">
              <span className="backend-auth-native-dialog__meta-label">
                收藏
              </span>
              <button
                type="button"
                className="backend-auth-native-dialog__meta-button"
                disabled={isSubmitting}
                onClick={async () => {
                  onSubmittingChange(true);
                  onMessageChange("");
                  try {
                    const favoriteState = await setUserSceneFavorite(
                      currentScene.sceneId,
                      !currentScene.isFavorite,
                    );
                    onCurrentSceneChange({
                      ...currentScene,
                      isFavorite: favoriteState.isFavorite,
                    });
                    onMessageChange(
                      favoriteState.isFavorite ? "已加入收藏" : "已取消收藏",
                    );
                  } catch (error) {
                    onMessageChange(
                      error instanceof Error ? error.message : "更新收藏状态失败",
                    );
                  } finally {
                    onSubmittingChange(false);
                  }
                }}
              >
                {currentScene.isFavorite ? "已收藏" : "加入收藏"}
              </button>
            </div>
          </div>
          <div className="backend-auth-native-dialog__panel backend-auth-native-dialog__panel--wide">
            <div className="backend-auth-native-dialog__meta-item">
              <span className="backend-auth-native-dialog__meta-label">
                协作模式
              </span>
              <div className="backend-auth-native-dialog__segmented">
                <button
                  type="button"
                  className="backend-auth-native-dialog__segmented-button"
                  data-active={currentScene.collabAccessMode === "private"}
                  disabled={isSubmitting || !isOwner}
                  onClick={async () => {
                    if (currentScene.collabAccessMode === "private" || !isOwner) {
                      return;
                    }
                    onSubmittingChange(true);
                    onMessageChange("");
                    try {
                      const updatedScene = await setUserSceneCollabAccessMode(
                        currentScene.sceneId,
                        "private",
                      );
                      onCurrentSceneChange({
                        ...currentScene,
                        ...updatedScene,
                      });
                      onMessageChange("已切换为仅成员可协作");
                    } catch (error) {
                      onMessageChange(
                        error instanceof Error ? error.message : "更新协作模式失败",
                      );
                    } finally {
                      onSubmittingChange(false);
                    }
                  }}
                >
                  仅成员白名单
                </button>
                <button
                  type="button"
                  className="backend-auth-native-dialog__segmented-button"
                  data-active={currentScene.collabAccessMode === "invite"}
                  disabled={isSubmitting || !isOwner}
                  onClick={async () => {
                    if (currentScene.collabAccessMode === "invite" || !isOwner) {
                      return;
                    }
                    onSubmittingChange(true);
                    onMessageChange("");
                    try {
                      const updatedScene = await setUserSceneCollabAccessMode(
                        currentScene.sceneId,
                        "invite",
                      );
                      onCurrentSceneChange({
                        ...currentScene,
                        ...updatedScene,
                      });
                      onMessageChange("已切换为登录后可加入协作");
                    } catch (error) {
                      onMessageChange(
                        error instanceof Error ? error.message : "更新协作模式失败",
                      );
                    } finally {
                      onSubmittingChange(false);
                    }
                  }}
                >
                  持链接登录可加入
                </button>
              </div>
            </div>
          </div>
          <div className="backend-auth-native-dialog__panel backend-auth-native-dialog__panel--wide">
            <div className="backend-auth-native-dialog__meta-item">
              <span className="backend-auth-native-dialog__meta-label">
                访问说明
              </span>
              <div className="backend-auth-native-dialog__hint">
                {currentScene.collabAccessMode === "private"
                  ? "当前是白名单协作，只有已有成员可以进入；被移除成员即使保留旧链接，也不能再重新进入当前协作。"
                  : "当前是登录可加入协作，拿到分享链接并登录后即可加入当前画布。"}
              </div>
            </div>
          </div>
        </div>
        <div className="backend-auth-native-dialog__section-header backend-auth-native-dialog__section-header--compact">
          <div>
            <div className="backend-auth-native-dialog__section-title">
              成员与权限
            </div>
            <div className="backend-auth-native-dialog__section-subtitle">
              查看当前成员，并在拥有者视角下执行添加、移除和角色调整。
            </div>
          </div>
        </div>
        <div className="backend-auth-native-dialog__panel">
          <div className="backend-auth-native-dialog__meta-item">
            <span className="backend-auth-native-dialog__meta-label">
              成员
            </span>
            {isOwner && (
              <div className="backend-auth-native-dialog__member-toolbar">
                <input
                  className="backend-auth-native-dialog__input backend-auth-native-dialog__member-input"
                  type="text"
                  value={memberUsernameDraft}
                  onChange={(event) =>
                    onMemberUsernameDraftChange(event.target.value)
                  }
                  placeholder="输入用户名添加成员"
                />
                <button
                  type="button"
                  className="backend-auth-native-dialog__meta-button"
                  disabled={isSubmitting || !memberUsernameDraft.trim()}
                  onClick={async () => {
                    onSubmittingChange(true);
                    onMessageChange("");
                    try {
                      const result = await addUserSceneMember(
                        currentScene.sceneId,
                        memberUsernameDraft.trim(),
                      );
                      onCurrentSceneChange({
                        ...currentScene,
                        memberCount: currentScene.memberCount + 1,
                        members: [...currentScene.members, result.member],
                      });
                      onMemberUsernameDraftChange("");
                      onMessageChange("成员已添加");
                    } catch (error) {
                      onMessageChange(
                        error instanceof Error ? error.message : "添加成员失败",
                      );
                    } finally {
                      onSubmittingChange(false);
                    }
                  }}
                >
                  添加成员
                </button>
              </div>
            )}
            <div className="backend-auth-native-dialog__member-list">
              {sortedMembers.length > 0 ? (
                sortedMembers.map((member) => {
                  const memberRole = getMemberRolePresentation(
                    member.relationType,
                    member.role || "editor",
                  );
                  const memberRowClass =
                    memberRole.className ===
                    "backend-auth-native-dialog__member-role-badge--owner"
                      ? "backend-auth-native-dialog__member-item--owner"
                      : memberRole.className ===
                          "backend-auth-native-dialog__member-role-badge--viewer"
                        ? "backend-auth-native-dialog__member-item--viewer"
                        : "backend-auth-native-dialog__member-item--editor";

                  return (
                    <div
                      key={`${member.userId}-${member.relationType}-${member.role}`}
                      className={`backend-auth-native-dialog__member-item ${memberRowClass}`}
                    >
                      <div className="backend-auth-native-dialog__member-head">
                        <div className="backend-auth-native-dialog__member-head-main">
                          <span className="backend-auth-native-dialog__member-name">
                            {member.displayName ||
                              member.username ||
                              `用户 #${member.userId}`}
                          </span>
                          <span
                            className={`backend-auth-native-dialog__member-role-badge ${memberRole.className}`}
                          >
                            {memberRole.label}
                          </span>
                          {currentUserId === member.userId && (
                            <span className="backend-auth-native-dialog__member-badge">
                              当前账号
                            </span>
                          )}
                        </div>
                        {isOwner && (
                          <div className="backend-auth-native-dialog__member-actions">
                            <select
                              className="backend-auth-native-dialog__member-role-select"
                              value={member.role || "editor"}
                              disabled={
                                isSubmitting ||
                                member.userId === currentScene.ownerUserId
                              }
                              title={
                                member.userId === currentScene.ownerUserId
                                  ? "拥有者角色不可调整"
                                  : "调整成员角色"
                              }
                              onChange={async (event) => {
                                if (member.userId === currentScene.ownerUserId) {
                                  onMessageChange("拥有者角色不可调整");
                                  return;
                                }
                                const nextRole = event.target.value as
                                  | "editor"
                                  | "viewer";
                                onSubmittingChange(true);
                                onMessageChange("");
                                try {
                                  const result = await updateUserSceneMemberRole(
                                    currentScene.sceneId,
                                    member.userId,
                                    nextRole,
                                  );
                                  onCurrentSceneChange({
                                    ...currentScene,
                                    members: currentScene.members.map((item) =>
                                      item.userId === member.userId
                                        ? result.member
                                        : item,
                                    ),
                                  });
                                  onMessageChange(
                                    nextRole === "viewer"
                                      ? "成员已调整为只读"
                                      : "成员已调整为可编辑",
                                  );
                                } catch (error) {
                                  onMessageChange(
                                    error instanceof Error
                                      ? error.message
                                      : "更新成员角色失败",
                                  );
                                } finally {
                                  onSubmittingChange(false);
                                }
                              }}
                            >
                              <option value="editor">可编辑</option>
                              <option value="viewer">只读</option>
                            </select>
                            <button
                              type="button"
                              className="backend-auth-native-dialog__member-action"
                              disabled={
                                isSubmitting ||
                                member.userId === currentScene.ownerUserId
                              }
                              title={
                                member.userId === currentScene.ownerUserId
                                  ? "拥有者不能移除"
                                  : "移除成员"
                              }
                              onClick={async () => {
                                if (member.userId === currentScene.ownerUserId) {
                                  onMessageChange("拥有者不能移除");
                                  return;
                                }
                                onSubmittingChange(true);
                                onMessageChange("");
                                try {
                                  await removeUserSceneMember(
                                    currentScene.sceneId,
                                    member.userId,
                                  );
                                  onCurrentSceneChange({
                                    ...currentScene,
                                    memberCount: Math.max(
                                      0,
                                      currentScene.memberCount - 1,
                                    ),
                                    members: currentScene.members.filter(
                                      (item) => item.userId !== member.userId,
                                    ),
                                  });
                                  onMessageChange("成员已移除");
                                } catch (error) {
                                  onMessageChange(
                                    error instanceof Error
                                      ? error.message
                                      : "移除成员失败",
                                  );
                                } finally {
                                  onSubmittingChange(false);
                                }
                              }}
                            >
                              移除
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="backend-auth-native-dialog__member-meta">
                        {member.relationType === "owner" ? "拥有者" : "参与者"} · 角色 {memberRole.label}
                      </span>
                      <span className="backend-auth-native-dialog__member-meta">
                        用户名：{member.username || `user-${member.userId}`} · 最近访问：
                        {member.lastVisitedAt
                          ? formatSceneTime(member.lastVisitedAt)
                          : "暂无记录"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="backend-auth-native-dialog__hint">
                  暂无可展示成员
                </div>
              )}
            </div>
          </div>
        </div>
        {message && (
          <div
            className={`backend-auth-native-dialog__message ${
              message.includes("已")
                ? "backend-auth-native-dialog__message--success"
                : "backend-auth-native-dialog__message--error"
            }`}
          >
            {message}
          </div>
        )}
        <div className="backend-auth-native-dialog__footer">
          <div className="backend-auth-native-dialog__actions backend-auth-native-dialog__actions--spread">
            <DialogActionButton
              label="打开协作"
              actionType="primary"
              disabled={isSubmitting}
              onClick={async () => {
                onSubmittingChange(true);
                onMessageChange("");
                try {
                  const collabRoom = await openSceneCollab(currentScene.sceneId);
                  onCurrentSceneChange({
                    ...currentScene,
                    sceneName: collabRoom.sceneName || currentScene.sceneName,
                    currentRoomId: collabRoom.roomId,
                    isCollabEnabled: true,
                  });
                  window.location.assign(
                    buildSceneCollabUrl({
                      sceneId: collabRoom.sceneId,
                      roomId: collabRoom.roomId,
                      roomKey: collabRoom.roomKey,
                    }),
                  );
                } catch (error) {
                  onMessageChange(
                    error instanceof Error ? error.message : "打开协作失败",
                  );
                } finally {
                  onSubmittingChange(false);
                }
              }}
            />
            <div className="backend-auth-native-dialog__actions">
              <DialogActionButton
                label="关闭"
                onClick={onClose}
                disabled={isSubmitting}
              />
              <DialogActionButton
                label={isSubmitting ? "保存中..." : "保存名称"}
                actionType="primary"
                disabled={isSubmitting || !nameDraft.trim()}
                onClick={async () => {
                  onSubmittingChange(true);
                  onMessageChange("");
                  try {
                    const updatedScene = await renameUserScene(
                      currentScene.sceneId,
                      nameDraft.trim(),
                    );
                    onCurrentSceneChange({
                      ...currentScene,
                      ...updatedScene,
                    });
                    onMessageChange("画布名称已更新");
                  } catch (error) {
                    onMessageChange(
                      error instanceof Error ? error.message : "修改画布名称失败",
                    );
                  } finally {
                    onSubmittingChange(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
