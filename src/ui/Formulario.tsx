import { DIAS, type Demanda, type DiaFuncionamento, type Entrada, type Funcao, type Regime } from '../motor/tipos';
import { resumoFuncionamento } from './analise';
import { BotaoAdicionar, BotaoRemover, CampoHora, Contador, Segmentado } from './controles';

const mulheresDe = (f: Funcao) => Math.min(f.mulheres ?? 0, f.quantidade);

interface Props { entrada: Entrada; mudar: (e: Entrada) => void; passo?: number }

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

/** Dias em que a faixa passa do horário aberto daquele dia. */
function foraDoHorario(d: Demanda, func: DiaFuncionamento[]): string {
  const dias = d.dias.filter((i) => {
    const ps = func[i].aberto ? func[i].periodos : [];
    if (!ps.length) return true;
    return d.ini < Math.min(...ps.map((p) => p.ini)) || d.fim > Math.max(...ps.map((p) => p.fim));
  });
  return dias.map((i) => DIAS[i]).join(', ');
}

function janelaGeral(func: DiaFuncionamento[]) {
  const ps = func.filter((d) => d.aberto).flatMap((d) => d.periodos);
  if (!ps.length) return { ini: 480, fim: 1080 };
  return { ini: Math.min(...ps.map((p) => p.ini)), fim: Math.max(...ps.map((p) => p.fim)) };
}

