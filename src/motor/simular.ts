import { avaliarCobertura, gradeNecessidade } from './cobertura';
import { custoHoraExtraMensal, custoMensal, salarioProporcional } from './custos';
import { gerarEscala } from './gerador';
import { CENARIOS, DESCANSO_SEMANAL_MIN, ENCARGOS_PADRAO, INTERJORNADA_MIN, LIMITE_DIARIO_SEM_ACORDO, TETO_DIARIO_COM_EXTRA, cenarioEfetivo } from './regras';
import { duracao, hhmm } from './tempo';
import { DIAS, type Alerta, type Cenario, type Entrada, type Funcao, type ParametrosEncargos, type Pessoa, type ResultadoCenario } from './tipos';

const r2 = (v: number) => Math.round(v * 100) / 100;

function pessoasDaFuncao(f: Funcao, extras: { semanalMin: number }[] = []) {
  const base = Array.from({ length: f.quantidade }, (_, i) => ({
    id: `${f.id}-${i + 1}`, nome: `${f.nome} ${i + 1}`, semanalMin: f.jornadaContratualMin,
  }));
  const ext = extras.map((e, i) => ({
    id: `${f.id}-novo-${i + 1}`, nome: `${f.nome} (nova contratação ${i + 1})`, semanalMin: e.semanalMin, extra: true,
  }));
  return [...base, ...ext];
}

function escalaFuncao(entrada: Entrada, f: Funcao, cenario: Cenario, extras: { semanalMin: number }[] = []) {
  const necessidade = gradeNecessidade(f.id, entrada.demandas, entrada.funcionamento);
  const pessoas = gerarEscala({
    funcaoId: f.id, nomeFuncao: f.nome, pessoas: pessoasDaFuncao(f, extras),
    cenario, funcionamento: entrada.funcionamento, necessidade,
  });
  return { pessoas, cobertura: avaliarCobertura(f.id, necessidade, pessoas) };
}

export function horasSemana(p: Pessoa): number {
  return p.turnos.reduce((a, t) => a + t.trabalhoMin, 0);
}

/** Pares de dias seguidos com menos de 11h de descanso (a semana se repete: domingo → segunda). */
export function faltasInterjornada(p: Pessoa): { de: number; para: number; descansoMin: number }[] {
  const porDia = new Map(p.turnos.map((t) => [t.dia, t]));
  const out: { de: number; para: number; descansoMin: number }[] = [];
  for (const t of p.turnos) {
    const prox = porDia.get((t.dia + 1) % 7);
    if (!prox) continue;
    const descanso = prox.ini + 1440 - t.fim;
    if (descanso < INTERJORNADA_MIN) out.push({ de: t.dia, para: prox.dia, descansoMin: descanso });
  }
  return out;
}

/** Maior descanso seguido da semana, em minutos (a semana se repete). Deve ser de pelo menos 35h (CLT arts. 66 e 67). */
export function maiorDescansoSemanal(p: Pessoa): number {
  const porDia = new Map(p.turnos.map((t) => [t.dia, t]));
  let maior = 0;
  for (const t of p.turnos) {
    let folgas = 0, n = (t.dia + 1) % 7;
    while (!porDia.has(n)) { folgas++; n = (n + 1) % 7; }
    const prox = porDia.get(n)!;
    maior = Math.max(maior, (1440 - t.fim) + folgas * 1440 + prox.ini);
  }
  return maior;
}

export function simularCenario(entrada: Entrada, cenarioBase: Cenario, p: ParametrosEncargos = ENCARGOS_PADRAO): ResultadoCenario {
  const cenario = cenarioEfetivo(cenarioBase, entrada);
  const pessoas: Pessoa[] = [];
  const cobertura = [];
  const alertas: Alerta[] = [];
  let folha = 0;
  for (const f of entrada.funcoes) {
    const r = escalaFuncao(entrada, f, cenario);
    pessoas.push(...r.pessoas);
    cobertura.push(r.cobertura);
    if (f.salario > 0) folha += custoMensal(f.salario, entrada.regime, p).total * f.quantidade;
    for (const c of r.cobertura.periodosCriticos.slice(0, 6)) {
      alertas.push({ tipo: 'aviso', texto: `${f.nome}: falta ${c.falta} pessoa(s) ${DIAS[c.dia]} das ${hhmm(c.ini)} às ${hhmm(c.fim)}.` });
    }
    if (r.cobertura.periodosCriticos.length > 6) {
      alertas.push({ tipo: 'aviso', texto: `${f.nome}: mais ${r.cobertura.periodosCriticos.length - 6} período(s) descoberto(s). Veja o mapa.` });
    }
    for (const pe of r.pessoas) {
      const h = horasSemana(pe);
      for (const f2 of faltasInterjornada(pe)) {
        alertas.push({ tipo: 'erro', texto: `${pe.nome}: só ${duracao(f2.descansoMin)} de descanso entre ${DIAS[f2.de]} e ${DIAS[f2.para]}. O mínimo é 11h entre jornadas (CLT art. 66). Ajuste os horários ou a equipe.` });
      }
      if (pe.turnos.length && maiorDescansoSemanal(pe) < DESCANSO_SEMANAL_MIN) {
        alertas.push({ tipo: 'erro', texto: `${pe.nome}: o maior descanso da semana é de ${duracao(maiorDescansoSemanal(pe))}. O mínimo é 35h seguidas (24h de folga + 11h entre jornadas, CLT arts. 66 e 67). Ajuste os horários ou a equipe.` });
      }
      if (h > cenario.limiteSemanalMin) alertas.push({ tipo: 'erro', texto: `${pe.nome}: ${duracao(h)} na semana, acima do limite de ${duracao(cenario.limiteSemanalMin)}.` });
      else if (h < Math.min(pe.semanalMin, cenario.limiteSemanalMin)) {
        alertas.push({ tipo: 'info', texto: `${pe.nome}: escalado ${duracao(h)}, menos que ${duracao(Math.min(pe.semanalMin, cenario.limiteSemanalMin))} da jornada. O horário de funcionamento não comporta mais. Não reduza salário por isso.` });
      }
    }
  }
  if (cenario.limiteDiarioMin < cenarioBase.limiteDiarioMin) {
    const max = cenario.limiteDiarioMin * (7 - cenario.folgasSemana);
    alertas.push({ tipo: 'aviso', texto: `Sem acordo ou convenção que permita mais de ${duracao(LIMITE_DIARIO_SEM_ACORDO)} por dia, cada pessoa fica em até ${duracao(max)} por semana neste cenário, abaixo das ${duracao(cenarioBase.limiteSemanalMin)} permitidas. Se houver acordo, marque a opção em "Empresa".` });
  }
  if (cenario.status === 'pendente') alertas.push({ tipo: 'info', texto: `Regras do cenário ${cenario.id}h ainda não validadas pela ContaD (${cenario.fonte}).` });
  const nec = cobertura.reduce((a, c) => a + c.necessarioMin, 0);
  const def = cobertura.reduce((a, c) => a + c.deficitMin, 0);
  return { cenario, pessoas, cobertura, alertas, indiceGeral: nec ? (nec - def) / nec : 1, folhaMensal: r2(folha) };
}

