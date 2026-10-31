import { NavLink } from 'react-router-dom';
import { ROTAS } from '../rotas.js';
import { useRelogio } from '../hooks/useRelogio.js';
import { useAlternarModo } from '../hooks/useAcoes.js';
import { som } from '../lib/som.js';
import { useTelemetria } from '../store/useTelemetria.js';
import ConexaoArduino from './ConexaoArduino.jsx';

export default function Sidebar({ aberto, aoNavegar }) {
  const relogio = useRelogio();
  const modo = useTelemetria((s) => s.estado?.modo ?? 'real');
  const { alternar, ocupado } = useAlternarModo();

  return (
    <aside className={`app-sidebar ${aberto ? 'mobile-open' : ''}`}>
      <div>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon-box">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="brand-title">HydraSmart</div>
              <div className="brand-subtitle">Monitoramento • Porto Alegre-RS</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {ROTAS.map((r) => (
            <NavLink
              key={r.caminho}
              to={r.caminho}
              end={r.caminho === '/'}
              className={({ isActive }) => `nav-link-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                som.beep(700, 0.04);
                aoNavegar();
              }}
            >
              <span className="nav-icon">{r.icone}</span>
              <span className="nav-label">{r.rotulo}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <ConexaoArduino />

        <button
          className={`mode-badge-btn ${modo}`}
          onClick={alternar}
          disabled={ocupado}
          title="Alternar entre Modo Real e Modo Demonstração"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>{modo === 'demo' ? 'Modo Demonstração' : 'Modo Real'}</span>
          </span>
          <span className="text-[10px]">Trocar</span>
        </button>

        <div className="clock-info-text" title="Horário de Porto Alegre-RS (GMT-3)">{relogio}</div>
      </div>
    </aside>
  );
}
