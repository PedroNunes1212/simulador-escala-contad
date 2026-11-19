// Motor de cálculo do Simulador de Escalas ContaD.
// Tudo em minutos inteiros. Dias: 0=Seg ... 6=Dom.

export const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
export const SLOT = 1; // cálculo em minutos reais
export const BLOCO_VISUAL = 30; // agrupamento só para exibir
export const SLOTS_DIA = (24 * 60) / SLOT;

export type Regime = 'simples' | 'simples_anexo_iv' | 'presumido_real';

export interface Periodo { ini: number; fim: number } // minutos desde 00:00, fim > ini

export interface DiaFuncionamento { aberto: boolean; periodos: Periodo[] }

export interface Funcao {
  id: string;
  nome: string;
  quantidade: number; // total (homens + mulheres)
  /** Quantas dessas pessoas são mulheres (regra de folga aos domingos). Sem o campo, todas contam como homens. */
  mulheres?: number;
  salario: number; // salário mensal médio (R$), 0 = não informado
  jornadaContratualMin: number; // semanal, ex. 44h = 2640
}

export interface Demanda {
  funcaoId: string;
  dias: number[]; // dias em que vale
  ini: number;
  fim: number;
  pessoas: number;
}

export type StatusRegra = 'pendente' | 'validada';

export interface Cenario {
  id: '44' | '42' | '40';
  nome: string;
  limiteSemanalMin: number;
  limiteDiarioMin: number;
  folgasSemana: number;
  divisor: number;
  status: StatusRegra;
  fonte: string;
}

export interface ParametrosEncargos {
  fgts: number; // 0.08
  cpp: number; // 0.20 (INSS patronal)
  rat: number; // 0.02 (RAT x FAP)
  terceiros: number; // 0.058 (Sistema S, salário-educação, Incra)
  multaFgtsProvisao: number; // 0.40 sobre o FGTS do mês
  adicionalHoraExtra: number; // 0.5
  reflexoDsr: number; // 1/6 aproximado
  semanasPorMes: number; // 52/12
  status: StatusRegra;
}

export interface Entrada {
  regime: Regime;
  funcionamento: DiaFuncionamento[]; // 7 posições
  funcoes: Funcao[];
  demandas: Demanda[];
  /** Acordo ou convenção coletiva que permite mais de 8h por dia (ex.: 5 × 8h24 no cenário de 42h). */
  acordoAcima8h?: boolean;
  /** Divisor da hora extra no cenário de 44h (padrão 210, pedido da ContaD; a CLT usa 220 para 44h). */
  divisor44?: 210 | 220;
}

export interface Turno {
  dia: number;
  ini: number;
  fim: number;
  intervaloIni: number | null;
  intervaloMin: number;
  trabalhoMin: number;
}

export interface Pessoa {
  id: string;
  nome: string;
  funcaoId: string;
  semanalMin: number;
  sexo?: 'M' | 'F';
  extra?: boolean; // reforço sugerido (não existe hoje)
  turnos: Turno[]; // um por dia trabalhado
}

export interface Alerta {
  tipo: 'erro' | 'aviso' | 'info';
  texto: string;
}

export interface CoberturaFuncao {
  funcaoId: string;
  necessarias: number[][]; // [dia][slot]
  trabalhando: number[][];
  emIntervalo: number[][];
  deficitMin: number; // minutos-pessoa faltando na semana
  excessoMin: number;
  necessarioMin: number;
  indice: number; // 0..1
  periodosCriticos: { dia: number; ini: number; fim: number; falta: number }[];
}

export interface ResultadoCenario {
  cenario: Cenario;
  pessoas: Pessoa[];
  cobertura: CoberturaFuncao[];
  alertas: Alerta[];
  indiceGeral: number;
  folhaMensal: number;
}
