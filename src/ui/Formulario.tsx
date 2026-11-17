import { DIAS, type Demanda, type DiaFuncionamento, type Entrada, type Funcao, type Regime } from '../motor/tipos';
import { hhmm, paraMinutos } from '../motor/tempo';

interface Props { entrada: Entrada; mudar: (e: Entrada) => void }

const REGIMES: { id: Regime; nome: string }[] = [
  { id: 'simples', nome: 'Simples Nacional (anexos I, II, III ou V)' },
  { id: 'simples_anexo_iv', nome: 'Simples Nacional, anexo IV' },
  { id: 'presumido_real', nome: 'Lucro Presumido ou Lucro Real' },
];

function CampoHora({ valor, onChange, rotulo }: { valor: number; onChange: (m: number) => void; rotulo: string }) {
  return (
    <input type="time" step={900} aria-label={rotulo} className="campo w-[6.6rem] px-2"
      value={hhmm(Math.min(valor, 1439))}
      onChange={(e) => { const m = paraMinutos(e.target.value); if (m !== null) onChange(m === 0 && valor > 720 ? 1440 : m); }} />
  );
}

function Secao({ titulo, children, descricao }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="painel p-4 sm:p-5">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {descricao && <p className="mt-1 text-[15px] text-marinho/75">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Formulario({ entrada, mudar }: Props) {
  const setDia = (i: number, d: DiaFuncionamento) => mudar({ ...entrada, funcionamento: entrada.funcionamento.map((x, j) => (j === i ? d : x)) });
  const atalho = (dias: number[]) => {
    const modelo = entrada.funcionamento.find((d) => d.aberto) ?? { aberto: true, periodos: [{ ini: 480, fim: 1080 }] };
    mudar({ ...entrada, funcionamento: DIAS.map((_, i) => (dias.includes(i) ? { aberto: true, periodos: modelo.periodos.map((p) => ({ ...p })) } : { aberto: false, periodos: [] })) });
  };
  const setFuncao = (id: string, f: Partial<Funcao>) => mudar({ ...entrada, funcoes: entrada.funcoes.map((x) => (x.id === id ? { ...x, ...f } : x)) });
  const novaFuncao = () => {
    const id = `f${Date.now().toString(36)}`;
    mudar({ ...entrada, funcoes: [...entrada.funcoes, { id, nome: 'Nova função', quantidade: 1, salario: 0, jornadaContratualMin: 2640 }] });
  };
  const removerFuncao = (id: string) => mudar({ ...entrada, funcoes: entrada.funcoes.filter((f) => f.id !== id), demandas: entrada.demandas.filter((d) => d.funcaoId !== id) });
  const setDemanda = (i: number, d: Partial<Demanda>) => mudar({ ...entrada, demandas: entrada.demandas.map((x, j) => (j === i ? { ...x, ...d } : x)) });
  const novaDemanda = (funcaoId: string) => {
    const abertos = entrada.funcionamento.map((d, i) => (d.aberto ? i : -1)).filter((i) => i >= 0);
    mudar({ ...entrada, demandas: [...entrada.demandas, { funcaoId, dias: abertos, ini: 660, fim: 840, pessoas: 2 }] });
  };

  return (
    <div className="space-y-4">
      <Secao titulo="Empresa">
        <label className="rotulo" htmlFor="regime">Regime tributário</label>
        <select id="regime" className="campo" value={entrada.regime} onChange={(e) => mudar({ ...entrada, regime: e.target.value as Regime })}>
          {REGIMES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <p className="mt-2 text-sm text-marinho/70">Define os encargos: no Simples (exceto anexo IV) não há INSS patronal, RAT nem terceiros.</p>
      </Secao>

      <Secao titulo="Horário de funcionamento">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className="botao-sec text-sm" onClick={() => atalho([0, 1, 2, 3, 4])}>Seg a sex</button>
          <button type="button" className="botao-sec text-sm" onClick={() => atalho([0, 1, 2, 3, 4, 5])}>Seg a sáb</button>
          <button type="button" className="botao-sec text-sm" onClick={() => atalho([0, 1, 2, 3, 4, 5, 6])}>Todos os dias</button>
        </div>
        <ul className="space-y-1">
          {entrada.funcionamento.map((d, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 py-1">
              <label className="flex w-16 items-center gap-2 font-semibold">
                <input type="checkbox" className="h-5 w-5" checked={d.aberto}
                  onChange={(e) => setDia(i, e.target.checked ? { aberto: true, periodos: d.periodos.length ? d.periodos : [{ ini: 480, fim: 1080 }] } : { ...d, aberto: false })} />
                {DIAS[i]}
              </label>
              {d.aberto ? d.periodos.map((p, k) => (
                <span key={k} className="flex items-center gap-1">
                  <CampoHora rotulo={`${DIAS[i]} abre`} valor={p.ini} onChange={(m) => setDia(i, { ...d, periodos: d.periodos.map((x, j) => (j === k ? { ...x, ini: m } : x)) })} />
                  <span aria-hidden>às</span>
                  <CampoHora rotulo={`${DIAS[i]} fecha`} valor={p.fim} onChange={(m) => setDia(i, { ...d, periodos: d.periodos.map((x, j) => (j === k ? { ...x, fim: m } : x)) })} />
                </span>
              )) : <span className="text-marinho/60">Fechado</span>}
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Equipe" descricao="Agrupe por função. Salário é opcional: sem ele, mostramos só a parte operacional.">
        <div className="space-y-4">
          {entrada.funcoes.map((f) => (
            <fieldset key={f.id} className="rounded-md bg-fundo p-3">
              <legend className="sr-only">{f.nome}</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2">
                  <label className="rotulo" htmlFor={`n-${f.id}`}>Função</label>
                  <input id={`n-${f.id}`} className="campo" value={f.nome} onChange={(e) => setFuncao(f.id, { nome: e.target.value })} />
                </div>
                <div>
                  <label className="rotulo" htmlFor={`q-${f.id}`}>Pessoas</label>
                  <input id={`q-${f.id}`} type="number" min={0} max={50} inputMode="numeric" className="campo" value={f.quantidade}
                    onChange={(e) => setFuncao(f.id, { quantidade: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
                </div>
                <div>
                  <label className="rotulo" htmlFor={`j-${f.id}`}>Jornada (h/sem)</label>
                  <input id={`j-${f.id}`} type="number" min={1} max={44} inputMode="numeric" className="campo" value={f.jornadaContratualMin / 60}
                    onChange={(e) => setFuncao(f.id, { jornadaContratualMin: Math.max(1, Math.min(44, Number(e.target.value) || 44)) * 60 })} />
                </div>
                <div className="col-span-2">
                  <label className="rotulo" htmlFor={`s-${f.id}`}>Salário médio (R$)</label>
                  <input id={`s-${f.id}`} type="number" min={0} step={50} inputMode="decimal" className="campo" value={f.salario || ''} placeholder="Opcional"
                    onChange={(e) => setFuncao(f.id, { salario: Math.max(0, Number(e.target.value) || 0) })} />
                </div>
                <div className="col-span-2 flex items-end justify-end">
                  {entrada.funcoes.length > 1 && <button type="button" className="botao-sec text-sm" onClick={() => removerFuncao(f.id)}>Remover função</button>}
                </div>
              </div>
            </fieldset>
          ))}
          <button type="button" className="botao-sec" onClick={novaFuncao}>Adicionar função</button>
        </div>
      </Secao>

      <Secao titulo="Pessoas necessárias por horário" descricao="Quantas pessoas precisam estar trabalhando ao mesmo tempo (fora do intervalo). Sem faixas, consideramos 1 pessoa da função em todo o horário aberto.">
        <div className="space-y-5">
          {entrada.funcoes.map((f) => (
            <div key={f.id}>
              <h3 className="font-semibold">{f.nome}</h3>
              <ul className="mt-2 space-y-2">
                {entrada.demandas.map((d, i) => d.funcaoId !== f.id ? null : (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-fundo p-2">
                    <CampoHora rotulo="Início da faixa" valor={d.ini} onChange={(m) => setDemanda(i, { ini: m })} />
                    <span aria-hidden>às</span>
                    <CampoHora rotulo="Fim da faixa" valor={d.fim} onChange={(m) => setDemanda(i, { fim: m })} />
                    <label className="flex items-center gap-1">
                      <input type="number" min={0} max={50} className="campo w-20" value={d.pessoas} aria-label="Pessoas necessárias"
                        onChange={(e) => setDemanda(i, { pessoas: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
                      pessoa(s)
                    </label>
                    <div className="flex flex-wrap gap-1" role="group" aria-label="Dias da faixa">
                      {DIAS.map((nome, dia) => (
                        <button key={dia} type="button" aria-pressed={d.dias.includes(dia)}
                          className={`min-h-[44px] min-w-[44px] rounded-md text-sm font-semibold ${d.dias.includes(dia) ? 'bg-marinho text-white' : 'border border-linha bg-white text-marinho/70'}`}
                          onClick={() => setDemanda(i, { dias: d.dias.includes(dia) ? d.dias.filter((x) => x !== dia) : [...d.dias, dia].sort() })}>{nome}</button>
                      ))}
                    </div>
                    <button type="button" className="botao-sec ml-auto text-sm" onClick={() => mudar({ ...entrada, demandas: entrada.demandas.filter((_, j) => j !== i) })}>Remover</button>
                  </li>
                ))}
              </ul>
              <button type="button" className="botao-sec mt-2 text-sm" onClick={() => novaDemanda(f.id)}>Adicionar faixa</button>
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}
