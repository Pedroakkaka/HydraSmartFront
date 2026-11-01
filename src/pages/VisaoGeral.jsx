import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import '../lib/graficos.js';
import { api } from '../lib/api.js';
import { useTelemetria } from '../store/useTelemetria.js';
import { useClima } from '../hooks/useConsultas.js';
import { situacaoGeral, temLeitura } from '../lib/risco.js';
import { num } from '../lib/formato.js';
import AnaliseIntegrada from '../components/AnaliseIntegrada.jsx';

const ESTACOES = {
  'DCRS-00044': 'Viamão · Itapuã',
  'DCRS-00054': 'Barra do Ribeiro · Guaíba',
  'DCRS-00076': 'Eldorado do Sul',
  'DCRS-00105': 'Viamão · Reserva Estadual'
};
const numero = (v, unidade = '') => v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})}${unidade}`;
const temDado = (b) => Boolean(b && temLeitura(b) && !b.desatualizado);

function CartaoIndicador({ icone, titulo, valor, detalhe, classe = '' }) {
  return <div className={`hs-kpi ${classe}`}>
    <span className="hs-kpi-title"><span className="hs-icon">{icone}</span>{titulo}</span>
    <div className="hs-kpi-number">{valor}</div>
    <p className="hs-kpi-caption">{detalhe}</p>
  </div>;
}
function NivelSensor({ bueiro, titulo }) {
  const valido = temDado(bueiro);
  const pct = valido ? Math.min(100,Math.max(0,Number(bueiro.nivelPct)||0)) : 0;
  return <div className="hs-meter-cell">
    <div className="hs-meter-title">{titulo}</div>
    <strong>{valido ? numero(bueiro.alturaAguaCm,' cm') : 'Sem leitura'}</strong>
    <div className="hs-meter-rail"><i style={{width:`${pct}%`}} /></div>
    <span>{valido ? `${numero(bueiro.nivelPct,'%')} da altura útil` : 'Sensor físico não conectado'}</span>
  </div>;
}
function GraficoNivel({ b1, b2 }) {
  const bases = [b1,b2].map(b=>Array.isArray(b?.historicoNiveis)?b.historicoNiveis:[]);
  const labelsOriginais = (b1?.historicoTimestamps?.length||0) >= (b2?.historicoTimestamps?.length||0) ? b1?.historicoTimestamps : b2?.historicoTimestamps;
  const comprimento = Math.max(bases[0].length,bases[1].length);
  if (!comprimento) return <div className="hs-chart-empty"><span>⌁</span><strong>Aguardando as primeiras leituras</strong><small>As curvas serão exibidas quando os sensores enviarem medições reais.</small></div>;
  const labels = Array.from({length:comprimento},(_,i) => {
    const valor = labelsOriginais?.[i];
    if(!valor) return `Leitura ${i+1}`;
    const dt = new Date(valor);
    return Number.isNaN(dt.getTime()) ? `Leitura ${i+1}` : dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  });
  const data={labels,datasets:[
    {label:'Bueiro 01 · Entrada',data:bases[0],borderColor:'#0069e6',backgroundColor:'rgba(0,105,230,.1)',pointRadius:2,tension:.35,fill:true,spanGaps:false},
    {label:'Bueiro 02 · Saída',data:bases[1],borderColor:'#02a5c7',backgroundColor:'rgba(2,165,199,.06)',pointRadius:2,tension:.35,fill:false,spanGaps:false}
  ]};
  const options={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#415875',boxWidth:12,font:{size:11}}},tooltip:{mode:'index',intersect:false}},scales:{x:{grid:{display:false},ticks:{color:'#6b7f96',maxTicksLimit:8}},y:{min:0,max:100,grid:{color:'#e8eef6'},ticks:{color:'#6b7f96',callback:v=>`${v}%`}}}};
  return <div className="hs-chart-graphic"><Line data={data} options={options}/></div>;
}
function Estacoes({ data, loading, error }) {
  const estacoes=(data?.estacoes||[]).filter(e=>ESTACOES[e.codigo]).slice(0,4);
  return <section className="hs-card hs-stations">
    <div className="hs-card-head"><h3><span className="hs-outline-icon">◉</span> Estações hidrológicas oficiais</h3><span className="hs-subtle-state">{loading?'Consultando…':`${estacoes.length} estações consultadas`}</span></div>
    <div className="hs-table-wrap">
      <table><thead><tr><th>Estação</th><th>Nível atual</th><th>Tendência</th><th>Situação oficial</th></tr></thead>
      <tbody>{estacoes.map(e=><tr key={e.codigo}>
        <td><span className="hs-pin">⌖</span> {ESTACOES[e.codigo]}</td>
        <td className="hs-val">{numero(e.rio?.nivelMetros,' m')}</td>
        <td>{numero(e.rio?.tendenciaMetros,' m')}</td>
        <td><span className="hs-status-tag">{e.rio?.situacaoOficial||'Não informada'}</span></td>
      </tr>)}</tbody></table>
      {!estacoes.length && <p className="hs-inline-empty">{error?'Estações temporariamente indisponíveis.':'Aguardando dados oficiais.'}</p>}
    </div>
    <p className="hs-card-foot">Fonte: Defesa Civil RS · Estações da região, não sensores dos bueiros. Atualização a cada 5 min.</p>
  </section>;
}

const TIPOS = [
  { id:'prototipo', titulo:'Protótipo físico', descricao:'Leituras experimentais do Arduino e dos sensores da bancada.', icone:'⌁', etiqueta:'EXPERIMENTAL' },
  { id:'demonstracao', titulo:'Demonstração sintética', descricao:'Valores fictícios gerados para mostrar cenários e alertas de teste.', icone:'◈', etiqueta:'DADOS FICTÍCIOS' },
  { id:'campo', titulo:'Monitoramento de campo', descricao:'Somente dados reais enviados por dispositivos instalados em campo.', icone:'⌖', etiqueta:'CAMPO REAL' }
];

function FontesSeparadas({ canais }) {
  return <section className="hs-card hs-origins" aria-label="Origem dos dados">
    <div className="hs-card-head"><h3><span className="hs-outline-icon">▦</span> Origem dos dados</h3><span className="hs-origins-note">Três fontes independentes</span></div>
    <div className="hs-origins-grid">
      {TIPOS.map(tipo=>{
        const leituras = Object.values(canais?.[tipo.id] ?? {});
        const ultima = leituras.length ? Math.max(...leituras.map(l=>Number(l.timestamp)||0)) : 0;
        const niveis = leituras.map(l=>Number(l.nivelPct)).filter(Number.isFinite);
        const maior = niveis.length ? Math.max(...niveis) : null;
        const recente = ultima && Date.now()-ultima < 30_000;
        return <div className={`hs-origin hs-origin-${tipo.id}`} key={tipo.id}>
          <span className="hs-origin-badge">{tipo.etiqueta}</span>
          <h4><span aria-hidden="true">{tipo.icone}</span> {tipo.titulo}</h4>
          <div className="hs-origin-value">{maior == null ? 'Sem leituras' : `${numero(maior,'%')}`}</div>
          <p>{tipo.descricao}</p>
          <small>{ultima ? `${recente?'Leitura recente':'Última leitura'}: ${new Date(ultima).toLocaleTimeString('pt-BR')}` : 'Nenhuma leitura recebida neste canal'}</small>
        </div>;
      })}
    </div>
    <p className="hs-card-foot">A origem é definida no servidor. Dados sintéticos e testes de bancada não são tratados como medições de campo nem acionam notificações externas.</p>
  </section>;
}

export default function VisaoGeral(){
  const navegar=useNavigate();
  const estado=useTelemetria(s=>s.estado);
  const {data:clima}=useClima();
  const {data:hidrologia,isLoading:hidroCarregando,isError:hidroErro}=useQuery({
    queryKey:['hidrologia-estacoes-rs'],queryFn:()=>api.get('/hidrologia/estacoes'),staleTime:2*60*1000,refetchInterval:5*60*1000
  });
  const b1=estado?.bueiros?.bueiro_1;
  const b2=estado?.bueiros?.bueiro_2;
  const ambos=temDado(b1)&&temDado(b2);
  const situacao=estado?.bueiros?situacaoGeral(estado.bueiros):'desconhecido';
  const status=!ambos?'Sem leituras':situacao==='normal'?'Estável':situacao==='atencao'?'Atenção':situacao==='critico'?'Crítico':'Indeterminado';
  const estadoVisual=!ambos?'indisponivel':situacao==='normal'?'normal':situacao==='atencao'?'atencao':'critico';
  const estacaoDestaque=(hidrologia?.estacoes||[]).find(e=>e.codigo==='DCRS-00054')||(hidrologia?.estacoes||[]).find(e=>e.rio?.nivelMetros!=null);
  const chuva=clima?.precipitacaoObservadaMm;
  return <div className="hs-dashboard">
    <div className="hs-left">
      <div className="hs-kpi-row">
        <div className="hs-kpi hs-kpi-status">
          <span className="hs-kpi-title"><span className="hs-icon">◉</span> Status de monitoramento</span>
          <span className={`hs-state-pill ${estadoVisual}`}>{status}</span>
          <p className="hs-kpi-caption">{ambos?'Condição avaliada pelos dois sensores físicos.':'Sem dados recentes suficientes para indicar normalidade.'}</p>
          <div className="hs-wave-lines" aria-hidden="true"/>
        </div>
        <CartaoIndicador icone="⌛" titulo="Tempo estimado para extravasamento" valor="—" detalhe="Sem estimativa validada" classe="hs-kpi-soft"/>
        <CartaoIndicador icone="⚠" titulo="Chance de alagamento (próx. 6 h)" valor="—" detalhe="Previsão não disponível" classe="hs-kpi-soft"/>
      </div>
      <FontesSeparadas canais={estado?.canais} />
      <div className="hs-measure-row">
        <section className="hs-card hs-level">
          <div className="hs-card-head"><h3><span className="hs-outline-icon">♧</span> Nível atual da água</h3><button className="hs-text-link" onClick={()=>navegar('/bueiros')}>Ver sensores ↗</button></div>
          <div className="hs-level-content">
            <div className="hs-level-main"><strong>{temDado(b1)?numero(b1.alturaAguaCm,' cm'):'Sem leitura'}</strong><p>Sensor físico · Bueiro 01 (montante)</p><span>{ambos?'Medições válidas de ambos os sensores':'Sem medições físicas recentes'}</span></div>
            <div className="hs-sensor-measures"><NivelSensor bueiro={b1} titulo="Entrada · B01"/><NivelSensor bueiro={b2} titulo="Saída · B02"/></div>
          </div>
        </section>
        <section className="hs-card hs-rain">
          <div className="hs-card-head"><h3><span className="hs-outline-icon">☁</span> Precipitação observada</h3></div>
          <div className="hs-rain-body"><div><strong>{chuva==null?'—':numero(chuva,' mm')}</strong><p>{chuva==null?'Dados meteorológicos indisponíveis':'Open-Meteo · observação reportada pela API'}</p></div><span className="hs-rain-icon" aria-hidden="true">▂▅▇█</span></div>
        </section>
      </div>
      <section className="hs-card hs-chart">
        <div className="hs-card-head"><h3><span className="hs-outline-icon">▥</span> Evolução do nível da água</h3><button className="hs-period" onClick={()=>navegar('/graficos')}>Ver histórico completo ⌄</button></div>
        <p className="hs-chart-caption">Medições dos dois sensores físicos · percentual da altura útil</p>
        <GraficoNivel b1={b1} b2={b2}/>
      </section>
      <Estacoes data={hidrologia} loading={hidroCarregando} error={hidroErro}/>
    </div>
    <AnaliseIntegrada estacao={estacaoDestaque} chuva={chuva}/>
  </div>;
}
