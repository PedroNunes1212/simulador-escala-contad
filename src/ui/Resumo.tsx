import { useMemo } from 'react';
import { duracao } from '../motor/tempo';
import type { Entrada, ResultadoCenario } from '../motor/tipos';
import { QUANDO, brl, ondeFalta, pct, solucao } from './analise';


function Situacao({ falta, indice }: { falta: number; indice: number }) {
  if (falta === 0) return <span className="rounded-full bg-ok/15 px-3 py-1 text-sm font-bold text-ok">Tudo coberto</span>;
  if (indice >= 0.95) return <span className="rounded-full bg-parcial/20 px-3 py-1 text-sm font-bold text-[#7a4f0c]">Falta pouco</span>;
  return <span className="rounded-full bg-falta/10 px-3 py-1 text-sm font-bold text-falta">Vai faltar gente</span>;
}

export function Resumo({ entrada, resultados }: { entrada: Entrada; resultados: ResultadoCenario[] }) {
  const dados = useMemo(() => resultados.map((r) => {
    const falta = r.cobertura.reduce((a, c) => a + c.deficitMin, 0);
    return { r, falta, onde: ondeFalta(entrada, r), sol: falta ? solucao(entrada, r) : null };
  }), [entrada, resultados]);
  const semSalario = entrada.funcoes.some((f) => f.quantidade > 0 && !f.salario);

  return (
    <div className="space-y-4">
      {dados.map(({ r, falta, onde, sol }) => {
        const exemplo = r.pessoas.find((p) => p.turnos.length);
        const dias = exemplo?.turnos.length ?? 0;
        const horasDia = exemplo ? Math.max(...exemplo.turnos.map((t) => t.trabalhoMin)) : 0;
        return (
          <section key={r.cenario.id} className="painel p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-marinho/60">{QUANDO[r.cenario.id]}</p>
                <h2 className="text-2xl font-extrabold">{r.cenario.id} horas por semana</h2>
              </div>
              <Situacao falta={falta} indice={r.indiceGeral} />
            </div>

            <p className="mt-3 text-[17px] leading-relaxed">
              Sua equipe cobre <strong>{pct(r.indiceGeral)}</strong> do horário em que você precisa de gente.
              {falta ? <> Faltam <strong className="text-falta">{duracao(falta)}</strong> de trabalho por semana.</> : ' Não falta ninguém.'}
            </p>
            {dias > 0 && (
              <p className="mt-1 text-marinho/75">
                Cada funcionário trabalha {dias} dias de até {duracao(horasDia)} e tem {7 - dias} {7 - dias === 1 ? 'folga' : 'folgas'} por semana.
              </p>
            )}

            {onde.length > 0 && (
              <>
                <h3 className="mt-4 font-bold">Onde vai faltar</h3>
                <ul className="mt-1 space-y-1">
                  {onde.slice(0, 3).map((o) => <li key={o.texto} className="flex gap-2"><span aria-hidden className="text-falta">●</span>{o.texto}</li>)}
                </ul>
                {onde.length > 3 && <p className="mt-1 text-sm text-marinho/70">E mais {onde.length - 3} horário(s). Veja tudo no resultado completo.</p>}
              </>
            )}

            {sol && (
              <div className="mt-4 rounded-md bg-fundo p-3">
                <h3 className="font-bold">Um jeito de resolver</h3>
                <ul className="mt-1 space-y-1">
                  {sol.passos.map((p) => (
                    <li key={p.funcao}>{p.funcao}: {p.alt.titulo.charAt(0).toLowerCase() + p.alt.titulo.slice(1)}
                      {p.alt.deficitRestanteMin > 0 && <span className="text-falta"> (ainda faltam {duracao(p.alt.deficitRestanteMin)})</span>}</li>
                  ))}
                </ul>
                <p className="mt-2 font-semibold">
                  {sol.custo === null ? 'Informe o salário no passo 3 para ver o custo.' : <>Custo extra estimado: <span className="text-lg">{brl(sol.custo)}</span> por mês, com encargos.</>}
                </p>
                <p className="mt-1 text-sm text-marinho/70">Há outras opções (horas extras, reorganizar turnos) no resultado completo.</p>
              </div>
            )}
          </section>
        );
      })}

      <section className="painel p-4 text-[15px] sm:p-5">
        <h2 className="font-bold">Importante</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-marinho/80">
          <li>O salário dos funcionários não pode ser reduzido com a nova jornada.</li>
          {!entrada.acordoAcima8h && <li>Cada dia tem no máximo 8h de trabalho. Por isso as 42h ficam iguais às 40h.</li>}
          {semSalario && <li>Sem o salário de todas as funções, os custos ficam incompletos.</li>}
          <li>As regras ainda estão sendo conferidas pela ContaD. Antes de mudar a escala, fale com a gente.</li>
        </ul>
      </section>
    </div>
  );
}
