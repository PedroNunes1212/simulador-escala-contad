import { useMemo, useState } from 'react';
import { custoMensal } from '../motor/custos';
import { janelaDoDia } from '../motor/gerador';
import { ENCARGOS_PADRAO } from '../motor/regras';
import { alternativas, horasSemana } from '../motor/simular';
import { duracao, hhmm } from '../motor/tempo';
import { BLOCO_VISUAL, DIAS, type CoberturaFuncao, type Entrada, type Funcao, type ResultadoCenario } from '../motor/tipos';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function Mapa({ entrada, cob, funcao }: { entrada: Entrada; cob: CoberturaFuncao; funcao: Funcao }) {
  const dias = DIAS.map((_, i) => i).filter((i) => janelaDoDia(entrada.funcionamento[i]));
  if (!dias.length) return null;
  const ini = Math.min(...dias.map((d) => janelaDoDia(entrada.funcionamento[d])!.ini));
  const fim = Math.max(...dias.map((d) => janelaDoDia(entrada.funcionamento[d])!.fim));
  const blocos: number[] = [];
  for (let m = Math.floor(ini / BLOCO_VISUAL) * BLOCO_VISUAL; m < fim; m += BLOCO_VISUAL) blocos.push(m);
  const celula = (dia: number, b: number) => {
    let nec = 0, falta = 0, trab = 0, interv = 0;
    for (let m = b; m < b + BLOCO_VISUAL; m++) {
      const n = cob.necessarias[dia][m], t = cob.trabalhando[dia][m];
      nec = Math.max(nec, n); falta = Math.max(falta, n - t); trab = Math.max(trab, t); interv = Math.max(interv, cob.emIntervalo[dia][m]);
    }
    return { nec, falta: Math.max(0, falta), trab, interv };
  };
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Mapa de cobertura de ${funcao.nome}`}>
      <table className="border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white pr-2 text-left font-semibold">Dia</th>
            {blocos.map((b) => <th key={b} className="min-w-[2.6rem] text-center font-medium text-marinho/70">{b % 60 === 0 ? hhmm(b) : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => (
            <tr key={dia}>
              <th className="sticky left-0 bg-white pr-2 text-left font-semibold">{DIAS[dia]}</th>
              {blocos.map((b) => {
                const c = celula(dia, b);
                const cls = c.nec === 0 ? 'bg-fundo text-marinho/40' : c.falta === 0 ? 'bg-ok/15 text-ok' : c.trab > 0 ? 'bg-parcial/20 text-[#7a4f0c]' : 'bg-falta/15 text-falta';
                const txt = c.nec === 0 ? '' : c.falta === 0 ? `${c.trab}` : `−${c.falta}`;
                const titulo = `${DIAS[dia]} ${hhmm(b)}–${hhmm(b + BLOCO_VISUAL)}: precisa ${c.nec}, trabalhando ${c.trab}, em intervalo ${c.interv}${c.falta ? `, falta ${c.falta}` : ''}`;
                return <td key={b} title={titulo} aria-label={titulo} className={`h-8 rounded text-center font-semibold ${cls}`}>{txt}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Escala({ r, funcao }: { r: ResultadoCenario; funcao: Funcao }) {
  const pessoas = r.pessoas.filter((p) => p.funcaoId === funcao.id);
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Escala de ${funcao.nome}`}>
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-linha text-left">
            <th className="sticky left-0 bg-white py-2 pr-3 font-semibold">Pessoa</th>
            {DIAS.map((d) => <th key={d} className="px-2 py-2 font-semibold">{d}</th>)}
            <th className="px-2 py-2 text-right font-semibold">Semana</th>
          </tr>
        </thead>
        <tbody>
          {pessoas.map((p) => (
            <tr key={p.id} className="border-b border-linha align-top">
              <th scope="row" className="sticky left-0 bg-white py-2 pr-3 text-left font-medium">{p.nome.replace(`${funcao.nome} `, '')}</th>
              {DIAS.map((_, dia) => {
                const t = p.turnos.find((x) => x.dia === dia);
                if (!t) return <td key={dia} className="px-2 py-2 font-semibold text-marinho/50">F</td>;
                return (
                  <td key={dia} className="px-2 py-2 leading-snug">
                    <span className="block font-semibold">{hhmm(t.ini)}–{hhmm(t.fim)}</span>
                    {t.intervaloIni !== null && t.intervaloMin > 0 && <span className="block text-marinho/70">int. {hhmm(t.intervaloIni)}–{hhmm(t.intervaloIni + t.intervaloMin)}</span>}
                    <span className="block text-marinho/70">{duracao(t.trabalhoMin)}</span>
                  </td>
                );
              })}
              <td className="px-2 py-2 text-right font-semibold">{duracao(horasSemana(p))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-marinho/70">F = folga. Horário: entrada–saída; int. = intervalo; horas trabalhadas sem o intervalo.</p>
    </div>
  );
}

function Alternativas({ entrada, r, funcao }: { entrada: Entrada; r: ResultadoCenario; funcao: Funcao }) {
  const alts = useMemo(() => alternativas(entrada, funcao, r.cenario), [entrada, funcao, r.cenario]);
  if (alts.length === 1) return <p className="text-ok font-semibold">A equipe atual cobre toda a demanda informada neste cenário.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-linha text-left">
          <th className="py-2 pr-2 font-semibold">Alternativa</th>
          <th className="py-2 px-2 text-right font-semibold">Ainda falta/sem</th>
          <th className="py-2 pl-2 text-right font-semibold">Custo extra/mês</th>
        </tr>
      </thead>
      <tbody>
        {alts.map((a, i) => (
          <tr key={i} className="border-b border-linha align-top">
            <td className="py-2 pr-2">
              <span className="font-semibold">{a.titulo}</span>
              <span className="block text-marinho/70">{a.detalhe}</span>
              {a.ressalvas.map((x) => <span key={x} className="block text-[#7a4f0c]">Atenção: {x}</span>)}
            </td>
            <td className={`py-2 px-2 text-right font-semibold ${a.deficitRestanteMin ? 'text-falta' : 'text-ok'}`}>{a.deficitRestanteMin ? duracao(a.deficitRestanteMin) : 'nada'}</td>
            <td className="py-2 pl-2 text-right font-semibold">{a.custoAdicionalMensal === null ? '—' : brl(a.custoAdicionalMensal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Comparativo({ resultados }: { resultados: ResultadoCenario[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-linha text-left">
            <th className="py-2 pr-2 font-semibold">Cenário</th>
            <th className="py-2 px-2 text-right font-semibold">Cobertura</th>
            <th className="py-2 px-2 text-right font-semibold">Falta/semana</th>
            <th className="py-2 px-2 text-right font-semibold">Horas escaladas</th>
            <th className="py-2 pl-2 text-right font-semibold">Folha mensal</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => {
            const falta = r.cobertura.reduce((a, c) => a + c.deficitMin, 0);
            const horas = r.pessoas.reduce((a, p) => a + horasSemana(p), 0);
            return (
              <tr key={r.cenario.id} className="border-b border-linha">
                <td className="py-2 pr-2"><span className="font-bold">{r.cenario.id}h</span><span className="hidden sm:inline"> · {r.cenario.nome.split(' · ')[1]}</span></td>
                <td className="py-2 px-2 text-right">{pct(r.indiceGeral)}</td>
                <td className={`py-2 px-2 text-right font-semibold ${falta ? 'text-falta' : 'text-ok'}`}>{falta ? duracao(falta) : 'nada'}</td>
                <td className="py-2 px-2 text-right">{duracao(horas)}</td>
                <td className="py-2 pl-2 text-right">{r.folhaMensal ? brl(r.folhaMensal) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-marinho/70">A folha não muda entre cenários: a EC 141/2026 proíbe reduzir salário. O custo da adaptação está nas alternativas.</p>
    </div>
  );
}

export function Resultado({ entrada, resultados }: { entrada: Entrada; resultados: ResultadoCenario[] }) {
  const [aba, setAba] = useState(1);
  const r = resultados[aba];
  const falta = r.cobertura.reduce((a, c) => a + c.deficitMin, 0);
  return (
    <div className="space-y-4">
      <section id="resultado" className="painel scroll-mt-4 p-4 sm:p-5">
        <h2 className="text-lg font-bold">Compare as jornadas</h2>
        <div className="mt-3"><Comparativo resultados={resultados} /></div>
      </section>

      <section className="painel p-4 sm:p-5" aria-labelledby="titulo-cenario">
        <div className="nao-imprimir flex flex-wrap gap-2" role="tablist" aria-label="Cenário">
          {resultados.map((x, i) => (
            <button key={x.cenario.id} role="tab" aria-selected={i === aba} type="button" onClick={() => setAba(i)}
              className={`botao text-sm ${i === aba ? 'bg-marinho text-white' : 'border border-linha bg-white text-marinho hover:bg-fundo'}`}>
              {x.cenario.id}h
            </button>
          ))}
        </div>
        <h2 id="titulo-cenario" className="mt-4 text-xl font-bold">{r.cenario.nome}</h2>
        <p className="mt-1 text-[15px]">
          Com os dados informados, a equipe atende <strong>{pct(r.indiceGeral)}</strong> da demanda
          {falta ? <> e faltam <strong className="text-falta">{duracao(falta)}</strong> de trabalho por semana.</> : ', sem horários descobertos.'}
        </p>
        <p className="mt-1 text-sm text-marinho/70">Sugestão viável gerada automaticamente, sem garantia de ser a melhor possível.</p>
      </section>

      {entrada.funcoes.map((f) => {
        const cob = r.cobertura.find((c) => c.funcaoId === f.id);
        if (!cob || f.quantidade === 0 && cob.necessarioMin === 0) return null;
        const custo = f.salario > 0 ? custoMensal(f.salario, entrada.regime, ENCARGOS_PADRAO) : null;
        return (
          <section key={f.id} className="painel p-4 sm:p-5">
            <h2 className="text-lg font-bold">{f.nome} <span className="font-medium text-marinho/70">· {f.quantidade} pessoa(s) · cobertura {pct(cob.indice)}</span></h2>
            <h3 className="mt-4 font-semibold">Mapa de cobertura</h3>
            <p className="mb-2 text-sm text-marinho/70">Número = pessoas trabalhando; −N = faltam N pessoas. Verde atendido, amarelo parcial, vermelho sem ninguém, cinza sem demanda.</p>
            <Mapa entrada={entrada} cob={cob} funcao={f} />
            <h3 className="mt-5 font-semibold">Escala da semana</h3>
            <Escala r={r} funcao={f} />
            <h3 className="mt-5 font-semibold">Alternativas</h3>
            <Alternativas entrada={entrada} r={r} funcao={f} />
            {custo && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold">Custo mensal por pessoa: {brl(custo.total)}</summary>
                <table className="mt-2 w-full max-w-md">
                  <tbody>
                    {([['Salário', custo.salario], ['Férias + 1/3 (provisão)', custo.ferias], ['13º (provisão)', custo.decimo], ['FGTS 8%', custo.fgts], ['Multa FGTS (provisão)', custo.multaFgts], ['INSS patronal', custo.cpp], ['RAT', custo.rat], ['Terceiros', custo.terceiros]] as const).map(([n, v]) => (
                      <tr key={n} className="border-b border-linha"><td className="py-1">{n}</td><td className="py-1 text-right">{brl(v)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </section>
        );
      })}

      <section className="painel p-4 sm:p-5">
        <h2 className="text-lg font-bold">Alertas</h2>
        <ul className="mt-2 space-y-1 text-[15px]">
          {r.alertas.map((a, i) => (
            <li key={i}><strong className={a.tipo === 'erro' ? 'text-falta' : a.tipo === 'aviso' ? 'text-[#7a4f0c]' : 'text-marinho/70'}>{a.tipo === 'erro' ? 'Erro' : a.tipo === 'aviso' ? 'Atenção' : 'Nota'}:</strong> {a.texto}</li>
          ))}
          {!r.alertas.length && <li>Sem inconsistências nas regras verificadas.</li>}
        </ul>
      </section>
    </div>
  );
}
