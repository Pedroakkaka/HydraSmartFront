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
    const dados = [];
    const adicionar = (id, valor) => {
      const bueiroId = normalizarId(id);
      if (!bueiroId || valor == null) return;
      const valorPercentual = typeof valor === 'object'
        ? (valor.nivel_pct ?? valor.nivelPct ?? valor.nivel_percentual)
        : valor;
      const percentual = valorPercentual == null || valorPercentual === '' ? NaN : Number(valorPercentual);
      const contatos = typeof valor === 'object' ? (valor.contatos_ativos ?? valor.contatosAtivos) : null;
      const nivel = Number.isFinite(percentual) ? percentual
        : Number.isInteger(contatos) && contatos >= 0 && contatos <= 6 ? contatos * 100 / 6 : NaN;
      if (!Number.isFinite(nivel) || nivel < 0 || nivel > 100) return;
      dados.push({ bueiroId, nivelPct: Number(nivel.toFixed(1)) });
    };
    // Formato recomendado para duas réguas: {"bueiros":[{"id":1,"nivel_pct":33.3},{"id":2,"nivel_pct":50}]}
    if (Array.isArray(obj.bueiros)) {
      for (const item of obj.bueiros) adicionar(item.id ?? item.bueiro ?? item.bueiroId, item);
      return dados;
    }
    // Formato compacto: {"b1":16.7,"b2":50} ou {"b1":{"contatos_ativos":1},"b2":{...}}
    for (const [id, valor] of [[1, obj.b1 ?? obj.bueiro1], [2, obj.b2 ?? obj.bueiro2]]) {
      if (valor != null) adicionar(id, valor);
    }
    if (dados.length) return dados;
    const id = obj.bueiro ?? obj.bueiroId ?? obj.id ?? obj.sensor ?? 1;
    if (obj.nivel_pct != null || obj.nivelPct != null || obj.nivel_percentual != null ||
        obj.contatos_ativos != null || obj.contatosAtivos != null) adicionar(id, obj);
    if (dados.length) return dados;
    // Compatibilidade com firmware ultrassônico legado, separado dos jumpers.
    const distancia = obj.dist_cm ?? obj.distancia_cm ?? obj.distancia;
    const bueiroId = normalizarId(id);
    if (bueiroId && distancia != null && Number.isFinite(Number(distancia)) &&
        Number(distancia) >= 2 && Number(distancia) <= 400) {
      return [{ bueiroId, distanciaCm: Number(distancia) }];
    }
    return [];
  } catch { return []; }
}

