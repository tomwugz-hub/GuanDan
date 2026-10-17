import path from "node:path";

export { DEFAULT_DEV_HOST } from "../lan-access.mjs";

const ALLOWED_PREFIXES = [
  "/app/",
  "/engine/",
  "/strategy/",
  "/decision/",
  "/coach/",
  "/simulation/",
  "/src/",
  "/training-samples/",
  "/datasets/",
];

function normalizeUrlPath(urlPath) {
  if (!urlPath || urlPath === "/") return "/app/";
  return urlPath.endsWith("/") && urlPath.length > 1 ? urlPath.slice(0, -1) : urlPath;
}

export function isLocalDevelopmentRequest(host, remoteAddress) {
  const remote = remoteAddress ?? "";
  if (remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1") {
    return true;
  }
  if (host === "127.0.0.1" || host === "localhost") return true;
  return false;
}

/**
 * Map HTTP path to a file under project root; block traversal and sensitive paths.
 */
export function resolveStaticAccess(projectRoot, urlPath, { localRequest = true } = {}) {
  const normalized = normalizeUrlPath(urlPath);
  const allowedPrefix = ALLOWED_PREFIXES.some((prefix) => (
    normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)
  ));
  if (!allowedPrefix) {
    return { allowed: false, filePath: null };
  }

  const relative = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  const filePath = path.resolve(projectRoot, relative);
  const rootResolved = path.resolve(projectRoot);
  if (!filePath.startsWith(rootResolved + path.sep) && filePath !== rootResolved) {
    return { allowed: false, filePath: null };
  }

  if (normalized.startsWith("/training-samples/") && !localRequest) {
    return { allowed: false, filePath: null };
  }

  return { allowed: true, filePath };
}
