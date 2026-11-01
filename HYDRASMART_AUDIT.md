# HydraSmart — Auditoria inicial
Data: 2026-11-01
Escopo: inspeção estática inicial dos repositórios HydraSmartFront e HydraSmartAPI via GitHub. **Não houve execução local, inspeção de navegador, testes automatizados ou implantação.**

## Evidências observadas
- Frontend: React 19, Vite 8, React Router, React Query, Zustand, Leaflet, Chart.js, Three.js; rotas em `src/rotas.js`.
- Backend: Fastify 5, PostgreSQL, WebSocket e integração serial opcional.
- `src/hooks/useAcoes.js` solicita `OPERATOR_API_KEY` via `window.prompt` em cada troca de modo; backend exige cabeçalho `X-Operator-Key` nas rotas administrativas. **Não remover autenticação**.
- `src/app.js` do backend ainda menciona Gemini nos comentários e mensagens, mas `src/routes/ia.js` chama a API OpenAI. Inconsistência textual confirmada.
- `src/pages/Graficos.jsx` inclui gráficos de telemetria, histórico persistido, estações oficiais e análise IA; comportamento em execução não verificado.
- `src/pages/VisaoGeral.jsx` distingue sensores físicos sem leitura e fontes meteorológicas, porém requer validação de todos os estados reais, offline e demo.
- OpenAI apresentou erro de autenticação e limite de faturamento nas sessões relatadas; funcionalidade não pode ser considerada operacional.
- Documento de requisitos recebido cita Cáceres/MT e Gemini, mas a versão vigente do projeto usa Porto Alegre/RS e OpenAI. **Decisão atual prevalece**.

## Riscos prioritários
1. **Alto:** não há evidência de funcionamento ponta a ponta no navegador nem de testes de regressão após alterações recentes.
2. **Alto:** site publicado pode não alcançar backend local; validar acesso externo antes da apresentação.
3. **Médio:** interface de chave de operador via prompt é pouco amigável, embora a autenticação seja necessária.
4. **Médio:** nomenclatura antiga Gemini no backend gera mensagens incorretas.
5. **Médio:** origem, localização e cobertura de referências históricas devem ser conferidas antes de rotular dados como Porto Alegre.

## Limites desta auditoria
Nenhum teste foi executado. Não foi verificada a versão publicada nem a disponibilidade das fontes em tempo real. Não declarar aprovação funcional com base somente na leitura do código.