export default function ConexaoArduino() {
  const fonte = useTelemetria(s => s.fonteSelecionada);
  const definirUsbLocal = useTelemetria(s => s.definirUsbLocal);
  const publicarNivelLocal = useTelemetria(s => s.publicarNivelLocal);
  const [chave, setChave] = useState('');
  const [baud, setBaud] = useState(115200);
  const [conectado, setConectado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [leituras, setLeituras] = useState(0);
  const [linhasRecebidas, setLinhasRecebidas] = useState(0);
  const [linhasInterpretadas, setLinhasInterpretadas] = useState(0);
  const [ultimaLeitura, setUltimaLeitura] = useState(null);
  const [ultimasPorBueiro, setUltimasPorBueiro] = useState({});
  const [statusEnvio, setStatusEnvio] = useState('Aguardando conexão');
  const [ultimaLinha, setUltimaLinha] = useState('');
  const [portaNome, setPortaNome] = useState('');
  const [erro, setErro] = useState('');
  const portaRef = useRef(null);
  const leitorRef = useRef(null);
  const interromperRef = useRef(false);
  const chaveRef = useRef('');
  const filaRef = useRef(Promise.resolve());
  const ultimoEnvioRef = useRef({});
  const abortarRef = useRef(null);
  const conexaoIdRef = useRef(0);
  const suportaWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator && typeof window !== 'undefined' && window.isSecureContext;

  useEffect(() => {
    chaveRef.current = chave.trim();
    if (chave.trim()) {
      setErro('');
      setStatusEnvio('Chave informada. Aguardando próxima leitura para tentar o envio à API.');
    }
  }, [chave]);

  const enviar = async (leitura, idConexao) => {
    if (interromperRef.current || idConexao !== conexaoIdRef.current) return;
    const token = chaveRef.current;
    if (!token) { setStatusEnvio('USB recebe dados, mas não há chave de envio à API.'); return; }
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
        setStatusEnvio('API bloqueou o envio: HTTP ' + response.status);
        setErro(response.status === 401 ? 'API recusou a chave do protótipo (401). Confira a chave configurada no servidor.' : 'Chave do protótipo não configurada no servidor (503).');
        // A falha de autenticação da API não deve interromper a leitura USB.
        // O operador pode corrigir a chave e retomar o envio sem reconectar o Arduino.
        return;
      }
      if (!response.ok) { setErro('API recusou leitura (HTTP ' + response.status + ').'); setStatusEnvio('Falha de envio: HTTP ' + response.status); return; }
      if (!interromperRef.current && idConexao === conexaoIdRef.current) {
        setLeituras(n => n + 1);
        setStatusEnvio('Leituras aceitas pela API; painel deve refletir o canal experimental.');
        setErro('');
      }
    } catch (err) {
      if (!interromperRef.current) { setErro(err.name === 'AbortError' ? 'Tempo de resposta da API esgotado.' : 'Sem conexão com a API HydraSmart.'); setStatusEnvio('Falha de rede ao enviar medições.'); }
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
    definirUsbLocal(false);
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
    setLinhasInterpretadas(0);
    setUltimaLeitura(null);
    setUltimasPorBueiro({});
    setStatusEnvio('Aguardando mensagens pela porta USB');
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
      definirUsbLocal(true);
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
              if (parsed.length) {
                setLinhasInterpretadas(n => n + parsed.length);
                setUltimaLeitura(parsed[parsed.length - 1]);
                setUltimasPorBueiro(anterior => Object.fromEntries([...Object.entries(anterior),...parsed.map(l => [l.bueiroId,l]) ]));
                for (const leitura of parsed) {
                  if (leitura.nivelPct != null) publicarNivelLocal(leitura);
                }
                if (!chaveRef.current) setStatusEnvio('Leitura interpretada localmente. Informe chave para enviar à API.');
                // Não acumula milhares de requests: a placa pode transmitir
                // mais rápido do que a rede. Amostra um envio por segundo.
                // Cada bueiro mantém frequência de envio independente.
                // Uma mensagem contendo B01 e B02 deve transmitir AMBOS.
                for (const leitura of parsed) {
                  const anterior = ultimoEnvioRef.current[leitura.bueiroId] || 0;
                  if (Date.now() - anterior >= 1000) {
                    ultimoEnvioRef.current[leitura.bueiroId] = Date.now();
                    filaRef.current = filaRef.current.then(() => enviar(leitura, idConexao)).catch(() => {});
                  }
                }
              } else if (linha.trim()) {
                setStatusEnvio('USB recebe linhas, mas o formato não corresponde ao firmware HydraSmart.');
              }
            }
          }
        } catch {
          if (!interromperRef.current) setErro('A comunicação USB foi interrompida. Confira o cabo.');
        } finally {
          try { leitor.releaseLock(); } catch { /* nada */ }
          leitorRef.current = null;
          try { await porta.close(); } catch { /* porta removida */ }
          portaRef.current = null;
          if (idConexao === conexaoIdRef.current) {
            definirUsbLocal(false);
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
    definirUsbLocal(false);
    void leitorRef.current?.cancel().catch(() => {});
  }, []);

  if (fonte !== 'prototipo') return null;
  return (
    <section className="hs-arduino-connection" aria-labelledby="hs-usb-title">
      <div className="hs-arduino-top">
        <div>
          <span className="hs-arduino-eyebrow">MODO PROJETO FÍSICO · ARDUINO UNO</span>
          <h2 id="hs-usb-title">Conexão USB do Arduino</h2>
          <p>Conecte seu Arduino Uno ao computador e selecione a porta USB pelo site. O painel identifica separadamente B01 e B02. A primeira régua utiliza A0–A5 + GND e a segunda D2–D7 + GND, conforme o firmware experimental para dois bueiros. Confirme que esses pinos não são usados pela bomba. A bomba não determina a leitura.</p>
        </div>
        <span className={`hs-arduino-status ${conectado ? 'online' : 'offline'}`} role="status">
          <span aria-hidden="true">●</span> {conectado ? 'USB conectada' : 'Aguardando USB'}
        </span>
      </div>
      <div className="hs-arduino-steps">
        <div><span className="hs-arduino-step-no">1</span><span>Conecte o cabo USB ao Arduino Uno e feche o Monitor Serial da IDE.</span></div>
        <div><span className="hs-arduino-step-no">2</span><span>Use Chrome ou Edge no computador e clique em <strong>Selecionar porta Arduino</strong>.</span></div>
        <div><span className="hs-arduino-step-no">3</span><span>Depois da conexão, observe as duas réguas: cada mensagem deve identificar o bueiro correspondente; dados ausentes permanecem como sem leitura.</span></div>
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
          <label htmlFor="hs-chave-usb">Chave de envio experimental (necessária para avisar outros celulares)</label>
          <input id="hs-chave-usb" type="password" autoComplete="off" value={chave}
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
      <p className="hs-arduino-raw" role="status"><strong>Diagnóstico de transmissão:</strong> {statusEnvio}. Mensagens interpretadas: {linhasInterpretadas}. {ultimaLeitura && <>Última medição reconhecida: <strong>{ultimaLeitura.nivelPct != null ? `${ultimaLeitura.nivelPct}%` : `${ultimaLeitura.distanciaCm} cm`}</strong> ({ultimaLeitura.bueiroId}).</>}</p>
      {conectado && <p className="hs-arduino-raw" role="status">
        <strong>B01:</strong> {ultimasPorBueiro.bueiro_1?.nivelPct != null ? `${ultimasPorBueiro.bueiro_1.nivelPct}%` : 'Aguardando régua 1'}
        {' · '}<strong>B02:</strong> {ultimasPorBueiro.bueiro_2?.nivelPct != null ? `${ultimasPorBueiro.bueiro_2.nivelPct}%` : 'Aguardando régua 2'}
      </p>}
      {conectado && ultimaLinha && <p className="hs-arduino-raw">Última linha serial recebida: <code>{ultimaLinha}</code></p>}
      {conectado && linhasRecebidas > 0 && linhasInterpretadas === 0 && <p role="alert" className="hs-arduino-error">A porta USB funciona, mas nenhuma linha é uma medição reconhecida. Confira a última linha e instale o firmware experimental de eletrodos na placa; o site não consegue gravar o firmware automaticamente.</p>}
      {conectado && !chave.trim() && <p role="status" className="hs-arduino-notice"><strong>Alertas em outros celulares indisponíveis:</strong> a leitura está chegando apenas por USB a este navegador. Para chegar aos celulares com o site aberto, configure a chave de envio do protótipo e confirme os envios aceitos pela API.</p>}
      {conectado && chave.trim() && leituras === 0 && <p role="status" className="hs-arduino-notice"><strong>Aguardando confirmação da API:</strong> ainda não há envio experimental aceito. Os gráficos locais não comprovam a transmissão aos celulares.</p>}
      {conectado && leituras > 0 && <p role="status" className="hs-arduino-notice"><strong>API recebeu medições experimentais.</strong> Celulares com o HydraSmart atualizado, aberto e com notificações autorizadas podem receber os avisos de teste independentemente da tela selecionada. Isso não é Web Push com o site fechado.</p>}
      {!suportaWebSerial && <p role="alert" className="hs-arduino-notice">Este navegador não permite selecionar portas USB seriais. Abra o site em Chrome ou Edge atualizado no computador, por HTTPS; no celular, use uma ponte ou dispositivo com Wi-Fi.</p>}
      {erro && <p role="alert" className="hs-arduino-error">{erro}</p>}
      <p className="hs-arduino-footnote">Apenas conexão e diagnóstico USB. A leitura dos eletrodos depende de firmware específico e da ordem física dos contatos. A bomba não é acionada pelo site; controle elétrico exige circuito e validação próprios.</p>
    </section>
  );
}
