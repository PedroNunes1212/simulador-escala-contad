import { useEffect, useMemo, useRef, useState } from 'react';
import { ENTRADA_VAZIA, EXEMPLOS } from './dados/exemplos';
import { CENARIOS, VERSAO_REGRAS } from './motor/regras';
import { simularTodos } from './motor/simular';
import type { Entrada } from './motor/tipos';
import { Formulario } from './ui/Formulario';
import { Resultado } from './ui/Resultado';

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
    quantidade: lim(f?.quantidade, 0, 50, 1), salario: lim(f?.salario, 0, 1_000_000, 0),
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

export default function App() {
  const [entrada, setEntrada] = useState<Entrada>(carregar);
  const [exemplo, setExemplo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const resultados = useMemo(() => simularTodos(entrada), [entrada]);

  useEffect(() => { try { sessionStorage.setItem(CHAVE, JSON.stringify(entrada)); } catch { /* ignora */ } }, [entrada]);

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
      setEntrada(dados); setExemplo(null); setErro('');
    } catch { setErro('Arquivo inválido. Use um arquivo salvo por este simulador.'); }
  };

  return (
    <div className="min-h-dvh">
      <header className="bg-marinho text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xl font-extrabold tracking-tight">ContaD</p>
            <h1 className="text-base font-medium text-white/85">Simulador de escalas: 44h, 42h e 40h</h1>
          </div>
          <div className="nao-imprimir flex flex-wrap gap-2">
            {!PREVIA && <button type="button" className="botao border border-white/40 text-white hover:bg-white/10" onClick={exportar}>Salvar arquivo</button>}
            {!PREVIA && <button type="button" className="botao border border-white/40 text-white hover:bg-white/10" onClick={() => arquivo.current?.click()}>Abrir arquivo</button>}
            <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" aria-label="Abrir arquivo de simulação"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
            {!PREVIA && <button type="button" className="botao bg-white text-marinho hover:bg-white/90" onClick={() => window.print()}>Imprimir ou PDF</button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="nao-imprimir mb-6">
          <p className="max-w-3xl text-[17px] leading-relaxed">
            Informe o funcionamento, a equipe e quantas pessoas precisa em cada horário. O simulador monta a escala de cada cenário,
            desconta os intervalos e mostra onde vai faltar gente e quanto custa resolver.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Exemplos com dados fictícios:</span>
            {EXEMPLOS.map((x) => (
              <button key={x.id} type="button" className={`botao-sec text-sm ${exemplo === x.id ? 'ring-2 ring-marinho-500' : ''}`}
                onClick={() => { setEntrada(structuredClone(x.entrada)); setExemplo(x.id); }}>{x.nome}</button>
            ))}
            <button type="button" className="botao-sec text-sm" onClick={() => { setEntrada(structuredClone(ENTRADA_VAZIA)); setExemplo(null); }}>Começar do zero</button>
          </div>
          {exemplo && <p className="mt-2 text-sm font-semibold text-[#7a4f0c]">Dados fictícios para demonstração.</p>}
          {erro && <p role="alert" className="mt-2 text-sm font-semibold text-falta">{erro}</p>}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="nao-imprimir min-w-0"><Formulario entrada={entrada} mudar={mudar} /></div>
          <div className="min-w-0"><Resultado entrada={entrada} resultados={resultados} /></div>
        </div>

        <section className="painel mt-6 p-4 sm:p-5">
          <h2 className="text-lg font-bold">Regras usadas</h2>
          <p className="mt-1 text-sm text-marinho/70">Versão {VERSAO_REGRAS.split('-').reverse().join('/')}. Regras pendentes ainda não foram conferidas pela ContaD e servem como hipótese de planejamento.</p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-linha text-left"><th className="py-2 pr-2">Cenário</th><th className="py-2 pr-2">Limites</th><th className="py-2 pr-2">Fonte</th><th className="py-2">Status</th></tr></thead>
            <tbody>
              {CENARIOS.map((c) => (
                <tr key={c.id} className="border-b border-linha align-top">
                  <td className="py-2 pr-2 font-semibold">{c.id}h</td>
                  <td className="py-2 pr-2">{c.limiteSemanalMin / 60}h/semana, até {Math.floor(c.limiteDiarioMin / 60)}h{String(c.limiteDiarioMin % 60).padStart(2, '0')}/dia, {c.folgasSemana} folga(s), divisor {c.divisor}</td>
                  <td className="py-2 pr-2">{c.fonte}</td>
                  <td className="py-2 font-semibold text-[#7a4f0c]">{c.status === 'pendente' ? 'Pendente' : 'Validada'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <a href="#resultado" className="nao-imprimir fixed inset-x-4 bottom-4 z-10 flex min-h-[48px] items-center justify-between rounded-md bg-marinho px-4 font-semibold text-white lg:hidden">
          <span>42h: cobertura {(resultados[1].indiceGeral * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
          <span>Ver resultado</span>
        </a>

        <footer className="mt-6 pb-24 lg:pb-8 text-sm text-marinho/75">
          <p>Ferramenta de planejamento. Os resultados dependem dos dados informados, do regime contratual, das normas vigentes e dos instrumentos coletivos aplicáveis.</p>
          <p className="mt-1">Os dados ficam só neste navegador, nesta aba. Nada é enviado a servidores.</p>
        </footer>
      </main>
    </div>
  );
}
