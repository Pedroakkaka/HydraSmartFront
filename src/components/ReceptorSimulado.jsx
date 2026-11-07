import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useTelemetria } from '../store/useTelemetria.js';

export default function ReceptorSimulado() {
  const fonte = useTelemetria(s => s.fonteSelecionada);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['simulador-defesa-civil'],
    queryFn: () => api.get('/defesa-civil/simulador'),
    refetchInterval: 5000, retry: false
  });
  const registros = (data?.registros || []).filter(r =>
    fonte === 'prototipo' ? r.origem === 'experimental' : r.origem === 'campo'
  ).slice(0, 4);
  return <section className="hs-card hs-test-receiver" aria-label="Central simulada de recebimento de alertas">
    <div className="hs-card-head"><h3><span className="hs-outline-icon">◈</span> Central simulada da Defesa Civil</h3><span className="hs-test-tag">AMBIENTE DE TESTE</span></div>
    <p className="hs-card-foot">Quando o HydraSmart gera um alerta crítico, uma mensagem de teste é registrada automaticamente neste receptor interno. Nenhuma comunicação é enviada à Defesa Civil ou aos celulares.</p>
    {isLoading && <p className="hydra-muted">Consultando mensagens de teste…</p>}
    {isError && <p className="hydra-muted">O receptor interno ainda não está disponível nesta versão da API.</p>}
    {registros.length ? <div className="hs-test-list">{registros.map(registro => <article key={registro.protocolo} className="hs-test-record">
      <div><strong>{registro.protocolo}</strong><span>Recebido pelo simulador ✓</span></div>
      <p>{registro.mensagem}</p>
      <small>{registro.recebidoEm ? new Date(registro.recebidoEm).toLocaleString('pt-BR') : 'Horário indisponível'} · SEM TRANSMISSÃO EXTERNA</small>
    </article>)}</div> : !isLoading && !isError && <p className="hydra-muted hs-test-empty">Nenhum alerta de teste registrado nesta execução do servidor.</p>}
  </section>;
}
