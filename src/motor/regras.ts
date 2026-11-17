import type { Cenario, ParametrosEncargos } from './tipos';

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
    status: 'pendente', fonte: 'EC 141/2026 art. 6º, I; cautelar ADIs 8041/8042 (8h24 sem acordo, a confirmar)',
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
