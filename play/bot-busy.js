/** Shared bot-busy invariants for play/ui.js (testable in Node). */
export const HUMAN_SEAT = 0;

/** scheduleBots: stop the bot loop and release the UI lock. */
export function shouldYieldPlayToHuman({
  isOver,
  tribMode,
  tributePending,
  currentSeat,
  humanSeat = HUMAN_SEAT,
}) {
  return isOver || !!tribMode || !!tributePending || currentSeat === humanSeat;
}

/** Human south should be able to act (matches render myTurn except selection). */
export function humanPlayPhase({
  isOver,
  tribMode,
  tributePending,
  currentSeat,
  humanSeat = HUMAN_SEAT,
}) {
  return !isOver && !tribMode && !tributePending && currentSeat === humanSeat;
}

/** Stale bot callback after token bump: never leave human locked behind botBusy. */
export function botBusyAfterStaleCallback({
  botBusy,
  my,
  token,
  currentSeat,
  humanSeat = HUMAN_SEAT,
  isOver = false,
  tribMode = false,
  tributePending = false,
}) {
  if (my !== token && humanPlayPhase({ isOver, tribMode, tributePending, currentSeat, humanSeat })) {
    return false;
  }
  return botBusy;
}

/** render() safety net when botBusy desyncs from currentSeat. */
export function repairBotBusyForHuman(state) {
  if (humanPlayPhase(state) && state.botBusy) return false;
  return state.botBusy;
}
