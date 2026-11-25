import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { hhmm } from '../motor/tempo';

/** Horários de 15 em 15 minutos, sempre em 24h. */
const HORAS = Array.from({ length: 97 }, (_, i) => i * 15);
const rotuloHora = (m: number) => (m === 1440 ? '24:00' : hhmm(m));

/**
 * Lê o que a pessoa digitou: "8", "08", "830", "0830", "8:30", "8h30", "8h", "18.45", "24".
 * Devolve minutos desde 00:00, ou null se não for um horário válido.
 */
export function lerHora(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  let h: number, m = 0;
  const sep = t.match(/^(\d{1,2})[:h.](\d{0,2})h?$/);
  if (sep) { h = Number(sep[1]); m = sep[2] ? Number(sep[2].padEnd(2, '0')) : 0; }
  else if (/^\d{1,2}h?$/.test(t)) h = Number(t.replace('h', ''));
  else if (/^\d{3,4}$/.test(t)) { h = Number(t.slice(0, -2)); m = Number(t.slice(-2)); }
  else return null;
  if (m > 59 || h > 24 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

/** Campo de horário: dá para digitar (ex.: 8, 830, 18:30) ou escolher numa lista de 15 em 15 minutos. */
export function CampoHora({ valor, onChange, rotulo, min = 0, max = 1440 }: {
  valor: number; onChange: (m: number) => void; rotulo: string; min?: number; max?: number;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(rotuloHora(valor));
  const [digitou, setDigitou] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [erro, setErro] = useState(false);
  const [seta, setSeta] = useState(false);
  const lista = useRef<HTMLUListElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const confirmado = useRef(false);

  useEffect(() => { if (!aberto) setTexto(rotuloHora(valor)); }, [valor, aberto]);
  useEffect(() => { setErro(false); }, [valor]);

  const todas = HORAS.filter((m) => m >= min && m <= max);
  const digitos = texto.replace(/\D/g, '');
  const filtradas = digitou && digitos
    ? todas.filter((m) => {
      const r = rotuloHora(m).replace(':', '');
      return r.startsWith(digitos) || r.startsWith(digitos.padStart(2, '0')) || r.replace(/^0/, '').startsWith(digitos);
    })
    : todas;
  const opcoes = filtradas.length ? filtradas : todas;

  useEffect(() => {
    if (!aberto) return;
    const el = lista.current?.children[ativo] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [aberto, ativo]);

  const abrir = () => {
    confirmado.current = false; setAberto(true); setDigitou(false); setErro(false); setSeta(false);
    const i = todas.findIndex((m) => m >= valor);
    setAtivo(Math.max(0, i));
  };
  const confirmar = (m: number | null) => {
    confirmado.current = true;
    setAberto(false); setDigitou(false);
    if (m !== null && m >= min && m <= max) { setErro(false); if (m !== valor) onChange(m); setTexto(rotuloHora(m)); }
    else { setErro(texto.trim() !== '' && texto !== rotuloHora(valor)); setTexto(rotuloHora(valor)); }
  };

  return (
    <div className="relative">
      <div className={`flex items-center rounded-xl border bg-white shadow-[0_1px_0_rgba(4,20,53,0.03)] transition-[border-color,box-shadow] duration-150 ${
        aberto ? 'border-marinho-500 shadow-[0_0_0_3px_rgba(42,74,134,0.15)]' : erro ? 'border-falta' : 'border-[#d3dae6] hover:border-[#b8c2d4]'}`}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="ml-3 shrink-0 text-marinho/45"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <input ref={campo} role="combobox" aria-label={rotulo} aria-expanded={aberto} aria-controls={`${id}-lista`} aria-autocomplete="list"
          aria-activedescendant={aberto ? `${id}-${opcoes[ativo] ?? ''}` : undefined} aria-invalid={erro || undefined}
          inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={5}
          className="h-[44px] w-[4.4rem] bg-transparent pl-2 pr-2 text-[15px] tabular-nums text-marinho focus:outline-none"
          value={texto}
          onFocus={(e) => { abrir(); e.target.select(); }}
          onClick={() => { if (!aberto) abrir(); }}
          onChange={(e) => { setTexto(e.target.value); setDigitou(true); setSeta(false); setAberto(true); setAtivo(0); }}
          onBlur={() => { if (aberto && !confirmado.current) confirmar(digitou ? lerHora(texto) : valor); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              if (!aberto) abrir();
              else { setSeta(true); setAtivo((a) => (e.key === 'ArrowDown' ? Math.min(opcoes.length - 1, a + 1) : Math.max(0, a - 1))); }
            }
            else if (e.key === 'Enter') {
              e.preventDefault();
              // Só vale o item da lista se a pessoa andou nela com as setas; senão vale o que digitou (inválido volta e fica vermelho).
              confirmar(aberto && seta ? opcoes[ativo] ?? null : digitou ? lerHora(texto) : valor);
              campo.current?.blur();
            }
            else if (e.key === 'Escape') { setAberto(false); setDigitou(false); setSeta(false); setTexto(rotuloHora(valor)); }
            else if (e.key === 'Tab' && aberto) confirmar(digitou && !seta ? lerHora(texto) : seta ? opcoes[ativo] ?? null : valor);
          }} />
      </div>
      {aberto && (
        <ul ref={lista} id={`${id}-lista`} role="listbox" aria-label={rotulo} onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-40 mt-1.5 max-h-60 w-full min-w-[7.5rem] overflow-y-auto overscroll-contain rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgba(4,20,53,0.08),0_16px_40px_-12px_rgba(4,20,53,0.35)]">
          {opcoes.map((m, i) => (
            <li key={m} id={`${id}-${m}`} role="option" aria-selected={m === valor}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-[15px] tabular-nums ${i === ativo ? 'bg-[#eef2f8]' : ''} ${m === valor ? 'font-bold text-marinho' : 'text-marinho/85'}`}
              onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setAtivo(i)} onClick={() => { confirmar(m); campo.current?.blur(); }}>
              {rotuloHora(m)}
              {m === valor && <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Opções em cartões grandes (pergunta com poucas escolhas, cada uma com explicação). */
export function OpcoesCartao<T extends string>({ opcoes, valor, onChange, rotulo, rotuloId, colunas = 1 }: {
  opcoes: { valor: T; nome: string; descricao?: string }[]; valor: T; onChange: (v: T) => void; rotulo: string; rotuloId?: string; colunas?: 1 | 2 | 3;
}) {
  const grupo = useRef<HTMLDivElement>(null);
  const atual = Math.max(0, opcoes.findIndex((o) => o.valor === valor));
  const mover = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const i = (atual + passo + opcoes.length) % opcoes.length;
    onChange(opcoes[i].valor);
    (grupo.current?.children[i] as HTMLElement | undefined)?.focus();
  };
  const grid = colunas === 3 ? 'sm:grid-cols-3' : colunas === 2 ? 'sm:grid-cols-2' : '';
  return (
    <div ref={grupo} role="radiogroup" aria-label={rotuloId ? undefined : rotulo} aria-labelledby={rotuloId} onKeyDown={mover} className={`grid gap-3 ${grid}`}>
      {opcoes.map((o, i) => {
        const sel = o.valor === valor;
        return (
          <button key={o.valor} type="button" role="radio" aria-checked={sel} tabIndex={i === atual ? 0 : -1} onClick={() => onChange(o.valor)}
            className={`group flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.99] ${
              sel ? 'border-marinho bg-[#f3f6fb] shadow-[0_8px_20px_-12px_rgba(4,20,53,0.45)]' : 'border-[#dde3ed] bg-white hover:border-marinho/35 hover:bg-[#fafbfd]'}`}>
            <span aria-hidden className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${sel ? 'border-marinho bg-marinho' : 'border-[#b8c2d4] bg-white group-hover:border-marinho/50'}`}>
              {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
            </span>
            <span className="min-w-0">
              <span className="block font-bold leading-snug">{o.nome}</span>
              {o.descricao && <span className="mt-1 block text-sm leading-snug text-marinho/70">{o.descricao}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Número com botões − e +, bom de usar no celular. */
export function Contador({ valor, onChange, min, max, rotulo, sufixo, id }: {
  valor: number; onChange: (n: number) => void; min: number; max: number; rotulo: string; sufixo?: string; id?: string;
}) {
  const lim = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-center gap-1">
      <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-[#d3dae6] bg-white shadow-[0_1px_0_rgba(4,20,53,0.03)]">
        <button type="button" className="contador-btn" aria-label={`Diminuir ${rotulo}`} disabled={valor <= min} onClick={() => onChange(lim(valor - 1))}>−</button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} aria-label={id ? undefined : rotulo}
          className="w-12 border-x border-[#e3e8f0] bg-white text-marinho text-center text-[15px] tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
    <div role="radiogroup" aria-label={rotulo} className="inline-flex flex-wrap gap-1 rounded-xl bg-[#e8ecf3] p-1">
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
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-marinho/55 hover:bg-falta/10 hover:text-falta">
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

export function BotaoAdicionar({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="botao w-full border border-dashed border-marinho/30 bg-white/70 text-marinho hover:border-marinho/60 hover:bg-white">
      <span aria-hidden className="text-lg leading-none">+</span>{children}
    </button>
  );
}
