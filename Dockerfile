# HydraSmart Front — build do React e servidor nginx

# 1) Compila o painel
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# 2) Serve os arquivos estáticos
FROM nginx:1.27-alpine
# O nginx substitui ${API_UPSTREAM} ao iniciar (templates em /etc/nginx/templates)
ENV API_UPSTREAM=api:3333
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
