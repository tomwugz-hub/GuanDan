function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

/** 广播类 notify 四路客户端会重复，合并时只留一份 */
export function dedupeKey(msg) {
  if (!msg || typeof msg !== "object") return stableStringify(msg);

  if (msg.type === "notify" && msg.stage === "beginning") {
    return `beginning:${msg.myPos}`;
  }

  if (msg.type === "notify") {
    const { handCards, myPos, ...rest } = msg;
    return `notify:${stableStringify(rest)}`;
  }

  if (msg.type === "act") {
    return `act:${msg.stage}:${stableStringify({
      curPos: msg.curPos,
      curRank: msg.curRank,
      greaterPos: msg.greaterPos,
      actionList: msg.actionList,
      indexRange: msg.indexRange,
    })}`;
  }

  if (msg.type === "PLAY" && msg.data) {
    return `play:${msg.data.player}:${stableStringify(msg.data.act)}`;
  }

  if (typeof msg.id === "number") {
    return `legacy:${msg.id}:${stableStringify(msg.data ?? {})}`;
  }

  return stableStringify(msg);
}
