import { describe, expect, it } from 'vitest';
import { avaliarCobertura, gradeNecessidade } from './cobertura';
import { custoMensal, custoHoraExtraMensal } from './custos';
import { gerarEscala } from './gerador';
import { CENARIOS, ENCARGOS_PADRAO, intervaloMinimo } from './regras';
import { alternativas, horasSemana, simularCenario } from './simular';
import { duracao, hhmm, paraMinutos } from './tempo';
import type { DiaFuncionamento, Entrada, Pessoa } from './tipos';

const C44 = CENARIOS[0], C42 = CENARIOS[1], C40 = CENARIOS[2];
const aberto = (ini: number, fim: number): DiaFuncionamento => ({ aberto: true, periodos: [{ ini, fim }] });
const fechado: DiaFuncionamento = { aberto: false, periodos: [] };
const segSab = (ini: number, fim: number) => [...Array(6)].map(() => aberto(ini, fim)).concat([fechado]);

describe('tempo em minutos', () => {
  it('8h24 é 504 minutos, não 8,24 horas', () => {
    expect(paraMinutos('08:24')).toBe(504);
    expect(5 * 504).toBe(42 * 60);
    expect(5 * 480).toBe(40 * 60);
    expect(4 * 480 + 240).toBe(36 * 60);
  });
  it('aceita formatos variados e formata de volta', () => {
    expect(paraMinutos('8')).toBe(480);
    expect(paraMinutos('8h30')).toBe(510);
    expect(paraMinutos('0830')).toBe(510);
    expect(paraMinutos('25:00')).toBeNull();
    expect(hhmm(1044)).toBe('17:24');
    expect(duracao(2500)).toBe('41h40');
  });
  it('intervalo mínimo da CLT', () => {
    expect(intervaloMinimo(504)).toBe(60);
    expect(intervaloMinimo(300)).toBe(15);
    expect(intervaloMinimo(240)).toBe(0);
  });
});

describe('custos por regime', () => {
  it('banhista R$ 1.650: Simples não paga CPP/RAT/terceiros', () => {
    const s = custoMensal(1650, 'simples', ENCARGOS_PADRAO);
    const pr = custoMensal(1650, 'presumido_real', ENCARGOS_PADRAO);
    expect(s.cpp).toBe(0);
    expect(s.total).toBeCloseTo(2191.5, 0);
    expect(pr.total).toBeCloseTo(2739.4, 0);
    expect(pr.total - s.total).toBeGreaterThan(500);
  });
  it('divisor muda o valor da hora extra (220, 210, 200)', () => {
    const a = custoHoraExtraMensal(1650, 220, 240, 'simples', ENCARGOS_PADRAO).total;
    const b = custoHoraExtraMensal(1650, 200, 240, 'simples', ENCARGOS_PADRAO).total;
    expect(b).toBeGreaterThan(a);
  });
});

describe('cobertura', () => {
  const func = segSab(8 * 60, 18 * 60);
  it('intervalo reduz quem está trabalhando', () => {
    const nec = gradeNecessidade('a', [{ funcaoId: 'a', dias: [0], ini: 720, fim: 780, pessoas: 3 }], func);
    const p = (id: string, intervalo: number | null): Pessoa => ({
      id, nome: id, funcaoId: 'a', semanalMin: 2640,
      turnos: [{ dia: 0, ini: 480, fim: 1080, intervaloIni: intervalo, intervaloMin: 60, trabalhoMin: 540 }],
    });
    const cob = avaliarCobertura('a', nec, [p('x', 720), p('y', 840), p('z', 840)]);
    expect(cob.trabalhando[0][730]).toBe(2);
    expect(cob.emIntervalo[0][730]).toBe(1);
    expect(cob.deficitMin).toBe(60);
    expect(cob.periodosCriticos[0]).toMatchObject({ dia: 0, ini: 720, fim: 780, falta: 1 });
  });
  it('excesso num horário não apaga déficit em outro', () => {
    const nec = gradeNecessidade('a', [
      { funcaoId: 'a', dias: [0], ini: 480, fim: 600, pessoas: 1 },
      { funcaoId: 'a', dias: [0], ini: 600, fim: 720, pessoas: 2 },
    ], func);
    const pessoas: Pessoa[] = ['x', 'y'].map((id) => ({
      id, nome: id, funcaoId: 'a', semanalMin: 2640,
      turnos: [{ dia: 0, ini: 480, fim: 600, intervaloIni: null, intervaloMin: 0, trabalhoMin: 120 }],
    }));
    const cob = avaliarCobertura('a', nec, pessoas);
    expect(cob.excessoMin).toBe(120);
    expect(cob.deficitMin).toBe(240);
  });
  it('funções não se substituem', () => {
    const nec = gradeNecessidade('b', [], func);
    const outra: Pessoa = { id: 'x', nome: 'x', funcaoId: 'a', semanalMin: 2640,
      turnos: [{ dia: 0, ini: 480, fim: 1080, intervaloIni: null, intervaloMin: 0, trabalhoMin: 600 }] };
    expect(avaliarCobertura('b', nec, [outra]).trabalhando[0][600]).toBe(0);
  });
});

