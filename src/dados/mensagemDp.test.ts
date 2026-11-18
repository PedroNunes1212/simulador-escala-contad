import { describe, expect, it } from 'vitest';
import { EXEMPLOS } from './exemplos';
import { linkWhatsapp, mensagemDp } from './mensagemDp';
import { simularTodos } from '../motor/simular';

describe('mensagem para o WhatsApp do DP', () => {
  const e = EXEMPLOS[0].entrada;
  const msg = mensagemDp(e, simularTodos(e), { empresa: 'Loja & Cia', responsavel: 'Ana', telefone: '', email: '', duvida: 'Abro sábado?' });
  it('traz empresa, dúvida e os 3 cenários', () => {
    expect(msg).toContain('Empresa: Loja & Cia');
    expect(msg).toContain('Dúvida: Abro sábado?');
    expect(msg.match(/^• \d\dh: cobre/gm)).toHaveLength(3);
  });
  it('monta o link do WhatsApp com o texto codificado', () => {
    const url = linkWhatsapp(msg, '+55 (31) 99999-0000');
    expect(url.startsWith('https://wa.me/5531999990000?text=')).toBe(true);
    expect(url).toContain('Loja%20%26%20Cia');
    expect(linkWhatsapp('oi', '')).toBe('https://wa.me/?text=oi');
  });
});
