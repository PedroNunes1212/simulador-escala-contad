import { avaliarCobertura, gradeNecessidade } from './cobertura';
import { custoHoraExtraMensal, custoMensal, salarioProporcional } from './custos';
import { gerarEscala } from './gerador';
import { CENARIOS, ENCARGOS_PADRAO } from './regras';
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

export function simularCenario(entrada: Entrada, cenario: Cenario, p: ParametrosEncargos = ENCARGOS_PADRAO): ResultadoCenario {
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
      if (h > cenario.limiteSemanalMin) alertas.push({ tipo: 'erro', texto: `${pe.nome}: ${duracao(h)} na semana, acima do limite de ${duracao(cenario.limiteSemanalMin)}.` });
      else if (h < Math.min(pe.semanalMin, cenario.limiteSemanalMin)) {
        alertas.push({ tipo: 'info', texto: `${pe.nome}: escalado ${duracao(h)}, menos que ${duracao(Math.min(pe.semanalMin, cenario.limiteSemanalMin))} da jornada. O horário de funcionamento não comporta mais. Não reduza salário por isso.` });
      }
    }
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
export function alternativas(entrada: Entrada, f: Funcao, cenario: Cenario, p: ParametrosEncargos = ENCARGOS_PADRAO): Alternativa[] {
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
        tipo: 'integral', titulo: `Contratar ${k} pessoa(s) em jornada integral`, deficitRestanteMin: r.cobertura.deficitMin,
        custoAdicionalMensal: temSal ? r2(custoMensal(f.salario, entrada.regime, p).total * k) : null,
        detalhe: `Mesmo salário médio da função (${duracao(jornadaCheia)}/semana).`, ressalvas: [],
      });
      if (r.cobertura.deficitMin === 0) break;
    }
  }
  const capacidadeHE = f.quantidade * (7 - cenario.folgasSemana) * 120;
  const heMin = Math.min(deficit, capacidadeHE);
  const he = temSal ? custoHoraExtraMensal(f.salario, cenario.divisor, heMin, entrada.regime, p) : null;
  out.push({
    tipo: 'hora_extra', titulo: `Horas extras (${duracao(heMin)}/semana)`, deficitRestanteMin: deficit - heMin,
    custoAdicionalMensal: he ? he.total : null,
    detalhe: he ? `${he.horasMes}h extras/mês, adicional de ${p.adicionalHoraExtra * 100}%, com DSR e encargos. Estimativa: supõe que as extras caem nos horários descobertos.` : 'Informe o salário para estimar.',
    ressalvas: ['Hora extra habitual é risco trabalhista; limite de 2h por dia (CLT art. 59).'],
  });
  return out;
}

export function simularTodos(entrada: Entrada, p: ParametrosEncargos = ENCARGOS_PADRAO) {
  return CENARIOS.map((c) => simularCenario(entrada, c, p));
}
