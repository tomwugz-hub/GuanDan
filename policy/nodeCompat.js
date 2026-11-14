/** Browser-safe process.env / stderr for policy code bundled into the play page. */

export function envOpt(key) {
  return typeof process !== 'undefined' ? process.env?.[key] : undefined;
}

export function envFlag(key) {
  return typeof process !== 'undefined' && !!process.env?.[key];
}

/** Debug line when env KEY is set (Node selfplay); no-op in browser. */
export function ruleTrig(envKey, msg) {
  if (typeof process !== 'undefined' && process.env?.[envKey]) process.stderr.write(msg);
}

/** Dynamic debug line (Node only). */
export function ruleLog(envKey, msg) {
  if (typeof process !== 'undefined' && process.env?.[envKey]) {
    process.stderr.write(typeof msg === 'function' ? msg() : msg);
  }
}