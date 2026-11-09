// Serviço de notificações remoto: somente simulações identificadas.
// Não altera cache, páginas, bancos ou telemetria do projeto.
self.addEventListener('push', (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch { return; }
  if (dados.tipo !== 'simulacao' || typeof dados.titulo !== 'string' ||
      !dados.titulo.includes('NÃO É EMERGÊNCIA') || typeof dados.corpo !== 'string' ||
      !dados.corpo.includes('Não é uma emergência real.')) return;
  event.waitUntil(self.registration.showNotification(dados.titulo, {
    body:dados.corpo,
    tag:'hydrasmart-push-' + (dados.bueiroId || 'teste'),
    icon:'/hydrasmart-h.svg',
    badge:'/hydrasmart-h.svg',
    silent:false,
    renotify:true,
    data:{url:'/diagnostico', tipo:'simulacao'}
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL('/diagnostico', self.location.origin).href;
  event.waitUntil((async () => {
    const abertas = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const encontrada = abertas.find(janela => new URL(janela.url).origin === self.location.origin);
    if (encontrada) {
      await encontrada.focus();
      if ('navigate' in encontrada) return encontrada.navigate(destino);
      return;
    }
    return self.clients.openWindow(destino);
  })());
});
