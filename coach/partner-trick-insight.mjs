/**
 * 从最近出牌记录识别「队友压队友」异常（P10）
 */
import { canBeat } from "../engine/compare-play.mjs";
import { PLAY_TYPES } from "../engine/play-types.mjs";
import { isTeammate } from "../strategy/seat-utils.mjs";

const BOMB_TYPES = new Set([PLAY_TYPES.bomb, PLAY_TYPES.straightFlush, PLAY_TYPES.jokerBomb]);

/**
 * @param {Array<{ playerIndex?: number, playerName?: string, play?: object }>} playHistory
 * @returns {null | { beater: object, victim: object, isHeavyBeat: boolean }}
 */
export function findTeammateBeatIncident(playHistory = []) {
  const history = Array.isArray(playHistory) ? playHistory : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const beat = history[i];
    const beatPlay = beat?.play;
    if (!beatPlay || beatPlay.type === PLAY_TYPES.pass) continue;
    if (beat.playerIndex == null) continue;

    let j = i - 1;
    while (j >= 0 && history[j]?.play?.type === PLAY_TYPES.pass) j -= 1;
    if (j < 0) continue;

    const victim = history[j];
    const victimPlay = victim?.play;
    if (!victimPlay || victimPlay.type === PLAY_TYPES.pass) continue;
    if (victim.playerIndex == null) continue;
    if (!isTeammate(beat.playerIndex, victim.playerIndex)) continue;
    if (!canBeat(beatPlay, victimPlay)) continue;

    const isHeavyBeat = BOMB_TYPES.has(beatPlay.type)
      || (beatPlay.type === PLAY_TYPES.pair && (beatPlay.mainRank === "BJ" || beatPlay.mainRank === "SJ"))
      || (beatPlay.type === PLAY_TYPES.single && (beatPlay.mainRank === "BJ" || beatPlay.mainRank === "SJ"));

    return { beater: beat, victim, isHeavyBeat };
  }
  return null;
}

/** 用户只写「不合理」等短句时，结合最近牌局补全专问 */
export function expandVagueObjectionQuestion(question, context = {}) {
  const q = String(question ?? "").trim();
  const vague = q.length <= 8 || /^(不合理|不对|有问题|不好|错了)[。！?？]*$/u.test(q);
  if (!vague) return q;

  const incident = findTeammateBeatIncident(
    context.recentPlayHistory ?? context.playHistory ?? [],
  );
  if (!incident) return q;

  const victimLabel = incident.victim.play?.label ?? incident.victim.play?.type ?? "牌";
  const beatLabel = incident.beater.play?.label ?? incident.beater.play?.type ?? "牌";
  return `${incident.victim.playerName ?? "队友"}出${victimLabel}，${incident.beater.playerName ?? "机器人"}用${beatLabel}压队友，为何不合理`;
}

export function buildTeammateBeatInsightAnalysis(incident) {
  if (!incident) return null;
  const victimName = incident.victim.playerName ?? "队友";
  const beaterName = incident.beater.playerName ?? "机器人";
  const victimLabel = incident.victim.play?.label ?? "牌";
  const beatLabel = incident.beater.play?.label ?? "牌";
  const heavy = incident.isHeavyBeat
    ? "用王/炸弹压队友代价极高，"
    : "";
  return [
    `你说得对：${victimName}本墩已出${victimLabel}占牌，${beaterName}不应再用${beatLabel}抢队友牌权。`,
    `原则P10（队友让牌）：${heavy}应过牌让队友继续走牌或等对手来压。`,
    "这属于机器人策略失误，已按教纲记为不合理出牌。",
  ].join("");
}
