import { describe, expect, it } from 'vitest';
import { EXEMPLOS } from './exemplos';
import { relatorioXml } from './relatorioXml';
import { simularTodos } from '../motor/simular';

describe('relatório XML para o DP', () => {
  const e = EXEMPLOS[0].entrada;
  const xml = relatorioXml(e, simularTodos(e), { empresa: 'Loja <A> & "B"', responsavel: 'Ana', telefone: '', email: '', duvida: 'Posso abrir sábado?' }, new Date('2026-11-18T12:00:00Z'));
  it('tem os 3 cenários, a equipe e a dúvida', () => {
    expect(xml.match(/<cenario /g)).toHaveLength(3);
    expect(xml).toContain('<funcao id="vend" nome="Vendedor(a)" pessoas="4" homens="2" mulheres="2" jornadaSemanal="44h" salarioMedio="1900">');
    expect(xml).toContain('<duvida>Posso abrir sábado?</duvida>');
  });
  it('escapa o texto digitado pelo cliente', () => {
    expect(xml).toContain('empresa="Loja &lt;A&gt; &amp; &quot;B&quot;"');
    expect(xml).not.toContain('<A>');
  });
  it('abre e fecha todas as tags', () => {
    const abre = (xml.match(/<[a-zA-Z][^>]*[^/]>/g) ?? []).filter((t) => !t.startsWith('<?')).length;
    const fecha = (xml.match(/<\/[a-zA-Z]+>/g) ?? []).length;
    expect(abre).toBe(fecha);
  });
});
