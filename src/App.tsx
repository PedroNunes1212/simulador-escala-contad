import { useEffect, useMemo, useRef, useState } from 'react';
import { ENTRADA_VAZIA } from './dados/exemplos';
import { CENARIOS, OBSERVACOES_EC, REGRA_DOMINGO, VERSAO_REGRAS, cenarioEfetivo } from './motor/regras';
import { simularTodos } from './motor/simular';
import type { Entrada } from './motor/tipos';
import { Formulario } from './ui/Formulario';
import { Resultado } from './ui/Resultado';
import { Relatorio } from './ui/Relatorio';
import { Resumo } from './ui/Resumo';
import { OpcoesCartao } from './ui/controles';

const CHAVE = 'simulador-escalas:entrada';
// Na prévia publicada (artifact) o navegador bloqueia download e impressão.
const PREVIA = import.meta.env.VITE_PREVIA === '1';

function carregar(): Entrada {
  try {
    const t = sessionStorage.getItem(CHAVE);
    const e = t ? sanitizar(JSON.parse(t)) : null;
    if (e) return e;
  } catch { /* navegador sem armazenamento: segue com o padrão */ }
  return ENTRADA_VAZIA;
}

const lim = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : padrao;
};

/** Arquivo aberto pelo usuário é dado não confiável: valida formato e limita tamanhos. */
export function sanitizar(e: unknown): Entrada | null {
  const x = e as Entrada;
  if (!x || !Array.isArray(x.funcionamento) || x.funcionamento.length !== 7 || !Array.isArray(x.funcoes) || !Array.isArray(x.demandas)) return null;
  const regimes = ['simples', 'simples_anexo_iv', 'presumido_real'];
  const funcoes = x.funcoes.slice(0, 20).map((f, i) => ({
    id: String(f?.id ?? `f${i}`).slice(0, 40), nome: String(f?.nome ?? 'Função').slice(0, 60),
    quantidade: lim(f?.quantidade, 0, 50, 1), mulheres: Math.min(lim(f?.mulheres, 0, 50, 0), lim(f?.quantidade, 0, 50, 1)), salario: lim(f?.salario, 0, 1_000_000, 0),
    jornadaContratualMin: lim(f?.jornadaContratualMin, 60, 2640, 2640),
  }));
  const ids = new Set(funcoes.map((f) => f.id));
  return {
    regime: regimes.includes(x.regime) ? x.regime : 'simples',
    funcionamento: x.funcionamento.map((d) => ({
      aberto: !!d?.aberto,
      periodos: (Array.isArray(d?.periodos) ? d.periodos : []).slice(0, 3)
        .map((p) => ({ ini: lim(p?.ini, 0, 1439, 480), fim: lim(p?.fim, 1, 1440, 1080) })).filter((p) => p.fim > p.ini),
    })),
    funcoes,
    demandas: x.demandas.slice(0, 100).filter((d) => ids.has(String(d?.funcaoId))).map((d) => ({
      funcaoId: String(d.funcaoId), dias: (Array.isArray(d.dias) ? d.dias : []).map((n) => lim(n, 0, 6, 0)),
      ini: lim(d.ini, 0, 1439, 480), fim: lim(d.fim, 1, 1440, 1080), pessoas: lim(d.pessoas, 0, 50, 1),
    })),
  };
}

const PASSOS = [
  { n: 1, nome: 'Empresa', dica: 'Regime tributário da empresa.' },
  { n: 2, nome: 'Funcionamento', dica: 'Dias e horários em que a empresa abre.' },
  { n: 3, nome: 'Equipe', dica: 'Funções, quantidade de pessoas, jornada e salário.' },
  { n: 4, nome: 'Pessoas por horário', dica: 'Quantas pessoas precisam estar trabalhando ao mesmo tempo, em cada horário do dia?' },
  { n: 5, nome: 'Resultado', dica: 'Veja o resumo simples ou o resultado completo, com escala, mapa de cobertura e custos.' },
];

