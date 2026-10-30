import { useEffect, useRef, useState } from 'react';
import { UrbanScene } from '../features/maquete3d/UrbanScene.js';
import { useTelemetria } from '../store/useTelemetria.js';
import { useCenarios } from '../hooks/useConsultas.js';
import { useAcao } from '../hooks/useAcoes.js';
import { api } from '../lib/api.js';

const ROTULO_FONTE = { simulado: 'Simulação Ativa', real: 'Dados Físicos Reais', indisponivel: 'Indisponível' };

export default function Simulacao3D() {
  const containerRef = useRef(null);
  const cenaRef = useRef(null);
  const maquete = useTelemetria((s) => s.estado.maquete3D);
  const simulacao = useTelemetria((s) => s.estado.simulacao);
  const { data: cenarios } = useCenarios();
  const { executar, ocupado } = useAcao();

  const [cenarioEscolhido, setCenarioEscolhido] = useState(simulacao.cenario || 'chuva_moderada');
  const [foco, setFoco] = useState('todos');
  const [explosao, setExplosao] = useState(0);

  // Cria a cena ao abrir a página e libera a memória da GPU ao sair
  useEffect(() => {
    const cena = new UrbanScene(containerRef.current);
    cenaRef.current = cena;
    const observador = new ResizeObserver(() => cena.redimensionar());
    observador.observe(containerRef.current);
    return () => {
      observador.disconnect();
      cena.descartar();
      cenaRef.current = null;
    };
  }, []);

  useEffect(() => { cenaRef.current?.atualizar(maquete); }, [maquete]);
  useEffect(() => { cenaRef.current?.definirExplosao(explosao / 100); }, [explosao]);
  useEffect(() => { cenaRef.current?.focar(foco); }, [foco]);

  const trocarCenario = (id) => {
    setCenarioEscolhido(id);
    if (simulacao.ativo) executar(() => api.put('/simulacao/cenario', { cenario: id }), { beep: 750 });
  };

  return (
    <div className="three-full-panel">
      <div className="sim-controls-panel">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-white">🏙️ Simulação 3D de Alagamento</span>
          <span className={`sim-source-badge ${maquete.status}`}>{ROTULO_FONTE[maquete.status]}</span>
        </div>

        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1" htmlFor="cenario">Cenário Demonstrativo</label>
          <select id="cenario" className="sim-scenario-select" value={cenarioEscolhido} onChange={(e) => trocarCenario(e.target.value)}>
            {(cenarios ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome} ({Math.round(Math.max(c.b1Alvo, c.b2Alvo))}%)</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1 leading-tight">
            {cenarios?.find((c) => c.id === cenarioEscolhido)?.descricao}
          </p>
        </div>

        <div className="sim-action-bar">
          <button className="sim-btn-play" disabled={ocupado}
            onClick={() => executar(() => api.post('/simulacao/iniciar', { cenario: cenarioEscolhido }), { beep: 850 })}>
            ▶ Iniciar Simulação
          </button>
          <button className="btn-action-secondary text-xs" disabled={ocupado || !simulacao.ativo}
            onClick={() => executar(() => api.post('/simulacao/pausar'))}>
            {simulacao.pausado ? '▶ Retomar' : '⏸ Pausar'}
          </button>
          <button className="btn-action-secondary text-xs" disabled={ocupado || !simulacao.ativo}
            onClick={() => executar(() => api.post('/simulacao/reiniciar'), { beep: 900 })}>
            🔄 Reiniciar
          </button>
          <button className="sim-btn-stop text-xs" disabled={ocupado || !simulacao.ativo}
            onClick={() => executar(() => api.post('/simulacao/encerrar'), { beep: 600 })}>
            ⏹ Encerrar
          </button>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Foco de Visualização</div>
          <div className="flex gap-1.5">
            {[['todos', 'Bairro Completo'], ['bueiro_1', 'Bueiro 01'], ['bueiro_2', 'Bueiro 02']].map(([id, rotulo]) => (
              <button key={id} className={`btn-action-secondary text-[11px] py-1 flex-1 ${foco === id ? 'active' : ''}`}
                onClick={() => setFoco(id)}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-400">
            <span>Vista Explodida dos Bueiros</span>
            <span className="font-mono text-[11px]">{explosao}%</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
            <span>Montado</span>
            <input type="range" min="0" max="100" step="1" value={explosao} className="flex-1"
              onChange={(e) => setExplosao(Number(e.target.value))} aria-label="Vista explodida" />
            <span>Explodido</span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 leading-tight space-y-1">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" /><span>Ciano: nível normal de drenagem</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span>Âmbar: atenção nas galerias (&gt;50%)</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /><span>Vermelho: transbordo e alagamento na pista (&gt;80%)</span></div>
        </div>
      </div>

      <div id="threeContainer" ref={containerRef} />
    </div>
  );
}
