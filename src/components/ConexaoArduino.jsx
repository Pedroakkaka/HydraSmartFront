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
    const unico = interpretar(obj.bueiro ?? obj.id ?? obj.sensor, obj.dist_cm ?? obj.distancia_cm ?? obj.distancia, obj.raw);
    if (unico) dados.push(unico);
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
  const [erro, setErro] = useState('');
  const portaRef = useRef(null);
  const leitorRef = useRef(null);
  const interromperRef = useRef(false);
  const chaveRef = useRef('');
  const filaRef = useRef(Promise.resolve());
  const abortarRef = useRef(null);
  const conexaoIdRef = useRef(0);
  const suportaWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator && window.isSecureContext;

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
    if (chaveRef.current.length < 16) {
      setErro('Informe a chave exclusiva do protótipo configurada no Render (mínimo 16 caracteres).');
      return;
    }
    if (conectado || ocupado) return;
    setOcupado(true);
    setErro('');
    setLeituras(0);
    try {
      const porta = await navigator.serial.requestPort();
      await porta.open({ baudRate: Number(baud) });
      portaRef.current = porta;
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
    <section className="sidebar-arduino-card" aria-label="Conectar Arduino diretamente pelo navegador">
      <div className="arduino-header-row">
        <strong>🔌 Arduino pelo site</strong>
        <span className={conectado ? 'text-emerald-400' : 'text-slate-400'}>{conectado ? 'USB conectado' : 'Desconectado'}</span>
      </div>
      <p className="text-xs text-slate-300">Conecte o cabo USB ao seu computador. O navegador solicitará a escolha da porta.</p>
      {!suportaWebSerial && <p className="text-xs text-amber-400">Conexão direta disponível no Chrome ou Edge para computador (HTTPS). No celular, utilize uma ponte ou dispositivo Wi-Fi.</p>}
      <label className="text-xs text-slate-300" htmlFor="hs-chave-usb">Chave de acesso do protótipo</label>
      <input id="hs-chave-usb" type="password" autoComplete="off" value={chave} disabled={conectado}
        onChange={e => setChave(e.target.value)} placeholder="Chave definida no Render"
        style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #94a3b8', color: '#0f172a', background: '#fff' }} />
      <label className="text-xs text-slate-300" htmlFor="hs-baud-usb">Velocidade serial</label>
      <select id="hs-baud-usb" className="baud-selector" value={baud} disabled={conectado} onChange={e => setBaud(Number(e.target.value))}>
        <option value={115200}>115200 baud</option>
        <option value={9600}>9600 baud</option>
      </select>
      <button type="button" className={`btn-usb-toggle ${conectado ? 'connected' : ''}`}
        onClick={conectado ? fecharPorta : conectar} disabled={ocupado || (!conectado && !suportaWebSerial)}>
        {ocupado ? 'Conectando…' : conectado ? 'Desconectar Arduino' : 'Conectar Arduino USB'}
      </button>
      {conectado && <p role="status" className="text-xs text-slate-300">Leituras aceitas pela API nesta conexão: {leituras}. Mantenha o site aberto.</p>}
      {erro && <p role="alert" className="sidebar-arduino-erro">{erro}</p>}
      <p className="text-xs text-slate-400">Somente medições físicas experimentais B1/B2. Não gera alerta oficial nem altera sensores de campo.</p>
    </section>
  );
}
