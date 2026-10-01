function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!value || typeof value !== "object") return value;
  const clone = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "function") {
      throw new TypeError(`DecisionResult cannot contain function at ${key}`);
    }
    clone[key] = clonePlain(child);
  }
  return clone;
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function createDecisionResult(input = {}) {
  const status = input.status;
  if (status !== "ok" && status !== "error") {
    throw new TypeError('DecisionResult status must be "ok" or "error"');
  }
  if (status === "ok" && !input.top1) {
    throw new TypeError("DecisionResult top1 is required when status is ok");
  }
  if (status === "ok" && typeof input.signature !== "string") {
    throw new TypeError("DecisionResult signature is required when status is ok");
  }

  return deepFreeze(clonePlain({
    status,
    top1: input.top1 ?? null,
    alternatives: input.alternatives ?? [],
    signature: input.signature ?? "",
    evidence: input.evidence ?? [],
    explanation: input.explanation ?? { short: [], detailed: [] },
    rejectedByInvariant: input.rejectedByInvariant ?? [],
    skillTags: input.skillTags ?? [],
    diagnostics: input.diagnostics ?? {},
    error: input.error ?? null,
  }));
}
