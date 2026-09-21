(() => {
  'use strict';
  window.addEventListener('hashchange', () => location.reload());
  const status = document.getElementById('status');
  const token = new URLSearchParams(location.hash.slice(1)).get('k');
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    status.textContent = 'この作品は専用の招待リンクから開けます。受け取ったURL、またはQRコードからお入りください。';
    return;
  }
  if (!window.crypto?.subtle) {
    status.textContent = 'このブラウザーでは作品を開けません。新しいSafari、Chrome、Edgeなどで招待リンクを開いてください。';
    return;
  }
  async function openAtelier() {
    status.textContent = 'アトリエを準備しています。少しお待ちください。';
    const keyBytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const response = await fetch('./atelier.bin', { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Unable to load atelier');
    const sealed = new Uint8Array(await response.arrayBuffer());
    if (sealed.length < 29) throw new Error('Invalid encrypted content');
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(0, 12), tagLength: 128 }, key, sealed.slice(12));
    const original = new TextDecoder('utf-8', { fatal: true }).decode(clear);
    const html = original.replace(/<head\b[^>]*>/i, '$&<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">');
    const frame = document.createElement('iframe');
    frame.title = 'Parfait Atelier 完全版';
    frame.allow = 'web-share';
    frame.referrerPolicy = 'no-referrer';
    frame.srcdoc = html;
    frame.addEventListener('load', () => {
      // srcdoc resolves relative links against its parent. Keep app anchors in
      // the app so they cannot navigate away from the invitation or its key.
      frame.contentDocument.addEventListener('click', event => {
        const anchor = event.target.closest('a[href^="#"]');
        if (!anchor) return;
        const target = frame.contentDocument.getElementById(anchor.getAttribute('href').slice(1));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      document.getElementById('invitation').hidden = true;
      document.title = 'Parfait Atelier｜完全版';
    }, { once: true });
    document.body.append(frame);
  }
  openAtelier().catch(() => {
    status.textContent = '作品を開けませんでした。通信状態を確認し、招待リンクやQRコードからもう一度開いてください。';
  });
})();
