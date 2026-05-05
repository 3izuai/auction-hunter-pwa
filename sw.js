// ============================================================
// ヤフオク お宝ハンター - Service Worker
// ============================================================

const CACHE_NAME = 'auction-hunter-v1';
const WORKER_URL = 'https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev'; // ★要変更

// インストール
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      c.addAll(['/', '/index.html', '/icon-192.png'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

// プッシュ通知受信
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/badge-72.png',
      image: data.image,        // 商品画像（あれば大きく表示）
      data: data.data,
      actions: data.actions || [],
      requireInteraction: true, // タップするまで消えない
      vibrate: [200, 100, 200],
      tag: data.data?.id,       // 同一商品の通知は上書き
    })
  );
});

// 通知のボタンタップ
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const item = e.notification.data;
  const action = e.action; // 'good' | 'maybe' | 'bad' | '' (本体タップ)

  if (action === 'good' || action === 'maybe' || action === 'bad') {
    // ボタン直接タップ → フィードバック送信してアプリを開く
    e.waitUntil(
      sendFeedback(item.id, action).then(() => {
        return openApp(`/?id=${item.id}&rated=${action}`);
      })
    );
  } else {
    // 通知本体タップ → 商品詳細ページを開く
    e.waitUntil(
      openApp(`/?id=${item.id}`)
    );
  }
});

async function sendFeedback(itemId, rating) {
  try {
    await fetch(`${WORKER_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, rating }),
    });
  } catch (e) {
    console.error('feedback error:', e);
  }
}

async function openApp(path) {
  const clients = await self.clients.matchAll({ type: 'window' });
  const appUrl = self.registration.scope + path.replace(/^\//, '');

  // すでにアプリが開いていればフォーカス
  for (const client of clients) {
    if (client.url.startsWith(self.registration.scope)) {
      await client.focus();
      client.postMessage({ type: 'navigate', path });
      return;
    }
  }
  // 開いていなければ新規タブ
  return self.clients.openWindow(appUrl);
}
