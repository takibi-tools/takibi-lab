(() => {
  'use strict';
  window.addEventListener('hashchange', () => location.reload());
  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  retry.addEventListener('click', () => location.reload());
  const token = new URLSearchParams(location.hash.slice(1)).get('k');
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    status.textContent = 'このページは、展示会の専用URLまたはQRコードから開けます。';
    return;
  }
  if (!window.crypto?.subtle) {
    status.textContent = 'このブラウザーでは開けません。Safari、Chrome、Edgeなどで専用リンクを開いてください。';
    return;
  }
  async function openEntry() {
    status.textContent = '展示会の入口を準備しています。';
    const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
    const response = await fetch('./portal.bin', { credentials:'omit', referrerPolicy:'no-referrer' });
    if (!response.ok) throw new Error('Unable to load entry');
    const sealed = new Uint8Array(await response.arrayBuffer());
    if (sealed.length < 29) throw new Error('Invalid encrypted content');
    const clear = await crypto.subtle.decrypt({ name:'AES-GCM', iv:sealed.slice(0,12), tagLength:128 }, key, sealed.slice(12));
    const frame = document.createElement('iframe');
    frame.id = 'entry';
    frame.title = 'どちらをつくる？ KESHIKI / Parfait Atelier';
    frame.referrerPolicy = 'no-referrer';
    frame.srcdoc = new TextDecoder('utf-8', { fatal:true }).decode(clear);
    frame.addEventListener('load', () => {
      document.getElementById('invitation').hidden = true;
      document.title = 'どちらをつくる？｜TAKIBI lab';
    }, { once:true });
    document.body.append(frame);
  }
  openEntry().catch(() => {
    status.textContent = '入口を開けませんでした。通信状態とURLを確認し、専用リンクやQRコードからもう一度開いてください。';
    retry.hidden = false;
  });
})();
