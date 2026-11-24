import { useEffect, useState } from 'react';

const INTERVALO_MS = 5 * 60 * 1000;

/** Só no site publicado (http/https); na prévia e no arquivo HTML aberto direto não há version.json. */
const online = () => typeof location !== 'undefined' && /^https?:$/.test(location.protocol);

/** Consulta a versão publicada; devolve true se for diferente da que está aberta. */
export async function temVersaoNova(atual = __VERSAO_APP__, buscar: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await buscar(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const { versao } = (await r.json()) as { versao?: unknown };
    return typeof versao === 'string' && versao !== atual;
  } catch { return false; }
}

/** Recarrega buscando a página de novo no servidor (o GitHub Pages guarda o HTML em cache por alguns minutos). */
async function atualizar() {
  try { await fetch(location.href, { cache: 'reload' }); } catch { /* segue para o reload */ }
  location.reload();
}

/** Faixa que aparece quando sai uma versão nova do simulador enquanto a página está aberta (ou veio do cache). */
export function AvisoAtualizacao() {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    if (!online()) return;
    let vivo = true;
    const checar = () => { if (document.visibilityState !== 'hidden') temVersaoNova().then((n) => { if (vivo && n) setNova(true); }); };
    checar();
    const id = setInterval(checar, INTERVALO_MS);
    document.addEventListener('visibilitychange', checar);
    return () => { vivo = false; clearInterval(id); document.removeEventListener('visibilitychange', checar); };
  }, []);
  if (!nova) return null;
  return (
    <div role="status" className="nao-imprimir fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:p-0">
      <div className="flex items-center gap-3 rounded-lg border-2 border-white bg-marinho p-3 text-white shadow-lg">
        <p className="flex-1 text-sm"><strong>Tem uma versão nova do simulador.</strong> Atualize para usar a mais recente.</p>
        <button type="button" className="botao shrink-0 bg-white text-sm text-marinho hover:bg-white/90" onClick={atualizar}>Atualizar</button>
      </div>
    </div>
  );
}
