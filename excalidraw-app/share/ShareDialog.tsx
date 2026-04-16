import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import {
  copyIcon,
  LinkIcon,
  playerPlayIcon,
  playerStopFilledIcon,
  share,
  shareIOS,
  shareWindows,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useCopyStatus } from "@excalidraw/excalidraw/hooks/useCopiedIndicator";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { KEYS, getFrame } from "@excalidraw/common";
import { useEffect, useRef, useState } from "react";

import { atom, useAtom, useAtomValue } from "../app-jotai";
import { activeRoomLinkAtom } from "../collab/Collab";
import { useAuth } from "../auth/AuthGate";
import {
  createUserScene,
  openSceneCollab,
  setUserSceneCollabAccessMode,
} from "../auth/api";
import { buildSceneCollabUrl } from "../auth/sceneSession";

import "./ShareDialog.scss";
import { QRCode } from "./QRCode";

import type { CollabAPI } from "../collab/Collab";
import type { SceneRecord } from "../auth/types";

type OnExportToBackend = () => void;
type ShareDialogType = "share" | "collaborationOnly";

export const shareDialogStateAtom = atom<
  { isOpen: false } | { isOpen: true; type: ShareDialogType }
>({ isOpen: false });

const getShareIcon = () => {
  const navigator = window.navigator as any;
  const isAppleBrowser = /Apple/.test(navigator.vendor);
  const isWindowsBrowser = navigator.appVersion.indexOf("Win") !== -1;

  if (isAppleBrowser) {
    return shareIOS;
  } else if (isWindowsBrowser) {
    return shareWindows;
  }

  return share;
};

export type ShareDialogProps = {
  collabAPI: CollabAPI | null;
  handleClose: () => void;
  onExportToBackend: OnExportToBackend;
  type: ShareDialogType;
  getSceneName?: () => string;
  currentScene?: SceneRecord | null;
  onSceneReady?: (scene: SceneRecord) => void;
};

const ActiveRoomDialog = ({
  collabAPI,
  activeRoomLink,
  currentScene,
  handleClose,
}: {
  collabAPI: CollabAPI;
  activeRoomLink: string;
  currentScene?: SceneRecord | null;
  handleClose: () => void;
}) => {
  const { t } = useI18n();
  const [, setJustCopied] = useState(false);
  const timerRef = useRef<number>(0);
  const ref = useRef<HTMLInputElement>(null);
  const isShareSupported = "share" in navigator;
  const { onCopy, copyStatus } = useCopyStatus();

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);
    } catch (e) {
      collabAPI.setCollabError(t("errors.copyToSystemClipboardFailed"));
    }

    setJustCopied(true);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setJustCopied(false);
    }, 3000);

    ref.current?.select();
  };

  const shareRoomLink = async () => {
    try {
      await navigator.share({
        title: t("roomDialog.shareTitle"),
        text: t("roomDialog.shareTitle"),
        url: activeRoomLink,
      });
    } catch (error: any) {
      // Just ignore.
    }
  };

  return (
    <>
      <h3 className="ShareDialog__active__header">
        {t("labels.liveCollaboration").replace(/\./g, "")}
      </h3>
      <TextField
        defaultValue={collabAPI.getUsername()}
        placeholder="Your name"
        label="Your name"
        onChange={collabAPI.setUsername}
        onKeyDown={(event) => event.key === KEYS.ENTER && handleClose()}
      />
      <div className="ShareDialog__active__linkRow">
        <TextField
          ref={ref}
          label="Link"
          readonly
          fullWidth
          value={activeRoomLink}
        />
        {isShareSupported && (
          <FilledButton
            size="large"
            variant="icon"
            label="Share"
            icon={getShareIcon()}
            className="ShareDialog__active__share"
            onClick={shareRoomLink}
          />
        )}
        <FilledButton
          size="large"
          label={t("buttons.copyLink")}
          icon={copyIcon}
          status={copyStatus}
          onClick={() => {
            copyRoomLink();
            onCopy();
          }}
        />
      </div>
      <QRCode value={activeRoomLink} />
      {currentScene && (
        <div className="ShareDialog__active__mode">
          <div className="ShareDialog__active__mode__label">当前协作加入方式</div>
          <div className="ShareDialog__active__mode__value">
            {currentScene.collabAccessMode === "private"
              ? "仅成员白名单"
              : "持链接登录可加入"}
          </div>
          <div className="ShareDialog__active__mode__hint">
            {currentScene.collabAccessMode === "private"
              ? "这个分享链接仅用于已在成员列表中的用户重新进入协作。"
              : "拿到这个分享链接并登录的用户，可以自动加入当前画布协作。"}
          </div>
          {currentScene.collabAccessMode === "private" && (
            <div className="ShareDialog__active__mode__hint">
              被移除的成员即使仍保留旧链接，也不能再通过该链接重新进入。
            </div>
          )}
        </div>
      )}
      <div className="ShareDialog__active__description">
        <p>
          <span
            role="img"
            aria-hidden="true"
            className="ShareDialog__active__description__emoji"
          >
            🔒{" "}
          </span>
          {t("roomDialog.desc_privacy")}
        </p>
        <p>{t("roomDialog.desc_exitSession")}</p>
      </div>

      <div className="ShareDialog__active__actions">
        <FilledButton
          size="large"
          variant="outlined"
          color="danger"
          label={t("roomDialog.button_stopSession")}
          icon={playerStopFilledIcon}
          onClick={() => {
            trackEvent("share", "room closed");
            collabAPI.stopCollaboration();
            if (!collabAPI.isCollaborating()) {
              handleClose();
            }
          }}
        />
      </div>
    </>
  );
};

