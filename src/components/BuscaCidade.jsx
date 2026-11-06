import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export default function BuscaCidade({ onSelect }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [resolvendo, setResolvendo] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const sequencia = useRef(0);
  const ignorar = useRef(false);
  useEffect(() => {
    if (ignorar.current) { ignorar.current = false; return; }
    const termo = busca.trim();
    if (termo.length < 2) { setResultados([]); setAberto(false); setErro(''); return; }
    const atual = ++sequencia.current;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const resposta = await api.get('/brasil/cidades-sugestoes?busca=' + encodeURIComponent(termo));
        if (sequencia.current !== atual) return;
        const cidades = resposta.cidades || [];
        setResultados(cidades);
        setAberto(true);
        setErro(cidades.length ? '' : 'Nenhuma sugestão encontrada. Tente outro trecho do nome.');
      } catch {
        if (sequencia.current !== atual) return;
        setResultados([]);
        setErro('Sugestões indisponíveis no momento. Tente buscar a cidade.');
      } finally {
        if (sequencia.current === atual) setBuscando(false);
      }
    }, 350);
    return () => { clearTimeout(timer); sequencia.current++; };
  }, [busca]);

  const escolher = async cidade => {
    setResolvendo(true);
    setAberto(false);
    setErro('');
    try {
      // O IBGE identifica o município, enquanto o geocodificador fornece
      // a latitude/longitude necessárias para centralizar o mapa.
      const resposta = await api.get('/brasil/cidades?busca=' + encodeURIComponent(cidade.nome));
      const candidatas = resposta.cidades || [];
      const nome = normalizar(cidade.nome);
      const mesmoNome = candidatas.filter(c => normalizar(c.nome) === nome);
      const selecionada = mesmoNome.find(c => normalizar(c.estado).includes(normalizar(cidade.estado)) ||
        normalizar(cidade.estado).includes(normalizar(c.estado))) || mesmoNome[0];
      if (!selecionada) {
        setErro('Município encontrado no IBGE, mas não foi possível obter as coordenadas do mapa.');
        setAberto(true);
        return;
      }
      ignorar.current = true;
      setBusca(cidade.nome + (cidade.estado ? ' — ' + cidade.estado : ''));
      setResultados([]);
      onSelect({ ...selecionada, nome: cidade.nome, codigoIbge: cidade.id });
    } catch {
      setErro('Não foi possível localizar esta cidade no mapa. Tente novamente.');
      setAberto(true);
    } finally { setResolvendo(false); }
  };

  const pesquisar = async evento => {
    evento.preventDefault();
    if (resultados.length) return escolher(resultados[0]);
    const termo = busca.trim();
    if (termo.length < 2) return;
    setBuscando(true);
    try {
      const resposta = await api.get('/brasil/cidades-sugestoes?busca=' + encodeURIComponent(termo));
      const lista = resposta.cidades || [];
      setResultados(lista);
      setAberto(Boolean(lista.length));
      if (!lista.length) setErro('Nenhuma cidade semelhante encontrada no cadastro do IBGE.');
    } catch { setErro('Busca de municípios indisponível. Tente novamente.'); }
    finally { setBuscando(false); }
  };

  return <div className="hs-city-search">
    <form className="hs-city-form" onSubmit={pesquisar} role="search" aria-label="Pesquisar município brasileiro">
      <label htmlFor="hs-city-input" className="hs-sr-only">Nome da cidade</label>
      <span aria-hidden="true">⌕</span>
      <input id="hs-city-input" type="search" value={busca}
        onChange={evento => { setBusca(evento.target.value); setAberto(true); setErro(''); }}
        onFocus={() => { if (resultados.length) setAberto(true); }}
        onKeyDown={evento => {
          if (evento.key === 'Escape') setAberto(false);
          if (evento.key === 'ArrowDown' && aberto && resultados.length) {
            evento.preventDefault();
            document.getElementById('hs-city-option-0')?.focus();
          }
        }}
        aria-autocomplete="list" aria-expanded={aberto && resultados.length > 0}
        aria-controls="hs-city-results"
        placeholder="Digite sua cidade, com ou sem acento…" maxLength={80} autoComplete="off" />
      <button type="submit" disabled={buscando || resolvendo || busca.trim().length < 2}>
        {resolvendo ? 'Localizando…' : buscando ? 'Buscando…' : 'Buscar cidade'}
      </button>
    </form>
    {erro && <p className="hs-city-error" role="status">{erro}</p>}
    {aberto && resultados.length > 0 && <div className="hs-city-results" id="hs-city-results" role="listbox" aria-label="Sugestões de municípios">
      {resultados.map((cidade, i) => <button key={cidade.id} id={'hs-city-option-' + i}
        role="option" aria-selected={false} type="button"
        onKeyDown={evento => {
          if (evento.key === 'Escape') { setAberto(false); document.getElementById('hs-city-input')?.focus(); }
          if (evento.key === 'ArrowDown') { evento.preventDefault(); document.getElementById('hs-city-option-' + (i + 1))?.focus(); }
          if (evento.key === 'ArrowUp') { evento.preventDefault(); (document.getElementById('hs-city-option-' + (i - 1)) || document.getElementById('hs-city-input'))?.focus(); }
        }}
        onClick={() => escolher(cidade)}><strong>📍 {cidade.nome}</strong><span>{cidade.estado || 'Brasil'}</span></button>)}
    </div>}
  </div>;
}
