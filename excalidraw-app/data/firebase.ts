import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

type StoredScenePayload = {
  sceneVersion: number;
  iv: string;
  ciphertext: string;
};

const API_PREFIX = "/api/v1";

const getStorageBackendBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_APP_STORAGE_BACKEND_URL?.trim();
  return configuredBaseUrl || window.location.origin;
};

const createStorageUrl = (path: string, searchParams?: URLSearchParams) => {
  const url = new URL(`${API_PREFIX}${path}`, getStorageBackendBaseUrl());
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return url.toString();
};

const getErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") {
      return data.error;
    }
  } catch {
    // noop
  }
  return `Request failed with status ${response.status}`;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

const putFile = async ({
  fileId,
  prefix,
  buffer,
  contentType,
  metadata,
}: {
  fileId: FileId;
  prefix: string;
  buffer: Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
}) => {
  const searchParams = new URLSearchParams({ prefix });
  if (metadata) {
    searchParams.set("metadata", JSON.stringify(metadata));
  }
  const response = await fetch(
    createStorageUrl(`/files/${encodeURIComponent(fileId)}`, searchParams),
    {
      method: "PUT",
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
      },
      body: buffer,
    },
  );
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

const getFile = async ({
  fileId,
  prefix,
}: {
  fileId: FileId;
  prefix: string;
}) => {
  const response = await fetch(
    createStorageUrl(
      `/files/${encodeURIComponent(fileId)}`,
      new URLSearchParams({ prefix }),
    ),
  );
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return new Uint8Array(await response.arrayBuffer());
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: StoredScenePayload,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = base64ToBytes(data.ciphertext);
  const iv = base64ToBytes(data.iv);

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
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
  prefix,
  fileId,
  blob,
  metadata,
}: {
  prefix: string;
  fileId: string;
  blob: Blob;
  metadata?: Record<string, string>;
}) => {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  await putFile({
    fileId: fileId as FileId,
    prefix,
    buffer,
    contentType: blob.type || "application/octet-stream",
    metadata,
  });
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

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        await putFile({
          fileId: id,
          prefix,
          buffer,
        });
        savedFiles.push(id);
      } catch {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createStoredScene = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  return {
    sceneVersion,
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  } satisfies StoredScenePayload;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (!roomId || !roomKey || !socket || isSavedToFirebase(portal, elements)) {
    return null;
  }

  const existingScene = await fetchScene(roomId);
  let elementsToStore = elements;

  if (existingScene) {
    const prevStoredElements = getSyncableElements(
      restoreElements(await decryptElements(existingScene, roomKey), null),
    );

    elementsToStore = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );
  }

  const storedScene = await createStoredScene(elementsToStore, roomKey);
  await putScene(roomId, storedScene);

  const storedElements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null),
  );

  FirebaseSceneVersionCache.set(socket, storedElements);

  return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const storedScene = await fetchScene(roomId);
  if (!storedScene) {
    return null;
  }

  const elements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null, {
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
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const arrayBuffer = await getFile({
          fileId: id,
          prefix,
        });

        const { data, metadata } = await decompressData<BinaryFileMetadata>(
          arrayBuffer,
          {
            decryptionKey,
          },
        );

        const dataURL = new TextDecoder().decode(data) as DataURL;

        loadedFiles.push({
          mimeType: metadata.mimeType || MIME_TYPES.binary,
          id,
          dataURL,
          created: metadata?.created || Date.now(),
          lastRetrieved: metadata?.created || Date.now(),
        });
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
