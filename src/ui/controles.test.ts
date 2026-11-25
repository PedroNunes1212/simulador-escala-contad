import { describe, expect, it } from 'vitest';
import { lerHora } from './controles';

describe('lerHora: horário digitado', () => {
  it('aceita os jeitos comuns de escrever', () => {
    expect(lerHora('8')).toBe(480);
    expect(lerHora('08')).toBe(480);
    expect(lerHora('8h')).toBe(480);
    expect(lerHora('830')).toBe(510);
    expect(lerHora('0830')).toBe(510);
    expect(lerHora('8:30')).toBe(510);
    expect(lerHora('8h30')).toBe(510);
    expect(lerHora('18.45')).toBe(1125);
    expect(lerHora('18:3')).toBe(1110);
    expect(lerHora(' 22:00 ')).toBe(1320);
    expect(lerHora('24')).toBe(1440);
    expect(lerHora('0')).toBe(0);
  });
  it('recusa o que não é horário', () => {
    for (const t of ['', 'abc', '25', '24:30', '8:75', '12345', '8:30:00']) expect(lerHora(t)).toBeNull();
  });
});
