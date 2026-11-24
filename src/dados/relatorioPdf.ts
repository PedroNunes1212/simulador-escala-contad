import { jsPDF } from 'jspdf';
import { OBSERVACOES_EC, VERSAO_REGRAS } from '../motor/regras';
import { horasSemana } from '../motor/simular';
import { duracao, hhmm } from '../motor/tempo';
import { DIAS, type Entrada, type ResultadoCenario } from '../motor/tipos';
import { QUANDO, brl, listaDias, ondeFalta, pct, resumoFuncionamento, solucao } from '../ui/analise';
import type { ContatoRelatorio } from './relatorioXml';

const REGIME: Record<string, string> = {
  simples: 'Simples Nacional (anexos I, II, III ou V)',
  simples_anexo_iv: 'Simples Nacional, anexo IV',
  presumido_real: 'Lucro Presumido ou Lucro Real',
};
const fim = (m: number) => (m === 1440 ? '24:00' : hhmm(m));
/** As fontes padrão do PDF só têm o alfabeto latino (com acentos); o resto vira equivalente simples. */
const limpo = (s: string) => s
  .replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/…/g, '...').replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '');

const MARINHO: [number, number, number] = [4, 20, 53];
const A4 = { w: 210, h: 297 };
const M = 15; // margem em mm
const LARG = A4.w - 2 * M;

/**
 * Relatório da simulação em PDF (A4), gerado no próprio navegador, sem enviar nada para servidor.
 * Mesmo conteúdo do relatório na tela, para o cliente compartilhar com o DP.
 */
