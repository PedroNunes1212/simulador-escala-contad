import { SLOT, SLOTS_DIA, type CoberturaFuncao, type Demanda, type DiaFuncionamento, type Pessoa } from './tipos';

const grade = () => Array.from({ length: 7 }, () => new Array<number>(SLOTS_DIA).fill(0));

/** Pessoas necessárias por dia e bloco de 15 min. Sem demanda cadastrada: 1 pessoa em todo o horário aberto. */
export function gradeNecessidade(funcaoId: string, demandas: Demanda[], func: DiaFuncionamento[]): number[][] {
  const g = grade();
  const minhas = demandas.filter((d) => d.funcaoId === funcaoId);
  for (let dia = 0; dia < 7; dia++) {
    if (!func[dia].aberto) continue;
    if (minhas.length === 0) {
      for (const p of func[dia].periodos) for (let s = p.ini / SLOT; s < p.fim / SLOT; s++) g[dia][s] = 1;
      continue;
    }
    for (const d of minhas) {
      if (!d.dias.includes(dia)) continue;
      for (let s = Math.floor(d.ini / SLOT); s < Math.ceil(d.fim / SLOT); s++) g[dia][s] = Math.max(g[dia][s], d.pessoas);
    }
  }
  return g;
}

/** Quem está trabalhando (fora do intervalo) e quem está em intervalo, por bloco. */
export function gradePresenca(pessoas: Pessoa[]): { trabalhando: number[][]; emIntervalo: number[][] } {
  const trabalhando = grade(), emIntervalo = grade();
  for (const p of pessoas) for (const t of p.turnos) {
    for (let s = t.ini / SLOT; s < t.fim / SLOT; s++) {
      const min = s * SLOT;
      const noIntervalo = t.intervaloIni !== null && min >= t.intervaloIni && min < t.intervaloIni + t.intervaloMin;
      if (noIntervalo) emIntervalo[t.dia][s]++; else trabalhando[t.dia][s]++;
    }
  }
  return { trabalhando, emIntervalo };
}

export function avaliarCobertura(funcaoId: string, necessarias: number[][], pessoas: Pessoa[]): CoberturaFuncao {
  const { trabalhando, emIntervalo } = gradePresenca(pessoas.filter((p) => p.funcaoId === funcaoId));
  let deficit = 0, excesso = 0, necessario = 0;
  const periodosCriticos: CoberturaFuncao['periodosCriticos'] = [];
  for (let dia = 0; dia < 7; dia++) {
    let aberto: { ini: number; falta: number } | null = null;
    for (let s = 0; s <= SLOTS_DIA; s++) {
      const nec = s < SLOTS_DIA ? necessarias[dia][s] : 0;
      const tra = s < SLOTS_DIA ? trabalhando[dia][s] : 0;
      const falta = Math.max(0, nec - tra);
      necessario += nec; deficit += falta; excesso += nec > 0 ? Math.max(0, tra - nec) : 0;
      if (falta > 0 && !aberto) aberto = { ini: s * SLOT, falta };
      else if (falta > 0 && aberto) aberto.falta = Math.max(aberto.falta, falta);
      else if (falta === 0 && aberto) { periodosCriticos.push({ dia, ini: aberto.ini, fim: s * SLOT, falta: aberto.falta }); aberto = null; }
    }
  }
  return {
    funcaoId, necessarias, trabalhando, emIntervalo,
    deficitMin: deficit * SLOT, excessoMin: excesso * SLOT, necessarioMin: necessario * SLOT,
    indice: necessario === 0 ? 1 : (necessario - deficit) / necessario,
    periodosCriticos,
  };
}
