import { isDeepStrictEqual } from "node:util";

export function publishAfterInputVerification({ before, after, publish }) {
  if (!isDeepStrictEqual(after, before)) {
    throw new Error("immutable Douyin source evidence changed during refinement");
  }
  if (typeof publish !== "function") throw new Error("publish callback is required");
  return publish();
}
