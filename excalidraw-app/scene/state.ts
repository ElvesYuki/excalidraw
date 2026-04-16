import { atom } from "../app-jotai";

import type { CurrentSceneState } from "./types";

export const initialCurrentSceneState: CurrentSceneState = {
  status: "idle",
  scene: null,
  errorMessage: "",
  isCollabReadOnly: false,
};

export const currentSceneStateAtom = atom<CurrentSceneState>(
  initialCurrentSceneState,
);
