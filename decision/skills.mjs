const SKILL_BY_EVIDENCE = Object.freeze({
  FINISH_HAND: "ENDGAME",
  BLOCK_OPPONENT_ONE_CARD: "ENDGAME",
  YIELD_TO_PARTNER: "PARTNER",
  USE_REGULAR_BEATER: "TEMPO",
  PASS_OPTION: "TEMPO",
  ONLY_BOMB_RESOURCE: "BOMB",
  LEAD_LOOSE_SINGLE: "TEMPO",
  LEAD_COMPLETE_STRUCTURE: "STRUCTURE",
  REDUCE_REMAINING_CARDS: "STRUCTURE",
  STRUCTURE_DAMAGE: "STRUCTURE",
  BOMB_RESOURCE_COST: "BOMB",
});

export function skillTagsForEvidence(evidence = []) {
  const tags = [];
  for (const item of evidence) {
    const tag = SKILL_BY_EVIDENCE[item.code];
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return Object.freeze(tags);
}
