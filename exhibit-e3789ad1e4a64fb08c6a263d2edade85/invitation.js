(() => {
  'use strict';
  window.addEventListener('hashchange', () => location.reload());
  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  retry.addEventListener('click', () => location.reload());
  const token = new URLSearchParams(location.hash.slice(1)).get('k');
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    status.textContent = 'この作品は、展示会の専用URLまたはQRコードから開けます。';
    return;
  }
  if (!window.crypto?.subtle) {
    status.textContent = 'このブラウザーでは作品を開けません。Safari、Chrome、Edgeなどで専用リンクを開いてください。';
    return;
  }
  async function openExhibition() {
    status.textContent = '日本の夏を準備しています。初回は約25MBを読み込みます。少しお待ちください。';
    const keyBytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const response = await fetch('./demo.bin', { credentials:'omit', referrerPolicy:'no-referrer' });
    if (!response.ok) throw new Error('Unable to load exhibition');
    const sealed = new Uint8Array(await response.arrayBuffer());
    if (sealed.length < 29) throw new Error('Invalid encrypted content');
    const clear = await crypto.subtle.decrypt({ name:'AES-GCM', iv:sealed.slice(0,12), tagLength:128 }, key, sealed.slice(12));
    const original = new TextDecoder('utf-8', { fatal:true }).decode(clear);
    const html = original.replace(/<head\b[^>]*>/i, '$&<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">');
    const frame = document.createElement('iframe');
    frame.id = 'exhibition';
    frame.title = 'Keshiki — A Japanese Summer v17';
    frame.allow = 'autoplay; fullscreen; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'no-referrer';
    frame.srcdoc = html;
    frame.addEventListener('load', () => {
      // The anthology has its own viewer. Keep plain in-page anchors inside
      // that document; its data-takibi-page links retain their navigation.
      const viewer = frame.contentDocument.getElementById('viewer');
      const bound = new WeakSet();
      const bindLocalAnchors = () => {
        const doc = viewer?.contentDocument;
        if (!doc || bound.has(doc)) return;
        bound.add(doc);
        doc.addEventListener('click', event => {
          const anchor = event.target.closest?.('a[href^="#"]');
          if (!anchor || anchor.hasAttribute('data-takibi-page')) return;
          const id = anchor.getAttribute('href').slice(1);
          const target = doc.getElementById(id);
          if (!target) return;
          event.preventDefault();
          target.scrollIntoView({ behavior:'smooth', block:'start' });
          target.focus({ preventScroll:true });
        });
      };
      viewer?.addEventListener('load', bindLocalAnchors);
      bindLocalAnchors();
      document.getElementById('invitation').hidden = true;
      document.title = 'Keshiki｜A Japanese Summer — 展示デモ';
    }, { once:true });
    document.body.append(frame);
  }
  openExhibition().catch(() => {
    status.textContent = '作品を開けませんでした。通信状態とURLを確認し、専用リンクやQRコードからもう一度開いてください。';
    retry.hidden = false;
  });
})();
