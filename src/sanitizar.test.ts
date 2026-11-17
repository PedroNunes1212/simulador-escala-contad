import { describe, expect, it } from 'vitest';
import { sanitizar } from './App';
import { ENTRADA_VAZIA } from './dados/exemplos';

describe('arquivo importado', () => {
  it('rejeita formato errado', () => {
    expect(sanitizar({})).toBeNull();
    expect(sanitizar({ funcionamento: [], funcoes: [], demandas: [] })).toBeNull();
  });
  it('limita valores absurdos e descarta demanda de função inexistente', () => {
    const e = sanitizar({ ...ENTRADA_VAZIA, regime: 'x',
      funcoes: [{ id: 'f1', nome: 'A', quantidade: 1e9, salario: -5, jornadaContratualMin: 99999 }],
      demandas: [{ funcaoId: 'zz', dias: [0], ini: 0, fim: 60, pessoas: 1 }] })!;
    expect(e.regime).toBe('simples');
    expect(e.funcoes[0]).toMatchObject({ quantidade: 50, salario: 0, jornadaContratualMin: 2640 });
    expect(e.demandas).toHaveLength(0);
  });
});
