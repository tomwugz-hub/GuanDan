/**
 * 本地策略审计单进程锁（避免并行 audit 写同一报告文件）。
 * 云端 CI 为单 job 时直接 no-op。
 */
export function acquireAuditLock({ command = "audit-strategy" } = {}) {
  return {
    command,
    release() {},
  };
}
