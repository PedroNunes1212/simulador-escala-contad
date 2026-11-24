import { horasSemana } from '../motor/simular';
import { duracao, hhmm } from '../motor/tempo';
import { DIAS, type Entrada, type ResultadoCenario } from '../motor/tipos';
import { VERSAO_REGRAS } from '../motor/regras';
import { ondeFalta, solucao } from '../ui/analise';

/** Dados de contato que o cliente informa no relatório (opcionais). */
export interface ContatoRelatorio { empresa: string; responsavel: string; telefone: string; email: string; duvida: string }

const esc = (v: unknown) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const attrs = (o: Record<string, unknown>) => Object.entries(o)
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
const fim = (m: number) => (m === 1440 ? '24:00' : hhmm(m));

/**
 * Relatório da simulação em XML, para o Departamento Pessoal.
 * Formato próprio e versionado; o layout final (e o PDF) será definido com a ContaD.
 */
export function relatorioXml(entrada: Entrada, resultados: ResultadoCenario[], contato: ContatoRelatorio, geradoEm = new Date()): string {
  const l: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  l.push(`<simulacaoEscala${attrs({ versaoFormato: 1, versaoRegras: VERSAO_REGRAS, geradoEm: geradoEm.toISOString() })}>`);
  l.push(`  <contato${attrs({ empresa: contato.empresa, responsavel: contato.responsavel, telefone: contato.telefone, email: contato.email })}>`);
  if (contato.duvida.trim()) l.push(`    <duvida>${esc(contato.duvida.trim())}</duvida>`);
  l.push('  </contato>');
  l.push(`  <empresa${attrs({ regime: entrada.regime, divisorHoraExtra44: entrada.divisor44 ?? 210 })}>`);
  l.push('    <funcionamento>');
  entrada.funcionamento.forEach((d, i) => {
    if (!d.aberto || !d.periodos.length) { l.push(`      <dia${attrs({ nome: DIAS[i], aberto: false })}/>`); return; }
    l.push(`      <dia${attrs({ nome: DIAS[i], aberto: true })}>`);
    for (const p of d.periodos) l.push(`        <periodo${attrs({ inicio: hhmm(p.ini), fim: fim(p.fim) })}/>`);
    l.push('      </dia>');
  });
  l.push('    </funcionamento>');
  l.push('  </empresa>');
  l.push('  <equipe>');
  for (const f of entrada.funcoes) {
    l.push(`    <funcao${attrs({ id: f.id, nome: f.nome, pessoas: f.quantidade, homens: f.quantidade - Math.min(f.mulheres ?? 0, f.quantidade), mulheres: Math.min(f.mulheres ?? 0, f.quantidade), jornadaSemanal: duracao(f.jornadaContratualMin), salarioMedio: f.salario || undefined })}>`);
    for (const d of entrada.demandas.filter((x) => x.funcaoId === f.id)) {
      l.push(`      <necessidade${attrs({ dias: d.dias.map((x) => DIAS[x]).join(','), inicio: hhmm(d.ini), fim: fim(d.fim), pessoas: d.pessoas })}/>`);
    }
    l.push('    </funcao>');
  }
  l.push('  </equipe>');
  l.push('  <cenarios>');
  for (const r of resultados) {
    const falta = r.cobertura.reduce((a, c) => a + c.deficitMin, 0);
    l.push(`    <cenario${attrs({ id: `${r.cenario.id}h`, nome: r.cenario.nome, cobertura: r.indiceGeral.toFixed(4), faltaSemanal: duracao(falta), folhaMensal: r.folhaMensal || undefined })}>`);
    for (const o of ondeFalta(entrada, r)) l.push(`      <falta>${esc(o.texto)}</falta>`);
    if (falta) {
      const s = solucao(entrada, r);
      l.push(`      <sugestao${attrs({ custoMensal: s.custo ?? undefined, resolveTudo: s.resolveTudo })}>`);
      for (const p of s.passos) l.push(`        <passo${attrs({ funcao: p.funcao, acao: p.alt.titulo, faltaRestante: duracao(p.alt.deficitRestanteMin), custoMensal: p.alt.custoAdicionalMensal ?? undefined })}/>`);
      l.push('      </sugestao>');
    }
    l.push('      <escala>');
    for (const pe of r.pessoas) {
      l.push(`        <pessoa${attrs({ nome: pe.nome, horasSemana: duracao(horasSemana(pe)) })}>`);
      for (const t of pe.turnos) {
        l.push(`          <turno${attrs({ dia: DIAS[t.dia], entrada: hhmm(t.ini), saida: fim(t.fim),
          intervalo: t.intervaloIni !== null && t.intervaloMin ? `${hhmm(t.intervaloIni)}-${hhmm(t.intervaloIni + t.intervaloMin)}` : undefined,
          horas: duracao(t.trabalhoMin) })}/>`);
      }
      l.push('        </pessoa>');
    }
    l.push('      </escala>');
    l.push('      <alertas>');
    for (const a of r.alertas) l.push(`        <alerta${attrs({ tipo: a.tipo })}>${esc(a.texto)}</alerta>`);
    l.push('      </alertas>');
    l.push('    </cenario>');
  }
  l.push('  </cenarios>');
  l.push('</simulacaoEscala>');
  return l.join('\n');
}