const ShareDialogPicker = (props: ShareDialogProps) => {
  const { t } = useI18n();
  const auth = useAuth();
  const { collabAPI } = props;
  const [isStartingCollab, setIsStartingCollab] = useState(false);
  const [selectedCollabAccessMode, setSelectedCollabAccessMode] = useState<
    "private" | "invite"
  >(props.currentScene?.collabAccessMode || "private");

  useEffect(() => {
    setSelectedCollabAccessMode(props.currentScene?.collabAccessMode || "private");
  }, [props.currentScene?.collabAccessMode, props.currentScene?.sceneId]);

  const openSceneDrivenCollab = async () => {
    if (!auth || auth.authState.status === "disabled" || !collabAPI) {
      collabAPI?.startCollaboration(null);
      return;
    }

    if (auth.authState.status !== "authenticated") {
      auth.promptLogin("开始实时协作前，请先登录");
      return;
    }

    setIsStartingCollab(true);
    try {
      let sceneId = props.currentScene?.sceneId || null;
      let sceneRecord = props.currentScene || null;
      if (!sceneId) {
        const createdScene = await createUserScene(
          props.getSceneName?.().trim() || document.title || "未命名画布",
          selectedCollabAccessMode,
        );
        sceneId = createdScene.sceneId;
        sceneRecord = createdScene;
        props.onSceneReady?.(createdScene);
      }

      if (
        sceneRecord &&
        selectedCollabAccessMode !== sceneRecord.collabAccessMode &&
        auth.authState.status === "authenticated" &&
        auth.authState.user.userId === sceneRecord.ownerUserId
      ) {
        const updatedScene = await setUserSceneCollabAccessMode(
          sceneRecord.sceneId,
          selectedCollabAccessMode,
        );
        sceneRecord = updatedScene;
        props.onSceneReady?.(updatedScene);
      }

      const collabRoom = await openSceneCollab(sceneId);
      window.history.pushState(
        {},
        "",
        buildSceneCollabUrl({
          sceneId: collabRoom.sceneId,
          roomId: collabRoom.roomId,
          roomKey: collabRoom.roomKey,
        }),
      );
      await collabAPI.startCollaboration({
        roomId: collabRoom.roomId,
        roomKey: collabRoom.roomKey,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "打开协作房间失败";
      collabAPI.setCollabError(message);
    } finally {
      setIsStartingCollab(false);
    }
  };

  const startCollabJSX = collabAPI ? (
    <>
      <div className="ShareDialog__picker__header">
        {t("labels.liveCollaboration").replace(/\./g, "")}
      </div>

      <div className="ShareDialog__picker__description">
        <div style={{ marginBottom: "1em" }}>{t("roomDialog.desc_intro")}</div>
        {t("roomDialog.desc_privacy")}
      </div>

      {auth?.authState.status === "authenticated" &&
        props.currentScene &&
        auth.authState.user.userId === props.currentScene.ownerUserId && (
          <div className="ShareDialog__picker__description">
            <div className="backend-auth-native-dialog__meta-label">
              协作加入方式
            </div>
            <div className="backend-auth-native-dialog__segmented">
              <button
                type="button"
                className="backend-auth-native-dialog__segmented-button"
                data-active={selectedCollabAccessMode === "private"}
                onClick={() => setSelectedCollabAccessMode("private")}
              >
                仅成员白名单
              </button>
              <button
                type="button"
                className="backend-auth-native-dialog__segmented-button"
                data-active={selectedCollabAccessMode === "invite"}
                onClick={() => setSelectedCollabAccessMode("invite")}
              >
                持链接登录可加入
              </button>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              {selectedCollabAccessMode === "private"
                ? "仅已加入画布的成员可以重新进入并参与协作；被移除后旧链接也会失效。"
                : "拿到分享链接并登录的用户，可以自动加入当前画布协作。"}
            </div>
          </div>
        )}

      <div className="ShareDialog__picker__button">
        <FilledButton
          size="large"
          label={t("roomDialog.button_startSession")}
          icon={playerPlayIcon}
          onClick={() => {
            trackEvent("share", "room creation", `ui (${getFrame()})`);
            void openSceneDrivenCollab();
          }}
          disabled={isStartingCollab}
        />
      </div>

      {props.type === "share" && (
        <div className="ShareDialog__separator">
          <span>{t("shareDialog.or")}</span>
        </div>
      )}
    </>
  ) : null;

  return (
    <>
      {startCollabJSX}

      {props.type === "share" && (
        <>
          <div className="ShareDialog__picker__header">
            {t("exportDialog.link_title")}
          </div>
          <div className="ShareDialog__picker__description">
            {t("exportDialog.link_details")}
          </div>

          <div className="ShareDialog__picker__button">
            <FilledButton
              size="large"
              label={t("exportDialog.link_button")}
              icon={LinkIcon}
              onClick={async () => {
                await props.onExportToBackend();
                props.handleClose();
              }}
            />
          </div>
        </>
      )}
    </>
  );
};

const ShareDialogInner = (props: ShareDialogProps) => {
  const activeRoomLink = useAtomValue(activeRoomLinkAtom);

  return (
    <Dialog size="small" onCloseRequest={props.handleClose} title={false}>
      <div className="ShareDialog">
        {props.collabAPI && activeRoomLink ? (
          <ActiveRoomDialog
            collabAPI={props.collabAPI}
            activeRoomLink={activeRoomLink}
            currentScene={props.currentScene}
            handleClose={props.handleClose}
          />
        ) : (
          <ShareDialogPicker {...props} />
        )}
      </div>
    </Dialog>
  );
};

export const ShareDialog = (props: {
  collabAPI: CollabAPI | null;
  onExportToBackend: OnExportToBackend;
  getSceneName?: () => string;
  currentScene?: SceneRecord | null;
  onSceneReady?: (scene: SceneRecord) => void;
}) => {
  const [shareDialogState, setShareDialogState] = useAtom(shareDialogStateAtom);

  const { openDialog } = useUIAppState();

  useEffect(() => {
    if (openDialog) {
      setShareDialogState({ isOpen: false });
    }
  }, [openDialog, setShareDialogState]);

  if (!shareDialogState.isOpen) {
    return null;
  }

  return (
    <ShareDialogInner
      handleClose={() => setShareDialogState({ isOpen: false })}
      collabAPI={props.collabAPI}
      onExportToBackend={props.onExportToBackend}
      type={shareDialogState.type}
      getSceneName={props.getSceneName}
      currentScene={props.currentScene}
      onSceneReady={props.onSceneReady}
    />
  );
};
