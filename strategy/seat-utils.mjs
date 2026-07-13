/**
 * 座位工具 — 避免 table-context 与 v3 模块循环依赖
 */
export function teammateIndex(playerIndex) {
  return (playerIndex + 2) % 4;
}

export function isTeammate(leftIndex, rightIndex) {
  if (leftIndex == null || rightIndex == null) return false;
  return teammateIndex(leftIndex) === rightIndex;
}

/** 上家：出牌顺序中紧挨在你前一家（与 app/main.mjs playerSeatLabel 一致，seat+1） */
export function upperPlayerIndex(playerIndex) {
  return (playerIndex + 1) % 4;
}

/** 下家：出牌顺序中紧挨在你后一家（seat+3，即逆时针下一位） */
export function lowerPlayerIndex(playerIndex) {
  return (playerIndex + 3) % 4;
}

export function isUpperPlayer(selfIndex, otherIndex) {
  if (selfIndex == null || otherIndex == null) return false;
  return upperPlayerIndex(selfIndex) === otherIndex;
}

export function isLowerPlayer(selfIndex, otherIndex) {
  if (selfIndex == null || otherIndex == null) return false;
  return lowerPlayerIndex(selfIndex) === otherIndex;
}
