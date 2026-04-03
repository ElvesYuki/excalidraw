type Listener = (...args: any[]) => void;

type ServerMessage = {
  event: string;
  args?: any[];
};

const encodeBytes = (value: ArrayBuffer | Uint8Array) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const decodeBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export class CollabSocket {
  id: string | null = null;

  private ws: WebSocket;
  private listeners = new Map<string, Set<Listener>>();
  private onceListeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.ws = new WebSocket(url);

    this.ws.addEventListener("open", () => {
      this.emitLocal("connect");
    });

    this.ws.addEventListener("error", () => {
      this.emitLocal("connect_error", new Error("WebSocket connection failed"));
    });

    this.ws.addEventListener("close", () => {
      this.emitLocal("disconnect");
    });

    this.ws.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data) as ServerMessage;
        if (
          payload.event === "init-room" &&
          typeof payload.args?.[0] === "string"
        ) {
          this.id = payload.args[0];
        }
        const args =
          payload.event === "client-broadcast" &&
          typeof payload.args?.[0] === "string" &&
          typeof payload.args?.[1] === "string"
            ? [
                decodeBytes(payload.args[0]).buffer,
                decodeBytes(payload.args[1]),
              ]
            : payload.args || [];
        this.emitLocal(payload.event, ...args);
      } catch (error) {
        console.error("Failed to parse collaboration message", error);
      }
    });
  }

  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) || new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  once(event: string, listener: Listener) {
    const listeners = this.onceListeners.get(event) || new Set<Listener>();
    listeners.add(listener);
    this.onceListeners.set(event, listeners);
    return this;
  }

  off(event: string, listener?: Listener) {
    if (!listener) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(listener);
    this.onceListeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, ...args: any[]) {
    const normalizedArgs =
      event === "server-broadcast" || event === "server-volatile-broadcast"
        ? [
            args[0],
            encodeBytes(args[1] as ArrayBuffer),
            encodeBytes(args[2] as Uint8Array),
          ]
        : args;

    const sendMessage = () =>
      this.ws.send(
        JSON.stringify({
          event,
          args: normalizedArgs,
        }),
      );

    if (this.ws.readyState === WebSocket.OPEN) {
      sendMessage();
      return this;
    }

    if (this.ws.readyState === WebSocket.CONNECTING) {
      const handleOpen = () => {
        this.ws.removeEventListener("open", handleOpen);
        sendMessage();
      };
      this.ws.addEventListener("open", handleOpen);
    }

    return this;
  }

  close() {
    this.ws.close();
  }

  private emitLocal(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((listener) => {
      listener(...args);
    });
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.forEach((listener) => {
        listener(...args);
      });
      this.onceListeners.delete(event);
    }
  }
}

export const createCollabSocket = (url: string) => new CollabSocket(url);
