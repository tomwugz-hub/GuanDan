import { Worker } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';

const WORKER = new URL('./worker.mjs', import.meta.url);

/**
 * 并行跑 tasks（每个 task 一个 worker），最多 n 个同时。
 * ckpt：检查点文件（jsonl，每行 {i, key, r}）；已完成的 task（同下标且同 key）直接复用，中断后重跑同一命令即可续跑。
 */
export function runTasks(tasks, n = Math.max(1, Math.min(7, os.cpus().length - 1)), onDone = null, { ckpt = null } = {}) {
  // 有 Jev 代理的任务：并发 = JEV_CONCURRENCY（默认 4；每个 worker 同一时刻最多一个 API 请求）
  const blob = JSON.stringify(tasks.map((t) => t.jobs || t.positions || []));
  if (/"jev(#[^"]*)?"/.test(blob)) n = Math.min(n, Number(process.env.JEV_CONCURRENCY || 4));
  // StartLux：bamboo 默认并发 3；local Instant 单槽默认 1（STARTLUX_BACKEND / BAMBOO_API_KEY）
  if (/"startlux(#[^"]*)?"/.test(blob)) {
    const bamboo = (process.env.STARTLUX_BACKEND || '').toLowerCase() === 'bamboo'
      || ((process.env.STARTLUX_BACKEND || '').toLowerCase() !== 'local' && !!process.env.BAMBOO_API_KEY);
    const def = bamboo ? 3 : 1;
    n = Math.min(n, Number(process.env.STARTLUX_CONCURRENCY || def));
  }
  return new Promise((resolve, reject) => {
    const results = new Array(tasks.length);
    const keyOf = (t) => JSON.stringify(t).length + ':' + JSON.stringify(t).slice(0, 200);
    let done = 0;
    if (ckpt && fs.existsSync(ckpt)) {
      for (const line of fs.readFileSync(ckpt, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try { const o = JSON.parse(line); if (tasks[o.i] && o.key === keyOf(tasks[o.i]) && !results[o.i]) { results[o.i] = o.r; done++; } } catch { /* 半行 */ }
      }
      if (done) console.error(`[pool] checkpoint ${ckpt}: ${done}/${tasks.length} tasks already done`);
    }
    const todo = tasks.map((_, i) => i).filter((i) => !results[i]);
    let next = 0;
    if (!todo.length) return resolve(results);
    const start = () => {
      if (next >= todo.length) return;
      const i = todo[next++];
      const w = new Worker(WORKER, { workerData: { task: tasks[i] } });
      w.once('message', (m) => {
        if (m.error) return reject(new Error(m.error));
        results[i] = m;
        if (ckpt) fs.appendFileSync(ckpt, JSON.stringify({ i, key: keyOf(tasks[i]), r: m }) + '\n');
        done++;
        if (onDone) onDone(done, tasks.length);
        w.terminate();
        if (done === tasks.length) resolve(results);
        else start();
      });
      w.once('error', reject);
    };
    for (let k = 0; k < Math.min(n, todo.length); k++) start();
  });
}

/** 把 jobs 分成 chunk 份的 deals 任务。 */
export function dealTasks(jobs, { collect = true, chunk = 25 } = {}) {
  const tasks = [];
  for (let i = 0; i < jobs.length; i += chunk) tasks.push({ kind: 'deals', collect, jobs: jobs.slice(i, i + chunk) });
  return tasks;
}

/** 配对统计：每个 seed 两副（换座位）取均值，返回均值与 95% CI。 */
export function pairedStats(values) {
  const n = values.length;
  const m = values.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
  const half = 1.96 * sd / Math.sqrt(n || 1);
  return { n, mean: m, lo: m - half, hi: m + half };
}
