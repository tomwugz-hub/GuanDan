import { SUITS, createCard } from "../../engine/card.mjs";

const SUIT_MAP = { S: SUITS.spades, H: SUITS.hearts, C: SUITS.clubs, D: SUITS.diamonds };

/** OpenGuanDan: "HA" / 旧平台 name: "H2" */
export function parseOpenGuanDanCard(code, deckIndex = 0) {
  const text = String(code ?? "").trim().toUpperCase();
  if (text === "SB" || text === "B") return createCard("SJ", "JOKER", deckIndex);
  if (text === "HR" || text === "R") return createCard("BJ", "JOKER", deckIndex);
  if (text.length < 2) return null;
  const suit = SUIT_MAP[text[0]];
  let rank = text.slice(1);
  if (rank === "T") rank = "10";
  if (!suit || !rank) return null;
  return createCard(rank, suit, deckIndex);
}

export function parseLegacyGdCard(card, deckIndex = 0) {
  if (!card) return null;
  if (card.name) return parseOpenGuanDanCard(card.name, card.deckIndex ?? deckIndex);
  if (card.color && card.viewNumber) {
    const rank = card.viewNumber === "T" ? "10" : card.viewNumber;
    if (rank === "B") return createCard("SJ", "JOKER", deckIndex);
    if (rank === "R") return createCard("BJ", "JOKER", deckIndex);
    return parseOpenGuanDanCard(`${card.color}${rank}`, deckIndex);
  }
  return null;
}

export function parseCardList(codes, parser = parseOpenGuanDanCard) {
  const used = new Map();
  const cards = [];
  for (const code of codes ?? []) {
    const key = String(code);
    const deckIndex = used.get(key) ?? 0;
    used.set(key, deckIndex + 1);
    const card = parser(code, deckIndex);
    if (card) cards.push(card);
  }
  return cards;
}
