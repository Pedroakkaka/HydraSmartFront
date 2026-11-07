# Diário de desenvolvimento — HydraSmart

> **Registro histórico de decisões, alterações e entregas realizadas durante as conversas de evolução do HydraSmart.**
>
> **Consolidado em:** 01/11/2026 · **Escopo:** interface, integrações, telemetria, IA, notificações, responsividade e deploy.
>
> **Repositórios:** [HydraSmartFront](https://github.com/Pedroakkaka/HydraSmartFront) e [HydraSmartAPI](https://github.com/Pedroakkaka/HydraSmartAPI). **Branch de trabalho:** `fix/audit-round-1`.

## Como interpretar este registro

Este documento descreve o **desenvolvimento realizado e solicitado**, não certifica que todas as funcionalidades foram validadas em produção. Os termos de status significam:

- **Commitado:** alteração registrada no GitHub, na branch de trabalho.
- **Compilado:** houve build `READY` do frontend na Vercel. Isso não é teste de ponta a ponta.
- **Produção confirmada:** houve deploy específico com alias `hydrasmart-monitor.vercel.app`.
- **A validar:** operação dependente de API Render, sensores, permissões do navegador, fontes externas ou avaliação funcional não comprovada.

O diário se limita às mudanças rastreáveis neste ciclo de conversas. O histórico anterior dos repositórios deve ser consultado no próprio Git.

## 1. Objetivo e diretrizes do produto

O HydraSmart monitora cenários de drenagem urbana e os apresenta por meio de dashboard web, dados meteorológicos/hidrológicos, sensores físicos e análise contextual. Ao longo das conversas, ficaram definidos estes princípios:

1. Manter **Projeto físico** e **Análise com dados reais** como as duas experiências visíveis.
2. Não misturar leituras do Arduino de bancada com sensores de campo, estações de rios ou dados sintéticos.
3. Não apresentar **probabilidades, tempos de extravasamento ou alertas públicos** sem dados e premissas suficientes.
4. Identificar testes com **“TESTE DO SISTEMA — NÃO É EMERGÊNCIA”**.
5. **Não enviar** alertas de demonstração à Defesa Civil oficial ou à população; recepção interna e navegadores autorizados são canais distintos.
6. Preservar a organização do dashboard desktop e dar suporte real a celular.
7. Proteger alterações administrativas com chave de operador, sem exigir token para a recepção passiva de avisos experimentais.

## 2. Linha do tempo das melhorias

| Etapa | Requisito levantado | Alteração registrada | Situação |
| --- | --- | --- | --- |
| Identidade visual | Retornar ao fundo claro sem desfazer o layout | Cartões brancos, fundo claro, texto preto e títulos com maior contraste em `src/styles/hydra-2026.css` | Commitado e publicado em etapa anterior |
| Modos | Reduzir três modos para dois | Seletor com **Projeto físico** e **Análise com dados reais**, preservando a autorização do operador | Frontend publicado; integração funcional a validar |
| Fontes | Exibir dados reais com procedência | Store seleciona canal `prototipo` ou `campo`; estação oficial identificada como **rio**, nunca bueiro | Frontend publicado |
| Eventos históricos | Demonstrar o fluxo sem dados inventados | Componente `DemonstracaoAssistida.jsx`: narrativa por etapas vinculada a registros oficiais | Commitado, integrado à Visão Geral |
| Central simulada | Simular recebimento pela Defesa Civil | Receptor interno na API e painel `ReceptorSimulado.jsx`; recibos rotulados, sem envio externo | Commitado; Render não verificado |
| IA | Verificar dados a cada 30 segundos | Frontend consulta relatório e estações a cada 30 s; backend usa assinatura das fontes para evitar regeração sem mudanças | Frontend publicado; atualização do Render não confirmada |
| Notificações | Automatizar avisos experimentais aos celulares | Alerta de atenção/crítico no protótipo; WebSocket, deduplicação por faixa, Service Worker de exibição local | Frontend publicado; testar com sensores |
| Avisos sem token | Retirar formulário manual do usuário | Removidos bloco exclusivo de notificações, chave e envio coletivo; autorização inicial concentrada em sino discreto | Frontend publicado |
| Mobile | Corrigir conteúdo que começava abaixo de área branca | Breakpoints, tabelas roláveis, fechamento do menu, scroll no topo e, por fim, correção de `position: sticky` da sidebar no mobile | Correção publicada; confirmar nos aparelhos |
| Indicadores reais | Fazer os cartões reagirem a observações | Cálculo experimental condicional do tempo até limite de bueiro; condição hidrológica oficial no lugar de percentual fictício de alagamento em 6 h | Commitado, builds de preview READY; produção final pendente |

### 2.1. Modos e origem dos dados

**Frontend:** `src/components/SeletorModo.jsx`, `src/store/useTelemetria.js`, `src/pages/VisaoGeral.jsx`, `src/pages/Graficos.jsx`, `src/pages/Diagnostico.jsx` e `src/components/Banners.jsx`.

- **Projeto físico:** usa leituras experimentais da bancada (`prototipo`), separadas do banco de sensores em campo.
- **Análise com dados reais:** lê o canal de campo quando há dispositivos reais e consulta hidrologia/meteorologia oficiais de forma independente.
- O seletor visível tem duas opções. A API ainda conserva mecanismos legados de demonstração, portanto “dois modos” não significa remoção integral de todas as rotas antigas do backend.
- O sistema de troca de modo consulta `/operador/validar` com chave administrativa; esta chave não é utilizada por visitantes para receber notificações.

### 2.2. Dashboard, IA e condições oficiais

**Frontend:** `src/components/AnaliseIntegrada.jsx`, `src/hooks/useConsultas.js`, `src/pages/VisaoGeral.jsx`.

- Relatório contextual da IA reconsultado a cada **30 s** no frontend; não implica nova medição oficial a cada 30 s.
- As estações da Defesa Civil/RS são exibidas com nível, tendência e situação oficial quando a API disponibiliza esses campos.
- A análise contextual de IA **não define** risco operacional certificado, nem equivale a previsão de alagamento.
- A fonte, o horário de verificação e a indisponibilidade devem permanecer visíveis.

**Backend:** `src/routes/ia.js` passou a verificar as fontes com intervalo nominal de 30 s e a comparar assinaturas do conteúdo antes de pedir novo texto. Falhas usam intervalo maior. **A execução desse comportamento em produção depende de atualização confirmada do Render.**

### 2.3. Alertas experimentais e notificações

**Frontend:** `src/lib/notificacoesTeste.js`, `src/hooks/useTempoReal.js`, `src/components/PermissaoAlertas.jsx`, `public/hydrasmart-testes-sw.js`.

**Backend:** `src/services/alertService.js`, `src/services/ingestService.js`, `src/services/simuladorDefesaCivil.js` e `src/routes/operacao.js`.

- Para **leituras experimentais do Arduino**, os limites padrão da API são **50% (atenção)** e **80% (crítico)**, sujeitos à calibração por bueiro.
- O backend emite alerta crítico; foi acrescentado evento didático ao ingressar em atenção. O frontend também observa snapshots recentes do canal de bancada, como redundância de exibição no navegador.
- Somente eventos identificados como **teste de protótipo** podem produzir a notificação experimental no celular. Leituras reais de campo e registros históricos não são convertidos em alarmes de teste.
- O consentimento é solicitado pelo navegador **uma única vez por aparelho/perfil**, por meio de sino discreto no cabeçalho. O site não pode contornar a permissão do sistema operacional.
- Foram removidos da Visão Geral o painel de inscrição e o formulário de token para envio coletivo. O endpoint de envio manual criado durante o desenvolvimento também foi retirado do backend.
- O Service Worker implementado serve para a **exibição de notificações locais**. **Não há push real com o site fechado** nesta etapa; o cliente deve permanecer com a página conectada.
- A mensagem obrigatória distingue ensaio de emergência real: **TESTE DO SISTEMA — NÃO É EMERGÊNCIA. Nenhuma ação é necessária.**
- A central denominada “Defesa Civil” no projeto é apenas **simulador interno** e não representa integração oficial com órgãos governamentais.

### 2.4. Responsividade móvel

**Frontend:** `src/styles/hydra-2026.css`, `src/App.jsx`, `src/components/Sidebar.jsx`.

Problema reportado: ao abrir cada aba no celular, surgia uma grande área branca antes dos cartões e era necessário rolar a tela para encontrar o conteúdo. As correções evoluíram em etapas:

1. Reorganização das grades, gráficos, banners, tabelas, inputs e modais nas larguras menores.
2. Fechamento do menu ao navegar e por tecla Escape, com melhoria dos atributos de acessibilidade.
3. Reset da posição de rolagem ao mudar de rota.
4. Diagnóstico pelo vídeo enviado: a regra desktop `position: sticky` da sidebar sobrepunha a configuração móvel `position: fixed`. Embora deslocada horizontalmente, a sidebar ainda consumia espaço vertical no fluxo.
5. Correção final: sidebar em `position: fixed !important` para telas de até 900 px, retirando-a do fluxo normal quando recolhida.

A compilação e o deploy da correção foram confirmados; ainda convém testar Android/iPhone com múltiplas rotas.

### 2.5. Indicadores do monitoramento real (última atualização)

**Frontend:** `src/lib/indicadoresReais.js`, `src/lib/indicadoresReais.test.js`, `src/pages/VisaoGeral.jsx`.

Anteriormente, os cartões exibiam sempre travessões:

- “Tempo estimado para extravasamento”.
- “Chance de alagamento (próx. 6 h)”.

Alterações realizadas:

- **Tempo até o limite do bueiro:** cálculo de extrapolação **experimental**, apenas com sensor de campo válido e recente, série temporal mínima e tendência ascendente consistente. Se a entrada for insuficiente, mostra **Não calculável**, com a justificativa, sem inventar ETA.
- **Condição hidrológica observada:** exibe a **situação oficial**, nível e tendência de uma estação hidrológica quando disponíveis. Não converte nível do rio em altura do bueiro.
- Não exibe **probabilidade numérica de alagamento em 6 h**, pois não há modelo probabilístico validado.
- Chuvas isoladas não bastam para afirmar que existe dado atual da estação.

**Status:** commitado na branch. Builds de preview `READY` foram observados. A tentativa de deploy de produção da versão consolidada foi bloqueada com HTTP **402**, limite **`api-deployments-free-per-day`** da Vercel, e orientação de nova tentativa após 24 h. Portanto, **a versão final dos indicadores não foi confirmada no domínio principal**.

## 3. Evidências e rastreabilidade

### Commits relevantes do frontend

| SHA abreviado | Motivo |
| --- | --- |
| `4483d326` | Sidebar móvel deixa de ocupar o fluxo da página |
| `f017308d` | Remoção do token e envio coletivo do cartão |
| `4d68918f` | Notificação automática por leituras experimentais recentes |
| `d707df19` | Retirada da seção exclusiva de notificações |
| `c0447017` | Botão discreto de autorização no cabeçalho |
| `6bee2e42` | Nova lógica dos indicadores reais |
| `b1a0aa69` | Integração dos indicadores à Visão Geral |
| `18bb9667` | Não inferir dados da estação apenas pela chuva |

### Commits relevantes da API

| SHA abreviado | Motivo |
| --- | --- |
| `75ea1288` | Evento automático de atenção experimental |
| `fec91e00` | Teste automatizado dos alertas de nível alto |
| `5ed1f823` | Retirada da rota de envio manual coletivo |

Os commits são evidências de trabalho versionado. O Git registra os horários, autores e diferenças exatas. Este diário resume os objetivos e as limitações dos respectivos commits.

## 4. Publicação e validação

| Entrega | Estado verificável no ciclo |
| --- | --- |
| Ajustes de layout, modos e tema | Frontend publicado em etapas anteriores |
| Correção da área branca no celular | Deploy de produção com estado `READY` |
| Remoção do painel de notificações e aviso automático no frontend | Deploy de produção com estado `READY` |
| Notificação real nos aparelhos durante leitura crítica do Arduino | A validar com hardware e navegadores |
| Novo receptor interno de testes da API | Código no GitHub; deploy Render não confirmado |
| Verificações de IA a cada 30 s no backend | Código no GitHub; deploy Render não confirmado |
| Últimos indicadores reais no domínio principal | **Pendente: limite diário de deploy da Vercel** |
| Probabilidade validada de alagamento para 6 h | Não implementada |
| Push com site fechado | Não implementado |

## 5. Pendências e próximos passos

1. Após a liberação do limite Vercel, consolidar os commits e fazer **um único deploy** da branch desejada para produção.
2. Confirmar branch/commit efetivos no Render e executar testes de integração da API.
3. Testar hardware: Arduino conectado, calibração correta, nível normal → atenção → crítico → normal e ausência de notificações repetidas.
4. Testar permissões do navegador e recepção com a aba aberta em Android e iPhone; documentar limitações de iOS.
5. Validar esquema/unidades das séries históricas de bueiros e a interpretação das situações oficiais das estações.
6. Se forem necessárias **previsões probabilísticas em seis horas**, definir dados, metodologia, validação, incerteza e critérios operacionais antes de publicar percentuais.
7. Atualizar este diário a cada lote consolidado de alterações, com commit, data, testes e evidência do deploy.

## 6. Política de manutenção deste diário

Após cada ciclo relevante, adicionar uma seção com: data, solicitação, arquivos alterados, commits, comportamento esperado, validação executada, deploy e pendências. Não substituir o histórico anterior; acrescentar novos registros datados.

---

**Nota de segurança:** nenhuma decisão neste diário autoriza envio de avisos oficiais ou coletivos sem consentimento. Os testes do HydraSmart não equivalem a serviços de alerta da Defesa Civil.
