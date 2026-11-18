import { duracao } from '../motor/tempo';
import type { Entrada, ResultadoCenario } from '../motor/tipos';
import { pct } from '../ui/analise';
import type { ContatoRelatorio } from './relatorioXml';

/**
 * WhatsApp do Departamento Pessoal da ContaD, só dígitos com DDI e DDD (ex.: '5531999999999').
 * Vazio: o WhatsApp abre a lista de conversas e o cliente escolhe o contato.
 */
export const WHATSAPP_DP = '';

/** Mensagem curta, já preenchida, com o essencial da simulação. */
export function mensagemDp(entrada: Entrada, resultados: ResultadoCenario[], contato: ContatoRelatorio): string {
  const l = ['Olá! Fiz uma simulação no Simulador de Escalas da ContaD e fiquei com dúvidas.', ''];
  if (contato.empresa.trim()) l.push(`Empresa: ${contato.empresa.trim()}`);
  if (contato.responsavel.trim()) l.push(`Nome: ${contato.responsavel.trim()}`);
  const equipe = entrada.funcoes.filter((f) => f.quantidade > 0).map((f) => `${f.quantidade} ${f.nome}`).join(', ');
  if (equipe) l.push(`Equipe: ${equipe}`);
  if (contato.duvida.trim()) l.push('', `Dúvida: ${contato.duvida.trim().slice(0, 600)}`);
  l.push('', 'Resultado:');
  for (const r of resultados) {
    const falta = r.cobertura.reduce((a, c) => a + c.deficitMin, 0);
    l.push(`• ${r.cenario.id}h: cobre ${pct(r.indiceGeral)}${falta ? `, faltam ${duracao(falta)} por semana` : ', sem falta'}`);
  }
  l.push('', 'Vou anexar o relatório em PDF.');
  return l.join('\n');
}

export function linkWhatsapp(texto: string, numero = WHATSAPP_DP): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
}
