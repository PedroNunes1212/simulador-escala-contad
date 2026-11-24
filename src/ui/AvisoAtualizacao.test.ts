import { describe, expect, it } from 'vitest';
import { temVersaoNova } from './AvisoAtualizacao';

const resposta = (corpo: unknown, ok = true) => (async () => ({ ok, json: async () => corpo })) as unknown as typeof fetch;

describe('aviso de versão nova', () => {
  it('avisa só quando a versão publicada é diferente da aberta', async () => {
    expect(await temVersaoNova('v1', resposta({ versao: 'v2' }))).toBe(true);
    expect(await temVersaoNova('v1', resposta({ versao: 'v1' }))).toBe(false);
  });
  it('não avisa quando não consegue consultar', async () => {
    expect(await temVersaoNova('v1', resposta({}, false))).toBe(false);
    expect(await temVersaoNova('v1', resposta({ versao: 3 }))).toBe(false);
    expect(await temVersaoNova('v1', (async () => { throw new Error('offline'); }) as typeof fetch)).toBe(false);
  });
});
