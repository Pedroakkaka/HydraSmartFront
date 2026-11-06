# Publicação do frontend na Vercel

Este repositório contém **somente o painel React/Vite**. A HydraSmartAPI continua como serviço separado.

## Publicar

1. Na Vercel, importe o repositório `Pedroakkaka/HydraSmartFront`, branch `main`.
2. Framework: **Vite**. Build: `npm run build`. Output Directory: `dist`.
3. Publique. O `vercel.json` permite abrir e atualizar rotas do painel (SPA).

## Conexão com a API

O frontend usa `VITE_API_URL` no build. No painel da Vercel, em **Project Settings → Environment Variables**, defina:

```dotenv
VITE_API_URL=https://ENDERECO-PUBLICO-HTTPS-DA-API
```

Faça **Redeploy** após mudar a variável. O código acrescenta `/api/v1` às chamadas HTTP e usa `wss://.../ws` para telemetria em tempo real.

**Atenção:** a API rodando apenas em `localhost:3333` no computador não é acessível a visitantes da Vercel. Para manter o backend no PC, é necessário disponibilizar um endereço HTTPS público seguro (por exemplo, túnel HTTPS com suporte a WebSocket), manter o PC ligado e proteger os endpoints administrativos antes de expô-los. Uma API em HTTP sem TLS não funciona de forma confiável a partir de um site HTTPS.

**Nunca coloque `GEMINI_API_KEY` ou `INGEST_API_KEY` no frontend, nem em variáveis `VITE_*`.** O Gemini é chamado exclusivamente pela API. Segredos do GitHub Actions não são injetados automaticamente no processo da API.

Sem `VITE_API_URL`, o frontend usa chamadas relativas ao domínio da Vercel, que não possui a API; as telas podem carregar, mas leituras e análise com IA não funcionarão até a conexão ser configurada.
