import { SLOT } from './tipos';

/** "08:30" -> 510. Aceita "8", "8h", "8:5", "0830". Retorna null se inválido. */
export function paraMinutos(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace('h', ':');
  let h: number, m: number;
  if (/^\d{3,4}$/.test(t)) { h = Number(t.slice(0, -2)); m = Number(t.slice(-2)); }
  else {
    const p = t.split(':');
    if (p.length > 2 || p[0] === '') return null;
    h = Number(p[0]); m = p[1] ? Number(p[1]) : 0;
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 24 || m < 0 || m > 59) return null;
  if (h === 24 && m > 0) return null;
  return h * 60 + m;
}

/** 510 -> "08:30" */
export function hhmm(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 2520 -> "42h", 2500 -> "41h40" */
export function duracao(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export const paraSlot = (min: number) => Math.floor(min / SLOT);
export const arredondaSlot = (min: number) => Math.round(min / SLOT) * SLOT;