export default function App() {
  const [entrada, setEntrada] = useState<Entrada>(carregar);
  const [exemplo, setExemplo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [etapa, setEtapa] = useState(0); // 0 = tela inicial
  const [visao, setVisao] = useState<'resumo' | 'completo'>('resumo');
  const [relatorio, setRelatorio] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const resultados = useMemo(() => simularTodos(entrada), [entrada]);

  useEffect(() => { try { sessionStorage.setItem(CHAVE, JSON.stringify(entrada)); } catch { /* ignora */ } }, [entrada]);
  useEffect(() => { window.scrollTo({ top: 0 }); document.getElementById('conteudo')?.focus({ preventScroll: true }); }, [etapa, relatorio]);

  const mudar = (e: Entrada) => { setEntrada(e); setExemplo(null); };
  const exportar = () => {
    const blob = new Blob([JSON.stringify(entrada, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `simulacao-escala-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importar = async (f: File) => {
    try {
      if (f.size > 500_000) throw new Error();
      const dados = sanitizar(JSON.parse(await f.text()));
      if (!dados) throw new Error();
      setEntrada(dados); setExemplo(null); setErro(''); setEtapa(1);
    } catch { setErro('Arquivo inválido. Use um arquivo salvo por este simulador.'); }
  };

  // O que impede avançar em cada passo.
  const bloqueio: Record<number, string> = {};
  if (!entrada.funcionamento.some((d) => d.aberto && d.periodos.some((p) => p.fim > p.ini))) bloqueio[2] = 'Marque pelo menos um dia aberto com horário válido.';
  if (!entrada.funcoes.some((f) => f.quantidade > 0)) bloqueio[3] = 'Informe pelo menos uma pessoa na equipe.';
  if (entrada.demandas.some((d) => d.fim <= d.ini)) bloqueio[4] = 'Há horário com o fim antes do início.';
  else if (entrada.demandas.some((d) => d.dias.length === 0)) bloqueio[4] = 'Há horário sem nenhum dia escolhido.';
  const motivo = bloqueio[etapa];

  const inputArquivo = (
    <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" aria-label="Abrir arquivo de simulação"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
  );

  if (etapa === 0) {
    return (
      <div className="flex min-h-dvh flex-col bg-marinho text-white">
        <header className="flex justify-center px-4 pt-8 sm:pt-12">
          <p className="text-center leading-none">
            <span className="block text-[1.75rem] font-extrabold tracking-[-0.02em] sm:text-[2rem]">ContaD</span>
            <span className="mt-1.5 block text-[0.95rem] font-medium text-white/80 sm:text-base">Assessoria Contábil</span>
          </p>
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-10 text-center sm:px-6">
          <h1 className="text-balance text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]">Simulador de Escalas</h1>
          <p className="mt-7 max-w-[36rem] text-pretty text-lg leading-[1.55] text-white/90 sm:mt-8 sm:text-[1.3rem]">
            Planeje a mudança da escala 6x1 para 5x2. Compare 44h, 42h e 40h por semana, veja onde vai faltar gente e quanto custa resolver.
          </p>
          <div className="mt-10 flex w-full flex-col items-center gap-3 sm:mt-12 sm:w-auto sm:flex-row">
            <button type="button" autoFocus
              className="botao min-h-[60px] w-full min-w-[15rem] bg-white px-10 text-xl text-marinho transition-transform hover:bg-white/90 active:scale-[0.98] sm:w-auto"
              onClick={() => { if (exemplo) { setEntrada(structuredClone(ENTRADA_VAZIA)); setExemplo(null); } setEtapa(1); }}>
              Começar
            </button>
            {!PREVIA && <button type="button" className="botao min-h-[60px] w-full border border-white/40 px-6 text-white hover:bg-white/10 sm:w-auto" onClick={() => arquivo.current?.click()}>Abrir simulação salva</button>}
            {inputArquivo}
          </div>
          {erro && <p role="alert" className="mt-4 font-semibold text-[#ffb4a8]">{erro}</p>}
        </main>
        <footer className="px-4 pb-6 text-center text-sm text-white/70 sm:px-6">
          Ferramenta de planejamento. Os dados ficam só neste navegador, nesta aba.
        </footer>
      </div>
    );
  }

  if (etapa === 5 && relatorio) {
    return <Relatorio entrada={entrada} resultados={resultados} podeBaixar={!PREVIA} onVoltar={() => setRelatorio(false)} />;
  }

  const passo = PASSOS[etapa - 1];
  return (
    <div className="min-h-dvh">
      <header className="nao-imprimir sticky top-0 z-20 bg-marinho text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" className="text-left" onClick={() => setEtapa(0)} aria-label="Voltar à tela inicial">
            <span className="block text-lg font-extrabold leading-tight tracking-tight">ContaD</span>
            <span className="block text-sm text-white/75">Simulador de Escalas</span>
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            {!PREVIA && <button type="button" className="botao border border-white/40 text-sm text-white hover:bg-white/10" onClick={exportar}>Salvar</button>}
            {!PREVIA && etapa === 5 && <button type="button" className="botao bg-white text-sm text-marinho hover:bg-white/90" onClick={() => window.print()}>Imprimir ou PDF</button>}
          </div>
        </div>
        <nav aria-label="Passos" className="mx-auto max-w-5xl px-4 pb-3 sm:px-6">
          <ol className="flex gap-1">
            {PASSOS.map((p) => {
              const feito = p.n < etapa, atual = p.n === etapa;
              return (
                <li key={p.n} className="min-w-0 flex-1">
                  <button type="button" aria-current={atual ? 'step' : undefined} onClick={() => setEtapa(p.n)}
                    className="group block w-full text-left">
                    <span className={`block h-1.5 rounded-full ${atual || feito ? 'bg-white' : 'bg-white/25'}`} />
                    <span className={`mt-1 block truncate text-xs ${atual ? 'font-bold text-white' : 'text-white/65 group-hover:text-white'}`}>
                      <span className="sm:hidden">{p.n}</span><span className="hidden sm:inline">{p.n}. {p.nome}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <main id="conteudo" tabIndex={-1} className={`mx-auto px-4 py-6 outline-none sm:px-6 ${etapa === 5 ? 'max-w-5xl' : 'max-w-2xl'} pb-28`}>
        <p className="nao-imprimir text-sm font-semibold text-marinho/60">Passo {etapa} de {PASSOS.length}</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{passo.nome}</h1>
        <p className="mt-1 text-marinho/75">{passo.dica}</p>
        {exemplo && <p className="mt-2 text-sm font-semibold text-[#7a4f0c]">Dados fictícios para demonstração.</p>}

        <div className="mt-5">
          {etapa < 5 && <Formulario entrada={entrada} mudar={mudar} passo={etapa} />}
          {etapa === 5 && (
            <>
              <section className="nao-imprimir painel mb-5 p-4 sm:p-5" aria-labelledby="como-ver">
                <h2 id="como-ver" className="flex items-center gap-2 text-lg font-bold">
                  <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#eef2f8] text-base font-extrabold text-marinho">?</span>
                  Como você quer ver o resultado?
                </h2>
                <p className="mt-1 text-sm text-marinho/70">Escolha uma das opções abaixo. Você pode trocar quando quiser.</p>
                <div className="mt-4">
                  <OpcoesCartao rotulo="Como você quer ver o resultado?" valor={visao} onChange={setVisao} colunas={2}
                    opcoes={[
                      { valor: 'resumo', nome: 'Resumo simples', descricao: 'O essencial: se a equipe dá conta em cada cenário e quanto custa resolver.' },
                      { valor: 'completo', nome: 'Completo', descricao: 'A escala de cada pessoa, o mapa de cobertura hora a hora e os custos.' },
                    ]} />
                </div>
              </section>
              {visao === 'resumo' ? <Resumo entrada={entrada} resultados={resultados} /> : <Resultado entrada={entrada} resultados={resultados} />}
            </>
          )}
        </div>

        {etapa === 5 && visao === 'completo' && (
          <section className="painel mt-6 p-4 sm:p-5">
            <h2 className="text-lg font-bold">Regras usadas</h2>
            <p className="mt-1 text-sm text-marinho/70">Versão {VERSAO_REGRAS.split('-').reverse().join('/')}. Regras pendentes ainda não foram conferidas pela ContaD e servem como hipótese de planejamento.</p>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full text-sm">
                <thead><tr className="border-b border-linha text-left"><th className="py-2 pr-2">Cenário</th><th className="py-2 pr-2">Limites</th><th className="py-2 pr-2">Fonte</th><th className="py-2">Status</th></tr></thead>
                <tbody>
                  {CENARIOS.map((c) => cenarioEfetivo(c, entrada)).map((c) => (
                    <tr key={c.id} className="border-b border-linha align-top">
                      <td className="py-2 pr-2 font-semibold">{c.id}h</td>
                      <td className="py-2 pr-2">{c.limiteSemanalMin / 60}h/semana, até {Math.floor(c.limiteDiarioMin / 60)}h{String(c.limiteDiarioMin % 60).padStart(2, '0')}/dia, {c.folgasSemana} folga(s), divisor {c.divisor}</td>
                      <td className="py-2 pr-2">{c.fonte}</td>
                      <td className="py-2 font-semibold text-[#7a4f0c]">{c.status === 'pendente' ? 'Pendente' : 'Validada'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm"><strong>Folga no domingo:</strong> homem 1 a cada {REGRA_DOMINGO.semanasHomem} semanas, mulher 1 a cada {REGRA_DOMINGO.semanasMulher} semanas. {REGRA_DOMINGO.fonte}. <span className="font-semibold text-ok">Validada</span></p>
            <h3 className="mt-4 font-semibold">Outros pontos da EC 141/2026 (a conferir)</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {OBSERVACOES_EC.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </section>
        )}

        {etapa === 5 && (
          <section className="nao-imprimir mt-6 rounded-lg bg-marinho p-5 text-white sm:p-6">
            <h2 className="text-xl font-extrabold">Ainda ficou com dúvidas?</h2>
            <p className="mt-1 text-white/85">Entre em contato com o Departamento Pessoal da ContaD. Gere o relatório da sua simulação e envie para a gente analisar com você.</p>
            <button type="button" className="botao mt-4 w-full bg-white px-6 text-marinho hover:bg-white/90 sm:w-auto" onClick={() => setRelatorio(true)}>
              Falar com o Departamento Pessoal
            </button>
          </section>
        )}

        <footer className="mt-6 text-sm text-marinho/75">
          <p>Ferramenta de planejamento. Os resultados dependem dos dados informados, do regime contratual, das normas vigentes e dos instrumentos coletivos aplicáveis.</p>
        </footer>
      </main>

      <div className="nao-imprimir fixed inset-x-0 bottom-0 z-20 border-t border-linha bg-white/95 backdrop-blur">
        <div className={`mx-auto flex items-center gap-3 px-4 py-3 sm:px-6 ${etapa === 5 ? 'max-w-5xl' : 'max-w-2xl'}`}>
          <button type="button" className="botao-sec" onClick={() => setEtapa(etapa - 1)}>Voltar</button>
          {motivo && <p className="min-w-0 flex-1 text-sm font-semibold text-falta">{motivo}</p>}
          {!motivo && <span className="flex-1" />}
          {etapa < 5
            ? <button type="button" className="botao-principal px-6" disabled={!!motivo} aria-disabled={!!motivo}
                onClick={() => setEtapa(etapa + 1)}>{etapa === 4 ? 'Ver resultado' : 'Continuar'}</button>
            : <button type="button" className="botao-principal px-6" onClick={() => setEtapa(1)}>Ajustar dados</button>}
        </div>
      </div>
    </div>
  );
}
