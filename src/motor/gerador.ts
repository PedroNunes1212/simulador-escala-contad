import { DESCANSO_SEMANAL_MIN, INTERJORNADA_MIN, INTERVALO_MAX, intervaloMinimo } from './regras';
import type { Cenario, DiaFuncionamento, Periodo, Pessoa, Turno } from './tipos';

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

/** Turno possível num dia: início, fim e, quando atravessa a pausa do funcionamento, o intervalo já fixo. */
export interface Candidato { ini: number; fim: number; intervaloIni: number | null; intervaloMin: number; trabalho: number }

/** Junta períodos que se tocam ou se sobrepõem e ordena. */
function normalizar(periodos: Periodo[]): Periodo[] {
  const ps = periodos.filter((p) => p.fim > p.ini).map((p) => ({ ...p })).sort((a, b) => a.ini - b.ini);
  const out: Periodo[] = [];
  for (const p of ps) {
    const ult = out[out.length - 1];
    if (ult && p.ini <= ult.fim) ult.fim = Math.max(ult.fim, p.fim); else out.push(p);
  }
  return out;
}

/**
 * Turnos possíveis no dia, sem nunca pôr alguém trabalhando com a empresa fechada.
 * O turno cabe num período só, ou atravessa a pausa entre dois períodos e a pausa vira o intervalo
 * (se ela tiver pelo menos o intervalo mínimo e no máximo 2h, CLT art. 71).
 * Fica só a maior jornada possível, para não encurtar o turno sem necessidade.
 */
export function candidatosDoDia(d: DiaFuncionamento, trabalhoDia: number): Candidato[] {
  if (!d.aberto) return [];
  const ps = normalizar(d.periodos);
  const out: Candidato[] = [];
  for (const p of ps) {
    const len = p.fim - p.ini;
    let t = trabalhoDia, i = intervaloMinimo(t);
    if (t + i > len) { t = len - intervaloMinimo(len); i = intervaloMinimo(t); }
    if (t <= 0) continue;
    const dur = t + i;
    const inis = new Set<number>([p.fim - dur]);
    for (let x = p.ini; x + dur <= p.fim; x += PASSO) inis.add(x);
    for (const x of inis) out.push({ ini: x, fim: x + dur, intervaloIni: null, intervaloMin: i, trabalho: t });
  }
  for (let k = 0; k + 1 < ps.length; k++) {
    const a = ps[k], b = ps[k + 1], pausa = b.ini - a.fim;
    if (pausa > INTERVALO_MAX || pausa < intervaloMinimo(trabalhoDia)) continue;
    // "antes" = minutos trabalhados no primeiro período; o resto vai para o segundo.
    const antesMin = Math.max(1, trabalhoDia - (b.fim - b.ini)), antesMax = Math.min(a.fim - a.ini, trabalhoDia - 1);
    if (antesMin > antesMax) continue;
    const inis = new Set<number>([a.fim - antesMax, a.fim - antesMin]);
    for (let x = Math.ceil((a.fim - antesMax) / PASSO) * PASSO; x <= a.fim - antesMin; x += PASSO) inis.add(x);
    for (const x of inis) {
      out.push({ ini: x, fim: b.ini + trabalhoDia - (a.fim - x), intervaloIni: a.fim, intervaloMin: pausa, trabalho: trabalhoDia });
    }
  }
  const maior = Math.max(0, ...out.map((c) => c.trabalho));
  return out.filter((c) => c.trabalho === maior);
}

/**
 * Folga que serve de descanso semanal (35h). Se já há duas folgas seguidas, o descanso está garantido
 * e não há restrição. Senão, escolhe uma folga isolada (de preferência o domingo).
 */
function folgaDoDescanso(trabalha: number[]): { antes: number; depois: number } | null {
  if (trabalha.length < 2) return null;
  const set = new Set(trabalha);
  const lacunas: { antes: number; depois: number; dias: number[] }[] = [];
  for (const w of trabalha) {
    const dias: number[] = [];
    let n = (w + 1) % 7;
    while (!set.has(n)) { dias.push(n); n = (n + 1) % 7; }
    if (dias.length) lacunas.push({ antes: w, depois: n, dias });
  }
  if (!lacunas.length || lacunas.some((l) => l.dias.length >= 2)) return null;
  return lacunas.find((l) => l.dias.includes(6)) ?? lacunas[0];
}

