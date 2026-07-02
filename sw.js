// שירות מינימלי - נדרש כדי שדפדפנים יזהו את האתר כ"ניתן להתקנה"
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

// מעביר את כל הבקשות ישירות לרשת, בלי caching מיוחד
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
