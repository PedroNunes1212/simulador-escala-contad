import type { ParametrosEncargos, Regime } from './tipos';

export interface CustoDetalhado {
  salario: number;
  ferias: number;
  decimo: number;
  fgts: number;
  multaFgts: number;
  cpp: number;
  rat: number;
  terceiros: number;
  total: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Simples Nacional (anexos I, II, III e V) não recolhe CPP nem RAT em separado; o anexo IV recolhe (LC 123, art. 18, §5º-C). */
export function pagaCpp(regime: Regime): boolean {
  return regime !== 'simples';
}

/** Terceiros (Sistema S, salário-educação): todo o Simples é dispensado, inclusive o anexo IV (LC 123, art. 13, §3º). */
export function pagaTerceiros(regime: Regime): boolean {
  return regime === 'presumido_real';
}

/** Custo mensal de um funcionário: salário + provisões + encargos do regime. */
export function custoMensal(salario: number, regime: Regime, p: ParametrosEncargos): CustoDetalhado {
  const ferias = (salario / 12) * (4 / 3);
  const decimo = salario / 12;
  const base = salario + ferias + decimo;
  const fgts = base * p.fgts;
  const multaFgts = fgts * p.multaFgtsProvisao;
  const cpp = pagaCpp(regime) ? base * p.cpp : 0;
  const rat = pagaCpp(regime) ? base * p.rat : 0;
  const terceiros = pagaTerceiros(regime) ? base * p.terceiros : 0;
  const total = base + fgts + multaFgts + cpp + rat + terceiros;
  return {
    salario: r2(salario), ferias: r2(ferias), decimo: r2(decimo), fgts: r2(fgts),
    multaFgts: r2(multaFgts), cpp: r2(cpp), rat: r2(rat), terceiros: r2(terceiros), total: r2(total),
  };
}

/** Fator de encargos sobre uma verba salarial (ex.: hora extra), incluindo reflexos em férias e 13º. */
export function fatorEncargos(regime: Regime, p: ParametrosEncargos): number {
  const provisoes = 1 + (4 / 3) / 12 + 1 / 12;
  const enc = p.fgts * (1 + p.multaFgtsProvisao) + (pagaCpp(regime) ? p.cpp + p.rat : 0) + (pagaTerceiros(regime) ? p.terceiros : 0);
  return provisoes * (1 + enc);
}

export function valorHora(salario: number, divisor: number): number {
  return salario / divisor;
}

/** Custo mensal de horas extras semanais (em minutos), com DSR e encargos. */
export function custoHoraExtraMensal(
  salario: number, divisor: number, minutosSemana: number, regime: Regime, p: ParametrosEncargos,
): { horasMes: number; total: number } {
  const horasMes = (minutosSemana / 60) * p.semanasPorMes;
  const base = horasMes * valorHora(salario, divisor) * (1 + p.adicionalHoraExtra);
  const total = base * (1 + p.reflexoDsr) * fatorEncargos(regime, p);
  return { horasMes: r2(horasMes), total: r2(total) };
}

/** Salário proporcional para meio período (ponto de partida; piso da convenção pode ser maior). */
export function salarioProporcional(salario: number, jornadaCheiaMin: number, jornadaParcialMin: number): number {
  return r2((salario * jornadaParcialMin) / jornadaCheiaMin);
}
