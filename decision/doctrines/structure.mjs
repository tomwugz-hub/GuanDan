export function evaluateHandShape(candidateFacts) {
  const evidence = [];
  if (candidateFacts.cardCount > 0) {
    evidence.push({
      code: "REDUCE_REMAINING_CARDS",
      facts: { remaining: candidateFacts.remainingCardCount },
    });
  }
  if (candidateFacts.breaksStructures.length > 0) {
    evidence.push({
      code: "STRUCTURE_DAMAGE",
      facts: { types: candidateFacts.breaksStructures.map((item) => item.type) },
    });
  }
  if (candidateFacts.usesBombResource) {
    evidence.push({ code: "BOMB_RESOURCE_COST", facts: {} });
  }
  return {
    remainingValue: -candidateFacts.remainingCardCount,
    damageValue: -candidateFacts.breaksStructures.length,
    bombValue: candidateFacts.usesBombResource ? -1 : 0,
    evidence,
  };
}
