import { intervaloMinimo } from './regras';
import type { Cenario, DiaFuncionamento, Pessoa, Turno } from './tipos';

const PASSO = 15; // entradas e intervalos começam em múltiplos de 15 min

export interface PedidoEscala {
  funcaoId: string;
  nomeFuncao: string;
  pessoas: { id: string; nome: string; semanalMin: number; extra?: boolean }[];
  cenario: Cenario;
  funcionamento: DiaFuncionamento[];
  necessidade: number[][]; // [dia][minuto]
}

export function janelaDoDia(d: DiaFuncionamento): { ini: number; fim: number } | null {
  if (!d.aberto || d.periodos.length === 0) return null;
  return { ini: Math.min(...d.periodos.map((p) => p.ini)), fim: Math.max(...d.periodos.map((p) => p.fim)) };
}

/** Gera uma escala viável (heurística gulosa). Não garante ótimo. */
export function gerarEscala(p: PedidoEscala): Pessoa[] {
  const { cenario, funcionamento, necessidade } = p;
  const diasAbertos = [0, 1, 2, 3, 4, 5, 6].filter((d) => janelaDoDia(funcionamento[d]));
  const cobertura = Array.from({ length: 7 }, () => new Array<number>(1440).fill(0));
  const demandaDia = necessidade.map((linha) => linha.reduce((a, b) => a + b, 0));
  const capacidadeDia = new Array<number>(7).fill(0);
  const pessoas: Pessoa[] = p.pessoas.map((x) => ({ ...x, funcaoId: p.funcaoId, turnos: [] }));

  pessoas.forEach((pessoa, k) => {
    const diasTrabalho = Math.min(7 - cenario.folgasSemana, diasAbertos.length);
    if (diasTrabalho === 0) return;
    const semanal = Math.min(pessoa.semanalMin, cenario.limiteSemanalMin);
    const trabalhoDia = Math.min(cenario.limiteDiarioMin, Math.floor(semanal / diasTrabalho));

    // Folgas: trabalha nos dias com maior necessidade ainda não atendida; empate gira entre pessoas (alterna domingos).
    const escolhidos = [...diasAbertos]
      .sort((a, b) => {
        const ra = demandaDia[a] - capacidadeDia[a], rb = demandaDia[b] - capacidadeDia[b];
        if (rb !== ra) return rb - ra;
        return ((a - k + 7) % 7) - ((b - k + 7) % 7);
      })
      .slice(0, diasTrabalho)
      .sort((a, b) => a - b);

    for (const dia of escolhidos) {
      const jan = janelaDoDia(funcionamento[dia])!;
      let trabalho = trabalhoDia;
      let intervalo = intervaloMinimo(trabalho);
      if (trabalho + intervalo > jan.fim - jan.ini) {
        // Funcionamento mais curto que o turno: encurta sem completar horas artificialmente.
        trabalho = jan.fim - jan.ini - intervaloMinimo(jan.fim - jan.ini);
        intervalo = intervaloMinimo(trabalho);
      }
      const dur = trabalho + intervalo;
      let melhor = jan.ini, melhorPontos = -1;
      const candidatos: number[] = [];
      for (let ini = jan.ini; ini + dur <= jan.fim; ini += PASSO) candidatos.push(ini);
      candidatos.push(jan.fim - dur); // também testa terminar exatamente no fechamento
      for (const ini of candidatos) {
        let pontos = 0;
        for (let m = ini; m < ini + dur; m++) pontos += Math.max(0, necessidade[dia][m] - cobertura[dia][m]);
        if (pontos > melhorPontos) { melhorPontos = pontos; melhor = ini; }
      }
      const turno: Turno = { dia, ini: melhor, fim: melhor + dur, intervaloIni: null, intervaloMin: intervalo, trabalhoMin: trabalho };
      for (let m = turno.ini; m < turno.fim; m++) cobertura[dia][m]++;
      capacidadeDia[dia] += dur;
      pessoa.turnos.push(turno);
    }
  });

  // Intervalos em revezamento: posição que menos tira gente de onde falta.
  for (const pessoa of pessoas) for (const t of pessoa.turnos) {
    if (t.intervaloMin === 0) continue;
    const margem = t.trabalhoMin > 360 ? 120 : 60;
    let lo = t.ini + margem, hi = t.fim - margem - t.intervaloMin;
    if (hi < lo) { lo = t.ini + Math.floor((t.fim - t.ini - t.intervaloMin) / 2); hi = lo; }
    else lo = Math.min(hi, Math.ceil(lo / PASSO) * PASSO); // intervalos em horários redondos
    const meio = t.ini + (t.fim - t.ini - t.intervaloMin) / 2;
    let melhor = lo, melhorCusto = Infinity;
    for (let ini = lo; ini <= hi; ini += PASSO) {
      let custo = 0;
      for (let m = ini; m < ini + t.intervaloMin; m++) if (cobertura[t.dia][m] - 1 < necessidade[t.dia][m]) custo++;
      const desempate = Math.abs(ini - meio) / 10000;
      if (custo + desempate < melhorCusto) { melhorCusto = custo + desempate; melhor = ini; }
    }
    t.intervaloIni = melhor;
    for (let m = melhor; m < melhor + t.intervaloMin; m++) cobertura[t.dia][m]--;
  }
  return pessoas;
}
