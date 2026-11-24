import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Identificador desta publicação. O site compara com /version.json para avisar quando sai versão nova. */
const VERSAO = new Date().toISOString();

const arquivoVersao = (): Plugin => ({
  name: 'arquivo-versao',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ versao: VERSAO }) });
  },
});

export default defineConfig({
  plugins: [react(), arquivoVersao()],
  base: './',
  define: { __VERSAO_APP__: JSON.stringify(VERSAO) },
});
