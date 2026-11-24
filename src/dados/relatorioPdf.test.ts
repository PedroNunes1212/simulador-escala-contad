import { describe, expect, it } from 'vitest';
import { EXEMPLOS } from './exemplos';
import { relatorioPdf } from './relatorioPdf';
import { simularTodos } from '../motor/simular';

describe('relatório PDF para o DP', () => {
  it('gera um PDF válido com os três cenários, para todos os exemplos', async () => {
    for (const ex of EXEMPLOS) {
      const e = ex.entrada;
      const blob = relatorioPdf(e, simularTodos(e), { empresa: 'Loja “Centro” – Ltda', responsavel: 'Ana', telefone: '', email: '', duvida: 'Posso abrir sábado? 😀' }, new Date('2026-11-18T12:00:00Z'));
      expect(blob.type).toBe('application/pdf');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const txt = new TextDecoder('latin1').decode(bytes);
      expect(txt.startsWith('%PDF-')).toBe(true);
      expect(txt.trimEnd().endsWith('%%EOF')).toBe(true);
      // capa + resumo, uma página por cenário (ou mais)
      expect((txt.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
    }
  });
});