describe('gerador', () => {
  const base: Entrada = {
    regime: 'simples', funcionamento: segSab(8 * 60, 18 * 60),
    funcoes: [{ id: 'at', nome: 'Atendente', quantidade: 3, salario: 2000, jornadaContratualMin: 44 * 60 }],
    demandas: [],
  };
  it('respeita limites, folgas e não ultrapassa a jornada em cada cenário', () => {
    for (const c of [C44, C42, C40]) {
      const r = simularCenario(base, c);
      for (const p of r.pessoas) {
        expect(horasSemana(p)).toBeLessThanOrEqual(c.limiteSemanalMin);
        expect(p.turnos.length).toBeLessThanOrEqual(7 - c.folgasSemana);
        for (const t of p.turnos) {
          expect(t.trabalhoMin).toBeLessThanOrEqual(c.limiteDiarioMin);
          expect(t.fim - t.ini).toBe(t.trabalhoMin + t.intervaloMin);
          expect(t.ini).toBeGreaterThanOrEqual(480);
          expect(t.fim).toBeLessThanOrEqual(1080);
          if (t.trabalhoMin > 360) expect(t.intervaloMin).toBe(60);
        }
      }
      expect(r.alertas.some((a) => a.tipo === 'erro')).toBe(false);
    }
  });
  it('42h vira 5 jornadas de 8h24 e 40h vira 5 de 8h', () => {
    const r42 = simularCenario(base, C42), r40 = simularCenario(base, C40);
    expect(r42.pessoas.map(horasSemana)).toEqual([2520, 2520, 2520]);
    expect(r40.pessoas.map(horasSemana)).toEqual([2400, 2400, 2400]);
  });
  it('não amplia jornada contratual menor', () => {
    const e = { ...base, funcoes: [{ ...base.funcoes[0], jornadaContratualMin: 30 * 60 }] };
    expect(simularCenario(e, C40).pessoas.every((p) => horasSemana(p) <= 1800)).toBe(true);
  });
  it('reduzir jornada sem aumentar equipe gera déficit, e contratar resolve', () => {
    const umaPessoa: Entrada = { ...base, funcoes: [{ ...base.funcoes[0], quantidade: 1 }] };
    const r = simularCenario(umaPessoa, C40);
    expect(r.indiceGeral).toBeLessThan(1);
    const alts = alternativas(umaPessoa, umaPessoa.funcoes[0], C40);
    const integral = alts.filter((a) => a.tipo === 'integral');
    expect(integral[integral.length - 1].deficitRestanteMin).toBeLessThan(alts[0].deficitRestanteMin);
    expect(alts.find((a) => a.tipo === 'hora_extra')!.ressalvas[0]).toMatch(/risco/);
  });
  it('alterna folgas entre pessoas para cobrir todos os dias', () => {
    const r = simularCenario(base, C40);
    const diasCobertos = new Set(r.pessoas.flatMap((p) => p.turnos.map((t) => t.dia)));
    expect([...diasCobertos].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('não escala em dia fechado', () => {
    const r = gerarEscala({ funcaoId: 'at', nomeFuncao: 'A', pessoas: [{ id: '1', nome: '1', semanalMin: 2640 }],
      cenario: C44, funcionamento: base.funcionamento, necessidade: gradeNecessidade('at', [], base.funcionamento) });
    expect(r[0].turnos.some((t) => t.dia === 6)).toBe(false);
  });
});
