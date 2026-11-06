import { useQuery } from '@tanstack/react-query';
import { CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { api } from '../lib/api.js';

export function distanciaKm(a, b) {
  const rad = Math.PI / 180;
  const lat = (b[0] - a[0]) * rad;
  const lon = (b[1] - a[1]) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(lon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function MarcadorLocal({ localizacao }) {
  const map = useMap();
  useEffect(() => {
    if (localizacao) map.flyTo([localizacao.latitude, localizacao.longitude], 15);
  }, [map, localizacao]);
  if (!localizacao) return null;
  return <CircleMarker center={[localizacao.latitude, localizacao.longitude]} radius={11}
    pathOptions={{ color: '#fff', fillColor: '#f59e0b', fillOpacity: 1, weight: 3 }}>
    <Tooltip permanent direction="top">Sua localização aproximada</Tooltip>
  </CircleMarker>;
}

export default function RiscosPertoDeMim({ localizacao, limpar, regiao, oficial, oficialCarregando, oficialErro }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['condicoes-locais', localizacao?.latitude, localizacao?.longitude],
    queryFn: () => api.get('/brasil/condicoes-locais?latitude=' + localizacao.latitude + '&longitude=' + localizacao.longitude),
    enabled: Boolean(localizacao),
    staleTime: 600000,
    refetchInterval: 600000,
    retry: false
  });
  if (!localizacao) return null;
  const perto = regiao === 'porto_alegre' && (oficial?.elementos || []).filter(p =>
    Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) &&
    distanciaKm([localizacao.latitude, localizacao.longitude], [Number(p.lat), Number(p.lon)]) <= 0.5
  );
  return <section className="card-base" aria-label="Condições meteorológicas perto de você">
    <div className="card-header-line">
      <strong>📍 Condições perto de você</strong>
      <button type="button" className="map-control-btn" onClick={limpar}>Limpar localização</button>
    </div>
    <p className="text-xs text-slate-300">Posição aproximada, compartilhada com sua permissão. O site não acompanha seu deslocamento.</p>
    {isLoading ? <p>Consultando previsão de chuva da sua região…</p>
    : isError || !data ? <p className="text-xs text-amber-400">Dados meteorológicos indisponíveis.</p>
    : <div>
      <p><strong>Chuva atual:</strong> {data.precipAtualMm == null ? 'Indisponível' : data.precipAtualMm + ' mm'} · <strong>Próximas 6 horas:</strong> {data.previsao6hMm == null ? 'Indisponível' : data.previsao6hMm + ' mm previstos'}</p>
      <p className="text-xs text-slate-300">{data.interpretacao} · Fonte: {data.fonte}</p>
    </div>}
    {regiao === 'porto_alegre' && <p className="text-xs text-slate-300">
      {oficialCarregando ? 'Consultando pontos de drenagem próximos…'
      : oficialErro || oficial?.status === 'indisponivel' ? 'Cadastro municipal indisponível.'
      : (perto?.length || 0) + ' bocas de lobo cadastradas até 500 m da posição aproximada, na área consultada (sem telemetria confirmada).'}
    </p>}
    {regiao === 'blumenau' && <p className="text-xs text-slate-300">Consulte o nível do Rio Itajaí-Açu e o mapa oficial de cotas abaixo; a leitura do rio não corresponde à inundação de um endereço.</p>}
    {regiao === 'brasil' && <p className="text-xs text-slate-300">Não há cadastro municipal conectado para esta posição; somente condições meteorológicas foram consultadas.</p>}
    <p className="text-xs text-amber-400">Não é um diagnóstico validado de risco de alagamento. A ausência de chuva prevista ou de sensores não indica segurança. Consulte alertas da Defesa Civil.</p>
  </section>;
}
