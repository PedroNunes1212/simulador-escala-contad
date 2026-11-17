import type { Cenario, Entrada, ParametrosEncargos } from './tipos';

// Regras versionadas. "pendente" = ainda não conferida pela ContaD.
export const VERSAO_REGRAS = '2026-11-17';

export const CENARIOS: Cenario[] = [
  {
    id: '44', nome: '44h · 6x1 (regra até 15/12/2026)',
    limiteSemanalMin: 44 * 60, limiteDiarioMin: 8 * 60, folgasSemana: 1, divisor: 220,
    status: 'pendente', fonte: 'CF art. 7º, XIII (redação anterior à EC 141/2026); CLT art. 58',
  },
  {
    id: '42', nome: '42h · 5x2 (transição a partir de 16/12/2026)',
    limiteSemanalMin: 42 * 60, limiteDiarioMin: 8 * 60 + 24, folgasSemana: 2, divisor: 210,
    status: 'pendente', fonte: 'EC 141/2026 (mais de 8h/dia só com acordo ou convenção, até a fase de 40h); cautelar ADIs 8041/8042 a conferir',
  },
  {
    id: '40', nome: '40h · 5x2 (definitiva a partir de 16/12/2027)',
    limiteSemanalMin: 40 * 60, limiteDiarioMin: 8 * 60, folgasSemana: 2, divisor: 200,
    status: 'pendente', fonte: 'EC 141/2026, CF art. 7º, XIII e XV',
  },
];

export const ENCARGOS_PADRAO: ParametrosEncargos = {
  fgts: 0.08,
  cpp: 0.2,
  rat: 0.02,
  terceiros: 0.058,
  multaFgtsProvisao: 0.4,
  adicionalHoraExtra: 0.5,
  reflexoDsr: 1 / 6,
  semanasPorMes: 52 / 12,
  status: 'pendente',
};

/** Intervalo mínimo (CLT art. 71): >6h → 60 min; >4h → 15 min; senão 0. */
export function intervaloMinimo(trabalhoMin: number): number {
  if (trabalhoMin > 360) return 60;
  if (trabalhoMin > 240) return 15;
  return 0;
}

/** Limite diário legal sem acordo coletivo (CF art. 7º, XIII). */
export const LIMITE_DIARIO_SEM_ACORDO = 8 * 60;
/** Descanso mínimo entre duas jornadas (CLT art. 66). */
export const INTERJORNADA_MIN = 11 * 60;
/** Teto diário com horas extras: jornada + no máximo 2h, até 10h (CLT art. 59). */
export const TETO_DIARIO_COM_EXTRA = 10 * 60;

/** Aplica ao cenário as condições informadas pela empresa (hoje: acordo para mais de 8h/dia). */
export function cenarioEfetivo(c: Cenario, entrada: Entrada): Cenario {
  if (c.limiteDiarioMin > LIMITE_DIARIO_SEM_ACORDO && !entrada.acordoAcima8h) {
    return { ...c, limiteDiarioMin: LIMITE_DIARIO_SEM_ACORDO };
  }
  return c;
}

/** Regras da EC 141/2026 que o simulador ainda não aplica sozinho; aparecem como aviso. */
export const OBSERVACOES_EC = [
  'Quem já trabalha 40h ou menos por semana não precisa reduzir a jornada, mas passa a ter as duas folgas semanais.',
  'Convenções e acordos coletivos incompatíveis com a emenda perdem efeito.',
  'Empregado com diploma superior e salário a partir de R$ 21.188,88 (2,5 vezes o teto do INSS em 2026) fica fora das regras de jornada.',
  'Não há dispensa automática para MEI, micro ou pequena empresa: a emenda prevê lei complementar futura.',
  'Trabalho noturno (22h às 5h) tem hora reduzida e adicional próprio, ainda não calculados aqui.',
];
