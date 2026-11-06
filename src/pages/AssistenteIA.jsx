import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAcaoProtegida } from '../hooks/useAcoes.js';

export default function AssistenteIA() {
  const [pergunta, setPergunta] = useState('Quais tendências aparecem no histórico recente dos sensores?');
  const [analise, setAnalise] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [configuracaoPendente, setConfiguracaoPendente] = useState(false);
  const { executarProtegida, ocupado } = useAcaoProtegida();
  function analisar(evento) {
    evento.preventDefault();
    setErro(''); setAnalise(''); setConfiguracaoPendente(false);
    return executarProtegida(async (headers) => {
      try {
        const dados = await api.post('/ia/analisar', { pergunta, limite: 40 }, headers);
        setAnalise(dados.analise);
        setAviso(dados.aviso);
      } catch (e) {
        if (e.status === 503) {
          setConfiguracaoPendente(true);
          setErro('A análise por IA está desativada no servidor. A ativação e a chave privada devem ser configuradas somente no backend, com controle de acesso e consumo. Nunca publique a chave no GitHub.');
        } else {
          setErro(e.message || 'Falha ao consultar a IA.');
        }
      }
    }, { beep: 0 });
  }
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 20 }}>
      <div style={{ background: '#05172c', border: '1px solid #004aad', borderRadius: 20, padding: 28, color: '#fff' }}>
        <div style={{ color: '#ffde59', fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>HYDRASMART • INTELIGÊNCIA CONSULTIVA</div>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginTop: 12 }}>Entenda os dados. Preserve a precisão.</h2>
        <p style={{ color: '#cbd5e1', marginTop: 12 }}>O Core calcula e classifica. A OpenAI interpreta os históricos disponíveis e auxilia na análise — sem controlar sensores ou alterar alertas.</p>
      </div>
      <form onSubmit={analisar} style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="pergunta-ia" style={{ fontWeight: 700 }}>O que você deseja investigar?</label>
        <textarea id="pergunta-ia" value={pergunta} maxLength={600} rows={4} onChange={(e) => setPergunta(e.target.value)} style={{ width: '100%', borderRadius: 12, padding: 14, background: '#0b1e33', color: 'white', border: '1px solid #64748b' }} />
        <button type="submit" disabled={ocupado || !pergunta.trim()} style={{ background: '#004aad', color: '#fff', borderRadius: 10, padding: 14, fontWeight: 700 }}>{ocupado ? 'Analisando histórico...' : 'Analisar com OpenAI'}</button>
      </form>
      {erro && <div role="alert" style={{ color: '#fecaca', background: '#35151e', border: '1px solid #9f0412', padding: 16, borderRadius: 12 }}><strong>{configuracaoPendente ? 'Configuração pendente' : 'Análise indisponível'}</strong><p style={{ marginTop: 8 }}>{erro}</p><p style={{ marginTop: 8, fontSize: 13, color: '#e2e8f0' }}>O monitoramento do Core e os alertas dos sensores continuam independentes da IA.</p></div>}
      {analise && <section aria-live="polite" style={{ whiteSpace: 'pre-wrap', padding: 22, border: '1px solid #004aad', borderRadius: 14 }}><h3 style={{ fontWeight: 800, marginBottom: 12 }}>Interpretação do histórico</h3>{analise}<p style={{ fontSize: 12, opacity: 0.7, marginTop: 18 }}>{aviso}</p></section>}
    </div>
  );
}
