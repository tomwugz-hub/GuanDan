export function parseAuditMode(argv = process.argv) {
  const lite = argv.includes("--lite");
  const perf = argv.includes("--perf");
  if (lite && perf) throw new Error("--lite and --perf are mutually exclusive");
  const budgetArg = argv.find((arg) => /^--turn-budget-ms=\d+$/.test(arg));
  const explicitBudget = budgetArg ? Number(budgetArg.split("=")[1]) : null;
  return {
    mode: lite ? "lite" : perf ? "perf" : "full",
    turnBudgetMs: lite ? (explicitBudget ?? 0) : perf ? (explicitBudget ?? 400) : null,
  };
}

export function classifyAuditPath({ forcedFallback = false, reasons = [] } = {}) {
  if (forcedFallback) return "constant";
  const text = (reasons ?? []).join("\n");
  if (/超时兜底：(结构安全领出|常数时间安全出牌|无安全牌可压)/.test(text)) {
    return "constant";
  }
  if (/(^|\n)(兜底：|超时兜底：)/.test(text)) return "fast";
  return "normal";
}

export function summarizeElapsedMs(samples = []) {
  const sorted = samples.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0 };
  const nearestRank = (ratio) => sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
  const rounded = (value) => Number(value.toFixed(2));
  return {
    p50: rounded(nearestRank(0.5)),
    p95: rounded(nearestRank(0.95)),
    p99: rounded(nearestRank(0.99)),
    max: rounded(sorted.at(-1)),
  };
}

export function buildTopReproductions(violations, limit = 10) {
  const grouped = new Map();
  for (const violation of violations ?? []) {
    const current = grouped.get(violation.code);
    if (current) {
      current.count += 1;
    } else {
      grouped.set(violation.code, {
        code: violation.code,
        count: 1,
        sample: violation,
      });
    }
  }
  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
    .slice(0, limit);
}
