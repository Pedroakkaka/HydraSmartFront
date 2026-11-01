import { describe, expect, it } from 'vitest';
import { ehAlertaProtótipo, TITULO_TESTE, TEXTO_TESTE } from './notificacoesTeste.js';

describe('separação rigorosa de notificações de teste', () => {
  it('autoriza exclusivamente alerta experimental identificado', () => {
    expect(ehAlertaProtótipo({ acao: 'disparado', alerta: { simulado: true, mensagem: '[TESTE PROTÓTIPO] Exemplo' } })).toBe(true);
  });
  it('impede alerta real, cenário fictício, aviso encerrado e conteúdo sem identificação', () => {
    for (const dados of [
      { acao: 'disparado', alerta: { simulado: false, mensagem: 'Nível crítico real' } },
      { acao: 'disparado', alerta: { simulado: true, mensagem: '[TESTE SIMULAÇÃO] Exemplo' } },
      { acao: 'encerrado', alerta: { simulado: true, mensagem: '[TESTE PROTÓTIPO] Exemplo' } },
      { acao: 'disparado', alerta: { simulado: true, mensagem: 'Aviso sem identificação' } },
      { acao: 'disparado', alerta: null }
    ]) expect(ehAlertaProtótipo(dados)).toBe(false);
  });
  it('comunica ausência de emergência em todas as mensagens ao celular', () => {
    expect(TITULO_TESTE).toContain('NÃO É EMERGÊNCIA');
    expect(TEXTO_TESTE).toContain('Não há emergência real');
    expect(TEXTO_TESTE).toContain('Nenhuma ação é necessária');
  });
});
