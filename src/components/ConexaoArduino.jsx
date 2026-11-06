import { useEffect, useRef, useState } from 'react';
import { avisar, useTelemetria } from '../store/useTelemetria.js';
import { API_V1 } from '../lib/api.js';

// Web Serial usa a porta USB deste computador; não tenta acessar a USB no Render.
// Chave mantida apenas nesta sessão do componente, sem localStorage/cookies/logs.
const normalizarId = id => {
  if (['1','01','bueiro_1','b1'].includes(String(id).toLowerCase())) return 'bueiro_1';
  if (['2','02','bueiro_2','b2'].includes(String(id).toLowerCase())) return 'bueiro_2';
  return null;
};
function analisarLinha(linha) {
  try {
    const obj = JSON.parse(linha);
    if (!obj || typeof obj !== 'object' || obj.erro || obj.status) return [];
    const interpretar = (id, valor, raw) => {
      const bueiroId = normalizarId(id);
      const distanciaCm = Number(valor);
      if (!bueiroId || valor == null || !Number.isFinite(distanciaCm) || distanciaCm < 2 || distanciaCm > 400) return null;
      const leitura = { bueiroId, distanciaCm };
      if (Number.isInteger(raw) && raw >= 0) leitura.raw = raw;
      return leitura;
    };
    const dados = [];
    const id = normalizarId(obj.bueiro ?? obj.id ?? obj.sensor);
    const nivel = obj.nivel_pct ?? obj.nivelPct;
    if (id && nivel !== undefined && nivel !== null && Number.isFinite(Number(nivel)) &&
        Number(nivel) >= 0 && Number(nivel) <= 100) {
      const leitura = { bueiroId: id, nivelPct: Number(nivel) };
      if (Number.isInteger(obj.raw) && obj.raw >= 0) leitura.raw = obj.raw;
      dados.push(leitura);
    } else {
      const unico = interpretar(obj.bueiro ?? obj.id ?? obj.sensor, obj.dist_cm ?? obj.distancia_cm ?? obj.distancia, obj.raw);
      if (unico) dados.push(unico);
    }
    for (const [id, valor] of [[1, obj.b1 ?? obj.bueiro1], [2, obj.b2 ?? obj.bueiro2]]) {
      if (valor == null) continue;
      const leitura = interpretar(id, typeof valor === 'object' ? (valor.dist_cm ?? valor.distancia_cm) : valor);
      if (leitura) dados.push(leitura);
    }
    return dados;
  } catch { return []; }
}

