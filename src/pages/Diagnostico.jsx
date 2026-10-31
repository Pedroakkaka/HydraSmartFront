import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTelemetria } from '../store/useTelemetria.js';
import { useCemaden, useClima, useDrenosOsm, useSaude, useUltimaLeituraBanco } from '../hooks/useConsultas.js';
import { api } from '../lib/api.js';
import { som } from '../lib/som.js';
import { avisar } from '../store/useTelemetria.js';
import { dataHora, hora, num } from '../lib/formato.js';

const CEMADEN_UI = {
  sucesso: ['normal', 'Dados Recebidos', 'text-emerald-400', 'Token ativo'],
  sem_dados_recentes: ['warning', 'Sem dados recentes', 'text-amber-400', 'Token ativo'],
  sem_token: ['muted', 'Sem credencial', 'text-slate-400', 'Definir CEMADEN_JWT_TOKEN na API'],
  erro_autenticacao: ['danger', 'Token recusado', 'text-rose-400', 'Token inválido ou expirado'],
  erro_conexao: ['danger', 'Erro', 'text-rose-400', 'Falha de conexão']
};

function Linha({ rotulo, children, classe = 'font-mono text-white' }) {
  return (
    <div className="diag-status-row">
      <span>{rotulo}</span>
      <span className={classe}>{children}</span>
    </div>
  );
}

