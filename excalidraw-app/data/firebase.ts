import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { getDataURL, getMimeType } from "@excalidraw/excalidraw/data/blob";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

type StoredScenePayload = {
  elements: readonly SyncableExcalidrawElement[];
  fileUrls?: Record<string, string>;
};

type UploadFileResult = {
  contentType?: string;
  fileName?: string;
  url: string;
};

const API_PREFIX = "/api/v1";

const getStorageBackendBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_APP_STORAGE_BACKEND_URL?.trim();
  return configuredBaseUrl || window.location.origin;
};

const getFileUploadBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_APP_FILE_UPLOAD_URL?.trim();
  return configuredBaseUrl || window.location.origin;
};

const createStorageUrl = (path: string) => {
  return new URL(`${API_PREFIX}${path}`, getStorageBackendBaseUrl()).toString();
};

const getErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.msg === "string" && data.msg) {
      return data.msg;
    }
    if (typeof data?.error === "string" && data.error) {
      return data.error;
    }
  } catch {
    // noop
  }
  return `Request failed with status ${response.status}`;
};

const sceneFileUrlsCache = new Map<string, Record<string, string>>();

const normalizeUploadedFileUrl = (url: string) => {
  const assetHost = import.meta.env.VITE_APP_FILE_UPLOAD_ASSET_PREFIX?.trim();
  if (!assetHost || /^https?:\/\//i.test(url)) {
    return url;
  }
  return new URL(url.replace(/^\//, ""), `${assetHost.replace(/\/+$/, "")}/`)
    .toString();
};

const uploadFileToHttpService = async (file: File): Promise<UploadFileResult> => {
  const uploadCode =
    import.meta.env.VITE_APP_FILE_UPLOAD_CODE?.trim() || "default";
  const uploadPath =
    import.meta.env.VITE_APP_FILE_UPLOAD_PATH?.trim() ||
    "/function/oss/upload/single/file";

  const formData = new FormData();
  formData.append("code", uploadCode);
  formData.append("file", file, file.name || "upload.bin");

  const url = new URL(uploadPath, getFileUploadBaseUrl());

  const response = await fetch(url.toString(), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const result = await response.json();
  if (!result?.success || !result?.data?.url) {
    throw new Error(result?.msg || "Upload failed");
  }

  return {
    contentType: result.data.contentType || file.type,
    fileName: result.data.fileName || file.name,
    url: normalizeUploadedFileUrl(result.data.url),
  };
};

const fetchScene = async (roomId: string): Promise<StoredScenePayload | null> => {
  const response = await fetch(createStorageUrl(`/scenes/${roomId}`));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json();
};

const putScene = async (roomId: string, scene: StoredScenePayload) => {
  const response = await fetch(createStorageUrl(`/scenes/${roomId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scene),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

const getSceneCacheKey = (prefix: string) => {
  const match = prefix.match(/\/rooms\/([^/]+)$/);
  return match?.[1] || prefix;
};

const cacheSceneFileUrls = (
  cacheKey: string,
  fileUrls: Record<string, string> | undefined,
) => {
  if (fileUrls) {
    sceneFileUrlsCache.set(cacheKey, fileUrls);
  }
};

const getCachedSceneFileUrls = (prefix: string) => {
  return sceneFileUrlsCache.get(getSceneCacheKey(prefix)) || {};
};

const blobToBinaryFileData = async ({
  id,
  blob,
}: {
  id: FileId;
  blob: Blob;
}): Promise<BinaryFileData> => {
  const mimeType =
    ((await getMimeType(blob, null)) as BinaryFileData["mimeType"]) ||
    MIME_TYPES.binary;

  return {
    id,
    dataURL: (await getDataURL(blob)) as DataURL,
    mimeType,
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    FirebaseSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const loadFirebaseStorage = async () => {
  return null;
};

export const uploadBlobToStorage = async ({
  fileId,
  blob,
}: {
  prefix: string;
  fileId: string;
  blob: Blob;
  metadata?: Record<string, string>;
}) => {
  await uploadFileToHttpService(
    new File([blob], fileId, { type: blob.type || "application/octet-stream" }),
  );
};

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    return FirebaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  return true;
};

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];
  const uploadedUrls: Record<string, string> = {};

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const blob = new Blob([buffer], {
          type: "application/octet-stream",
        });
        const uploadResult = await uploadFileToHttpService(
          new File([blob], id, { type: blob.type }),
        );
        uploadedUrls[id] = uploadResult.url;
        savedFiles.push(id);
      } catch {
        erroredFiles.push(id);
      }
    }),
  );

  const cacheKey = getSceneCacheKey(prefix);
  if (Object.keys(uploadedUrls).length) {
    sceneFileUrlsCache.set(cacheKey, {
      ...sceneFileUrlsCache.get(cacheKey),
      ...uploadedUrls,
    });
  }

  return { savedFiles, erroredFiles };
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
) => {
  const { roomId, socket } = portal;
  if (!roomId || !socket || isSavedToFirebase(portal, elements)) {
    return null;
  }

  const cacheKey = getSceneCacheKey(`files/rooms/${roomId}`);
  const fileUrls = sceneFileUrlsCache.get(cacheKey) || {};

  const storedScene: StoredScenePayload = {
    elements,
    fileUrls,
  };

  await putScene(roomId, storedScene);

  const restoredElements = toBrandedType(
    restoreElements(storedScene.elements, null, {
      deleteInvisibleElements: true,
    }),
  );

  FirebaseSceneVersionCache.set(socket, restoredElements);

  return restoredElements;
};

export const loadFromFirebase = async (
  roomId: string,
  _roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const storedScene = await fetchScene(roomId);
  if (!storedScene) {
    return null;
  }

  cacheSceneFileUrls(roomId, storedScene.fileUrls);

  const elements = toBrandedType(
    restoreElements(storedScene.elements, null, {
      deleteInvisibleElements: true,
    }),
  );

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const loadFilesFromFirebase = async (
  prefix: string,
  _decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();
  const fileUrls = getCachedSceneFileUrls(prefix);

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      const url = fileUrls[id];
      if (!url) {
        erroredFiles.set(id, true);
        return;
      }

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file ${id}`);
        }

        const blob = await response.blob();
        loadedFiles.push(
          await blobToBinaryFileData({
            id,
            blob,
          }),
        );
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
