import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { som } from '../lib/som.js';
import { avisar, useTelemetria } from '../store/useTelemetria.js';
import { cabecalhoOperador } from '../lib/operador.js';

/**
 * Cartão do menu lateral para conectar o Arduino.
 * A porta USB é aberta pelo servidor (API); aqui o operador só escolhe a porta e a velocidade.
 */
export default function ConexaoArduino() {
  const serial = useTelemetria((s) => s.estado?.serial);
  const fonte = useTelemetria((s) => s.fonteSelecionada);
  const [porta, setPorta] = useState('auto');
  const [baud, setBaud] = useState(115200);
  const [ocupado, setOcupado] = useState(false);

  const habilitada = serial?.habilitada !== false;
  const portas = useQuery({
    queryKey: ['serial-portas'],
    queryFn: () => api.get('/serial/portas'),
    enabled: habilitada,
    refetchInterval: serial?.conectado ? false : 5000
  });

  const conectado = Boolean(serial?.conectado);

  const alternar = async () => {
    const chave = window.prompt('Informe a chave de operador configurada no backend (OPERATOR_API_KEY):');
    if (chave === null) return;
    const headers = cabecalhoOperador(chave);
    if (!headers) {
      avisar('Informe a chave de operador para controlar a conexão serial.', 'erro');
      return;
    }
    setOcupado(true);
    try {
      if (conectado) {
        await api.post('/serial/desconectar', {}, headers);
        som.beep(600);
      } else {
        const r = await api.post('/serial/conectar', { porta, baudRate: Number(baud) }, headers);
        som.beep(900, 0.08);
        avisar(`Arduino conectado em ${r.porta}`);
      }
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setOcupado(false);
    }
  };

  if (fonte !== 'prototipo') return null;

  return (
    <div className="sidebar-arduino-card">
      <div className="arduino-header-row">
        <div className="arduino-status-indicator">
          <span className={`status-dot-indicator ${conectado ? 'online' : 'offline'}`} />
          <span>{conectado ? `${serial.porta} (${serial.baudRate})` : habilitada ? 'Desconectado' : 'USB desativada'}</span>
        </div>
        <select
          className="baud-selector"
          title="Velocidade serial"
          value={baud}
          onChange={(e) => setBaud(e.target.value)}
          disabled={conectado || !habilitada}
        >
          <option value={115200}>115200</option>
          <option value={9600}>9600</option>
        </select>
      </div>

      {habilitada && !conectado && (
        <select className="port-selector" value={porta} onChange={(e) => setPorta(e.target.value)} title="Porta USB do servidor">
          <option value="auto">Detectar Arduino automaticamente</option>
          {(portas.data ?? []).map((p) => (
            <option key={p.caminho} value={p.caminho}>
              {p.caminho} {p.fabricante ? `— ${p.fabricante}` : ''} {p.provavelArduino ? '★' : ''}
            </option>
          ))}
        </select>
      )}

      <button
        className={`btn-usb-toggle ${conectado ? 'connected' : ''}`}
        onClick={alternar}
        disabled={ocupado || !habilitada || !serial}
        title="A porta USB é lida pelo servidor HydraSmart"
      >
        {ocupado ? '⏳ Aguarde...' : conectado ? '🔌 Desconectar' : '🔌 Conectar Arduino'}
      </button>

      {!conectado && serial?.erroMensagem && <div className="sidebar-arduino-erro">{serial.erroMensagem}</div>}
    </div>
  );
}