export function relatorioPdf(entrada: Entrada, resultados: ResultadoCenario[], contato: ContatoRelatorio, geradoEm = new Date()): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  const quebra = (alt: number) => { if (y + alt > A4.h - M) { doc.addPage(); y = M; } };
  const texto = (s: string, { tam = 10, negrito = false, recuo = 0, cor = MARINHO }: { tam?: number; negrito?: boolean; recuo?: number; cor?: [number, number, number] } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    doc.setFontSize(tam);
    doc.setTextColor(...cor);
    const alt = tam * 0.42;
    for (const linha of doc.splitTextToSize(limpo(s), LARG - recuo) as string[]) {
      quebra(alt);
      doc.text(linha, M + recuo, y + alt * 0.8);
      y += alt;
    }
  };
  const titulo = (s: string) => { y += 4; quebra(14); texto(s, { tam: 13, negrito: true }); y += 1; };
  const item = (s: string) => { texto(`- ${s}`, { recuo: 3 }); };

  // Cabeçalho
  texto('ContaD Assessoria Contábil', { tam: 11, negrito: true });
  texto('Relatório da simulação de escalas', { tam: 16, negrito: true });
  const data = geradoEm.toLocaleDateString('pt-BR');
  const hora = geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  texto(`Gerado em ${data} às ${hora} - regras de ${VERSAO_REGRAS.split('-').reverse().join('/')}`, { tam: 9, cor: [90, 100, 120] });
  y += 1.5;
  doc.setDrawColor(...MARINHO); doc.setLineWidth(0.6); doc.line(M, y, A4.w - M, y);
  y += 3;

  titulo('Contato');
  const ni = (v: string) => v.trim() || 'não informado';
  texto(`Empresa: ${ni(contato.empresa)}    Responsável: ${ni(contato.responsavel)}`);
  texto(`Telefone: ${ni(contato.telefone)}    E-mail: ${ni(contato.email)}`);
  if (contato.duvida.trim()) { y += 1; texto(`Dúvida: ${contato.duvida.trim()}`); }

  titulo('1. Resumo');
  for (const r of resultados) {
    const falta = r.cobertura.reduce((a, c) => a + c.deficitMin, 0);
    y += 1;
    texto(`${r.cenario.id} horas por semana - ${QUANDO[r.cenario.id] ?? ''}`, { tam: 11, negrito: true });
    texto(`Cobre ${pct(r.indiceGeral)} do horário em que precisa de gente. ${falta ? `Faltam ${duracao(falta)} de trabalho por semana.` : 'Não falta ninguém.'}`);
    const onde = ondeFalta(entrada, r);
    onde.slice(0, 5).forEach((o) => item(o.texto));
    if (onde.length > 5) item(`E mais ${onde.length - 5} horário(s), no detalhe abaixo.`);
    if (falta) {
      const s = solucao(entrada, r);
      texto(`Sugestão: ${s.passos.map((p) => `${p.funcao}: ${p.alt.titulo.charAt(0).toLowerCase()}${p.alt.titulo.slice(1)}`).join('; ')}. ${s.custo === null ? 'Custo não calculado (salário não informado).' : `Custo extra estimado: ${brl(s.custo)} por mês, com encargos.`}`);
    }
  }

  titulo('2. Dados informados');
  texto(`Regime tributário: ${REGIME[entrada.regime] ?? entrada.regime}`);
  texto(`Funcionamento: ${resumoFuncionamento(entrada.funcionamento)}`);
  for (const f of entrada.funcoes) {
    const m = Math.min(f.mulheres ?? 0, f.quantidade);
    y += 1;
    texto(`${f.nome}: ${f.quantidade} pessoa(s) (${f.quantidade - m} H, ${m} M), ${duracao(f.jornadaContratualMin)}/sem., salário médio ${f.salario ? brl(f.salario) : 'não informado'}`, { negrito: true });
    const nec = entrada.demandas.filter((d) => d.funcaoId === f.id);
    if (nec.length) nec.forEach((d) => item(`${listaDias(d.dias)}, ${hhmm(d.ini)} às ${fim(d.fim)}: ${d.pessoas} pessoa(s)`));
    else item('1 pessoa em todo o horário aberto (padrão)');
  }

  // Escalas: uma tabela por cenário, cada uma começando em página nova
  const colNome = 38, colSem = 14, colDia = (LARG - colNome - colSem) / 7;
  for (const r of resultados) {
    doc.addPage(); y = M;
    texto(`3. Escala sugerida - ${r.cenario.nome}`, { tam: 13, negrito: true });
    y += 2;
    const cab = () => {
      doc.setFillColor(...MARINHO); doc.rect(M, y, LARG, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
      doc.text('Pessoa', M + 1.5, y + 4.2);
      DIAS.forEach((d, i) => doc.text(d, M + colNome + i * colDia + 1.5, y + 4.2));
      doc.text('Semana', A4.w - M - 1.5, y + 4.2, { align: 'right' });
      y += 6;
    };
    cab();
    for (const p of r.pessoas) {
      const celulas = DIAS.map((_, dia) => {
        const t = p.turnos.find((x) => x.dia === dia);
        if (!t) return ['folga'];
        const l = [`${hhmm(t.ini)}-${fim(t.fim)}`];
        if (t.intervaloIni !== null && t.intervaloMin > 0) l.push(`${hhmm(t.intervaloIni)}-${hhmm(t.intervaloIni + t.intervaloMin)}`);
        return l;
      });
      doc.setFontSize(7.5);
      const nome = doc.splitTextToSize(limpo(p.nome), colNome - 3) as string[];
      const linhas = Math.max(nome.length, ...celulas.map((c) => c.length));
      const alt = linhas * 3.3 + 2.4;
      if (y + alt > A4.h - M) { doc.addPage(); y = M; cab(); }
      doc.setTextColor(...MARINHO);
      doc.setFont('helvetica', 'bold');
      nome.forEach((n, k) => doc.text(n, M + 1.5, y + 3.6 + k * 3.3));
      doc.setFont('helvetica', 'normal');
      celulas.forEach((c, i) => c.forEach((s, k) => {
        doc.setTextColor(...(s === 'folga' || k > 0 ? [120, 128, 145] as [number, number, number] : MARINHO));
        doc.text(s, M + colNome + i * colDia + 1.5, y + 3.6 + k * 3.3);
      }));
      doc.setTextColor(...MARINHO); doc.setFont('helvetica', 'bold');
      doc.text(duracao(horasSemana(p)), A4.w - M - 1.5, y + 3.6, { align: 'right' });
      y += alt;
      doc.setDrawColor(210, 214, 222); doc.setLineWidth(0.2); doc.line(M, y, A4.w - M, y);
    }
    y += 2;
    texto('Em cada dia: horário de trabalho e, em cinza, o intervalo.', { tam: 8, cor: [90, 100, 120] });
    if (r.alertas.length) {
      y += 3;
      texto('Alertas deste cenário', { tam: 10, negrito: true });
      r.alertas.forEach((a) => item(`${a.tipo === 'erro' ? 'Erro' : a.tipo === 'aviso' ? 'Atenção' : 'Nota'}: ${a.texto}`));
    }
  }

  titulo('4. Observações');
  [
    'Simulação de planejamento, gerada automaticamente com os dados informados pelo cliente. Não é parecer jurídico.',
    'As regras ainda estão sendo conferidas pela ContaD. A escala é uma sugestão viável, sem garantia de ser a melhor possível.',
    'O salário não pode ser reduzido com a nova jornada (EC 141/2026).',
    ...OBSERVACOES_EC,
  ].forEach(item);

  // Rodapé com número da página
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 128, 145);
    doc.text(`Simulador de Escalas ContaD - página ${i} de ${total}`, A4.w / 2, A4.h - 7, { align: 'center' });
  }
  return doc.output('blob');
}
