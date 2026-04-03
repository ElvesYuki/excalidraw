import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";

const port = Number(process.env.PORT || 3015);
const apiPrefix = process.env.API_PREFIX || "/api/v1";
const corsOrigin = process.env.CORS_ORIGIN || "*";
const storageDir = process.env.STORAGE_DIR || "/tmp/excalidraw-storage";

const app = express();

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(","),
  }),
);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const sanitizeKeySegment = (value) =>
  value.replace(/^\/+/, "").replace(/\.\./g, "");

const getSceneFilePath = (roomId) =>
  path.join(storageDir, "scenes", `${sanitizeKeySegment(roomId)}.json`);

const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const sendNotFound = (res) => {
  res.status(404).json({ error: "Not found" });
};

app.get(`${apiPrefix}/scenes/:roomId`, async (req, res) => {
  try {
    const filePath = getSceneFilePath(req.params.roomId);
    const buffer = await fs.readFile(filePath);
    res.type("application/json").send(buffer);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return sendNotFound(res);
    }
    console.error(error);
    res.status(500).json({ error: "Failed to load scene" });
  }
});

app.put(
  `${apiPrefix}/scenes/:roomId`,
  express.json({ limit: "10mb" }),
  async (req, res) => {
    try {
      const filePath = getSceneFilePath(req.params.roomId);
      await ensureParentDir(filePath);
      await fs.writeFile(filePath, JSON.stringify(req.body));
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save scene" });
    }
  },
);

app.listen(port, "0.0.0.0", async () => {
  await fs.mkdir(path.join(storageDir, "scenes"), { recursive: true });
  console.log(`storage api listening on http://0.0.0.0:${port}`);
});
