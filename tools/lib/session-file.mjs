import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  compactSessionForPersist,
  validateSessionPayload,
} from "../../app/boot-guard.mjs";

const SESSION_FILE_MAX_BYTES = 3_000_000;

export async function writeSessionFile(trainingDir, session) {
  await mkdir(trainingDir, { recursive: true });
  const path = join(trainingDir, "active-session.json");
  const compact = compactSessionForPersist(session);
  await writeFile(path, JSON.stringify(compact, null, 2), "utf8");
  return path;
}

export async function readSessionFile(trainingDir) {
  const path = join(trainingDir, "active-session.json");
  try {
    const fileStat = await stat(path);
    if (fileStat.size > SESSION_FILE_MAX_BYTES) {
      await unlink(path);
      return null;
    }
    const text = await readFile(path, "utf8");
    const data = JSON.parse(text);
    const compact = compactSessionForPersist(data);
    if (!validateSessionPayload(compact)) return null;
    return compact;
  } catch {
    return null;
  }
}

export async function deleteSessionFile(trainingDir) {
  const path = join(trainingDir, "active-session.json");
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}
