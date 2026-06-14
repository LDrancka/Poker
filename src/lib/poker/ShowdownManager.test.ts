import { describe, it, expect } from "vitest";
import { ShowdownManager, ShowdownPlayer } from "./ShowdownManager";

const player = (over: Partial<ShowdownPlayer> & { id: string }): ShowdownPlayer => ({
  name: over.id,
  cards: [],
  totalBet: 0,
  hasFolded: false,
  ...over,
});

describe("ShowdownManager.calculateSidePots", () => {
  it("pote único quando todos apostam o mesmo valor", () => {
    const players = [
      player({ id: "A", totalBet: 100 }),
      player({ id: "B", totalBet: 100 }),
      player({ id: "C", totalBet: 100 }),
    ];
    const pots = ShowdownManager.calculateSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds).toEqual(["A", "B", "C"]);
  });

  it("multi all-in: três níveis distintos geram principal + 2 side pots", () => {
    // A all-in 500, B all-in 1500, C cobre 2000.
    const players = [
      player({ id: "A", totalBet: 500 }),
      player({ id: "B", totalBet: 1500 }),
      player({ id: "C", totalBet: 2000 }),
    ];
    const pots = ShowdownManager.calculateSidePots(players);
    expect(pots).toHaveLength(3);
    // Principal: 500 × 3 = 1500 (todos elegíveis)
    expect(pots[0]).toEqual({ amount: 1500, eligiblePlayerIds: ["A", "B", "C"] });
    // Side 1: (1500-500) × 2 = 2000 (B, C)
    expect(pots[1]).toEqual({ amount: 2000, eligiblePlayerIds: ["B", "C"] });
    // Side 2: (2000-1500) × 1 = 500 (só C, recebe de volta)
    expect(pots[2]).toEqual({ amount: 500, eligiblePlayerIds: ["C"] });
  });

  it("foldado contribui para o valor mas não é elegível a ganhar", () => {
    const players = [
      player({ id: "A", totalBet: 100, hasFolded: true }),
      player({ id: "B", totalBet: 100 }),
      player({ id: "C", totalBet: 100 }),
    ];
    const pots = ShowdownManager.calculateSidePots(players);
    expect(pots[0].amount).toBe(300); // dinheiro do foldado entra no pote
    expect(pots[0].eligiblePlayerIds).toEqual(["B", "C"]); // mas ele não ganha
  });

  it("a soma dos potes conserva o total apostado", () => {
    const players = [
      player({ id: "A", totalBet: 500 }),
      player({ id: "B", totalBet: 1500 }),
      player({ id: "C", totalBet: 2000 }),
    ];
    const total = players.reduce((s, p) => s + p.totalBet, 0);
    const pots = ShowdownManager.calculateSidePots(players);
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(total);
  });
});

describe("ShowdownManager.resolve — vencedor", () => {
  it("vencedor único leva o pote inteiro", () => {
    const players = [
      player({ id: "A", cards: ["Ah", "Ad"], totalBet: 100 }), // par de Áses
      player({ id: "B", cards: ["Kh", "Kd"], totalBet: 100 }), // par de Reis
    ];
    const board = ["2c", "7d", "9s", "Jc", "4h"];
    const res = ShowdownManager.resolve(players, board, 0);
    expect(res.pots[0].winners).toEqual(["A"]);
    expect(res.pots[0].amountPerWinner).toBe(200);
    expect(res.pots[0].isSplit).toBe(false);
  });

  it("split pot: pote par dividido igualmente, sem ficha ímpar", () => {
    // Ambos jogam o board (a sequência da mesa) — empate total.
    const players = [
      player({ id: "A", cards: ["2h", "3d"], totalBet: 100 }),
      player({ id: "B", cards: ["2s", "3c"], totalBet: 100 }),
    ];
    const board = ["Ah", "Kd", "Qc", "Js", "Th"]; // sequência A-K-Q-J-T na mesa
    const res = ShowdownManager.resolve(players, board, 0);
    expect(res.pots[0].isSplit).toBe(true);
    expect(res.pots[0].winners).toHaveLength(2);
    expect(res.pots[0].amountPerWinner).toBe(100);
    expect(res.pots[0].remainder).toBe(0);
  });

  it("ficha ímpar: pote ímpar deixa 1 de resto para o primeiro à esquerda do dealer", () => {
    // Pote único de 303 (3 × 101) dividido entre 2 vencedores → 151 cada + 1 de resto.
    // A e B formam a mesma sequência (A-K-Q-J-T); C perde. Todos apostam 101.
    const players = [
      player({ id: "A", cards: ["Td", "9d"], totalBet: 101 }),
      player({ id: "B", cards: ["Ts", "9s"], totalBet: 101 }),
      player({ id: "C", cards: ["3h", "4h"], totalBet: 101 }),
    ];
    const board = ["Ah", "Kd", "Qc", "Js", "2c"]; // A-K-Q-J na mesa; T dos jogadores fecha a sequência
    // dealerIndex 0 → primeiro à esquerda é o índice 1 = jogador B.
    const res = ShowdownManager.resolve(players, board, 0);
    const main = res.pots[0];
    expect(main.amount).toBe(303);
    expect(main.isSplit).toBe(true);
    // Ordenados a partir da esquerda do dealer (idx0): B (idx1) vem antes de A (idx0).
    expect(main.winners).toEqual(["B", "A"]);
    expect(main.amountPerWinner).toBe(151);
    expect(main.remainder).toBe(1);
    expect(main.winners[0]).toBe("B"); // a ficha ímpar vai para o primeiro à esquerda do dealer
  });

  it("side pot: short-stack só disputa o principal; o excedente vai ao all-in maior", () => {
    // A (short) tem a melhor mão mas só apostou 100; B apostou 300 e tem a 2ª melhor.
    const players = [
      player({ id: "A", cards: ["Ah", "Ad"], totalBet: 100 }), // trinca de Áses
      player({ id: "B", cards: ["Kh", "Kd"], totalBet: 300 }), // trinca de Reis
      player({ id: "C", cards: ["7h", "2d"], totalBet: 300, hasFolded: true }),
    ];
    const board = ["Ac", "Kc", "5s", "9d", "3h"];
    const res = ShowdownManager.resolve(players, board, 0);
    // Principal: 100 × 3 = 300 → A vence (melhor mão entre elegíveis A,B).
    expect(res.pots[0].amount).toBe(300);
    expect(res.pots[0].winners).toEqual(["A"]);
    // Side: (300-100) × 2 = 400 → só B e (foldado) C contribuem; A não é elegível → B leva.
    expect(res.pots[1].amount).toBe(400);
    expect(res.pots[1].winners).toEqual(["B"]);
  });
});

describe("ShowdownManager.resolveUncontested", () => {
  it("último jogador leva todo o pote sem ranking", () => {
    const players = [
      player({ id: "A", totalBet: 150 }),
      player({ id: "B", totalBet: 50, hasFolded: true }),
    ];
    const res = ShowdownManager.resolveUncontested("A", players);
    expect(res.pots).toHaveLength(1);
    expect(res.pots[0].amount).toBe(200);
    expect(res.pots[0].winners).toEqual(["A"]);
    expect(res.rankings).toHaveLength(0);
  });
});
