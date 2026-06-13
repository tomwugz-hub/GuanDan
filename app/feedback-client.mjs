import { buildCoachFeedbackPayload } from "../coach/feedback-sample.mjs";
import { safeGetItem, safeSetItem } from "./storage-safe.mjs";

const FEEDBACK_QUEUE_KEY = "guandan-coach-feedback-queue";
const DISPUTE_QUEUE_KEY = "guandan-coach-dispute-queue";
const BRIDGE_URL = "http://127.0.0.1:8787/coach-feedback";
const DISPUTE_URL = "http://127.0.0.1:8787/coach-dispute";

export function readFeedbackQueue() {
  try {
    const raw = safeGetItem(FEEDBACK_QUEUE_KEY, "[]");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFeedbackQueue(items) {
  safeSetItem(FEEDBACK_QUEUE_KEY, JSON.stringify(items.slice(-80)));
}

export function enqueueFeedback(payload) {
  const queue = readFeedbackQueue();
  queue.push({ queuedAt: new Date().toISOString(), payload });
  writeFeedbackQueue(queue);
  return queue.length;
}

export async function postCoachFeedback(payload) {
  const response = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `coach-feedback failed: ${response.status}`);
  return data;
}

export async function flushFeedbackQueue() {
  const queue = readFeedbackQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      await postCoachFeedback(item.payload);
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }
  writeFeedbackQueue(remaining);
  return { flushed, remaining: remaining.length };
}

export function buildFeedbackFromSession({
  question,
  context,
  record,
  currentPosition,
  matchLevels,
  matchGameNumber,
}) {
  return buildCoachFeedbackPayload({
    question,
    context,
    record,
    currentPosition,
    matchLevels,
    matchGameNumber,
  });
}

export async function submitCoachFeedback(payload) {
  try {
    const result = await postCoachFeedback(payload);
    return { ok: true, online: true, ...result };
  } catch (error) {
    const pending = enqueueFeedback(payload);
    return {
      ok: true,
      online: false,
      pending,
      error: error.message || String(error),
    };
  }
}

export function readDisputeQueue() {
  try {
    const raw = safeGetItem(DISPUTE_QUEUE_KEY, "[]");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeDisputeQueue(items) {
  safeSetItem(DISPUTE_QUEUE_KEY, JSON.stringify(items.slice(-120)));
}

export function enqueueDispute(dispute) {
  const queue = readDisputeQueue();
  queue.push({ queuedAt: new Date().toISOString(), dispute });
  writeDisputeQueue(queue);
  return queue.length;
}

export async function postUserDispute(dispute) {
  const response = await fetch(DISPUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dispute),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `coach-dispute failed: ${response.status}`);
  return data;
}

export async function submitUserDispute(dispute) {
  try {
    const result = await postUserDispute(dispute);
    return { ok: true, online: true, ...result };
  } catch (error) {
    const pending = enqueueDispute(dispute);
    return {
      ok: true,
      online: false,
      pending,
      error: error.message || String(error),
    };
  }
}
