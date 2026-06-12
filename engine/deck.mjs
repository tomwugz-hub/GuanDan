import { createCard, SUITS } from "./card.mjs";
import { sortCardsForDisplay } from "./rank-order.mjs";

const NORMAL_RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
const NORMAL_SUITS = [SUITS.spades, SUITS.hearts, SUITS.clubs, SUITS.diamonds];

export function createDoubleDeck() {
  const cards = [];

  for (let deckIndex = 0; deckIndex < 2; deckIndex += 1) {
    for (const suit of NORMAL_SUITS) {
      for (const rank of NORMAL_RANKS) {
        cards.push(createCard(rank, suit, deckIndex));
      }
    }

    cards.push(createCard("SJ", SUITS.joker, deckIndex));
    cards.push(createCard("BJ", SUITS.joker, deckIndex));
  }

  return cards;
}

export function shuffle(cards, random = Math.random) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function dealFourPlayers(cards, levelRank) {
  if (cards.length !== 108) {
    throw new Error(`Expected 108 cards, got ${cards.length}`);
  }

  const hands = [[], [], [], []];
  cards.forEach((card, index) => {
    hands[index % 4].push(card);
  });

  return hands.map((hand) => sortCardsForDisplay(hand));
}
