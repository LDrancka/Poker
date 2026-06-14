export type HandRank =
  | "HIGH_CARD"
  | "ONE_PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH"
  | "ROYAL_FLUSH";

export interface HandResult {
  rank: HandRank;
  score: number; // CONVENÇÃO ÚNICA DO SISTEMA: MAIOR score = mão mais forte
  description: string;
}

const RANK_ORDER: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
};

// CONVENÇÃO ÚNICA: maior número = categoria mais forte. Combinada com os kickers
// codificados abaixo, garante "maior score = mão mais forte" em TODO o sistema
// (evaluateBestHand, calculateEquity e ShowdownManager).
const HAND_SCORES: Record<HandRank, number> = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

export class HandEvaluator {
  /** Avalia a melhor mão de 5 cartas entre N cartas (ex.: 7 = hole + board). */
  public static evaluateBestHand(cards: string[]): HandResult {
    if (cards.length < 5) {
      throw new Error(`evaluateBestHand requer ao menos 5 cartas, recebeu ${cards.length}`);
    }
    const combinations = this.getCombinations(cards, 5);
    let best: HandResult | null = null;
    for (const combo of combinations) {
      const result = this.evaluateFiveCard(combo);
      if (!best || result.score > best.score) best = result;
    }
    return best!;
  }

  private static getCombinations(arr: string[], k: number): string[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    const withFirst = this.getCombinations(rest, k - 1).map((c) => [first, ...c]);
    const withoutFirst = this.getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  private static evaluateFiveCard(cards: string[]): HandResult {
    const ranks = cards.map((c) => RANK_ORDER[c[0]]).sort((a, b) => b - a);
    const suits = cards.map((c) => c[1]);
    const isFlush = suits.every((s) => s === suits[0]);
    const isStraight = this.checkStraight(ranks);

    const rankCounts = this.countRanks(ranks);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // Kickers = ranks (decrescente) que não pertencem ao(s) grupo(s) excluído(s).
    const kickers = (exclude: number[]) => ranks.filter((r) => !exclude.includes(r));

    if (isFlush && isStraight && ranks[0] === 14 && ranks[1] === 13) {
      return { rank: "ROYAL_FLUSH", score: HAND_SCORES.ROYAL_FLUSH * 1e10, description: "Royal Flush" };
    }
    if (isFlush && isStraight) {
      const high = ranks[0] === 14 && ranks[1] === 5 ? 5 : ranks[0]; // Wheel: high é o 5
      return { rank: "STRAIGHT_FLUSH", score: HAND_SCORES.STRAIGHT_FLUSH * 1e10 + high, description: "Straight Flush" };
    }
    if (counts[0] === 4) {
      const quadRank = this.getHighCard(rankCounts, 4);
      const kicker = kickers([quadRank])[0] || 0;
      return { rank: "FOUR_OF_A_KIND", score: HAND_SCORES.FOUR_OF_A_KIND * 1e10 + quadRank * 1e4 + kicker, description: "Quadra" };
    }
    if (counts[0] === 3 && counts[1] === 2) {
      const tripRank = this.getHighCard(rankCounts, 3);
      const pairRank = this.getHighCard(rankCounts, 2);
      return { rank: "FULL_HOUSE", score: HAND_SCORES.FULL_HOUSE * 1e10 + tripRank * 1e4 + pairRank, description: "Full House" };
    }
    if (isFlush) {
      return {
        rank: "FLUSH",
        score: HAND_SCORES.FLUSH * 1e10 + ranks[0] * 1e8 + ranks[1] * 1e6 + ranks[2] * 1e4 + ranks[3] * 1e2 + ranks[4],
        description: "Flush",
      };
    }
    if (isStraight) {
      const high = ranks[0] === 14 && ranks[1] === 5 ? 5 : ranks[0]; // Wheel
      return { rank: "STRAIGHT", score: HAND_SCORES.STRAIGHT * 1e10 + high, description: "Sequência" };
    }
    if (counts[0] === 3) {
      const tripRank = this.getHighCard(rankCounts, 3);
      const ks = kickers([tripRank]).sort((a, b) => b - a);
      return {
        rank: "THREE_OF_A_KIND",
        score: HAND_SCORES.THREE_OF_A_KIND * 1e10 + tripRank * 1e6 + (ks[0] || 0) * 1e4 + (ks[1] || 0),
        description: "Trinca",
      };
    }
    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = Object.entries(rankCounts)
        .filter(([, v]) => v === 2)
        .map(([k]) => Number(k))
        .sort((a, b) => b - a);
      const kk = kickers([pairs[0], pairs[1]]).sort((a, b) => b - a);
      return {
        rank: "TWO_PAIR",
        score: HAND_SCORES.TWO_PAIR * 1e10 + pairs[0] * 1e6 + pairs[1] * 1e4 + (kk[0] || 0),
        description: "Dois Pares",
      };
    }
    if (counts[0] === 2) {
      const pairRank = this.getHighCard(rankCounts, 2);
      const ks = kickers([pairRank]).sort((a, b) => b - a);
      return {
        rank: "ONE_PAIR",
        score: HAND_SCORES.ONE_PAIR * 1e10 + pairRank * 1e8 + (ks[0] || 0) * 1e6 + (ks[1] || 0) * 1e4 + (ks[2] || 0),
        description: "Um Par",
      };
    }
    return {
      rank: "HIGH_CARD",
      score: HAND_SCORES.HIGH_CARD * 1e10 + ranks[0] * 1e8 + ranks[1] * 1e6 + ranks[2] * 1e4 + ranks[3] * 1e2 + ranks[4],
      description: "Carta Alta",
    };
  }

