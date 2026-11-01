import { Suspense, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ROTAS } from './rotas.js';
import { useTempoReal } from './hooks/useTempoReal.js';
import { useTelemetria } from './store/useTelemetria.js';
import Sidebar from './components/Sidebar.jsx';
import Banners from './components/Banners.jsx';
import Avisos from './components/Avisos.jsx';

const TEXTO_CONEXAO = {
  online: 'Servidor conectado • tempo real',
  conectando: 'Conectando ao servidor...',
  offline: 'Servidor indisponível'
};

function Carregando({ texto = 'Carregando...' }) {
  return <div className="carregando-pagina">⏳ {texto}</div>;
}

export default function App() {
  useTempoReal();
  const [menuAberto, setMenuAberto] = useState(false);
  const { pathname } = useLocation();
  const conexao = useTelemetria((s) => s.conexao);
  const temEstado = useTelemetria((s) => Boolean(s.estado));
  const serialConectada = useTelemetria((s) => Boolean(s.estado?.serial?.conectado));
  const fonte = useTelemetria((s) => s.fonteSelecionada);

  const rotaAtual = ROTAS.find((r) => r.caminho === pathname) ?? ROTAS[0];

  return (
    <>
      <header className="mobile-header-bar">
        <div className="flex items-center gap-2">
          <button className="hamburger-btn" aria-label="Abrir menu" onClick={() => setMenuAberto((v) => !v)}>☰</button>
          <span className="font-bold text-sm text-white">HydraSmart</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-dot-indicator ${serialConectada ? 'online' : 'offline'}`} />
          <span className="text-xs font-mono text-slate-400">{serialConectada ? 'USB Conectado' : 'USB Off'}</span>
        </div>
      </header>

      <div className={`sidebar-backdrop ${menuAberto ? 'active' : ''}`} onClick={() => setMenuAberto(false)} />

      <div className="app-container">
        <Sidebar aberto={menuAberto} aoNavegar={() => setMenuAberto(false)} />

        <main className="app-main-content">
          <div className="top-context-bar">
            <div className="page-heading-group">
              <span className="page-heading-eyebrow">SISTEMA DE MONITORAMENTO HIDROLÓGICO</span>
              <h1 className="page-title-heading"><span className="page-heading-icon" aria-hidden="true">⌖</span>{pathname === '/' ? 'Porto Alegre' : rotaAtual.rotulo}</h1>
            </div>
            <div className="header-status-pills">
              <span className={`header-mode-pill ${fonte === 'demonstracao' ? 'demo' : 'real'}`}>{fonte === 'campo' ? '● Campo · Dados reais' : fonte === 'prototipo' ? '● Protótipo · Experimental' : '● Demonstração · Fictício'}</span>
              <span className={`server-pill ${conexao}`}>
                <span className="ponto" />
                {TEXTO_CONEXAO[conexao]}
              </span>
            </div>
          </div>

          <Banners />

          <div className="page-container">
            {!temEstado ? (
              <Carregando texto={conexao === 'offline' ? 'Aguardando o servidor HydraSmart (API) ficar disponível...' : 'Conectando ao servidor HydraSmart...'} />
            ) : (
              <Suspense fallback={<Carregando />}>
                <Routes>
                  {ROTAS.map(({ caminho, Pagina }) => (
                    <Route key={caminho} path={caminho} element={<section className="page-section active"><Pagina /></section>} />
                  ))}
                  <Route path="*" element={<Carregando texto="Página não encontrada." />} />
                </Routes>
              </Suspense>
            )}
          </div>
        </main>
      </div>

      <Avisos />
    </>
  );
}
