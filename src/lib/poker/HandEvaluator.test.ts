import { describe, it, expect } from "vitest";
import { HandEvaluator, HandRank } from "./HandEvaluator";

const score = (cards: string[]) => HandEvaluator.evaluateBestHand(cards).score;
const rank = (cards: string[]) => HandEvaluator.evaluateBestHand(cards).rank;

describe("HandEvaluator — classificação de categorias", () => {
  const cases: Array<[HandRank, string[]]> = [
    ["ROYAL_FLUSH", ["Ah", "Kh", "Qh", "Jh", "Th"]],
    ["STRAIGHT_FLUSH", ["9h", "8h", "7h", "6h", "5h"]],
    ["FOUR_OF_A_KIND", ["9h", "9d", "9c", "9s", "2h"]],
    ["FULL_HOUSE", ["9h", "9d", "9c", "2s", "2h"]],
    ["FLUSH", ["Ah", "Jh", "8h", "5h", "2h"]],
    ["STRAIGHT", ["9h", "8d", "7c", "6s", "5h"]],
    ["THREE_OF_A_KIND", ["9h", "9d", "9c", "Ks", "2h"]],
    ["TWO_PAIR", ["9h", "9d", "5c", "5s", "2h"]],
    ["ONE_PAIR", ["9h", "9d", "Kc", "5s", "2h"]],
    ["HIGH_CARD", ["Ah", "Jd", "8c", "5s", "2h"]],
  ];

  it.each(cases)("identifica %s", (expected, cards) => {
    expect(rank(cards)).toBe(expected);
  });
});

describe("HandEvaluator — ranking total (maior score = mais forte)", () => {
  // Uma representante de cada categoria, da mais fraca à mais forte.
  const ladder: string[][] = [
    ["Ah", "Jd", "8c", "5s", "2h"], // HIGH_CARD
    ["9h", "9d", "Kc", "5s", "2h"], // ONE_PAIR
    ["9h", "9d", "5c", "5s", "2h"], // TWO_PAIR
    ["9h", "9d", "9c", "Ks", "2h"], // THREE_OF_A_KIND
    ["9h", "8d", "7c", "6s", "5h"], // STRAIGHT
    ["Ah", "Jh", "8h", "5h", "2h"], // FLUSH
    ["9h", "9d", "9c", "2s", "2h"], // FULL_HOUSE
    ["9h", "9d", "9c", "9s", "2h"], // FOUR_OF_A_KIND
    ["9h", "8h", "7h", "6h", "5h"], // STRAIGHT_FLUSH
    ["Ah", "Kh", "Qh", "Jh", "Th"], // ROYAL_FLUSH
  ];

  it("scores são estritamente crescentes na escada de categorias", () => {
    const scores = ladder.map(score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
  });
});

describe("HandEvaluator — bordas", () => {
  it("a wheel (A-2-3-4-5) é a sequência mais fraca, abaixo de 6-high", () => {
    const wheel = score(["5h", "4d", "3c", "2s", "Ah"]);
    const sixHigh = score(["6h", "5d", "4c", "3s", "2h"]);
    expect(rank(["5h", "4d", "3c", "2s", "Ah"])).toBe("STRAIGHT");
    expect(wheel).toBeLessThan(sixHigh);
  });

  it("straight flush A-high (royal) supera straight flush K-high", () => {
    const royal = score(["Ah", "Kh", "Qh", "Jh", "Th"]);
    const kingHigh = score(["Kh", "Qh", "Jh", "Th", "9h"]);
    expect(royal).toBeGreaterThan(kingHigh);
  });

  it("desempate por kicker: par de Áses com K supera par de Áses com Q", () => {
    const aceKing = score(["Ah", "Ad", "Kc", "7s", "3h"]);
    const aceQueen = score(["Ah", "Ad", "Qc", "7s", "3h"]);
    expect(aceKing).toBeGreaterThan(aceQueen);
  });

  it("dois pares: desempate pelo kicker quando os pares são iguais", () => {
    const withKing = score(["Ah", "Ad", "5c", "5s", "Kh"]);
    const withQueen = score(["Ah", "Ad", "5c", "5s", "Qh"]);
    expect(withKing).toBeGreaterThan(withQueen);
  });

  it("split: duas mãos idênticas em ranks têm o mesmo score", () => {
    const a = score(["Ah", "Kd", "Qc", "Js", "9h"]);
    const b = score(["As", "Kh", "Qd", "Jc", "9s"]);
    expect(a).toBe(b);
  });
});

describe("HandEvaluator — melhor mão entre 7 cartas", () => {
  it("seleciona o flush de 5 cartas ignorando as 2 piores", () => {
    // 6 cartas de copas presentes; melhor flush usa as 5 mais altas.
    const result = HandEvaluator.evaluateBestHand(["Ah", "Kh", "Qh", "2h", "3h", "9c", "4d"]);
    expect(result.rank).toBe("FLUSH");
  });

  it("encontra a quadra escondida em 7 cartas", () => {
    const result = HandEvaluator.evaluateBestHand(["7h", "7d", "7c", "7s", "Ah", "Kd", "2c"]);
    expect(result.rank).toBe("FOUR_OF_A_KIND");
  });

  it("lança erro com menos de 5 cartas", () => {
    expect(() => HandEvaluator.evaluateBestHand(["Ah", "Kd"])).toThrow();
  });
});

describe("HandEvaluator — equidade Monte Carlo (item 0.4)", () => {
  it("mãos idênticas no mesmo board resultam em ~50% (empate = 0.5)", () => {
    // Board com 5 cartas → resultado determinístico: par de board, kickers iguais → empate.
    const eq = HandEvaluator.calculateEquityVs(["Ah", "Kd"], [["As", "Kc"]], ["2h", "7d", "9s", "Jc", "4h"], 200);
    expect(eq).toBeCloseTo(0.5, 5);
  });

  it("coin-flip AKs vs QQ fica próximo do conhecido (~46% para AK)", () => {
    const eq = HandEvaluator.calculateEquityVs(["Ah", "Kh"], [["Qd", "Qc"]], [], 20000);
    // Valor teórico ≈ 0.462; tolerância folgada para não criar teste instável.
    expect(eq).toBeGreaterThan(0.42);
    expect(eq).toBeLessThan(0.5);
  });

  it("equidade está sempre em [0, 1]", () => {
    const eq = HandEvaluator.calculateEquity(["Ah", "Ad"], ["Kh", "7d", "2c"], 2, 300);
    expect(eq).toBeGreaterThanOrEqual(0);
    expect(eq).toBeLessThanOrEqual(1);
  });
});

describe("HandEvaluator — performance (RNF02 < 2ms por mão de 7 cartas)", () => {
  it("avalia 7 cartas em menos de 2ms (média de 1000 execuções)", () => {
    const hand = ["Ah", "Kh", "Qh", "2h", "3h", "9c", "4d"];
    const start = performance.now();
    const N = 1000;
    for (let i = 0; i < N; i++) HandEvaluator.evaluateBestHand(hand);
    const avg = (performance.now() - start) / N;
    expect(avg).toBeLessThan(2);
  });
});