export default function ConexaoArduino() {
  const fonte = useTelemetria(s => s.fonteSelecionada);
  const [chave, setChave] = useState('');
  const [baud, setBaud] = useState(115200);
  const [conectado, setConectado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [leituras, setLeituras] = useState(0);
  const [linhasRecebidas, setLinhasRecebidas] = useState(0);
  const [ultimaLinha, setUltimaLinha] = useState('');
  const [portaNome, setPortaNome] = useState('');
  const [erro, setErro] = useState('');
  const portaRef = useRef(null);
  const leitorRef = useRef(null);
  const interromperRef = useRef(false);
  const chaveRef = useRef('');
  const filaRef = useRef(Promise.resolve());
  const abortarRef = useRef(null);
  const conexaoIdRef = useRef(0);
  const suportaWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator && typeof window !== 'undefined' && window.isSecureContext;

  useEffect(() => { chaveRef.current = chave.trim(); }, [chave]);

  const enviar = async (leitura, idConexao) => {
    if (interromperRef.current || idConexao !== conexaoIdRef.current) return;
    const token = chaveRef.current;
    if (!token) return;
    const controlador = new AbortController();
    abortarRef.current = controlador;
    const timeout = setTimeout(() => controlador.abort(), 9500);
    try {
      const response = await fetch(API_V1 + '/leituras/prototipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Prototype-Key': token },
        body: JSON.stringify(leitura),
        signal: controlador.signal
      });
      if (response.status === 401 || response.status === 503) {
        setErro(response.status === 401 ? 'Chave do protótipo incorreta.' : 'Chave do protótipo não configurada no Render.');
        interromperRef.current = true;
        try { await leitorRef.current?.cancel(); } catch { /* encerramento */ }
        return;
      }
      if (!response.ok) { setErro('API recusou leitura (HTTP ' + response.status + ').'); return; }
      if (!interromperRef.current && idConexao === conexaoIdRef.current) {
        setLeituras(n => n + 1);
        setErro('');
      }
    } catch (err) {
      if (!interromperRef.current) setErro(err.name === 'AbortError' ? 'Tempo de resposta da API esgotado.' : 'Sem conexão com a API HydraSmart.');
    } finally {
      clearTimeout(timeout);
      if (abortarRef.current === controlador) abortarRef.current = null;
    }
  };

  const fecharPorta = async () => {
    interromperRef.current = true;
    conexaoIdRef.current++;
    abortarRef.current?.abort();
    try { await leitorRef.current?.cancel(); } catch { /* leitor já fechado */ }
    // A leitura está no loop assíncrono; porta.close() fica após releaseLock().
    setConectado(false);
  };

  const conectar = async () => {
    if (!suportaWebSerial) {
      setErro('Use Chrome ou Edge atualizado no computador, acessando o HydraSmart por HTTPS.');
      return;
    }
    if (conectado || ocupado) return;
    setOcupado(true);
    setErro('');
    setLeituras(0);
    setLinhasRecebidas(0);
    setUltimaLinha('');
    try {
      const porta = await navigator.serial.requestPort();
      await porta.open({ baudRate: Number(baud) });
      portaRef.current = porta;
      const informacoes = porta.getInfo?.() || {};
      setPortaNome(informacoes.usbVendorId ? `USB ${informacoes.usbVendorId.toString(16).toUpperCase()}:${(informacoes.usbProductId || 0).toString(16).toUpperCase()}` : 'Porta serial autorizada');
      interromperRef.current = false;
      const idConexao = ++conexaoIdRef.current;
      setConectado(true);
      avisar('Arduino conectado pelo USB deste computador.');
      void (async () => {
        const leitor = porta.readable.getReader();
        leitorRef.current = leitor;
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (!interromperRef.current) {
            const { value, done } = await leitor.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            if (buffer.length > 4096 && !buffer.includes('\n')) buffer = '';
            const linhas = buffer.split(/\r?\n/);
            buffer = linhas.pop() || '';
            for (const linha of linhas) {
              if (linha.trim()) { setLinhasRecebidas(n => n + 1); setUltimaLinha(linha.trim().slice(0, 180)); }
              const parsed = analisarLinha(linha.trim());
              for (const leitura of parsed) {
                filaRef.current = filaRef.current.then(() => enviar(leitura, idConexao));
              }
            }
          }
        } catch (e) {
          if (!interromperRef.current) setErro('A comunicação USB foi interrompida. Confira o cabo.');
        } finally {
          try { leitor.releaseLock(); } catch { /* nada */ }
          leitorRef.current = null;
          try { await porta.close(); } catch { /* porta removida */ }
          portaRef.current = null;
          if (idConexao === conexaoIdRef.current) {
            setConectado(false);
            setOcupado(false);
          }
        }
      })();
    } catch (err) {
      if (err.name !== 'NotFoundError') setErro('Não foi possível abrir a porta USB: ' + err.message);
      else setErro('Nenhuma porta foi selecionada. Confira se o Arduino aparece no Gerenciador de Dispositivos e tente novamente.');
    } finally { setOcupado(false); }
  };

  useEffect(() => () => {
    interromperRef.current = true;
    conexaoIdRef.current++;
    abortarRef.current?.abort();
    void leitorRef.current?.cancel().catch(() => {});
  }, []);

  if (fonte !== 'prototipo') return null;
  return (
    <section className="hs-arduino-connection" aria-labelledby="hs-usb-title">
      <div className="hs-arduino-top">
        <div>
          <span className="hs-arduino-eyebrow">MODO PROJETO FÍSICO · ARDUINO UNO</span>
          <h2 id="hs-usb-title">Conexão USB do Arduino</h2>
          <p>Conecte seu Arduino Uno ao computador e selecione a porta USB pelo site. A montagem informada utiliza 6 entradas A0–A5 e 1 contato de referência GND, com uma bomba de circulação.</p>
        </div>
        <span className={`hs-arduino-status ${conectado ? 'online' : 'offline'}`} role="status">
          <span aria-hidden="true">●</span> {conectado ? 'USB conectada' : 'Aguardando USB'}
        </span>
      </div>
      <div className="hs-arduino-steps">
        <div><span className="hs-arduino-step-no">1</span><span>Conecte o cabo USB ao Arduino Uno e feche o Monitor Serial da IDE.</span></div>
        <div><span className="hs-arduino-step-no">2</span><span>Use Chrome ou Edge no computador e clique em <strong>Selecionar porta Arduino</strong>.</span></div>
        <div><span className="hs-arduino-step-no">3</span><span>Depois da conexão, observe se chegam linhas do Arduino. A régua de 7 contatos requer firmware específico para transmitir o nível percentual.</span></div>
      </div>
      <div className="hs-arduino-fields">
        <div className="hs-arduino-field">
          <label htmlFor="hs-baud-usb">Velocidade serial</label>
          <select id="hs-baud-usb" value={baud} disabled={conectado || ocupado} onChange={e => setBaud(Number(e.target.value))}>
            <option value={115200}>115200 baud</option>
            <option value={9600}>9600 baud</option>
          </select>
        </div>
        <div className="hs-arduino-field">
          <label htmlFor="hs-chave-usb">Chave de envio experimental (opcional para detectar USB)</label>
          <input id="hs-chave-usb" type="password" autoComplete="off" value={chave} disabled={conectado}
            onChange={e => setChave(e.target.value)} placeholder="Informe somente para transmitir à API"/>
        </div>
        <button className={`hs-arduino-action ${conectado ? 'disconnect' : ''}`} type="button"
          onClick={conectado ? fecharPorta : conectar} disabled={ocupado || (!conectado && !suportaWebSerial)}>
          {ocupado ? 'Conectando…' : conectado ? 'Desconectar Arduino' : 'Selecionar porta Arduino'}
        </button>
      </div>
      <div className="hs-arduino-readout" aria-live="polite">
        <div><span>Porta</span><strong>{conectado ? portaNome : 'Não selecionada'}</strong></div>
        <div><span>Linhas recebidas</span><strong>{linhasRecebidas}</strong></div>
        <div><span>Envios aceitos pela API</span><strong>{leituras}</strong></div>
      </div>
      {conectado && ultimaLinha && <p className="hs-arduino-raw">Última linha serial recebida: <code>{ultimaLinha}</code></p>}
      {conectado && !chave.trim() && <p className="hs-arduino-notice">USB conectada para diagnóstico. Sem a chave do protótipo, nenhuma medição é enviada à API. Desconecte antes de informar a chave.</p>}
      {!suportaWebSerial && <p role="alert" className="hs-arduino-notice">Este navegador não permite selecionar portas USB seriais. Abra o site em Chrome ou Edge atualizado no computador, por HTTPS; no celular, use uma ponte ou dispositivo com Wi-Fi.</p>}
      {erro && <p role="alert" className="hs-arduino-error">{erro}</p>}
      <p className="hs-arduino-footnote">Apenas conexão e diagnóstico USB. A leitura dos eletrodos depende de firmware específico e da ordem física dos contatos. A bomba não é acionada pelo site; controle elétrico exige circuito e validação próprios.</p>
    </section>
  );
}
