import { DIAS, type Demanda, type DiaFuncionamento, type Entrada, type Funcao, type Regime } from '../motor/tipos';
import { BotaoAdicionar, BotaoRemover, CampoHora, Contador, Segmentado } from './controles';

interface Props { entrada: Entrada; mudar: (e: Entrada) => void }

const REGIMES: { id: Regime; nome: string }[] = [
  { id: 'simples', nome: 'Simples Nacional (anexos I, II, III ou V)' },
  { id: 'simples_anexo_iv', nome: 'Simples Nacional, anexo IV' },
  { id: 'presumido_real', nome: 'Lucro Presumido ou Lucro Real' },
];

const ATALHOS: { valor: string; nome: string; dias: number[] }[] = [
  { valor: 'uteis', nome: 'Seg a sex', dias: [0, 1, 2, 3, 4] },
  { valor: 'segsab', nome: 'Seg a sáb', dias: [0, 1, 2, 3, 4, 5] },
  { valor: 'todos', nome: 'Todos os dias', dias: [0, 1, 2, 3, 4, 5, 6] },
];

const JORNADAS = [44, 42, 40, 36, 30];

function Secao({ titulo, children, descricao, passo }: { titulo: string; descricao?: string; passo: number; children: React.ReactNode }) {
  return (
    <section className="painel p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-marinho text-sm text-white">{passo}</span>
        {titulo}
      </h2>
      {descricao && <p className="mt-1 text-[15px] text-marinho/75">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SeletorDias({ dias, onChange, rotulo, permitidos }: { dias: number[]; onChange: (d: number[]) => void; rotulo: string; permitidos?: number[] }) {
  return (
    <div className="flex flex-wrap gap-[3px]" role="group" aria-label={rotulo}>
      {DIAS.map((nome, dia) => {
        const on = dias.includes(dia);
        const fora = permitidos && !permitidos.includes(dia);
        return (
          <button key={dia} type="button" aria-pressed={on} title={fora ? 'Empresa fechada neste dia' : undefined}
            className={`dia ${on ? 'dia-on' : 'dia-off'} ${fora && !on ? 'opacity-40' : ''}`}
            onClick={() => onChange(on ? dias.filter((x) => x !== dia) : [...dias, dia].sort((a, b) => a - b))}>{nome}</button>
        );
      })}
    </div>
  );
}

export function Formulario({ entrada, mudar }: Props) {
  const abertos = entrada.funcionamento.map((d, i) => (d.aberto ? i : -1)).filter((i) => i >= 0);
  const atalhoAtivo = ATALHOS.find((a) => a.dias.length === abertos.length && a.dias.every((d) => abertos.includes(d)))?.valor ?? null;
  const modelo = () => entrada.funcionamento.find((d) => d.aberto && d.periodos.length) ?? { aberto: true, periodos: [{ ini: 480, fim: 1080 }] };

  const setDia = (i: number, d: DiaFuncionamento) => mudar({ ...entrada, funcionamento: entrada.funcionamento.map((x, j) => (j === i ? d : x)) });
  const setAbertos = (dias: number[]) => {
    const m = modelo();
    mudar({ ...entrada, funcionamento: entrada.funcionamento.map((d, i) => (dias.includes(i)
      ? (d.aberto && d.periodos.length ? d : { aberto: true, periodos: m.periodos.map((p) => ({ ...p })) })
      : { aberto: false, periodos: d.periodos })) });
  };
  const copiarParaTodos = (i: number) => {
    const fonte = entrada.funcionamento[i];
    mudar({ ...entrada, funcionamento: entrada.funcionamento.map((d) => (d.aberto ? { aberto: true, periodos: fonte.periodos.map((p) => ({ ...p })) } : d)) });
  };
  const setFuncao = (id: string, f: Partial<Funcao>) => mudar({ ...entrada, funcoes: entrada.funcoes.map((x) => (x.id === id ? { ...x, ...f } : x)) });
  const novaFuncao = () => {
    const id = `f${Date.now().toString(36)}`;
    mudar({ ...entrada, funcoes: [...entrada.funcoes, { id, nome: 'Nova função', quantidade: 1, salario: 0, jornadaContratualMin: 2640 }] });
  };
  const removerFuncao = (id: string) => mudar({ ...entrada, funcoes: entrada.funcoes.filter((f) => f.id !== id), demandas: entrada.demandas.filter((d) => d.funcaoId !== id) });
  const setDemanda = (i: number, d: Partial<Demanda>) => mudar({ ...entrada, demandas: entrada.demandas.map((x, j) => (j === i ? { ...x, ...d } : x)) });
  const novaDemanda = (funcaoId: string) => mudar({ ...entrada, demandas: [...entrada.demandas, { funcaoId, dias: abertos, ini: 660, fim: 840, pessoas: 2 }] });

  return (
    <div className="space-y-4">
      <Secao passo={1} titulo="Empresa">
        <label className="rotulo" htmlFor="regime">Regime tributário</label>
        <select id="regime" className="campo" value={entrada.regime} onChange={(e) => mudar({ ...entrada, regime: e.target.value as Regime })}>
          {REGIMES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <p className="mt-2 text-sm text-marinho/70">Define os encargos: no Simples (exceto anexo IV) não há INSS patronal, RAT nem terceiros.</p>
        <p className="rotulo mt-4" id="acordo-rotulo">Há acordo ou convenção coletiva que permite mais de 8h por dia?</p>
        <Segmentado rotulo="Acordo para mais de 8h por dia" valor={entrada.acordoAcima8h ? 'sim' : 'nao'}
          opcoes={[{ valor: 'nao', nome: 'Não ou não sei' }, { valor: 'sim', nome: 'Sim' }]}
          onChange={(v) => mudar({ ...entrada, acordoAcima8h: v === 'sim' })} />
        <p className="mt-2 text-sm text-marinho/70">Com acordo, as 42h podem ser 5 dias de 8h24. Sem acordo, o limite é 8h por dia.</p>
      </Secao>

      <Secao passo={2} titulo="Horário de funcionamento">
        <Segmentado rotulo="Atalho de dias" valor={atalhoAtivo} opcoes={ATALHOS.map(({ valor, nome }) => ({ valor, nome }))}
          onChange={(v) => setAbertos(ATALHOS.find((a) => a.valor === v)!.dias)} />
        <p className="rotulo mt-4">Dias abertos</p>
        <SeletorDias rotulo="Dias em que a empresa abre" dias={abertos} onChange={setAbertos} />
        {abertos.length > 1 && <p className="mt-4 text-sm text-marinho/70">Use o ícone de copiar para repetir um horário em todos os dias.</p>}
        <ul className="mt-2 divide-y divide-linha">
          {entrada.funcionamento.map((d, i) => !d.aberto ? null : (
            <li key={i} className="flex flex-wrap items-center gap-2 py-2">
              <span className="w-9 font-semibold">{DIAS[i]}</span>
              {d.periodos.map((p, k) => (
                <span key={k} className="flex items-center gap-1">
                  <CampoHora rotulo={`${DIAS[i]} abre`} valor={p.ini} max={1425} onChange={(m) => setDia(i, { ...d, periodos: d.periodos.map((x, j) => (j === k ? { ...x, ini: m } : x)) })} />
                  <span aria-hidden className="text-marinho/60">às</span>
                  <CampoHora rotulo={`${DIAS[i]} fecha`} valor={p.fim} min={15} onChange={(m) => setDia(i, { ...d, periodos: d.periodos.map((x, j) => (j === k ? { ...x, fim: m } : x)) })} />
                </span>
              ))}
              {abertos.length > 1 && (
                <button type="button" aria-label={`Usar o horário de ${DIAS[i]} em todos os dias abertos`} title="Usar este horário em todos os dias"
                  className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-marinho-500 hover:bg-fundo"
                  onClick={() => copiarParaTodos(i)}>
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
        {abertos.length === 0 && <p className="mt-2 text-sm font-semibold text-falta">Marque pelo menos um dia aberto.</p>}
      </Secao>

      <Secao passo={3} titulo="Equipe" descricao="Agrupe por função. Salário é opcional: sem ele, mostramos só a parte operacional.">
        <div className="space-y-3">
          {entrada.funcoes.map((f) => {
            const h = f.jornadaContratualMin / 60;
            return (
              <fieldset key={f.id} className="rounded-md border border-linha bg-fundo/60 p-3">
                <legend className="sr-only">{f.nome}</legend>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="rotulo" htmlFor={`n-${f.id}`}>Função</label>
                    <input id={`n-${f.id}`} className="campo" value={f.nome} onChange={(e) => setFuncao(f.id, { nome: e.target.value })} />
                  </div>
                  {entrada.funcoes.length > 1 && <BotaoRemover rotulo={`Remover função ${f.nome}`} onClick={() => removerFuncao(f.id)} />}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="rotulo" htmlFor={`q-${f.id}`}>Pessoas</label>
                    <Contador id={`q-${f.id}`} rotulo="pessoas" valor={f.quantidade} min={0} max={50} onChange={(n) => setFuncao(f.id, { quantidade: n })} />
                  </div>
                  <div>
                    <label className="rotulo" htmlFor={`s-${f.id}`}>Salário médio (R$)</label>
                    <input id={`s-${f.id}`} type="number" min={0} step={50} inputMode="decimal" className="campo" value={f.salario || ''} placeholder="Opcional"
                      onChange={(e) => setFuncao(f.id, { salario: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                </div>
                <p className="rotulo mt-3">Jornada do contrato (horas por semana)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmentado rotulo={`Jornada de ${f.nome}`} valor={JORNADAS.includes(h) ? h : 0}
                    opcoes={[...JORNADAS.map((j) => ({ valor: j, nome: `${j}h` })), { valor: 0, nome: 'Outra' }]}
                    onChange={(j) => setFuncao(f.id, { jornadaContratualMin: (j || 20) * 60 })} />
                  {!JORNADAS.includes(h) && (
                    <Contador rotulo="jornada em horas" valor={h} min={1} max={44} sufixo="h por semana" onChange={(n) => setFuncao(f.id, { jornadaContratualMin: n * 60 })} />
                  )}
                </div>
              </fieldset>
            );
          })}
          <BotaoAdicionar onClick={novaFuncao}>Adicionar função</BotaoAdicionar>
        </div>
      </Secao>

      <Secao passo={4} titulo="Pessoas necessárias por horário" descricao="Quantas pessoas precisam estar trabalhando ao mesmo tempo (fora do intervalo). Sem faixas, consideramos 1 pessoa da função em todo o horário aberto.">
        <div className="space-y-5">
          {entrada.funcoes.map((f) => (
            <div key={f.id}>
              <h3 className="font-semibold">{f.nome}</h3>
              <ul className="mt-2 space-y-2">
                {entrada.demandas.map((d, i) => d.funcaoId !== f.id ? null : (
                  <li key={i} className="rounded-md border border-linha bg-fundo/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1">
                        <CampoHora rotulo="Início da faixa" valor={d.ini} max={1425} onChange={(m) => setDemanda(i, { ini: m })} />
                        <span aria-hidden className="text-marinho/60">às</span>
                        <CampoHora rotulo="Fim da faixa" valor={d.fim} min={15} onChange={(m) => setDemanda(i, { fim: m })} />
                      </span>
                      <Contador rotulo="pessoas necessárias" valor={d.pessoas} min={0} max={50} sufixo={d.pessoas === 1 ? 'pessoa' : 'pessoas'}
                        onChange={(n) => setDemanda(i, { pessoas: n })} />
                      <span className="ml-auto"><BotaoRemover rotulo="Remover faixa" onClick={() => mudar({ ...entrada, demandas: entrada.demandas.filter((_, j) => j !== i) })} /></span>
                    </div>
                    <div className="mt-2"><SeletorDias rotulo="Dias da faixa" dias={d.dias} permitidos={abertos} onChange={(dias) => setDemanda(i, { dias })} /></div>
                    {d.fim <= d.ini && <p className="mt-2 text-sm font-semibold text-falta">O fim precisa ser depois do início.</p>}
                  </li>
                ))}
              </ul>
              <div className="mt-2"><BotaoAdicionar onClick={() => novaDemanda(f.id)}>Adicionar faixa de horário</BotaoAdicionar></div>
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}
