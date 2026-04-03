import express from "express";
import cors from "cors";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const port = Number(process.env.PORT || 3015);
const apiPrefix = process.env.API_PREFIX || "/api/v1";
const s3Bucket = process.env.S3_BUCKET;
const s3Region = process.env.S3_REGION || "us-east-1";
const corsOrigin = process.env.CORS_ORIGIN || "*";

if (!s3Bucket) {
  throw new Error("S3_BUCKET is required");
}

const s3 = new S3Client({
  region: s3Region,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const app = express();

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(","),
  }),
);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const sanitizeKeySegment = (value) => value.replace(/^\/+/, "").replace(/\.\./g, "");

const getSceneKey = (roomId) => `scenes/${sanitizeKeySegment(roomId)}.json`;

const getFileKey = (prefix, fileId) => {
  const normalizedPrefix = sanitizeKeySegment(prefix || "files");
  return `${normalizedPrefix}/${sanitizeKeySegment(fileId)}`;
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const sendNotFound = (res) => {
  res.status(404).json({ error: "Not found" });
};

app.get(`${apiPrefix}/scenes/:roomId`, async (req, res) => {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: s3Bucket,
        Key: getSceneKey(req.params.roomId),
      }),
    );
    const buffer = await streamToBuffer(response.Body);
    res.type("application/json").send(buffer);
  } catch (error) {
    if (error?.name === "NoSuchKey") {
      return sendNotFound(res);
    }
    console.error(error);
    res.status(500).json({ error: "Failed to load scene" });
  }
});

app.put(`${apiPrefix}/scenes/:roomId`, express.json({ limit: "10mb" }), async (req, res) => {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: getSceneKey(req.params.roomId),
        Body: JSON.stringify(req.body),
        ContentType: "application/json",
        CacheControl: "no-store",
      }),
    );
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save scene" });
  }
});

app.get(`${apiPrefix}/files/:fileId`, async (req, res) => {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: s3Bucket,
        Key: getFileKey(req.query.prefix, req.params.fileId),
      }),
    );
    res.setHeader(
      "Cache-Control",
      response.CacheControl || "public, max-age=31536000",
    );
    res.type(response.ContentType || "application/octet-stream");
    response.Body.pipe(res);
  } catch (error) {
    if (error?.name === "NoSuchKey") {
      return sendNotFound(res);
    }
    console.error(error);
    res.status(500).json({ error: "Failed to load file" });
  }
});

app.put(
  `${apiPrefix}/files/:fileId`,
  express.raw({ type: "*/*", limit: "10mb" }),
  async (req, res) => {
    try {
      const metadata = req.query.metadata
        ? JSON.parse(String(req.query.metadata))
        : undefined;
      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: getFileKey(req.query.prefix, req.params.fileId),
          Body: req.body,
          ContentType: req.get("content-type") || "application/octet-stream",
          CacheControl:
            req.get("cache-control") || "public, max-age=31536000",
          Metadata: metadata,
        }),
      );
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save file" });
    }
  },
);

app.listen(port, "0.0.0.0", () => {
  console.log(`storage api listening on http://0.0.0.0:${port}`);
});
