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

/** Clear botBusy whenever the scheduler must yield (human / tribute / deal over). */
export function repairBotBusy(state) {
  if (!state.botBusy) return false;
  if (shouldYieldPlayToHuman(state)) return false;
  return state.botBusy;
}

/** Bot async callback is current for this deal + schedule generation. */
export function isBotCallbackCurrent({
  scheduleGen,
  capturedGen,
  token,
  capturedToken,
}) {
  return scheduleGen === capturedGen && token === capturedToken;
}

/**
 * Infer play tribute UI mode when engine still has tributePending but tribMode was lost.
 * @returns {'resist'|'give'|'return'|null}
 */
export function inferTributeUiMode({ tributeState, tributePending, humanSeat = HUMAN_SEAT }) {
  if (!tributePending || !tributeState) return null;
  const { plan, phase } = tributeState;
  if (!plan || plan.kind === 'none') return null;
  if (plan.resisted) return 'resist';
  if (phase === 'give') return 'give';
  if (phase === 'return' && tributeState.pending?.some((x) => x.seat === humanSeat)) return 'return';
  return null;
}

/** After bot step failure the loop must continue or south stays locked behind “思考中”. */
export function shouldRescheduleBotsAfterFailure({
  isOver,
  tribMode,
  tributePending,
  currentSeat,
  humanSeat = HUMAN_SEAT,
}) {
  return !isOver && !tribMode && !tributePending && currentSeat !== humanSeat;
}