function Secao({ titulo, children, descricao, passo }: { titulo: string; descricao?: string; passo: number; children: React.ReactNode }) {
  return (
    <section className="painel p-4 sm:p-5">
      {titulo && (
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-marinho text-sm text-white">{passo}</span>
          {titulo}
        </h2>
      )}
      {descricao && <p className={`${titulo ? 'mt-1' : ''} text-[15px] text-marinho/75`}>{descricao}</p>}
      <div className={titulo || descricao ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

function SeletorDias({ dias, onChange, rotulo, permitidos }: { dias: number[]; onChange: (d: number[]) => void; rotulo: string; permitidos?: number[] }) {
  return (
    <div className="flex flex-wrap gap-[3px] sm:gap-1" role="group" aria-label={rotulo}>
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

export function Formulario({ entrada, mudar, passo }: Props) {
  const ver = (n: number) => !passo || passo === n;
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
  const novaDemanda = (funcaoId: string) => {
    const f = entrada.funcoes.find((x) => x.id === funcaoId);
    const jan = janelaGeral(entrada.funcionamento);
    const anteriores = entrada.demandas.filter((d) => d.funcaoId === funcaoId);
    // 1ª: mínimo no horário todo. 2ª: pico do meio do dia. Depois: continua de onde a última terminou.
    const q = f?.quantidade ?? 1;
    let ini = jan.ini, fim = jan.fim, pessoas = 1;
    if (anteriores.length === 1) {
      ini = Math.max(jan.ini, Math.min(660, jan.fim - 180)); fim = Math.min(jan.fim, ini + 180); pessoas = Math.max(1, Math.min(q, 2));
    } else if (anteriores.length > 1) {
      ini = Math.min(anteriores[anteriores.length - 1].fim, jan.fim - 60); fim = Math.min(ini + 120, jan.fim); pessoas = Math.max(1, Math.min(q, 2));
    }
    mudar({ ...entrada, demandas: [...entrada.demandas, { funcaoId, dias: abertos, ini, fim: Math.max(fim, ini + 15), pessoas }] });
  };

  return (
    <div className="space-y-4">
      {ver(1) && (
      <Secao passo={passo ? 0 : 1} titulo={passo ? '' : 'Empresa'}>
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
        <p className="rotulo mt-4">Divisor da hora extra no cenário de 44h</p>
        <Segmentado rotulo="Divisor da hora extra no cenário de 44h" valor={entrada.divisor44 ?? 210}
          opcoes={[{ valor: 210, nome: '210 (padrão ContaD)' }, { valor: 220, nome: '220' }]}
          onChange={(v) => mudar({ ...entrada, divisor44: v as 210 | 220 })} />
        <p className="mt-2 text-sm text-marinho/70">Valor da hora = salário ÷ divisor. Nos cenários de 42h e 40h o divisor é 210 e 200.</p>
      </Secao>
      )}

      {ver(2) && (
      <Secao passo={passo ? 0 : 2} titulo={passo ? '' : 'Horário de funcionamento'}>
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
        {abertos.length === 0 && !passo && <p className="mt-2 text-sm font-semibold text-falta">Marque pelo menos um dia aberto.</p>}
      </Secao>
      )}

      {ver(3) && (
      <Secao passo={passo ? 0 : 3} titulo={passo ? '' : 'Equipe'} descricao="Agrupe por função. Salário é opcional: sem ele, mostramos só a parte operacional.">
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
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <label className="rotulo" htmlFor={`qh-${f.id}`}>Homens</label>
                      <Contador id={`qh-${f.id}`} rotulo={`homens em ${f.nome}`} valor={f.quantidade - mulheresDe(f)} min={0} max={50 - mulheresDe(f)}
                        onChange={(n) => setFuncao(f.id, { quantidade: n + mulheresDe(f), mulheres: mulheresDe(f) })} />
                    </div>
                    <div>
                      <label className="rotulo" htmlFor={`qm-${f.id}`}>Mulheres</label>
                      <Contador id={`qm-${f.id}`} rotulo={`mulheres em ${f.nome}`} valor={mulheresDe(f)} min={0} max={50 - (f.quantidade - mulheresDe(f))}
                        onChange={(n) => setFuncao(f.id, { quantidade: f.quantidade - mulheresDe(f) + n, mulheres: n })} />
                    </div>
                    <p className="w-full text-sm text-marinho/70">Por mês, cada homem folga 1 domingo e cada mulher folga 2 (a cada 15 dias).</p>
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
      )}

      {ver(4) && (
      <Secao passo={passo ? 0 : 4} titulo={passo ? '' : 'Pessoas necessárias por horário'}
        descricao="Não é quantas pessoas você tem (isso foi no passo 3). É de quantas você precisa trabalhando ao mesmo tempo, em cada horário, para a empresa funcionar bem. Com isso o simulador mostra onde vai faltar gente.">
        <div className="mb-4 rounded-md border border-linha bg-white p-3 text-sm sm:p-4">
          <p className="font-bold">Exemplo: loja com 4 vendedores, aberta das 9h às 19h</p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex gap-3"><span className="w-[7.5rem] shrink-0 font-semibold tabular-nums">Das 9h às 11h</span><span><strong>1 vendedor</strong> · movimento fraco</span></li>
            <li className="flex gap-3"><span className="w-[7.5rem] shrink-0 font-semibold tabular-nums">Das 11h às 15h</span><span><strong>3 vendedores</strong> · pico do almoço</span></li>
            <li className="flex gap-3"><span className="w-[7.5rem] shrink-0 font-semibold tabular-nums">Das 15h às 19h</span><span><strong>2 vendedores</strong></span></li>
          </ul>
          <p className="mt-2 text-marinho/70">Cada horário vale para os dias que você marcar. Quem está no intervalo de almoço não conta.</p>
        </div>
        <p className="mb-4 rounded-md bg-fundo px-3 py-2 text-sm">
          <strong>Empresa aberta:</strong> {resumoFuncionamento(entrada.funcionamento)}
        </p>
        <div className="space-y-5">
          {entrada.funcoes.map((f) => {
            const faixas = entrada.demandas.map((d, i) => ({ d, i })).filter(({ d }) => d.funcaoId === f.id);
            const nome = f.nome.trim() || 'Função sem nome';
            return (
              <div key={f.id} className="rounded-lg border border-linha p-2.5 sm:p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-lg font-bold">{nome}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${f.quantidade ? 'bg-marinho/10 text-marinho' : 'bg-falta/10 text-falta'}`}>
                    Você tem {f.quantidade} {f.quantidade === 1 ? 'pessoa' : 'pessoas'} · {f.jornadaContratualMin / 60}h por semana
                  </span>
                </div>
                <p className="mt-1 text-sm text-marinho/75">
                  {f.quantidade
                    ? `Em cada horário, quantas dessas ${f.quantidade} pessoas precisam estar trabalhando?`
                    : 'Nenhuma pessoa nessa função. Se precisar de alguém, o resultado mostra quanto custa contratar.'}
                </p>

                {faixas.length === 0 && (
                  <div className="mt-3 rounded-md border border-dashed border-linha bg-fundo/60 p-3 text-sm">
                    <p>Nenhum horário definido ainda. Sem faixas, o simulador considera <strong>1 pessoa</strong> durante todo o horário aberto.</p>
                  </div>
                )}

                {faixas.length > 0 && (
                  <p className="mt-2 text-sm text-marinho/70">Dica: comece pelo mínimo do dia todo e acrescente os horários de pico. Quando horários se sobrepõem, vale o maior número.</p>
                )}
                <ul className="mt-3 space-y-2">
                  {faixas.map(({ d, i }, n) => (
                    <li key={i} className="rounded-md border border-linha bg-fundo/60 p-2.5 sm:p-3">
                      <div className="-mt-1 mb-1 flex items-center justify-between">
                        <span className="text-sm font-bold text-marinho/70">Horário {n + 1}</span>
                        <BotaoRemover rotulo={`Remover horário ${n + 1}`} onClick={() => mudar({ ...entrada, demandas: entrada.demandas.filter((_, j) => j !== i) })} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                        <span className="text-sm font-semibold">Das</span>
                        <CampoHora rotulo={`Início da faixa de ${nome}`} valor={d.ini} max={1425} onChange={(m) => setDemanda(i, { ini: m })} />
                        <span className="text-sm font-semibold">às</span>
                        <CampoHora rotulo={`Fim da faixa de ${nome}`} valor={d.fim} min={15} onChange={(m) => setDemanda(i, { fim: m })} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">precisa de</span>
                        <Contador rotulo={`${nome} necessários`} valor={d.pessoas} min={0} max={50} onChange={(n) => setDemanda(i, { pessoas: n })} />
                        <span className="text-sm">{d.pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
                      </div>
                      <div className="mt-2"><SeletorDias rotulo="Dias da faixa" dias={d.dias} permitidos={abertos} onChange={(dias) => setDemanda(i, { dias })} /></div>
                      {d.fim <= d.ini && <p className="mt-2 text-sm font-semibold text-falta">O fim precisa ser depois do início.</p>}
                      {d.pessoas > f.quantidade && (
                        <p className="mt-2 text-sm font-semibold text-[#7a4f0c]">
                          Você tem só {f.quantidade}. Pode manter: o resultado mostra a falta e as opções para cobrir.
                        </p>
                      )}
                      {d.dias.length === 0 && <p className="mt-2 text-sm font-semibold text-falta">Escolha pelo menos um dia.</p>}
                      {foraDoHorario(d, entrada.funcionamento) && (
                        <p className="mt-2 text-sm text-marinho/70">Parte desse horário fica fora do funcionamento ({foraDoHorario(d, entrada.funcionamento)}). Essa parte não entra na conta.</p>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-2"><BotaoAdicionar onClick={() => novaDemanda(f.id)}>{faixas.length ? 'Adicionar outro horário' : 'Definir horários'}</BotaoAdicionar></div>
              </div>
            );
          })}
        </div>
      </Secao>
      )}
    </div>
  );
}
