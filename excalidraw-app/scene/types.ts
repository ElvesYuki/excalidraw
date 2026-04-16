import type { SceneDetailRecord } from "../auth/types";

export type CurrentSceneStatus = "idle" | "loading" | "ready" | "error";

export type CurrentSceneState = {
  status: CurrentSceneStatus;
  scene: SceneDetailRecord | null;
  errorMessage: string;
  isCollabReadOnly: boolean;
};
