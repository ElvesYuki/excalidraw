import { useCallback, useEffect } from "react";

import { useAtom } from "../app-jotai";
import {
  getCurrentSceneIdFromUrl,
  updateSceneIdInUrl,
} from "../auth/sceneSession";
import { currentSceneStateAtom, initialCurrentSceneState } from "./state";
import { fetchSceneDetail, SceneRequestError } from "./api";

import type { SceneRecord } from "../auth/types";

export const useCurrentScene = () => {
  const [state, setState] = useAtom(currentSceneStateAtom);

  const setCurrentScene = useCallback(
    (scene: SceneRecord | null) => {
      if (!scene) {
        updateSceneIdInUrl(null, true);
        setState(initialCurrentSceneState);
        return;
      }

      updateSceneIdInUrl(scene.sceneId, true);
      setState({
        status: "ready",
        scene,
        errorMessage: "",
      });
    },
    [setState],
  );

  const refreshCurrentScene = useCallback(async () => {
    const sceneId = getCurrentSceneIdFromUrl();
    if (!sceneId) {
      setState((prev) =>
        prev.scene
          ? { status: "idle", scene: null, errorMessage: "" }
          : { ...prev, status: "idle", errorMessage: "" },
      );
      return null;
    }

    setState((prev) => ({
      status: "loading",
      scene: prev.scene,
      errorMessage: "",
    }));

    try {
      const scene = await fetchSceneDetail(sceneId);
      setState({
        status: "ready",
        scene,
        errorMessage: "",
      });
      return scene;
    } catch (error) {
      if (
        error instanceof SceneRequestError &&
        (error.status === 403 || error.status === 404)
      ) {
        updateSceneIdInUrl(null, true);
        setState({
          status: "idle",
          scene: null,
          errorMessage:
            error.status === 403
              ? "当前画布无权访问，已返回默认画布。"
              : "当前画布不存在，已返回默认画布。",
        });
        return null;
      }

      const message = error instanceof Error ? error.message : "加载画布失败";
      setState({
        status: "error",
        scene: null,
        errorMessage: message,
      });
      return null;
    }
  }, [setState]);

  useEffect(() => {
    void refreshCurrentScene();

    const handlePopState = () => {
      void refreshCurrentScene();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [refreshCurrentScene]);

  return {
    currentSceneState: state,
    currentScene: state.scene,
    setCurrentScene,
    refreshCurrentScene,
  };
};
