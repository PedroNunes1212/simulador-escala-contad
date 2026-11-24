import { describe, expect, it } from 'vitest';
import { avaliarCobertura, gradeNecessidade } from './cobertura';
import { custoMensal, custoHoraExtraMensal } from './custos';
import { gerarEscala } from './gerador';
import { CENARIOS, ENCARGOS_PADRAO, cenarioEfetivo, intervaloMinimo, limiteDomingo } from './regras';
import { alternativas, faltasInterjornada, horasSemana, maiorDescansoSemanal, simularCenario } from './simular';
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
  it('demanda fora do horário aberto não vira falta', () => {
    const func = segSab(9 * 60, 19 * 60); func[5] = aberto(9 * 60, 14 * 60);
    const g = gradeNecessidade('cx', [{ funcaoId: 'cx', dias: [0, 1, 2, 3, 4, 5], ini: 9 * 60, fim: 19 * 60, pessoas: 1 }], func);
    expect(g[5].slice(14 * 60, 19 * 60).every((x) => x === 0)).toBe(true);
    expect(g[5][13 * 60]).toBe(1);
    expect(g[0][18 * 60]).toBe(1);
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
  it('com acordo, 42h vira 5 jornadas de 8h24; 40h vira 5 de 8h', () => {
    const r42 = simularCenario({ ...base, acordoAcima8h: true }, C42), r40 = simularCenario(base, C40);
    expect(r42.pessoas.map(horasSemana)).toEqual([2520, 2520, 2520]);
    expect(r42.pessoas.every((p) => p.turnos.every((t) => t.trabalhoMin === 504))).toBe(true);
    expect(r40.pessoas.map(horasSemana)).toEqual([2400, 2400, 2400]);
  });
  it('sem acordo, 42h fica em 8h por dia e avisa (não limita em silêncio)', () => {
    const r = simularCenario(base, C42);
    expect(r.pessoas.every((p) => p.turnos.every((t) => t.trabalhoMin <= 480))).toBe(true);
    expect(r.alertas.some((a) => /limite de 8h por dia/.test(a.texto))).toBe(true);
  });
  it('respeita 11h de descanso entre jornadas, inclusive domingo → segunda', () => {
    const longo: Entrada = {
      regime: 'simples', funcionamento: [...Array(7)].map(() => ({ aberto: true, periodos: [{ ini: 6 * 60, fim: 23 * 60 }] })),
      funcoes: [{ id: 'at', nome: 'Atendente', quantidade: 4, salario: 2000, jornadaContratualMin: 44 * 60 }],
      demandas: [
        { funcaoId: 'at', dias: [0, 2, 4, 6], ini: 15 * 60, fim: 23 * 60, pessoas: 2 },
        { funcaoId: 'at', dias: [1, 3, 5], ini: 6 * 60, fim: 14 * 60, pessoas: 2 },
      ],
    };
    for (const c of [C44, C42, C40]) {
      const r = simularCenario(longo, c);
      for (const p of r.pessoas) expect(faltasInterjornada(p)).toEqual([]);
    }
  });
  it('detecta falta de descanso entre jornadas', () => {
    const p = { id: 'x', nome: 'X', funcaoId: 'at', semanalMin: 2640, turnos: [
      { dia: 0, ini: 14 * 60, fim: 23 * 60, intervaloIni: 18 * 60, intervaloMin: 60, trabalhoMin: 480 },
      { dia: 1, ini: 6 * 60, fim: 15 * 60, intervaloIni: 10 * 60, intervaloMin: 60, trabalhoMin: 480 },
    ] };
    expect(faltasInterjornada(p)).toEqual([{ de: 0, para: 1, descansoMin: 420 }]);
  });
  it('hora extra respeita o teto de 10h por dia', () => {
    const umaPessoa: Entrada = { ...base, acordoAcima8h: true, funcoes: [{ ...base.funcoes[0], quantidade: 1 }] };
    const he = alternativas(umaPessoa, umaPessoa.funcoes[0], C42).find((a) => a.tipo === 'hora_extra')!;
    // 5 dias × (10h − 8h24) = 5 × 96 min = 8h por semana, não 10h
    expect(he.titulo).toMatch(/8h/);
    expect(he.titulo).not.toMatch(/10h/);
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

describe('revisão de 18/11', () => {
  const farmacia = (ini: number, fim: number) => [...Array(7)].map(() => aberto(ini, fim));
  it('descanso semanal de 35h com loja aberta das 7h às 22h, 6x1', () => {
    const e: Entrada = { regime: 'simples', funcionamento: farmacia(420, 1320),
      funcoes: [{ id: 'b', nome: 'B', quantidade: 6, salario: 0, jornadaContratualMin: 2640 }],
      demandas: [{ funcaoId: 'b', dias: [0, 1, 2, 3, 4, 5, 6], ini: 420, fim: 1320, pessoas: 2 }] };
    for (const c of CENARIOS) {
      const r = simularCenario(e, c);
      for (const p of r.pessoas) expect(maiorDescansoSemanal(p)).toBeGreaterThanOrEqual(35 * 60);
      expect(r.alertas.some((a) => a.texto.includes('35h seguidas'))).toBe(false);
    }
  });
  it('acusa descanso semanal menor que 35h', () => {
    const t = (dia: number, ini: number, fim: number) => ({ dia, ini, fim, intervaloIni: null, intervaloMin: 60, trabalhoMin: fim - ini - 60 });
    const p: Pessoa = { id: 'x', nome: 'x', funcaoId: 'b', semanalMin: 2640,
      turnos: [t(0, 420, 860), t(1, 420, 860), t(2, 420, 860), t(3, 420, 860), t(4, 420, 860), t(5, 880, 1320)] };
    // sábado sai 22h, domingo folga, segunda entra 7h: 2h + 24h + 7h = 33h
    expect(maiorDescansoSemanal(p)).toBe(33 * 60);
  });
  it('pausa no funcionamento: ninguém trabalha com a empresa fechada', () => {
    const dia: DiaFuncionamento = { aberto: true, periodos: [{ ini: 480, fim: 720 }, { ini: 840, fim: 1080 }] };
    const e: Entrada = { regime: 'simples', funcionamento: [...Array(5)].map(() => dia).concat([fechado, fechado]),
      funcoes: [{ id: 'a', nome: 'A', quantidade: 2, salario: 0, jornadaContratualMin: 2400 }], demandas: [] };
    const r = simularCenario(e, C40);
    for (const p of r.pessoas) for (const t of p.turnos) {
      for (let m = t.ini; m < t.fim; m++) {
        const noIntervalo = t.intervaloIni !== null && m >= t.intervaloIni && m < t.intervaloIni + t.intervaloMin;
        if (!noIntervalo) expect(dia.periodos.some((x) => m >= x.ini && m < x.fim)).toBe(true);
      }
      expect(t.trabalhoMin).toBe(480);
    }
    expect(r.cobertura[0].deficitMin).toBe(0);
  });
  it('Simples anexo IV paga INSS patronal e RAT, mas não terceiros', () => {
    const iv = custoMensal(2000, 'simples_anexo_iv', ENCARGOS_PADRAO);
    expect(iv.cpp).toBeGreaterThan(0);
    expect(iv.rat).toBeGreaterThan(0);
    expect(iv.terceiros).toBe(0);
    expect(custoMensal(2000, 'presumido_real', ENCARGOS_PADRAO).terceiros).toBeGreaterThan(0);
  });
});

describe('pedidos de 19/11: domingos por sexo e divisor 210', () => {
  const todoDia = (ini: number, fim: number) => Array.from({ length: 7 }, () => ({ aberto: true, periodos: [{ ini, fim }] }));
  const base = (homens: number, mulheres: number, divisor44?: 210 | 220): Entrada => ({
    regime: 'simples', funcionamento: todoDia(8 * 60, 16 * 60), divisor44,
    funcoes: [{ id: 'a', nome: 'Atendente', quantidade: homens + mulheres, mulheres, salario: 2100, jornadaContratualMin: 44 * 60 }],
    demandas: [{ funcaoId: 'a', dias: [0, 1, 2, 3, 4, 5, 6], ini: 8 * 60, fim: 16 * 60, pessoas: homens + mulheres }],
  });
  const noDomingo = (e: Entrada) => simularCenario(e, CENARIOS[0]).pessoas.filter((p) => p.turnos.some((t) => t.dia === 6)).length;

  it('limite de domingo: homem trabalha 2 de 3, mulher 1 de 2', () => {
    expect(limiteDomingo(3, 0)).toBe(2);
    expect(limiteDomingo(6, 0)).toBe(4);
    expect(limiteDomingo(4, 0)).toBe(2);
    expect(limiteDomingo(0, 4)).toBe(2);
    expect(limiteDomingo(2, 2)).toBe(2);
    expect(limiteDomingo(1, 0)).toBe(0);
  });
  it('a escala respeita o limite e avisa no domingo', () => {
    expect(noDomingo(base(6, 0))).toBeLessThanOrEqual(4);
    expect(noDomingo(base(0, 4))).toBeLessThanOrEqual(2);
    const r = simularCenario(base(0, 4), CENARIOS[0]);
    expect(r.alertas.some((a) => a.texto.includes('no máximo 2 de 4') && a.texto.includes('domingo'))).toBe(true);
  });
  it('mais mulheres = menos gente no domingo, sem mudar o total de pessoas', () => {
    expect(noDomingo(base(0, 6))).toBeLessThan(noDomingo(base(6, 0)));
  });
  it('divisor do cenário 44h é 210 por padrão e 220 se escolhido', () => {
    expect(cenarioEfetivo(CENARIOS[0], base(1, 0)).divisor).toBe(210);
    expect(cenarioEfetivo(CENARIOS[0], base(1, 0, 220)).divisor).toBe(220);
    expect(cenarioEfetivo(CENARIOS[1], base(1, 0, 220)).divisor).toBe(210);
  });
});
