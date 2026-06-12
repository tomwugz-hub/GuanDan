import { PLAY_TYPES } from "./play-types.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

function bombStrength(play) {
  if (play.type === PLAY_TYPES.jokerBomb) return [100, Number.POSITIVE_INFINITY];
  if (play.type === PLAY_TYPES.straightFlush) return [play.length, play.power + 1000];
  if (play.type === PLAY_TYPES.bomb) return [play.bombSize, play.power];
  return [0, play.power];
}

export function canBeat(candidate, previous) {
  if (!previous || previous.type === PLAY_TYPES.pass) return candidate.type !== PLAY_TYPES.invalid;
  if (candidate.type === PLAY_TYPES.pass) return true;
  if (candidate.type === PLAY_TYPES.invalid || previous.type === PLAY_TYPES.invalid) return false;

  const candidateIsBomb = BOMB_TYPES.has(candidate.type);
  const previousIsBomb = BOMB_TYPES.has(previous.type);

  if (candidateIsBomb || previousIsBomb) {
    if (!candidateIsBomb) return false;
    if (!previousIsBomb) return true;

    const [candidateSize, candidatePower] = bombStrength(candidate);
    const [previousSize, previousPower] = bombStrength(previous);
    if (candidateSize !== previousSize) return candidateSize > previousSize;
    return candidatePower > previousPower;
  }

  if (candidate.type !== previous.type) return false;
  if (candidate.length !== previous.length) return false;
  return candidate.power > previous.power;
}