/** Gera uma escala viável (heurística gulosa). Não garante ótimo. */
export function gerarEscala(p: PedidoEscala): Pessoa[] {
  const { cenario, funcionamento, necessidade } = p;
  const diasAbertos = [0, 1, 2, 3, 4, 5, 6].filter((d) => janelaDoDia(funcionamento[d]));
  const cobertura = Array.from({ length: 7 }, () => new Array<number>(1440).fill(0));
  const demandaDia = necessidade.map((linha) => linha.reduce((a, b) => a + b, 0));
  const capacidadeDia = new Array<number>(7).fill(0);
  const pessoas: Pessoa[] = p.pessoas.map((x) => ({ ...x, funcaoId: p.funcaoId, turnos: [] }));
  // Folga isolada: descanso = (24h - saída) + 24h de folga + entrada da volta. Precisa ser >= 35h.
  const FOLGA_E_DOIS_DIAS = 2 * 1440;

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
    const dsr = folgaDoDescanso(escolhidos);

    const porDia = new Map<number, Turno>();
    for (const dia of escolhidos) {
      const candidatos = candidatosDoDia(funcionamento[dia], trabalhoDia);
      if (!candidatos.length) continue;
      // Descanso de 11h entre jornadas (CLT art. 66), inclusive de domingo para a segunda seguinte.
      const ontem = porDia.get(dia - 1);
      const segunda = dia === 6 ? porDia.get(0) : undefined;
      let minIni = ontem ? ontem.fim + INTERJORNADA_MIN - 1440 : -Infinity;
      let maxFim = segunda ? segunda.ini + 1440 - INTERJORNADA_MIN : Infinity;
      // Descanso semanal de 35h na folga escolhida (24h + 11h).
      if (dsr && dia === dsr.depois && porDia.has(dsr.antes)) minIni = Math.max(minIni, porDia.get(dsr.antes)!.fim + DESCANSO_SEMANAL_MIN - FOLGA_E_DOIS_DIAS);
      if (dsr && dia === dsr.antes && porDia.has(dsr.depois)) maxFim = Math.min(maxFim, porDia.get(dsr.depois)!.ini + FOLGA_E_DOIS_DIAS - DESCANSO_SEMANAL_MIN);
      const validos = candidatos.filter((c) => c.ini >= minIni && c.fim <= maxFim);
      let melhor = candidatos[0], melhorPontos = -1;
      for (const c of validos.length ? validos : candidatos) {
        let pontos = 0;
        for (let m = c.ini; m < c.fim; m++) {
          if (c.intervaloIni !== null && m >= c.intervaloIni && m < c.intervaloIni + c.intervaloMin) continue;
          pontos += Math.max(0, necessidade[dia][m] - cobertura[dia][m]);
        }
        if (pontos > melhorPontos) { melhorPontos = pontos; melhor = c; }
      }
      const turno: Turno = { dia, ini: melhor.ini, fim: melhor.fim, intervaloIni: melhor.intervaloIni, intervaloMin: melhor.intervaloMin, trabalhoMin: melhor.trabalho };
      for (let m = turno.ini; m < turno.fim; m++) cobertura[dia][m]++;
      if (turno.intervaloIni !== null) for (let m = turno.intervaloIni; m < turno.intervaloIni + turno.intervaloMin; m++) cobertura[dia][m]--;
      capacidadeDia[dia] += turno.fim - turno.ini;
      pessoa.turnos.push(turno);
      porDia.set(dia, turno);
    }
  });

  // Intervalos em revezamento: posição que menos tira gente de onde falta (os fixados pela pausa ficam como estão).
  for (const pessoa of pessoas) for (const t of pessoa.turnos) {
    if (t.intervaloMin === 0 || t.intervaloIni !== null) continue;
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
