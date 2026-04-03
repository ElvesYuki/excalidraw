import { ENCRYPTION_KEY_BITS } from "@excalidraw/common";

import { blobToArrayBuffer } from "./blob";

export const IV_LENGTH_BYTES = 12;

const isCryptoSupported = () =>
  typeof window !== "undefined" &&
  !!window.crypto &&
  !!window.crypto.subtle &&
  window.isSecureContext;

const bytesToBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

export const createIV = (): Uint8Array<ArrayBuffer> => {
  const arr = new Uint8Array(IV_LENGTH_BYTES);
  return window.crypto.getRandomValues(arr);
};

export const generateEncryptionKey = async <
  T extends "string" | "cryptoKey" = "string",
>(
  returnAs?: T,
): Promise<T extends "cryptoKey" ? CryptoKey : string> => {
  if (!isCryptoSupported()) {
    if (returnAs === "cryptoKey") {
      throw new Error(
        "CryptoKey generation is unavailable in insecure HTTP contexts",
      );
    }

    const keyBytes = window.crypto.getRandomValues(new Uint8Array(16));
    return bytesToBase64Url(keyBytes) as T extends "cryptoKey"
      ? CryptoKey
      : string;
  }

  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: ENCRYPTION_KEY_BITS,
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );
  return (
    returnAs === "cryptoKey"
      ? key
      : (await window.crypto.subtle.exportKey("jwk", key)).k
  ) as T extends "cryptoKey" ? CryptoKey : string;
};

export const getCryptoKey = (key: string, usage: KeyUsage) =>
  window.crypto.subtle.importKey(
    "jwk",
    {
      alg: "A128GCM",
      ext: true,
      k: key,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    {
      name: "AES-GCM",
      length: ENCRYPTION_KEY_BITS,
    },
    false, // extractable
    [usage],
  );

export const encryptData = async (
  key: string | CryptoKey,
  data: Uint8Array<ArrayBuffer> | ArrayBuffer | Blob | File | string,
): Promise<{ encryptedBuffer: ArrayBuffer; iv: Uint8Array<ArrayBuffer> }> => {
  const buffer: ArrayBuffer | Uint8Array<ArrayBuffer> =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : data instanceof Blob
      ? await blobToArrayBuffer(data)
      : data;

  if (!isCryptoSupported()) {
    return {
      encryptedBuffer:
        buffer instanceof Uint8Array ? buffer.slice().buffer : buffer.slice(0),
      iv: createIV(),
    };
  }

  const importedKey =
    typeof key === "string" ? await getCryptoKey(key, "encrypt") : key;
  const iv = createIV();

  // We use symmetric encryption. AES-GCM is the recommended algorithm and
  // includes checks that the ciphertext has not been modified by an attacker.
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    importedKey,
    buffer,
  );

  return { encryptedBuffer, iv };
};

export const decryptData = async (
  iv: Uint8Array<ArrayBuffer>,
  encrypted: Uint8Array<ArrayBuffer> | ArrayBuffer,
  privateKey: string,
): Promise<ArrayBuffer> => {
  if (!isCryptoSupported()) {
    return encrypted instanceof Uint8Array ? encrypted.slice().buffer : encrypted;
  }

  const key = await getCryptoKey(privateKey, "decrypt");
  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encrypted,
  );
};
