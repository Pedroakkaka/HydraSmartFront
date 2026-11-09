import { describe, expect, it } from 'vitest';
import { ehAlertaProtótipo, ehAlertaSimulacao, ehAlertaDeTeste, classificarFaixaTeste, TITULO_TESTE, TEXTO_TESTE } from './notificacoesTeste.js';

describe('separação rigorosa de notificações de teste', () => {
  it('autoriza exclusivamente alerta experimental identificado', () => {
    expect(ehAlertaProtótipo({ acao: 'disparado', alerta: { simulado: true, mensagem: '[TESTE PROTÓTIPO] Exemplo' } })).toBe(true);
    expect(ehAlertaProtótipo({ acao: 'nivel_alto_teste', alerta: { simulado: true, canal: 'prototipo', mensagem: '[TESTE PROTÓTIPO] Nível alto de bancada' } })).toBe(true);
  });
  it('impede alerta real, cenário fictício, aviso encerrado e conteúdo sem identificação', () => {
    for (const dados of [
      { acao: 'disparado', alerta: { simulado: false, mensagem: 'Nível crítico real' } },
      { acao: 'disparado', alerta: { simulado: true, mensagem: '[TESTE SIMULAÇÃO] Exemplo' } },
      { acao: 'encerrado', alerta: { simulado: true, mensagem: '[TESTE PROTÓTIPO] Exemplo' } },
      { acao: 'disparado', alerta: { simulado: true, mensagem: 'Aviso sem identificação' } },
      { acao: 'disparado', alerta: null },
      { acao: 'nivel_alto_teste', alerta: { simulado: false, mensagem: '[TESTE PROTÓTIPO] texto indevido' } },
      { acao: 'nivel_alto_teste', alerta: { simulado: true, mensagem: 'Nível alto sem identificação de teste' } }
    ]) expect(ehAlertaProtótipo(dados)).toBe(false);
  });
  it('comunica ausência de emergência em todas as mensagens ao celular', () => {
    expect(TITULO_TESTE).toContain('NÃO É EMERGÊNCIA');
    expect(TEXTO_TESTE).toContain('Não há emergência real');
    expect(TEXTO_TESTE).toContain('Nenhuma ação é necessária');
  });
});

describe('notificações de simulação para qualquer modo de visualização', () => {
  const testeDigital = {
    acao: 'disparado',
    alerta: {
      bueiroId: 'bueiro_2', simulado: true, nivelPctPico: 83.3,
      mensagem: '[TESTE SIMULAÇÃO] Nível crítico em demonstração'
    }
  };
  it('identifica simulação explicitamente sem marcá-la como protótipo físico', () => {
    expect(ehAlertaSimulacao(testeDigital)).toBe(true);
    expect(ehAlertaDeTeste(testeDigital)).toBe(true);
    expect(ehAlertaProtótipo(testeDigital)).toBe(false);
  });
  it('não depende do modo visual selecionado no celular', () => {
    const evento = { ...testeDigital, fonteSelecionada: 'inteligente' };
    expect(ehAlertaDeTeste(evento)).toBe(true);
  });
  it('não permite que avisos operacionais ou mensagens sem rótulo sejam enviados como simulação', () => {
    expect(ehAlertaSimulacao({
      acao: 'disparado', alerta: { simulado: false, mensagem: '[TESTE SIMULAÇÃO] forjado' }
    })).toBe(false);
    expect(ehAlertaDeTeste({
      acao: 'disparado', alerta: { simulado: true, mensagem: 'Nível alto' }
    })).toBe(false);
  });
  it('classifica faixas e rejeita níveis ausentes', () => {
    expect(classificarFaixaTeste(null)).toBe(null);
    expect(classificarFaixaTeste(16.7)).toBe('normal');
    expect(classificarFaixaTeste(50)).toBe('atencao');
    expect(classificarFaixaTeste(83.3)).toBe('critico');
  });
});
