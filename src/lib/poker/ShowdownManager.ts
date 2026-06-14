import { HandEvaluator, HandResult } from "./HandEvaluator";

export interface ShowdownPlayer {
  id: string;
  name: string;
  cards: string[]; // Hole cards
  totalBet: number; // Total apostado nesta mão (base do cálculo de side pots)
  hasFolded: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[]; // Apenas quem pode ganhar este pote
}

export interface PotResult {
  potIndex: number; // 0 = pote principal, 1+ = laterais
  amount: number;
  winners: string[];
  isSplit: boolean;
  amountPerWinner: number;
  remainder: number; // Ficha(s) ímpar(es) — primeiro vencedor à esquerda do dealer
}

export interface ShowdownResult {
  pots: PotResult[];
  rankings: Array<{
    playerId: string;
    playerName: string;
    bestHand: HandResult;
    isWinner: boolean;
    showCards: boolean;
  }>;
}

export class ShowdownManager {
  /**
   * Determina vencedor(es) do showdown aplicando as regras oficiais:
   *   1. Melhor mão de 5 entre as 7 disponíveis.
   *   2. Desempate por kicker (codificado no score — maior = mais forte).
   *   3. Split pot quando scores empatam.
   *   4. Side pots corretos para all-ins de valores diferentes.
   */
  public static resolve(players: ShowdownPlayer[], board: string[], dealerIndex: number): ShowdownResult {
    const evaluations = players
      .filter((p) => !p.hasFolded)
      .map((p) => ({ ...p, bestHand: HandEvaluator.evaluateBestHand([...p.cards, ...board]) }));

    const sidePots = this.calculateSidePots(players);

    const potResults: PotResult[] = sidePots.map((pot, idx) => {
      const eligible = evaluations.filter((e) => pot.eligiblePlayerIds.includes(e.id));
      if (eligible.length === 0) {
        return { potIndex: idx, amount: pot.amount, winners: [], isSplit: false, amountPerWinner: 0, remainder: 0 };
      }

      const maxScore = Math.max(...eligible.map((e) => e.bestHand.score));
      const winnersUnordered = eligible.filter((e) => e.bestHand.score === maxScore).map((e) => e.id);
      // Ordena vencedores por assento a partir da esquerda do dealer (regra da ficha ímpar).
      const winners = this.orderBySeatFromDealer(winnersUnordered, players, dealerIndex);

      const amountPerWinner = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount % winners.length;

      return { potIndex: idx, amount: pot.amount, winners, isSplit: winners.length > 1, amountPerWinner, remainder };
    });

    const rankings = evaluations
      .sort((a, b) => b.bestHand.score - a.bestHand.score)
      .map((e) => ({
        playerId: e.id,
        playerName: e.name,
        bestHand: e.bestHand,
        isWinner: potResults.some((pot) => pot.winners.includes(e.id)),
        showCards: true,
      }));

    return { pots: potResults, rankings };
  }

  /**
   * Cálculo de Side Pots (regras oficiais).
   * Ordena por valor total apostado e, a cada nível, cria um pote com
   * (diferença × nº de contribuintes). Apenas não-foldados são elegíveis.
   */
  public static calculateSidePots(players: ShowdownPlayer[]): SidePot[] {
    const pots: SidePot[] = [];
    let prevLevel = 0;

    const levels = [...new Set(players.map((p) => p.totalBet))].filter((v) => v > 0).sort((a, b) => a - b);

    for (const level of levels) {
      const contribution = level - prevLevel;
      if (contribution <= 0) continue;

      const contributors = players.filter((p) => p.totalBet >= level);
      const potAmount = contribution * contributors.length;
      const eligible = contributors.filter((p) => !p.hasFolded).map((p) => p.id);

      if (potAmount > 0) pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
      prevLevel = level;
    }

    return pots;
  }

  /** Ordena os ids pela ordem de assento a partir do primeiro à esquerda do dealer. */
  private static orderBySeatFromDealer(ids: string[], players: ShowdownPlayer[], dealerIndex: number): string[] {
    const n = players.length;
    const ordered: string[] = [];
    for (let i = 1; i <= n; i++) {
      const seat = players[(dealerIndex + i) % n];
      if (ids.includes(seat.id)) ordered.push(seat.id);
    }
    // Mantém eventuais ids não encontrados nos assentos (defensivo) no fim.
    for (const id of ids) if (!ordered.includes(id)) ordered.push(id);
    return ordered;
  }

  /** Descrição textual de um pote para exibição no showdown. */
  public static describePotResult(result: PotResult, playerNames: Record<string, string>): string {
    if (result.winners.length === 0) return "Pote sem vencedor (todos foldaram)";
    if (result.isSplit) {
      const names = result.winners.map((id) => playerNames[id] || id).join(" e ");
      return `Split Pot — ${names} dividem ${result.amount} fichas (${result.amountPerWinner} cada${
        result.remainder > 0 ? ` + ${result.remainder} ficha ímpar para o primeiro à esquerda do dealer` : ""
      })`;
    }
    const winner = playerNames[result.winners[0]] || result.winners[0];
    return `${winner} vence ${result.amount} fichas`;
  }

  /**
   * Mão não disputada: quando todos os outros foldaram, o último jogador
   * vence o pote sem mostrar cartas.
   */
  public static resolveUncontested(winnerId: string, players: ShowdownPlayer[]): ShowdownResult {
    const totalPot = players.reduce((sum, p) => sum + p.totalBet, 0);
    return {
      pots: [{ potIndex: 0, amount: totalPot, winners: [winnerId], isSplit: false, amountPerWinner: totalPot, remainder: 0 }],
      rankings: [],
    };
  }
}
