import { deepFreeze } from "./result.mjs";

const SHORT = Object.freeze({
  RESERVE_WILD_FOR_NATURAL_ROUTE: "\u5f00\u5c40\u5df2\u6709\u5929\u7136\u6210\u7ec4\u724c\uff0c\u9022\u4eba\u914d\u7559\u7ed9\u9ad8\u4ef7\u503c\u7ed3\u6784\u3002",
  RESERVE_WILD_FOR_NATURAL_BEATER: "\u6709\u5929\u7136\u540c\u578b\u538b\u724c\uff0c\u4e0d\u5fc5\u6d88\u8017\u9022\u4eba\u914d\u3002",
  FINISH_HAND: "这一手可以直接走完。",
  BLOCK_OPPONENT_ONE_CARD: "对手已经报单，优先封住这一手。",
  YIELD_TO_PARTNER: "对家已经控牌，这里让牌。",
  USE_REGULAR_BEATER: "有普通牌可以压住，不必动用炸弹资源。",
  ONLY_BOMB_RESOURCE: "当前只有炸弹资源能够完成应对。",
  LEAD_LOOSE_SINGLE: "接风时先走不伤结构的小单张。",
  PASS_RESERVE_WILD: "对手大单试探，过牌保留逢人配。",
  RESERVE_WILD_FOR_JOKER: "手牌仍多，宜王夺权，不宜先耗逢人配。",
  RESERVE_WILD_HIGH_PROBE: "逢人配宜留作同花顺/炸弹，不宜中单张压试探。",
  JOKER_OVER_WILD: "有大单试探时，优先用王夺权而非逢人配。",
  RESERVE_WILD_FOR_NATURAL_PLANE: "有天然钢板能压住，逢人配留给更高价值结构。",
});

function detailedLine(item) {
  switch (item.code) {
    case "FINISH_HAND": return "出完后手牌归零。";
    case "BLOCK_OPPONENT_ONE_CARD": return "当前占牌的对手只剩一张，不能轻易放过。";
    case "YIELD_TO_PARTNER": return item.facts?.partnerNearFinish
      ? "对家接近走完并保持牌权，让牌有利于团队收尾。"
      : "当前牌权属于对家，不用无收益地抢回。";
    case "USE_REGULAR_BEATER": return "普通压牌已经足够完成应对。";
    case "PASS_OPTION": return "过牌仍是合法选择。";
    case "ONLY_BOMB_RESOURCE": return "候选池中没有普通压牌。";
    case "LEAD_LOOSE_SINGLE": return "本轮已接回牌权，优先清理散单并保留成组牌。";
    case "LEAD_COMPLETE_STRUCTURE": return "本轮已接回牌权，候选可完整走掉一组成牌。";
    case "REDUCE_REMAINING_CARDS": return Number.isInteger(item.facts?.remaining)
      ? `出牌后剩余${item.facts.remaining}张。`
      : null;
    case "STRUCTURE_DAMAGE": return "该候选会拆开现有完整结构。";
    case "BOMB_RESOURCE_COST": return "该候选会消耗炸弹级资源。";
    case "PASS_RESERVE_WILD": return "局面尚早，过牌保留逢人配更利于后续组牌。";
    case "RESERVE_WILD_FOR_JOKER": return "手牌仍多且须压大单试探，宜先出王夺权。";
    case "RESERVE_WILD_HIGH_PROBE": return "逢人配应优先凑同花顺或炸弹，不宜当单张压试探。";
    case "JOKER_OVER_WILD": return "有王可夺权时，不应先打出逢人配单张。";
    case "RESERVE_WILD_FOR_NATURAL_PLANE": return "有天然钢板可完成应对，不用逢人配补低位钢板，保留给同花顺、炸弹或收官。";
    case "RESERVE_WILD_FOR_NATURAL_ROUTE": return "\u5f00\u5c40\u5df2\u6709\u5929\u7136\u6210\u7ec4\u724c\uff0c\u4e0d\u7528\u9022\u4eba\u914d\u51d1\u666e\u901a\u8fde\u5bf9\u3001\u94a2\u677f\u6216\u4e09\u5e26\u4e8c\uff0c\u4fdd\u7559\u7ed9\u540c\u82b1\u987a\u3001\u70b8\u5f39\u6216\u6536\u5b98\u3002";
    case "RESERVE_WILD_FOR_NATURAL_BEATER": return "\u5bf9\u624b\u7684\u724c\u578b\u5df2\u6709\u5929\u7136\u538b\u724c\uff0c\u5f53\u524d\u4e0d\u5fc5\u7528\u9022\u4eba\u914d\u8ffd\u6c42\u66f4\u9ad8\u70b9\u6570\u3002";
    default: return null;
  }
}

export function renderDecisionExplanation(evidence = []) {
  const short = [];
  const detailed = [];
  for (const item of evidence) {
    if (short.length === 0 && SHORT[item.code]) short.push(SHORT[item.code]);
    const line = detailedLine(item);
    if (line && !detailed.includes(line)) detailed.push(line);
  }
  return deepFreeze({ short, detailed });
}
