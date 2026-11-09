# HydraSmart — validação final do Projeto físico (B01 e B02)

Este checklist corresponde à branch `fix/hydrasmart-integracao-final-20261109`.
A branch parte da `main` já com a correção do professor sobre erros de autenticação da API.
Não há alteração do firmware nem dos pinos neste lote.

## O que foi implementado

- Históricos B01 e B02 são alinhados por timestamp real e exibidos em curvas independentes.
- Níveis inválidos não entram no gráfico. Não existe interpolação de **medições** entre bueiros.
- O frontend atualiza imediatamente pelo estado USB/WebSocket e consulta `/api/v1/estado`
  a cada 3 segundos **apenas na página Gráficos do modo Projeto físico**.
- Uma resposta HTTP atrasada não substitui um snapshot WebSocket mais recente.
- Leituras sem atualização por mais de 30 segundos passam a ser sinalizadas como
  indisponíveis (reavaliação a cada 5 segundos), inclusive com o socket ainda conectado.
- A leitura USB local continua sendo atualizada sem chave da API; a chave é necessária
  somente para transmitir ao servidor, conforme o fluxo existente.
- A correção recente do professor que permite corrigir a chave sem reconectar o Arduino
  foi preservada.

## Testes automatizados — executar no checkout da branch

```powershell
npm install
npm test
npm run lint
npm run build
```

Testes adicionais:
- `src/lib/seriesPrototipo.test.js`: alinhamento, duas réguas independentes,
  subida/descida, horários serializados e rejeição de dados inválidos.
- `src/store/useTelemetria.test.js`: prevalência de USB local recente, nenhuma
  leitura fabricada para B02, rejeição de timestamp inválido e expiração após 30 segundos.

**Atenção:** os testes foram incluídos no repositório; executar a suíte no ambiente
da equipe para obter evidência de aprovação e corrigir eventuais falhas.

## Teste obrigatório com o protótipo físico

1. Abra o painel no Chrome/Edge com HTTPS, escolha **Projeto físico** e conecte a
   porta correta do Arduino Uno. Feche o Monitor Serial da IDE antes disso.
2. Confirme **Linhas recebidas** e **Mensagens interpretadas** na conexão USB.
   Use a aba **Gráficos e Histórico**; sem dados deve aparecer "Aguardando".
3. Suba gradualmente a água no B01: 0%, 16,7%, 33,3%, 50%, 66,7%, 83,3% e 100%.
   A curva azul deve subir, a porcentagem deve acompanhar e B02 deve permanecer
   independente. Reduza a água e confira a descida da curva.
4. Repita no B02. A curva laranja deve atualizar sem copiar os valores do B01.
5. Deixe B02 sem leitura por mais de 30 segundos: deve aparecer como indisponível,
   **não** como 0% medido. Repita com B01.
6. Sem chave ou com chave de API incorreta, confirme que a leitura local continua
   funcionando no mesmo navegador. Para transmitir ao servidor, configure uma chave
   válida do protótipo; não publique chaves em prints ou repositórios.
7. Confira a tabela dos dois bueiros, a página Diagnóstico e a identificação
   **Experimental**. Alertas de atenção/crítico devem ser apresentados como testes
   e não representar serviços oficiais da Defesa Civil.
8. Teste com o navegador em celular (visualização). Web Serial requer navegador e
   plataforma compatíveis; não pressuponha que a USB funcione no celular.
9. Reinicie/desconecte o USB e o servidor. Confira reconexão, expiração das leituras
   e ausência de mistura de dados experimentais com dados de campo.

## IA, alerta e fontes oficiais

- Diagnóstico de subida e ETA em bancada são **experimentais**, condicionados a
  amostras suficientes, consistência temporal e frescor dos dados.
- Previsão probabilística de alagamento em seis horas **não está validada** e não
  deve ser anunciada como recurso concluído.
- A confiabilidade de INMET/CEMADEN/Defesa Civil e das posições no mapa depende
  de validação de serviços/locais externos. Não deduza risco de bueiro somente a
  partir de dados de chuva ou nível de estação hidrológica.
- Testar notificações no dispositivo com permissão concedida e sem disparos
  públicos. A entrega de push com a aplicação fechada não é garantida.

## Publicação

Depois de aprovar os testes, revisar o pull request da branch e só então integrá-lo
à `main`. Conferir no Vercel o SHA publicado e no Render a versão da API. Um
commit, por si só, **não** significa deploy.

## 09/11/2026 — acompanhamento dos testes da equipe

O responsável confirmou que o protótipo físico já envia percentuais corretos, os
gráficos acompanham a água e as tabelas atualizam. Essas três verificações são
evidências relatadas pela equipe; não equivalem a testes instrumentados feitos
nesta branch.

**Falha reportada:** a notificação não chegou. Causa provável identificada no
código: o hook observava mensagens do WebSocket da API, mas não reagia diretamente
às alterações de `canalLocal` quando o Arduino estava conectado via Web Serial
sem credencial experimental. Agora as leituras locais genuínas são observadas,
com a mesma classificação de faixa e proteção contra duplicações já existentes.
O usuário deve **ativar avisos** e usar **Testar aviso** neste dispositivo para
separar problemas de permissão de problemas de telemetria.

**Limitação:** a notificação funciona com a página aberta, permissão concedida
e recursos do navegador disponíveis. Não há infraestrutura de Web Push com
assinatura/servidor para garantir aviso com o aplicativo fechado, especialmente
em plataformas móveis. Não anunciar essa capacidade sem implementação e testes.

**Diagnóstico:** o código USB local passou a exigir ao menos 10 amostras em
25 segundos, no mínimo duas elevações e ausência de quedas para considerar a
extrapolação de enchimento. Se a água ficar estável, baixar, ficar sem leitura,
ou se ocorrer salto isolado, o resultado é **Não calculável**. A estimativa
continua sendo experimental, não uma previsão validada de alagamento.

**Publicação:** integrar e publicar somente após `npm test`, `npm run lint`,
`npm run build` e validação da notificação com Arduino real. Alterações do
professor no histórico da `main` foram mantidas.
