import { NavLink } from 'react-router-dom';
import { ROTAS } from '../rotas.js';
import { useRelogio } from '../hooks/useRelogio.js';
import { som } from '../lib/som.js';
import { useTelemetria } from '../store/useTelemetria.js';
import SeletorModo, { ROTULOS_FONTE } from './SeletorModo.jsx';
import { useState } from 'react';

const CAMINHOS = {
  '/': <><path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z" /></>,
  '/mapa': <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="2.5" /></>,
  '/bueiros': <><rect x="9" y="8" width="6" height="8" rx="2"/><path d="M6 5a10 10 0 0 0 0 14M18 5a10 10 0 0 1 0 14M3 2a14 14 0 0 0 0 20M21 2a14 14 0 0 1 0 20"/></>,
  '/clima': <><path d="M7 18a5 5 0 0 1-.2-10A7 7 0 0 1 20 10a4 4 0 0 1-1 8z" /></>,
  '/graficos': <><path d="M4 20h16M5 17v-6h4v6M10 17V4h4v13M15 17V9h4v8" /></>,
  '/diagnostico': <><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5"/></>
};
function IconeMenu({ caminho }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CAMINHOS[caminho]}</svg>;
}

export default function Sidebar({ aberto, aoNavegar }) {
  const relogio = useRelogio();
  const [modalAberto, setModalAberto] = useState(false);
  const fonte = useTelemetria((s) => s.fonteSelecionada);

  return (
    <>
    <aside id="hydra-sidebar" aria-label="Navegação do HydraSmart" className={`app-sidebar ${aberto ? 'mobile-open' : ''}`}>
      <div>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon-box"><img src="/hydrasmart-h.svg" alt="Monograma H da HydraSmart" /></div>
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
              <span className="nav-icon"><IconeMenu caminho={r.caminho}/></span>
              <span className="nav-label">{r.rotulo}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button className={`mode-badge-btn ${'real'}`} type="button" onClick={() => setModalAberto(true)} title="Selecionar origem dos dados do painel">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-current"/><span>{ROTULOS_FONTE[fonte]}</span></span>
          <span className="text-[10px]">Trocar</span>
        </button>

        <div className="clock-info-text" title="Horário de Porto Alegre-RS (GMT-3)">{relogio}</div>
      </div>
    </aside>
    <SeletorModo aberto={modalAberto} fechar={() => setModalAberto(false)} />
    </>
  );
}
