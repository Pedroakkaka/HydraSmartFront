# HydraSmart — Arquitetura atual e proposta
## Implementado (identificado no código)
- Frontend: React/Vite, React Router, React Query, Zustand, Leaflet, Chart.js.
- Backend: Fastify/Node.js, WebSocket, PostgreSQL, serial Arduino opcional.
- Fontes: Open-Meteo e Defesa Civil RS via backend; CEMADEN sujeito a disponibilidade.
- IA: integração OpenAI consultiva, sujeita a chave válida, limites e faturamento.
- Município atual: Porto Alegre, RS. Dados de demonstração devem permanecer claramente identificados.

## Equipe lógica proposta (não são processos autônomos em execução)
1. Arquiteto/coordenador — priorização e revisão.
2. Frontend — páginas, acessibilidade e UX.
3. Backend — API, persistência e integrações.
4. Meteorologia/hidrologia — proveniência, séries e consistência.
5. IA — análises com dados auditáveis, sem alegar treinamento automático.
6. QA — testes automatizados, navegador e regressão.
7. Segurança — autenticação, dependências, credenciais e permissões.

## Fluxo proposto
Issue -> branch por tarefa -> alteração -> lint/test/build -> revisão -> teste em navegador -> aprovação humana -> merge -> implantação autorizada.

## Autonomia
Esta documentação **não configura nem inicia** agentes em segundo plano. Para execução contínua será necessário um executor com permissões limitadas, fila de tarefas, limites de gastos, logs persistentes, segredos protegidos e política de aprovação. Fechar uma sessão de chat não garante continuidade.
