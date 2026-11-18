import { hhmm } from '../motor/tempo';

/** Horários de 15 em 15 minutos, sempre em 24h (o seletor nativo mostra AM/PM conforme o navegador). */
const HORAS = Array.from({ length: 97 }, (_, i) => i * 15);

export function CampoHora({ valor, onChange, rotulo, min = 0, max = 1440 }: {
  valor: number; onChange: (m: number) => void; rotulo: string; min?: number; max?: number;
}) {
  return (
    <select aria-label={rotulo} className="campo !w-[5.6rem] px-2 tabular-nums" value={valor}
      onChange={(e) => onChange(Number(e.target.value))}>
      {!HORAS.includes(valor) && <option value={valor}>{hhmm(valor)}</option>}
      {HORAS.filter((m) => m >= min && m <= max).map((m) => <option key={m} value={m}>{m === 1440 ? '24:00' : hhmm(m)}</option>)}
    </select>
  );
}

/** Número com botões − e +, bom de usar no celular. */
export function Contador({ valor, onChange, min, max, rotulo, sufixo, id }: {
  valor: number; onChange: (n: number) => void; min: number; max: number; rotulo: string; sufixo?: string; id?: string;
}) {
  const lim = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-center gap-1">
      <div className="inline-flex items-stretch overflow-hidden rounded-md border border-linha bg-white">
        <button type="button" className="contador-btn" aria-label={`Diminuir ${rotulo}`} disabled={valor <= min} onClick={() => onChange(lim(valor - 1))}>−</button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} aria-label={id ? undefined : rotulo}
          className="w-12 border-x border-linha text-center text-[15px] tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          value={valor} onChange={(e) => onChange(lim(Number(e.target.value) || 0))} />
        <button type="button" className="contador-btn" aria-label={`Aumentar ${rotulo}`} disabled={valor >= max} onClick={() => onChange(lim(valor + 1))}>+</button>
      </div>
      {sufixo && <span className="text-sm text-marinho/70">{sufixo}</span>}
    </div>
  );
}

/** Grupo de opções exclusivas (substitui caixas de seleção soltas). */
export function Segmentado<T extends string | number>({ opcoes, valor, onChange, rotulo }: {
  opcoes: { valor: T; nome: string }[]; valor: T | null; onChange: (v: T) => void; rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex flex-wrap gap-1 rounded-lg bg-fundo p-1">
      {opcoes.map((o) => (
        <button key={String(o.valor)} type="button" role="radio" aria-checked={valor === o.valor}
          className={`chip ${valor === o.valor ? 'chip-ativo' : ''}`} onClick={() => onChange(o.valor)}>{o.nome}</button>
      ))}
    </div>
  );
}

export function BotaoRemover({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} onClick={onClick}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-marinho/55 hover:bg-falta/10 hover:text-falta">
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

export function BotaoAdicionar({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="botao w-full gap-2 border border-dashed border-marinho/35 bg-white text-marinho hover:border-marinho hover:bg-fundo">
      <span aria-hidden className="text-lg leading-none">+</span>{children}
    </button>
  );
}
