const SCENE_ID_PARAM = "sceneId";

const toSceneId = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const getCurrentSceneIdFromUrl = (): number | null => {
  const searchParams = new URLSearchParams(window.location.search);
  return toSceneId(searchParams.get(SCENE_ID_PARAM));
};

export const updateSceneIdInUrl = (sceneId: number | null, replace = false) => {
  const url = new URL(window.location.href);
  if (sceneId && sceneId > 0) {
    url.searchParams.set(SCENE_ID_PARAM, String(sceneId));
  } else {
    url.searchParams.delete(SCENE_ID_PARAM);
  }

  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", `${url.pathname}${url.search}${url.hash}`);
};

export const buildSceneCollabUrl = ({
  sceneId,
  roomId,
  roomKey,
}: {
  sceneId: number;
  roomId: string;
  roomKey: string;
}) => {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(SCENE_ID_PARAM, String(sceneId));
  url.hash = `room=${encodeURIComponent(roomId)},${encodeURIComponent(roomKey)}`;
  return `${url.pathname}${url.search}${url.hash}`;
};
