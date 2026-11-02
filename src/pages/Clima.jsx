import { useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { useQueryClient } from '@tanstack/react-query';
import { useClima } from '../hooks/useConsultas.js';
import { api } from '../lib/api.js';
import { som } from '../lib/som.js';
import { avisar } from '../store/useTelemetria.js';
import { opcoesBase } from '../lib/graficos.js';
import { dataHora, num } from '../lib/formato.js';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONO = { family: 'JetBrains Mono', size: 10 };

const opcoesClima = {
  ...opcoesBase,
  scales: {
    x: opcoesBase.scales.x,
    yTemp: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#00d4e5', font: MONO }, title: { display: true, text: '°C', color: '#00d4e5' } },
    yProb: { type: 'linear', position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { color: '#38bdf8', font: MONO }, title: { display: true, text: '% Chuva', color: '#38bdf8' } },
    yPrecip: { display: false, min: 0 }
  }
};

function Metrica({ rotulo, valor, cor = '', legenda }) {
  return (
    <div className="weather-metric-box">
      <span className="metric-sub-label">{rotulo}</span>
      <span className={`value-large ${cor}`}>{valor}</span>
      <span className="text-[10px] text-slate-400">{legenda}</span>
    </div>
  );
}

export default function Clima() {
  const { data: clima, isLoading } = useClima();
  const queryClient = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      const novo = await api.get('/clima?forcar=true');
      queryClient.setQueryData(['clima'], novo);
      som.beep(900);
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setAtualizando(false);
    }
  };

  const horas = clima?.previsaoHoraria ?? [];
  const dadosGrafico = {
    labels: horas.map((h) => h.horario?.slice(11, 16)),
    datasets: [
      { type: 'line', label: 'Temperatura (°C)', data: horas.map((h) => h.temperatura), borderColor: '#00d4e5', backgroundColor: 'rgba(0,212,229,0.1)', yAxisID: 'yTemp', tension: 0.3, borderWidth: 2, pointRadius: 2 },
      { type: 'line', label: 'Probabilidade de Chuva (%)', data: horas.map((h) => h.probabilidadePct), borderColor: '#38bdf8', borderDash: [4, 4], backgroundColor: 'transparent', yAxisID: 'yProb', tension: 0.3, borderWidth: 1.5, pointRadius: 2 },
      { type: 'bar', label: 'Precipitação Prevista (mm)', data: horas.map((h) => h.precipitacaoEstimadaMm), backgroundColor: 'rgba(56,189,248,0.4)', yAxisID: 'yPrecip', borderRadius: 3 }
    ]
  };

  return (
    <>
      {clima?.status === 'desatualizado' && (
        <div className="demo-alert-banner mb-4">
          <span>Open-Meteo fora do ar no momento. Exibindo a última consulta válida ({dataHora(clima.horarioUltimaConsulta)}).</span>
        </div>
      )}

      <div className="weather-metrics-strip">
        <Metrica rotulo="Temperatura" valor={num(clima?.temperatura)} legenda="Graus Celsius (°C)" />
        <Metrica rotulo="Umidade Relativa" valor={`${clima?.umidadeRelativaPct ?? '--'}%`} cor="text-sky-400" legenda="Percentual (%)" />
        <Metrica rotulo="Precipitação Total" valor={num(clima?.precipitacaoObservadaMm, 1, '0.0')} cor="text-cyan-400" legenda="Milímetros acumulados (mm)" />
        <Metrica rotulo="Componente Chuva" valor={num(clima?.chuvaAtualMm, 1, '0.0')} cor="text-blue-400" legenda="Fração líquida da precipitação" />
        <Metrica rotulo="Cobertura de Nuvens" valor={`${clima?.coberturaNuvensPct ?? '--'}%`} cor="text-slate-200" legenda="Céu encoberto (%)" />
        <Metrica rotulo="Vento (10m)" valor={num(clima?.velocidadeVentoKmh)} cor="text-slate-300" legenda="Velocidade em km/h" />
      </div>

      <div className="weather-forecast-section">
        <div className="card-base">
          <div className="card-header-line">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><span>📈</span> Projeção Meteorológica Horária (Próximas 24 Horas)</h3>
              <p className="text-xs text-slate-400">
                {clima?.condicaoTempo ?? 'Consultando...'} • atualizado {dataHora(clima?.horarioUltimaConsulta)}
              </p>
            </div>
            <button className="btn-action-primary text-xs" onClick={atualizar} disabled={atualizando}>
              {atualizando ? '🔄 Consultando...' : '🔄 Atualizar Dados'}
            </button>
          </div>
          <div className="h-64 w-full relative mt-2">
            {horas.length ? <Chart type="bar" data={dadosGrafico} options={opcoesClima} /> : (
              <div className="text-slate-500 text-xs py-4">{isLoading ? 'Carregando previsão...' : clima?.erroMensagem ?? 'Sem dados de previsão.'}</div>
            )}
          </div>
        </div>

        <div className="card-base">
          <div className="card-header-line">
            <span className="card-title-text">📅 Previsão Diária dos Próximos 7 Dias (Cáceres-MT)</span>
            <span className="text-[11px] text-slate-400">Fuso: {clima?.fusoHorario ?? 'America/Sao_Paulo'}</span>
          </div>
          <div className="forecast-days-grid mt-2">
            {(clima?.previsaoDiaria ?? []).map((d) => {
              const data = new Date(`${d.data}T12:00:00`);
              return (
                <div key={d.data} className="forecast-day-card">
                  <div className="day-name">{DIAS[data.getDay()]} • {String(data.getDate()).padStart(2, '0')}/{String(data.getMonth() + 1).padStart(2, '0')}</div>
                  <div className="day-moon">{d.faseLunarTexto}</div>
                  <div className="day-temp">
                    <span className="text-rose-400">▲ {num(d.tempMax, 0)}°</span>
                    <span className="text-cyan-400">▼ {num(d.tempMin, 0)}°</span>
                  </div>
                  <div className="day-rain">
                    <span className="text-sky-400 font-bold">{num(d.precipitacaoTotalMm, 1, '0.0')} mm</span>
                    <span className="text-slate-400">({d.probabilidadeMaxPct}%)</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{d.horasPrecipitacao || 0}h de chuva</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Fonte: Open-Meteo (modelos ECMWF e GFS), consultada pelo servidor com cache de 10 minutos. A chuva já está incluída na
          precipitação total. Dados de contexto meteorológico, não são medições dos bueiros.
        </div>
      </div>
    </>
  );
}
