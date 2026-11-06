import { useState } from 'react';
import { api } from '../lib/api.js';

export default function BuscaCidade({ onSelect }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const pesquisar = async (event) => {
    event.preventDefault();
    const termo = busca.trim();
    if (termo.length < 2) return;
    setBuscando(true);
    setErro('');
    setResultados([]);
    try {
      const resposta = await api.get('/brasil/cidades?busca=' + encodeURIComponent(termo));
      setResultados(resposta.cidades || []);
      if (!resposta.cidades?.length) setErro('Nenhuma cidade brasileira encontrada. Confira o nome.');
    } catch {
      setErro('Busca de municípios indisponível. Tente novamente.');
    } finally { setBuscando(false); }
  };
  return <div className="hs-city-search">
    <form className="hs-city-form" onSubmit={pesquisar} role="search" aria-label="Pesquisar município brasileiro">
      <label htmlFor="hs-city-input" className="hs-sr-only">Nome da cidade</label>
      <span aria-hidden="true">⌕</span>
      <input id="hs-city-input" type="search" value={busca} onChange={event => setBusca(event.target.value)}
        placeholder="Pesquise sua cidade, ex.: Porto Alegre, Blumenau, Cáceres…"
        maxLength={80} autoComplete="off" />
      <button type="submit" disabled={buscando || busca.trim().length < 2}>
        {buscando ? 'Buscando…' : 'Buscar cidade'}
      </button>
    </form>
    {erro && <p className="hs-city-error" role="status">{erro}</p>}
    {resultados.length > 0 && <div className="hs-city-results" aria-label="Cidades encontradas">
      {resultados.map(cidade => <button key={cidade.id} type="button" onClick={() => {
        onSelect(cidade);
        setBusca(cidade.nome + (cidade.estado ? ' — ' + cidade.estado : ''));
        setResultados([]);
        setErro('');
      }}><strong>📍 {cidade.nome}</strong><span>{cidade.estado || 'Brasil'}</span></button>)}
    </div>}
  </div>;
}
