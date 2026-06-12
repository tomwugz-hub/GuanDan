import { existsSync, readFileSync } from "node:fs";
import { messageTimestamp } from "./message-timestamp.mjs";

export { messageTimestamp } from "./message-timestamp.mjs";

export function loadMessagesFromFile(path) {
  if (!existsSync(path)) {
    const error = new Error(`文件不存在: ${path}`);
    error.code = "ENOENT";
    throw error;
  }
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  if (path.endsWith(".jsonl")) {
    return text.split(/\r?\n/).map((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const msg = JSON.parse(trimmed);
      return { msg, lineIndex };
    }).filter(Boolean);
  }
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    return data.map((msg, lineIndex) => ({ msg, lineIndex }));
  }
  if (data.messages) {
    return data.messages.map((msg, lineIndex) => ({ msg, lineIndex }));
  }
  return [{ msg: data, lineIndex: 0 }];
}

