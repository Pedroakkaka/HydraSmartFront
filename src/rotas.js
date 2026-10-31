import { lazy } from 'react';

/**
 * Páginas do painel. Cada uma é carregada sob demanda (o mapa e o 3D são pesados).
 */
export const ROTAS = [
  { caminho: '/', icone: '🏠', rotulo: 'Visão geral', titulo: 'Visão Geral do Sistema', Pagina: lazy(() => import('./pages/VisaoGeral.jsx')) },
  { caminho: '/mapa', icone: '🗺️', rotulo: 'Mapa', titulo: 'Mapa Interativo de Drenagem', Pagina: lazy(() => import('./pages/Mapa.jsx')) },
  { caminho: '/bueiros', icone: '🚰', rotulo: 'Bueiros e sensores', titulo: 'Bueiros e Sensores Físicos', Pagina: lazy(() => import('./pages/Bueiros.jsx')) },
  { caminho: '/clima', icone: '⛅', rotulo: 'Clima', titulo: 'Clima e Meteorologia de Cáceres-MT', Pagina: lazy(() => import('./pages/Clima.jsx')) },
  { caminho: '/graficos', icone: '📈', rotulo: 'Gráficos e histórico', titulo: 'Gráficos e Histórico Auditável', Pagina: lazy(() => import('./pages/Graficos.jsx')) },
  { caminho: '/simulacao-3d', icone: '🏙️', rotulo: 'Simulação 3D de alagamento', titulo: 'Simulação 3D de Alagamento do Bairro', Pagina: lazy(() => import('./pages/Simulacao3D.jsx')) },
  { caminho: '/assistente-ia', icone: '🧠', rotulo: 'Análise com IA', titulo: 'Inteligência Consultiva • Gemini', Pagina: lazy(() => import('./pages/AssistenteIA.jsx')) },
  { caminho: '/diagnostico', icone: '🧪', rotulo: 'Diagnóstico', titulo: 'Diagnóstico Técnico do Sistema', Pagina: lazy(() => import('./pages/Diagnostico.jsx')) }
];
