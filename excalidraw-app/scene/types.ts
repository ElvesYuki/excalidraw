import type { SceneRecord } from "../auth/types";

export type CurrentSceneStatus = "idle" | "loading" | "ready" | "error";

export type CurrentSceneState = {
  status: CurrentSceneStatus;
  scene: SceneRecord | null;
  errorMessage: string;
};
