import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";

import { openSceneCollab, renameUserScene } from "../auth/api";
import { buildSceneCollabUrl } from "../auth/sceneSession";

import type { SceneRecord } from "../auth/types";

type CurrentSceneDialogProps = {
  currentScene: SceneRecord;
  isOpen: boolean;
  nameDraft: string;
  message: string;
  isSubmitting: boolean;
  onNameDraftChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmittingChange: (value: boolean) => void;
  onCurrentSceneChange: (scene: SceneRecord) => void;
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

export const CurrentSceneDialog = ({
  currentScene,
  isOpen,
  nameDraft,
  message,
  isSubmitting,
  onNameDraftChange,
  onMessageChange,
  onSubmittingChange,
  onCurrentSceneChange,
  onClose,
}: CurrentSceneDialogProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      size="small"
      title="当前画布"
      onCloseRequest={onClose}
      className="backend-auth-native-dialog"
    >
      <div className="backend-auth-native-dialog__form">
        <div className="backend-auth-native-dialog__hint">
          这里展示当前正在编辑的正式画布信息，你可以修改名称或直接进入协作房间。
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
        <div className="backend-auth-native-dialog__meta-grid">
          <div className="backend-auth-native-dialog__meta-item">
            <span className="backend-auth-native-dialog__meta-label">
              sceneId
            </span>
            <span className="backend-auth-native-dialog__meta-value">
              {currentScene.sceneId}
            </span>
          </div>
          <div className="backend-auth-native-dialog__meta-item">
            <span className="backend-auth-native-dialog__meta-label">
              当前 roomId
            </span>
            <span className="backend-auth-native-dialog__meta-value">
              {currentScene.currentRoomId || "尚未开启协作"}
            </span>
          </div>
          <div className="backend-auth-native-dialog__meta-item">
            <span className="backend-auth-native-dialog__meta-label">
              更新时间
            </span>
            <span className="backend-auth-native-dialog__meta-value">
              {formatSceneTime(currentScene.updatedAt)}
            </span>
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
                  onCurrentSceneChange(updatedScene);
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
    </Dialog>
  );
};
