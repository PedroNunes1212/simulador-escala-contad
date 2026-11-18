import { alternativas, type Alternativa } from '../motor/simular';
import { hhmm } from '../motor/tempo';
import { DIAS, type DiaFuncionamento, type Entrada, type ResultadoCenario } from '../motor/tipos';

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
/** Percentual com uma casa, arredondado para baixo (nunca mostra 100% se falta algo). */
export const pct = (v: number) => `${Math.floor(v * 1000) / 10}`.replace('.', ',') + '%';

export const QUANDO: Record<string, string> = {
  '44': 'Hoje, até 15/12/2026',
  '42': 'A partir de 16/12/2026',
  '40': 'A partir de 16/12/2027',
};

export function listaDias(dias: number[]): string {
  const ord = [...dias].sort((a, b) => a - b);
  const seguidos = ord.every((d, i) => i === 0 || d === ord[i - 1] + 1);
  if (ord.length >= 3 && seguidos) return `${DIAS[ord[0]]} a ${DIAS[ord[ord.length - 1]]}`;
  return ord.map((d) => DIAS[d]).join(', ');
}

/** Junta os horários descobertos iguais em dias diferentes: "Seg a Qua, 13:00 às 14:00". */
export function ondeFalta(entrada: Entrada, r: ResultadoCenario) {
  const out: { texto: string; peso: number }[] = [];
  for (const c of r.cobertura) {
    const f = entrada.funcoes.find((x) => x.id === c.funcaoId);
    if (!f) continue;
    const grupos = new Map<string, { dias: number[]; ini: number; fim: number; falta: number }>();
    for (const p of c.periodosCriticos) {
      const k = `${p.ini}-${p.fim}-${p.falta}`;
      const g = grupos.get(k) ?? { dias: [], ini: p.ini, fim: p.fim, falta: p.falta };
      g.dias.push(p.dia); grupos.set(k, g);
    }
    for (const g of grupos.values()) {
      out.push({
        texto: `${listaDias(g.dias)}, das ${hhmm(g.ini)} às ${hhmm(g.fim)}: falta ${g.falta} ${f.nome}`,
        peso: g.falta * (g.fim - g.ini) * g.dias.length,
      });
    }
  }
  return out.sort((a, b) => b.peso - a.peso);
}

/** Caminho mais simples que zera a falta de cada função: meio período se resolver, senão o menor número de contratações. */
export function solucao(entrada: Entrada, r: ResultadoCenario) {
  const passos: { funcao: string; alt: Alternativa }[] = [];
  for (const c of r.cobertura) {
    if (c.deficitMin === 0) continue;
    const f = entrada.funcoes.find((x) => x.id === c.funcaoId)!;
    const alts = alternativas(entrada, f, r.cenario).filter((a) => a.tipo === 'parcial' || a.tipo === 'integral');
    const resolve = alts.find((a) => a.deficitRestanteMin === 0);
    passos.push({ funcao: f.nome, alt: resolve ?? alts[alts.length - 1] });
  }
  const custos = passos.map((p) => p.alt.custoAdicionalMensal);
  const custo = custos.every((x) => x !== null) ? custos.reduce((a: number, b) => a + (b ?? 0), 0) : null;
  const resolveTudo = passos.every((p) => p.alt.deficitRestanteMin === 0);
  return { passos, custo, resolveTudo };
}

/** "Seg a Sex 08:00–18:00; Sáb 08:00–12:00" agrupando dias seguidos com o mesmo horário. */
export function resumoFuncionamento(func: DiaFuncionamento[]): string {
  const txt = (d: DiaFuncionamento) => d.periodos.map((p) => `${hhmm(p.ini)}–${p.fim === 1440 ? '24:00' : hhmm(p.fim)}`).join(' e ');
  const grupos: { de: number; ate: number; h: string }[] = [];
  func.forEach((d, i) => {
    if (!d.aberto || !d.periodos.length) return;
    const h = txt(d), ult = grupos[grupos.length - 1];
    if (ult && ult.h === h && ult.ate === i - 1) ult.ate = i; else grupos.push({ de: i, ate: i, h });
  });
  if (!grupos.length) return 'nenhum dia (volte ao passo 2).';
  return grupos.map((g) => `${g.de === g.ate ? DIAS[g.de] : `${DIAS[g.de]} a ${DIAS[g.ate]}`} ${g.h}`).join('; ') + '.';
}

