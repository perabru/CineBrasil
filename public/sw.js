const ROOT = new URL('./', self.location.href)
const CACHE = 'cinebrasil-' + ROOT.pathname + '-v2'
const OFFLINE = new URL('offline.html', ROOT).href
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE,new URL('favicon.svg',ROOT).href]))); self.skipWaiting() })
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()) })
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if(url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname) || url.pathname.includes('/api/')) return
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) { const copy=response.clone(); event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy))) }
    return response
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode==='navigate' ? await caches.match(OFFLINE) : Response.error())))
})
