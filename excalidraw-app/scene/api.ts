import { authorizedFetch } from "../auth/api";

import type { SceneDetailRecord } from "../auth/types";

const API_PREFIX = "/api/v1";

const getBackendBaseUrl = () =>
  import.meta.env.VITE_APP_STORAGE_BACKEND_URL?.trim() ||
  import.meta.env.VITE_APP_BACKEND_URL?.trim() ||
  window.location.origin;

const createBackendUrl = (path: string) =>
  new URL(path, getBackendBaseUrl()).toString();

const getUserSceneDetailUrl = (sceneId: number) =>
  createBackendUrl(`${API_PREFIX}/user-scenes/${sceneId}`);

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const json = await response.json();
    return json?.error || json?.msg || fallback;
  } catch {
    return fallback;
  }
};

export class SceneRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SceneRequestError";
    this.status = status;
  }
}

export const fetchSceneDetail = async (
  sceneId: number,
): Promise<SceneDetailRecord> => {
  const response = await authorizedFetch(getUserSceneDetailUrl(sceneId));
  if (!response.ok) {
    throw new SceneRequestError(
      await getErrorMessage(response, "加载画布失败"),
      response.status,
    );
  }
  const json = await response.json();
  return json?.data as SceneDetailRecord;
};
