import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { captureEnvironment } from "../env";

const version = "v1";

function key(encoded = captureEnvironment().ENCRYPTION_KEY) {
  if (!encoded)
    throw new Error("Set ENCRYPTION_KEY to save connection passwords.");
  return Buffer.from(encoded, "base64");
}

export function encryptionAvailable() {
  return Boolean(captureEnvironment().ENCRYPTION_KEY);
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext>, all base64url. */
export function encryptSecret(plain: string, encoded?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(encoded), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    version,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}

export function decryptSecret(sealed: string, encoded?: string) {
  const [prefix, iv, tag, body] = sealed.split(".");
  if (prefix !== version || !iv || !tag || body === undefined)
    throw new Error("Unrecognised secret format.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(encoded),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newToken() {
  return "et_" + randomBytes(32).toString("base64url");
}