  private static checkStraight(sortedRanks: number[]): boolean {
    if (new Set(sortedRanks).size !== 5) return false;
    if (sortedRanks[0] - sortedRanks[4] === 4) return true;
    // Wheel (A-2-3-4-5): Ás conta como 1
    return JSON.stringify(sortedRanks) === JSON.stringify([14, 5, 4, 3, 2]);
  }

  private static countRanks(ranks: number[]): Record<number, number> {
    return ranks.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {} as Record<number, number>);
  }

  private static getHighCard(counts: Record<number, number>, targetCount: number): number {
    return Math.max(
      ...Object.entries(counts)
        .filter(([, v]) => v === targetCount)
        .map(([k]) => Number(k)),
    );
  }

  /**
   * Equidade via Monte Carlo contra oponentes com mãos ALEATÓRIAS (ranges desconhecidos).
   * Empates dividem o valor (0.5 heads-up, 1/N em multiway) — refino do item 0.4 do roadmap.
   */
  public static calculateEquity(
    playerCards: string[],
    boardCards: string[],
    numOpponents = 1,
    iterations = 1000,
  ): number {
    let equitySum = 0;
    for (let i = 0; i < iterations; i++) {
      const used = new Set([...playerCards, ...boardCards]);
      const deck = this.shuffleArr(this.buildRemainingDeck(used));
      let idx = 0;

      const fullBoard = [...boardCards];
      while (fullBoard.length < 5) fullBoard.push(deck[idx++]);

      const opponents: string[][] = [];
      for (let op = 0; op < numOpponents; op++) opponents.push([deck[idx++], deck[idx++]]);

      equitySum += this.scoreShare(playerCards, opponents, fullBoard);
    }
    return equitySum / iterations;
  }

  /**
   * Equidade via Monte Carlo contra oponentes com mãos FIXAS (ex.: AKs vs QQ).
   * Usado para validar coin-flips conhecidos. Empates contam 0.5 (item 0.4).
   */
  public static calculateEquityVs(
    playerCards: string[],
    opponentHands: string[][],
    boardCards: string[] = [],
    iterations = 1000,
  ): number {
    let equitySum = 0;
    const fixed = new Set([...playerCards, ...opponentHands.flat(), ...boardCards]);
    for (let i = 0; i < iterations; i++) {
      const deck = this.shuffleArr(this.buildRemainingDeck(fixed));
      let idx = 0;
      const fullBoard = [...boardCards];
      while (fullBoard.length < 5) fullBoard.push(deck[idx++]);
      equitySum += this.scoreShare(playerCards, opponentHands, fullBoard);
    }
    return equitySum / iterations;
  }

  /** Fração do pote que o jogador leva nesta amostra (1 vence só, 1/k empate, 0 perde). */
  private static scoreShare(playerCards: string[], opponents: string[][], fullBoard: string[]): number {
    const myScore = this.evaluateBestHand([...playerCards, ...fullBoard]).score;
    let tiedWithMe = 1; // o próprio jogador
    for (const opCards of opponents) {
      const opScore = this.evaluateBestHand([...opCards, ...fullBoard]).score;
      if (opScore > myScore) return 0; // perdeu para alguém
      if (opScore === myScore) tiedWithMe++; // empate → split
    }
    return 1 / tiedWithMe;
  }

  private static buildRemainingDeck(exclude: Set<string>): string[] {
    const suits = ["h", "d", "c", "s"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
    const deck: string[] = [];
    for (const s of suits) {
      for (const r of ranks) {
        const card = r + s;
        if (!exclude.has(card)) deck.push(card);
      }
    }
    return deck;
  }

  private static shuffleArr<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
