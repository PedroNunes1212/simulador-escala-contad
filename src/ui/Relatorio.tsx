import { useMemo, useState } from 'react';
import { linkWhatsapp, mensagemDp } from '../dados/mensagemDp';
import { relatorioXml, type ContatoRelatorio } from '../dados/relatorioXml';
import { OBSERVACOES_EC, VERSAO_REGRAS } from '../motor/regras';
import { horasSemana } from '../motor/simular';
import { duracao, hhmm } from '../motor/tempo';
import { DIAS, type Entrada, type ResultadoCenario } from '../motor/tipos';
import { QUANDO, brl, listaDias, ondeFalta, pct, resumoFuncionamento, solucao } from './analise';

const REGIME: Record<string, string> = {
  simples: 'Simples Nacional (anexos I, II, III ou V)',
  simples_anexo_iv: 'Simples Nacional, anexo IV',
  presumido_real: 'Lucro Presumido ou Lucro Real',
};
const fim = (m: number) => (m === 1440 ? '24:00' : hhmm(m));

function baixar(nome: string, conteudo: string, tipo: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Relatório da simulação para o Departamento Pessoal: resumo simples primeiro, detalhes depois. Vira PDF pela impressão. */
export function Relatorio({ entrada, resultados, onVoltar, podeBaixar }: {
  entrada: Entrada; resultados: ResultadoCenario[]; onVoltar: () => void; podeBaixar: boolean;
}) {
  const [contato, setContato] = useState<ContatoRelatorio>({ empresa: '', responsavel: '', telefone: '', email: '', duvida: '' });
  const [geradoEm] = useState(() => new Date());
  const dados = useMemo(() => resultados.map((r) => {
    const falta = r.cobertura.reduce((a, c) => a + c.deficitMin, 0);
    return { r, falta, onde: ondeFalta(entrada, r), sol: falta ? solucao(entrada, r) : null };
  }), [entrada, resultados]);
  const campo = (k: keyof ContatoRelatorio) => ({
    value: contato[k], onChange: (e: { target: { value: string } }) => setContato({ ...contato, [k]: e.target.value.slice(0, k === 'duvida' ? 1000 : 120) }),
  });
  const data = geradoEm.toLocaleDateString('pt-BR');
  const hora = geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nomeArquivo = `relatorio-escala-${geradoEm.toISOString().slice(0, 10)}`;

  return (
    <div className="min-h-dvh bg-fundo print:bg-white">
      <header className="nao-imprimir sticky top-0 z-20 bg-marinho text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <button type="button" className="botao border border-white/40 text-sm text-white hover:bg-white/10" onClick={onVoltar}>Voltar ao resultado</button>
          {podeBaixar && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="botao border border-white/40 text-sm text-white hover:bg-white/10"
                onClick={() => baixar(`${nomeArquivo}.xml`, relatorioXml(entrada, resultados, contato, geradoEm), 'application/xml')}>Baixar XML</button>
              <button type="button" className="botao bg-white text-sm text-marinho hover:bg-white/90" onClick={() => window.print()}>Salvar em PDF</button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
        <section className="nao-imprimir painel mb-6 p-4 sm:p-5">
          <h1 className="text-2xl font-extrabold tracking-tight">Falar com o Departamento Pessoal</h1>
          <p className="mt-1 text-marinho/75">
            Preencha seus dados, se quiser, e envie este relatório para o Departamento Pessoal da ContaD.
            Ele mostra o que você informou e o resultado dos três cenários, para a gente analisar com você.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="rotulo" htmlFor="r-empresa">Empresa</label><input id="r-empresa" className="campo" autoComplete="organization" {...campo('empresa')} /></div>
            <div><label className="rotulo" htmlFor="r-resp">Seu nome</label><input id="r-resp" className="campo" autoComplete="name" {...campo('responsavel')} /></div>
            <div><label className="rotulo" htmlFor="r-tel">Telefone ou WhatsApp</label><input id="r-tel" className="campo" inputMode="tel" autoComplete="tel" {...campo('telefone')} /></div>
            <div><label className="rotulo" htmlFor="r-email">E-mail</label><input id="r-email" className="campo" type="email" autoComplete="email" {...campo('email')} /></div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="r-duvida">Qual é a sua dúvida?</label>
              <textarea id="r-duvida" rows={3} className="campo" placeholder="Ex.: posso manter a loja aberta no sábado à tarde com a equipe atual?" {...campo('duvida')} />
            </div>
          </div>
          <ol className="mt-4 space-y-3">
            <li className="flex flex-wrap items-center gap-3">
              <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marinho text-sm font-bold text-white">1</span>
              {podeBaixar
                ? <button type="button" className="botao-sec" onClick={() => window.print()}>Salvar o relatório em PDF</button>
                : <span className="text-sm text-marinho/70">Salve o relatório em PDF (na versão publicada; nesta prévia o navegador bloqueia).</span>}
            </li>
            <li className="flex flex-wrap items-center gap-3">
              <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marinho text-sm font-bold text-white">2</span>
              <a className="botao-principal" target="_blank" rel="noopener noreferrer" href={linkWhatsapp(mensagemDp(entrada, resultados, contato))}>
                Enviar pelo WhatsApp do DP
              </a>
            </li>
          </ol>
          <p className="mt-3 text-sm text-marinho/70">
            O WhatsApp abre numa nova aba com um resumo já escrito. Anexe o PDF na conversa.
            Nada é enviado sem você tocar em enviar.
          </p>
        </section>

        <article className="painel p-4 text-[15px] sm:p-6 print:border-0 print:p-0 print:text-[11pt]">
          <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-marinho pb-3">
            <div>
              <p className="text-lg font-extrabold leading-tight">ContaD <span className="font-medium text-marinho/70">Assessoria Contábil</span></p>
              <h2 className="text-xl font-extrabold">Relatório da simulação de escalas</h2>
            </div>
            <p className="text-sm text-marinho/70">Gerado em {data} às {hora} · regras de {VERSAO_REGRAS.split('-').reverse().join('/')}</p>
          </header>

          <section className="mt-4">
            <h3 className="font-bold">Contato</h3>
            <dl className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              <div><dt className="inline font-semibold">Empresa: </dt><dd className="inline">{contato.empresa || 'não informado'}</dd></div>
              <div><dt className="inline font-semibold">Responsável: </dt><dd className="inline">{contato.responsavel || 'não informado'}</dd></div>
              <div><dt className="inline font-semibold">Telefone: </dt><dd className="inline">{contato.telefone || 'não informado'}</dd></div>
              <div><dt className="inline font-semibold">E-mail: </dt><dd className="inline">{contato.email || 'não informado'}</dd></div>
            </dl>
            {contato.duvida.trim() && <p className="mt-2 whitespace-pre-line rounded-md bg-fundo p-2"><strong>Dúvida:</strong> {contato.duvida.trim()}</p>}
          </section>

          <section className="mt-5">
            <h3 className="text-lg font-bold">1. Resumo</h3>
            <div className="mt-2 space-y-3">
              {dados.map(({ r, falta, onde, sol }) => (
                <div key={r.cenario.id} className="break-inside-avoid rounded-md border border-linha p-3">
                  <p className="font-bold">{r.cenario.id} horas por semana <span className="font-medium text-marinho/70">· {QUANDO[r.cenario.id]}</span></p>
                  <p>Cobre {pct(r.indiceGeral)} do horário em que precisa de gente. {falta ? <>Faltam <strong>{duracao(falta)}</strong> de trabalho por semana.</> : 'Não falta ninguém.'}</p>
                  {onde.length > 0 && (
                    <ul className="mt-1 list-disc pl-5">
                      {onde.slice(0, 5).map((o) => <li key={o.texto}>{o.texto}</li>)}
                      {onde.length > 5 && <li>E mais {onde.length - 5} horário(s), no detalhe abaixo.</li>}
                    </ul>
                  )}
                  {sol && (
                    <p className="mt-1">
                      <strong>Sugestão:</strong> {sol.passos.map((p) => `${p.funcao}: ${p.alt.titulo.charAt(0).toLowerCase()}${p.alt.titulo.slice(1)}`).join('; ')}.
                      {' '}{sol.custo === null ? 'Custo não calculado (salário não informado).' : `Custo extra estimado: ${brl(sol.custo)} por mês, com encargos.`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5 break-inside-avoid">
            <h3 className="text-lg font-bold">2. Dados informados</h3>
            <p className="mt-1"><strong>Regime tributário:</strong> {REGIME[entrada.regime]}</p>
            <p><strong>Divisor da hora extra (44h):</strong> {entrada.divisor44 ?? 210}</p>
            <p><strong>Funcionamento:</strong> {resumoFuncionamento(entrada.funcionamento)}</p>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-sm">
                <thead><tr className="border-b border-linha text-left"><th className="py-1 pr-2">Função</th><th className="py-1 pr-2">Pessoas</th><th className="py-1 pr-2">Jornada</th><th className="py-1 pr-2">Salário médio</th><th className="py-1">Pessoas necessárias por horário</th></tr></thead>
                <tbody>
                  {entrada.funcoes.map((f) => {
                    const nec = entrada.demandas.filter((d) => d.funcaoId === f.id);
                    return (
                      <tr key={f.id} className="border-b border-linha align-top">
                        <td className="py-1 pr-2 font-semibold">{f.nome}</td>
                        <td className="py-1 pr-2">{f.quantidade} ({f.quantidade - Math.min(f.mulheres ?? 0, f.quantidade)} H, {Math.min(f.mulheres ?? 0, f.quantidade)} M)</td>
                        <td className="py-1 pr-2">{duracao(f.jornadaContratualMin)}/sem.</td>
                        <td className="py-1 pr-2">{f.salario ? brl(f.salario) : 'não informado'}</td>
                        <td className="py-1">{nec.length
                          ? nec.map((d, i) => <span key={i} className="block">{listaDias(d.dias)}, {hhmm(d.ini)} às {fim(d.fim)}: {d.pessoas}</span>)
                          : '1 pessoa em todo o horário aberto (padrão)'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {resultados.map((r, i) => (
            <section key={r.cenario.id} className={`mt-5 ${i > 0 ? 'break-before-page' : ''}`}>
              <h3 className="text-lg font-bold">3. Escala sugerida · {r.cenario.nome}</h3>
              <div className="overflow-x-auto">
                <table className="mt-2 w-full min-w-[640px] text-xs print:min-w-0">
                  <thead>
                    <tr className="border-b border-linha text-left"><th className="py-1 pr-2">Pessoa</th>{DIAS.map((d) => <th key={d} className="px-1 py-1">{d}</th>)}<th className="py-1 pl-1 text-right">Semana</th></tr>
                  </thead>
                  <tbody>
                    {r.pessoas.map((p) => (
                      <tr key={p.id} className="border-b border-linha align-top">
                        <td className="py-1 pr-2 font-semibold">{p.nome}</td>
                        {DIAS.map((_, dia) => {
                          const t = p.turnos.find((x) => x.dia === dia);
                          return (
                            <td key={dia} className="px-1 py-1 leading-tight">
                              {t ? <>{hhmm(t.ini)}–{fim(t.fim)}{t.intervaloIni !== null && t.intervaloMin > 0 && <span className="block text-marinho/70">int. {hhmm(t.intervaloIni)}–{hhmm(t.intervaloIni + t.intervaloMin)}</span>}</> : <span className="text-marinho/50">folga</span>}
                            </td>
                          );
                        })}
                        <td className="py-1 pl-1 text-right font-semibold">{duracao(horasSemana(p))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.alertas.length > 0 && (
                <>
                  <h4 className="mt-3 font-semibold">Alertas deste cenário</h4>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {r.alertas.map((a, i) => <li key={i}><strong>{a.tipo === 'erro' ? 'Erro' : a.tipo === 'aviso' ? 'Atenção' : 'Nota'}:</strong> {a.texto}</li>)}
                  </ul>
                </>
              )}
            </section>
          ))}

          <section className="mt-5 break-inside-avoid">
            <h3 className="text-lg font-bold">4. Observações</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              <li>Simulação de planejamento, gerada automaticamente com os dados informados pelo cliente. Não é parecer jurídico.</li>
              <li>As regras ainda estão sendo conferidas pela ContaD. A escala é uma sugestão viável, sem garantia de ser a melhor possível.</li>
              <li>O salário não pode ser reduzido com a nova jornada (EC 141/2026).</li>
              {OBSERVACOES_EC.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