export interface Alternativa {
  tipo: 'reorganizar' | 'parcial' | 'integral' | 'hora_extra';
  titulo: string;
  deficitRestanteMin: number;
  custoAdicionalMensal: number | null; // null = salário não informado
  detalhe: string;
  ressalvas: string[];
}

/** Alternativas para cobrir o déficit de uma função num cenário. Recalcula a escala para cada uma. */
export function alternativas(entrada: Entrada, f: Funcao, cenarioBase: Cenario, p: ParametrosEncargos = ENCARGOS_PADRAO): Alternativa[] {
  const cenario = cenarioEfetivo(cenarioBase, entrada);
  const base = escalaFuncao(entrada, f, cenario);
  const deficit = base.cobertura.deficitMin;
  const temSal = f.salario > 0;
  const out: Alternativa[] = [{
    tipo: 'reorganizar', titulo: 'Reorganizar turnos (escala sugerida)', deficitRestanteMin: deficit,
    custoAdicionalMensal: 0, detalhe: 'Mesma equipe, turnos e intervalos redistribuídos.',
    ressalvas: deficit > 0 ? ['Ainda sobram horários descobertos.'] : [],
  }];
  if (deficit === 0) return out;

  const jornadaCheia = Math.min(f.jornadaContratualMin, cenario.limiteSemanalMin);
  const parcialMin = Math.min(30 * 60, Math.max(20 * 60, Math.ceil(deficit / 60) * 60));
  if (parcialMin < jornadaCheia) {
    const r = escalaFuncao(entrada, f, cenario, [{ semanalMin: parcialMin }]);
    out.push({
      tipo: 'parcial', titulo: `Contratar 1 pessoa em tempo parcial (${duracao(parcialMin)}/semana)`,
      deficitRestanteMin: r.cobertura.deficitMin,
      custoAdicionalMensal: temSal ? custoMensal(salarioProporcional(f.salario, jornadaCheia, parcialMin), entrada.regime, p).total : null,
      detalhe: 'Salário proporcional à jornada da função.',
      ressalvas: ['Conferir piso e regras de tempo parcial da convenção (CLT art. 58-A).'],
    });
  }
  for (let k = 1; k <= 3; k++) {
    const r = escalaFuncao(entrada, f, cenario, Array.from({ length: k }, () => ({ semanalMin: jornadaCheia })));
    if (r.cobertura.deficitMin < deficit || k === 3) {
      out.push({
        tipo: 'integral', titulo: `Contratar ${k} ${k === 1 ? 'pessoa' : 'pessoas'} em jornada integral`, deficitRestanteMin: r.cobertura.deficitMin,
        custoAdicionalMensal: temSal ? r2(custoMensal(f.salario, entrada.regime, p).total * k) : null,
        detalhe: `Mesmo salário médio da função (${duracao(jornadaCheia)}/semana).`, ressalvas: [],
      });
      if (r.cobertura.deficitMin === 0) break;
    }
  }
  // Até 2h extras por dia, sem passar de 10h no dia (CLT art. 59).
  const capacidadeHE = base.pessoas.flatMap((pe) => pe.turnos)
    .reduce((a, t) => a + Math.max(0, Math.min(120, TETO_DIARIO_COM_EXTRA - t.trabalhoMin)), 0);
  const heMin = Math.min(deficit, capacidadeHE);
  const he = temSal ? custoHoraExtraMensal(f.salario, cenario.divisor, heMin, entrada.regime, p) : null;
  out.push({
    tipo: 'hora_extra', titulo: `Horas extras (${duracao(heMin)}/semana)`, deficitRestanteMin: deficit - heMin,
    custoAdicionalMensal: he ? he.total : null,
    detalhe: he ? `${he.horasMes}h extras/mês, adicional de ${p.adicionalHoraExtra * 100}%, com DSR e encargos. Estimativa: supõe que as extras caem nos horários descobertos.` : 'Informe o salário para estimar.',
    ressalvas: ['Hora extra habitual é risco trabalhista; até 2h por dia e no máximo 10h no dia (CLT art. 59).'],
  });
  return out;
}

export function simularTodos(entrada: Entrada, p: ParametrosEncargos = ENCARGOS_PADRAO) {
  return CENARIOS.map((c) => simularCenario(entrada, c, p));
}
