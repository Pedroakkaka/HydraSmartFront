# HydraSmart Front

Painel web do **HydraSmart**, a plataforma de monitoramento de drenagem urbana e prevenção de alagamentos de Porto Alegre-RS.

Mostra em tempo real o nível de água dos bueiros, os alertas críticos, o mapa da cidade, a meteorologia, o histórico gravado e uma maquete 3D com simulação de alagamento. Todos os dados vêm da [HydraSmartAPI](https://github.com/Pedroakkaka/HydraSmartAPI).

| | |
|---|---|
| **Stack** | React 19 · Vite · React Router · TanStack Query · Zustand · Leaflet · Chart.js · Three.js |
| **Tempo real** | WebSocket (`/ws`) com reconexão automática |
| **Produção** | Build estático servido por nginx (Docker) |

## Páginas

| Rota | Conteúdo |
|---|---|
| `/` | Visão geral: situação, bueiros, clima e status do enlace |
| `/mapa` | Mapa OpenStreetMap com bueiros, drenos e marcação de coordenadas |
| `/bueiros` | Detalhe dos sensores e calibração física |
| `/clima` | Open-Meteo: condições atuais, previsão de 24 h e 7 dias |
| `/graficos` | Séries ao vivo, histórico do banco (1 h / 6 h / 24 h), alertas e registros oficiais |
| `/simulacao-3d` | Maquete 3D com cenários de alagamento e vista explodida |
| `/diagnostico` | Autodiagnóstico, serial, CEMADEN, banco e serviços externos |

## Estrutura

```
src/
├── main.jsx, App.jsx        # entrada, layout e rotas
├── rotas.js                 # páginas (carregadas sob demanda)
├── pages/                   # uma página por rota
├── components/              # menu lateral, conexão do Arduino, faixas de alerta, avisos
├── features/maquete3d/      # cena Three.js (independente do React)
├── hooks/                   # tempo real (WebSocket), consultas REST, ações
├── store/                   # estado global (Zustand)
├── lib/                     # cliente da API, formatação, risco, sons, gráficos
└── styles/                  # tema visual
```

O painel **não calcula nada crítico**: conversão de níveis, risco e alertas ficam na API. O front só exibe o estado recebido e envia comandos (calibração, simulação, conexão USB).

## Instalar em outro computador (notebook da feira)

Use o instalador automático do repositório da API. O passo a passo completo está em
[HydraSmartAPI/docs/INSTALACAO.md](https://github.com/Pedroakkaka/HydraSmartAPI/blob/main/docs/INSTALACAO.md).
Ele baixa este painel sozinho e deixa tudo pronto para ligar com dois cliques.

## Como rodar manualmente (desenvolvimento)

Pré-requisito: a **HydraSmartAPI rodando** (`npm run dev` no repositório dela, porta 3333).

```powershell
npm install
npm run dev
```

Abra **http://localhost:5173**. O Vite repassa `/api` e `/ws` para a API, então não é preciso configurar nada.

Se a API estiver em outra máquina da rede (ex.: notebook ligado ao Arduino e uma TV mostrando o painel), crie um `.env` com:

```dotenv
API_PROXY_TARGET=http://192.168.0.10:3333
```

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga instantânea |
| `npm run build` | Gera a versão de produção em `dist/` |
| `npm run preview` | Serve o build localmente para conferência |
| `npm test` | Testes (Vitest) |
| `npm run lint` | ESLint |

## Deploy em VPS

Com a API já rodando na VPS (veja `docs/DEPLOY_VPS.md` no repositório da API):

```bash
git clone https://github.com/Pedroakkaka/HydraSmartFront.git
cd HydraSmartFront
docker compose up -d --build
```

O nginx (`nginx.conf`) serve o painel na porta 80 e encaminha `/api`, `/ws` e `/docs` para o container `api:3333` pela rede Docker `hydrasmart`.

### HTTPS

O jeito mais simples é colocar o Caddy na frente, que gera o certificado sozinho. Para isso, troque a porta do painel para `WEB_PORT=8080` e crie um `Caddyfile`:

```
seu-dominio.com.br {
  reverse_proxy localhost:8080
}
```