/** Verificação geral para mostrar à banca que tudo está no ar. */
function Autodiagnostico() {
  const conexao = useTelemetria((s) => s.conexao);
  const serial = useTelemetria((s) => s.estado.serial);
  const saude = useSaude();
  const clima = useClima();
  const osm = useDrenosOsm();
  const [mudo, setMudo] = useState(som.estaMudo());

  const CONSULTANDO = ['check-aviso', '… Consultando'];
  const item = (ok, aviso = false) => (ok ? ['check-ok', '✔ OK'] : aviso ? ['check-aviso', '● Atenção'] : ['check-falha', '✖ Falha']);
  const externo = (q) => (q.isFetching && !q.data ? CONSULTANDO
    : q.data?.status === 'sucesso' ? item(true)
      : q.data?.status === 'desatualizado' ? ['check-aviso', '● Cache']
        : ['check-aviso', '● Indisponível']);
  const verificacoes = [
    ['API HydraSmart', ...(saude.isFetching && !saude.data ? CONSULTANDO : item(saude.isSuccess))],
    ['Tempo real (WebSocket)', ...item(conexao === 'online')],
    ['Banco de dados PostgreSQL', ...item(saude.data?.banco === 'postgres', saude.data?.banco?.startsWith('memoria'))],
    ['Arduino na porta USB', ...(serial.conectado ? item(true) : ['check-aviso', serial.habilitada ? '● Desconectado' : '● Desativado'])],
    ['Meteorologia (Open-Meteo)', ...externo(clima)],
    ['Mapa de drenos (OpenStreetMap)', ...externo(osm)]
  ];

  return (
    <div className="diag-card">
      <div className="diag-card-title">
        <span>🧪 Autodiagnóstico do Sistema</span>
        <button className="btn-action-primary text-xs" onClick={() => { saude.refetch(); clima.refetch(); osm.refetch(); som.beep(900); }}>
          Verificar agora
        </button>
      </div>
      <ul className="check-list">
        {verificacoes.map(([nome, classe, texto]) => (
          <li key={nome}><span className="text-slate-300">{nome}</span><span className={classe}>{texto}</span></li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-400">
        Os 25 testes automatizados das regras de cálculo rodam no servidor com <code>npm test</code> (repositório HydraSmartAPI).
      </p>
      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
        <button className="btn-action-secondary text-xs" onClick={() => setMudo(som.alternarMudo())}>
          {mudo ? '🔇 Sirene Desativada' : '🔊 Sirene Ativa'}
        </button>
        <button className="btn-action-secondary text-xs" onClick={() => som.sirene()} disabled={mudo}>Testar sirene</button>
      </div>
    </div>
  );
}

export default function Diagnostico() {
  const serial = useTelemetria((s) => s.estado.serial);
  const { data: cemaden } = useCemaden();
  const saude = useSaude();
  const ultima = useUltimaLeituraBanco();
  const queryClient = useQueryClient();
  const [consultando, setConsultando] = useState(false);

  const [badgeC, rotuloC, corC, authC] = CEMADEN_UI[cemaden?.status] ?? ['muted', 'Consultando...', 'text-slate-400', '--'];
  const registro = ultima.data?.[0];

  const consultarCemaden = async () => {
    setConsultando(true);
    try {
      queryClient.setQueryData(['cemaden'], await api.get('/cemaden?forcar=true'));
      som.beep(850);
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="diagnostico-grid">
      <div className="diag-card">
        <div className="diag-card-title">
          <span>🔌 Enlace Arduino USB (lido pelo servidor)</span>
          <span className={`badge-pill ${serial.conectado ? 'normal' : 'muted'}`}>{serial.conectado ? 'Conectado' : 'Desconectado'}</span>
        </div>
        <div className="space-y-2">
          <Linha rotulo="Situação:" classe="font-mono text-slate-300 text-[11px]">{serial.statusTexto}</Linha>
          <Linha rotulo="Porta:">{serial.porta ?? '--'}</Linha>
          <Linha rotulo="Velocidade:">{serial.baudRate ? `${serial.baudRate} baud` : '--'}</Linha>
          <Linha rotulo="Leituras válidas:" classe="font-mono text-cyan-400">{serial.leiturasRecebidas}</Linha>
          <Linha rotulo="Linhas rejeitadas:" classe="font-mono text-slate-400">{serial.errosParser}</Linha>
          <Linha rotulo="Última mensagem:" classe="font-mono text-slate-300">{serial.timestampUltimaMensagem ? hora(serial.timestampUltimaMensagem) : 'Nenhuma'}</Linha>
        </div>
        <div className="text-[10px] text-slate-400 uppercase font-bold mt-2">Último pacote serial bruto:</div>
        <div className="diag-terminal-box">{serial.ultimaMensagemBruta || 'Aguardando pacotes do Arduino...'}</div>
        {serial.erroMensagem && <div className="text-[11px] text-rose-400">{serial.erroMensagem}</div>}
      </div>

      <div className="diag-card">
        <div className="diag-card-title">
          <span>📡 Integração Oficial CEMADEN</span>
          <span className={`badge-pill ${badgeC}`}>{rotuloC}</span>
        </div>
        <div className="space-y-2">
          <Linha rotulo="Estações de Porto Alegre:">{cemaden?.metadados?.estacaoNome ?? 'Sem estação identificada'}</Linha>
          <Linha rotulo="Código IBGE:" classe="font-mono text-slate-300">4314902 (Porto Alegre - RS)</Linha>
          <Linha rotulo="Sensores oficiais:" classe="text-slate-300">Consultar sensores disponíveis no CEMADEN</Linha>
          <Linha rotulo="Credencial:" classe={`${corC} font-mono text-[11px]`}>{authC}</Linha>
          <Linha rotulo="Última consulta:" classe="font-mono text-slate-300">{hora(cemaden?.ultimaConsulta)}</Linha>
        </div>
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-xs text-slate-300">
          {cemaden?.mensagem ?? 'Consultando os servidores oficiais do CEMADEN...'}
        </div>
        <button className="btn-action-primary text-xs mt-1" onClick={consultarCemaden} disabled={consultando}>
          {consultando ? '⏳ Consultando...' : '🔄 Consultar CEMADEN Agora'}
        </button>
      </div>

      <Autodiagnostico />

      <div className="diag-card">
        <div className="diag-card-title"><span>🗄️ Servidor e Banco de Dados</span>
          <span className={`badge-pill ${saude.data?.status === 'ok' ? 'normal' : 'danger'}`}>{saude.data?.status === 'ok' ? 'Operacional' : 'Verificar'}</span>
        </div>
        <div className="space-y-2 text-xs">
          <Linha rotulo="Versão da API:" classe="font-mono text-cyan-400">{saude.data?.versao ?? '--'}</Linha>
          <Linha rotulo="Banco:" classe="font-mono text-slate-300">{saude.data?.banco ?? (saude.isError ? 'indisponível' : '...')}</Linha>
          <Linha rotulo="No ar há:" classe="font-mono text-slate-300">{saude.data ? `${Math.floor(saude.data.uptimeSegundos / 60)} min` : '--'}</Linha>
          <Linha rotulo="Último registro gravado:" classe="font-mono text-cyan-300 text-[11px]">
            {registro ? `${registro.bueiroId} • ${num(registro.nivelPct)}% • ${dataHora(registro.registradoEm)}` : 'Nenhum'}
          </Linha>
        </div>
        <a className="btn-action-secondary text-xs mt-2" href="/docs" target="_blank" rel="noreferrer">📘 Documentação da API (Swagger)</a>
      </div>

      <div className="diag-card">
        <div className="diag-card-title"><span>🌐 Serviços Externos</span></div>
        <div className="space-y-2 text-xs">
          <Linha rotulo="Open-Meteo:" classe="font-mono text-emerald-400">Consultado pelo servidor (cache 10 min)</Linha>
          <Linha rotulo="Tiles OpenStreetMap:" classe="font-mono text-emerald-400">tile.openstreetmap.org</Linha>
          <Linha rotulo="Overpass OSM:" classe="font-mono text-cyan-400">Consultado pelo servidor (cache 6 h)</Linha>
          <Linha rotulo="Referência:" classe="font-mono text-slate-300">-30.0346, -51.2177 (Porto Alegre-RS)</Linha>
        </div>
      </div>
    </div>
  );
}
