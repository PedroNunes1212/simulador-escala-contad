import type { DiaFuncionamento, Entrada } from '../motor/tipos';

// Dados fictícios para demonstração.
const ab = (ini: number, fim: number): DiaFuncionamento => ({ aberto: true, periodos: [{ ini, fim }] });
const fe: DiaFuncionamento = { aberto: false, periodos: [] };
const h = (x: number) => x * 60;
const UTEIS = [0, 1, 2, 3, 4];

export interface Exemplo { id: string; nome: string; descricao: string; entrada: Entrada }

export const EXEMPLOS: Exemplo[] = [
  {
    id: 'comercio', nome: 'Loja (seg a sáb)', descricao: '4 vendedores e 1 caixa, pico no almoço.',
    entrada: {
      regime: 'simples',
      funcionamento: [...Array(5)].map(() => ab(h(9), h(19))).concat([ab(h(9), h(14)), fe]),
      funcoes: [
        { id: 'vend', nome: 'Vendedor(a)', quantidade: 4, mulheres: 2, salario: 1900, jornadaContratualMin: h(44) },
        { id: 'caixa', nome: 'Caixa', quantidade: 1, mulheres: 1, salario: 1750, jornadaContratualMin: h(44) },
      ],
      demandas: [
        { funcaoId: 'vend', dias: UTEIS, ini: h(9), fim: h(11), pessoas: 1 },
        { funcaoId: 'vend', dias: UTEIS, ini: h(11), fim: h(15), pessoas: 3 },
        { funcaoId: 'vend', dias: UTEIS, ini: h(15), fim: h(19), pessoas: 2 },
        { funcaoId: 'vend', dias: [5], ini: h(9), fim: h(14), pessoas: 3 },
        { funcaoId: 'caixa', dias: [0, 1, 2, 3, 4, 5], ini: h(9), fim: h(19), pessoas: 1 },
      ],
    },
  },
  {
    id: 'farmacia', nome: 'Farmácia (todos os dias)', descricao: 'Farmacêutico obrigatório, balconistas e caixa.',
    entrada: {
      regime: 'simples',
      funcionamento: [...Array(6)].map(() => ab(h(7), h(22))).concat([ab(h(8), h(20))]),
      funcoes: [
        { id: 'farm', nome: 'Farmacêutico(a)', quantidade: 3, salario: 5200, jornadaContratualMin: h(44) },
        { id: 'balc', nome: 'Balconista', quantidade: 5, mulheres: 3, salario: 1850, jornadaContratualMin: h(44) },
        { id: 'cx', nome: 'Caixa', quantidade: 2, mulheres: 1, salario: 1750, jornadaContratualMin: h(44) },
      ],
      demandas: [
        { funcaoId: 'balc', dias: [0, 1, 2, 3, 4, 5], ini: h(7), fim: h(10), pessoas: 1 },
        { funcaoId: 'balc', dias: [0, 1, 2, 3, 4, 5], ini: h(10), fim: h(19), pessoas: 2 },
        { funcaoId: 'balc', dias: [0, 1, 2, 3, 4, 5], ini: h(19), fim: h(22), pessoas: 1 },
        { funcaoId: 'balc', dias: [6], ini: h(8), fim: h(20), pessoas: 1 },
      ],
    },
  },
  {
    id: 'escritorio', nome: 'Escritório (seg a sex)', descricao: 'Recepção e atendimento, 08h às 18h.',
    entrada: {
      regime: 'presumido_real',
      funcionamento: [...Array(5)].map(() => ab(h(8), h(18))).concat([fe, fe]),
      funcoes: [
        { id: 'rec', nome: 'Recepcionista', quantidade: 1, salario: 2100, jornadaContratualMin: h(44) },
        { id: 'aten', nome: 'Atendente', quantidade: 3, salario: 2400, jornadaContratualMin: h(44) },
      ],
      demandas: [
        { funcaoId: 'aten', dias: UTEIS, ini: h(8), fim: h(12), pessoas: 2 },
        { funcaoId: 'aten', dias: UTEIS, ini: h(13), fim: h(18), pessoas: 2 },
      ],
    },
  },
];

export const ENTRADA_VAZIA: Entrada = {
  regime: 'simples',
  funcionamento: [...Array(6)].map(() => ab(h(8), h(18))).concat([fe]),
  funcoes: [{ id: 'f1', nome: 'Atendente', quantidade: 2, salario: 0, jornadaContratualMin: h(44) }],
  demandas: [],
};
