export const MAX_PLAYERS = 4;
export const ROOM_CODE_LENGTH = 6;
export const POINT_UNIT = 3; // 1 punto = 3 unita (terzi di punto)

export const SUITS = [
  { key: "CUPS", label: "Coppe", asset: "Cups" },
  { key: "COINS", label: "Denari", asset: "Coins" },
  { key: "CLUBS", label: "Bastoni", asset: "Clubs" },
  { key: "SWORDS", label: "Spade", asset: "Swords" },
];

export const RANKS = [
  { key: "1", label: "Asso" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "7", label: "7" },
  { key: "F", label: "Fante" },
  { key: "H", label: "Cavallo" },
  { key: "K", label: "Re" },
];

export const CARD_LABELS = new Map();
for (const suit of SUITS) {
  for (const rank of RANKS) {
    CARD_LABELS.set(`${suit.key}-${rank.key}`, `${rank.label} di ${suit.label}`);
  }
}

export function buildDeck() {
  const deck: string[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${suit.key}-${rank.key}`);
    }
  }
  return deck;
}

export function shuffle(deck: string[]) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function dealFullDeck(order: string[], deck: string[]) {
  const hands: Record<string, string[]> = {};
  order.forEach((playerId) => {
    hands[playerId] = [];
  });
  deck.forEach((card, index) => {
    const playerId = order[index % order.length];
    hands[playerId].push(card);
  });
  return hands;
}

export function formatCard(card: string) {
  return CARD_LABELS.get(card) || card;
}

export function parseCard(card: string) {
  const [suit, rank] = card.split("-");
  return { suit, rank };
}

export function cardImage(card: string) {
  const { suit, rank } = parseCard(card);
  const suitAsset = SUITS.find((s) => s.key === suit)?.asset || suit;
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  return `${baseUrl}assets/cards/${suitAsset}_${rank}.png`;
}

export const TRICK_ORDER = ["3", "2", "1", "K", "H", "F", "7", "6", "5", "4"];
export const TRICK_RANK = new Map(TRICK_ORDER.map((rank, index) => [rank, index]));

export const POINT_VALUE = new Map([
  ["1", POINT_UNIT],
  ["2", 1],
  ["3", 1],
  ["K", 1],
  ["H", 1],
  ["F", 1],
]);

export function cardPoints(card: string) {
  const { rank } = parseCard(card);
  return POINT_VALUE.get(rank) || 0;
}

export function compareCards(a: string, b: string, leadSuit: string, briscolaSuit: string) {
  const ca = parseCard(a);
  const cb = parseCard(b);

  const aIsBriscola = ca.suit === briscolaSuit;
  const bIsBriscola = cb.suit === briscolaSuit;
  if (aIsBriscola && !bIsBriscola) return 1;
  if (!aIsBriscola && bIsBriscola) return -1;

  const suitToFollow = aIsBriscola || bIsBriscola ? briscolaSuit : leadSuit;
  const aMatches = ca.suit === suitToFollow;
  const bMatches = cb.suit === suitToFollow;
  if (aMatches && !bMatches) return 1;
  if (!aMatches && bMatches) return -1;

  const rankA = TRICK_RANK.get(ca.rank) ?? 99;
  const rankB = TRICK_RANK.get(cb.rank) ?? 99;
  return rankA < rankB ? 1 : rankA > rankB ? -1 : 0;
}

export function pointsFromUnits(units: number) {
  return Math.floor(units / POINT_UNIT);
}

export function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function countTeams(players: any[]) {
  return players.reduce(
    (acc: any, player: any) => {
      if (player.team === "A") {
        acc.A += 1;
      } else if (player.team === "B") {
        acc.B += 1;
      }
      return acc;
    },
    { A: 0, B: 0 }
  );
}
