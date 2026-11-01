// Hermes Element Picker v3
// 🎯 button (top-right) toggles. Click element = pick; note box stays open while you type and
// you can click a different element to switch selection. Picks list in a panel below the
// button (remove ✕ per item, Copy all). Queue persists in localStorage['hermes_pick_queue'].
(() => {
  window.__hermesPickLog = window.__hermesPickLog || [];
  const log = (m) => { try { window.__hermesPickLog.push(m); } catch {} };
  if (window.__hermesPicker2) return;
  let on = false, outline = null, noteBox = null, pendingEl = null, noteInput = null;

  const Q = () => { try { return JSON.parse(localStorage.getItem('hermes_pick_queue') || '[]'); } catch { return []; } };
  const saveQ = (q) => localStorage.setItem('hermes_pick_queue', JSON.stringify(q));
  const pushQ = (item) => { const q = Q(); q.push(item); saveQ(q); };

  const cssPath = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el.parentElement && parts.length < 6) {
      let p = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string')
        p += '.' + el.className.trim().split(/\s+/).slice(0, 2).map(c => CSS.escape(c)).join('.');
      const sib = [...el.parentElement.children].indexOf(el) + 1;
      parts.unshift(`${p}:nth-child(${sib})`);
      el = el.parentElement;
    }
    return parts.join(' > ');
  };

  const fingerprint = (el) => ({
    url: location.href, time: new Date().toISOString(),
    selector: cssPath(el), tag: el.tagName.toLowerCase(),
    id: el.id || null, classes: el.className || null,
    text: (el.innerText || el.value || '').trim().slice(0, 200),
    type: el.getAttribute('type'), name: el.getAttribute('name'),
    href: el.getAttribute('href'), aria: el.getAttribute('aria-label'),
    rect: (({ x, y, width, height }) => ({ x, y, width, height }))(el.getBoundingClientRect())
  });

  // keep highlight pinned to pendingEl while the note box is open
  const pinOutline = () => {
    if (!pendingEl || !pendingEl.isConnected) { outline && outline.remove(); return; }
    const r = pendingEl.getBoundingClientRect();
    outline = outline || document.createElement('div');
    Object.assign(outline.style, { position: 'fixed', left: r.x + 'px', top: r.y + 'px',
      width: r.width + 'px', height: r.height + 'px', background: 'rgba(0,150,255,.15)',
      outline: '2px solid #0075ff', zIndex: 2147483647, pointerEvents: 'none' });
    document.documentElement.appendChild(outline);
  };
  document.addEventListener('scroll', () => { if (noteBox) pinOutline(); window.__hermesPickerPanel && window.__hermesPickerPanel(); }, true);

  const over = (e) => {
    if (!on) return;
    if (noteBox) return; // selection locked while typing; highlight stays
    if (e.target !== outline) { outline && outline.remove(); }
    const r = e.target.getBoundingClientRect();
    outline = outline || document.createElement('div');
    Object.assign(outline.style, { position: 'fixed', left: r.x + 'px', top: r.y + 'px',
      width: r.width + 'px', height: r.height + 'px', background: 'rgba(0,150,255,.15)',
      outline: '2px solid #0075ff', zIndex: 2147483647, pointerEvents: 'none' });
    document.documentElement.appendChild(outline);
  };

  const badge = (msg, sticky) => {
    let b = document.getElementById('hermes-picker-badge');
    b = b || document.createElement('div');
    b.id = 'hermes-picker-badge';
    Object.assign(b.style, { position: 'fixed', top: '8px', left: '50%', transform: 'translateX(-50%)',
      background: '#0075ff', color: '#fff', padding: '4px 14px', borderRadius: '12px',
      font: '12px sans-serif', zIndex: 2147483647 });
    b.textContent = 'Hermes picker (' + Q().length + ' queued): ' + msg;
    document.documentElement.appendChild(b);
    if (!sticky) setTimeout(() => b.remove(), 1500);
  };

  // picks panel, below the toggle button (top-right)
  const renderPanel = () => {
    let panel = document.getElementById('hermes-picker-panel');
    const q = Q();
    if (!q.length) { panel && panel.remove(); return; }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'hermes-picker-panel';
      Object.assign(panel.style, { position: 'fixed', top: '48px', right: '8px', zIndex: 2147483647,
        width: '280px', maxHeight: '50vh', overflowY: 'auto', background: '#fff', color: '#222',
        border: '2px solid #0075ff', borderRadius: '10px', padding: '8px',
        font: '12px sans-serif', boxShadow: '0 2px 12px rgba(0,0,0,.25)' });
      document.documentElement.appendChild(panel);
    }
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'font-weight:bold;margin-bottom:4px;';
    head.textContent = 'Picks (' + q.length + ')';
    panel.appendChild(head);
    q.forEach((it, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:4px;align-items:flex-start;margin-bottom:4px;';
      const label = document.createElement('span');
      label.style.cssText = 'flex:1;word-break:break-word;';
      label.textContent = (i + 1) + '. <' + it.tag + '> ' + (it.text || it.selector).slice(0, 60) + (it.note ? ' — "' + it.note + '"' : '');
      row.append(label);
      if (it.snap && it.snap.startsWith('data:image/')) {
        const img = document.createElement('img');
        img.src = it.snap;
        img.title = 'element screenshot';
        img.style.cssText = 'max-height:40px;max-width:70px;border:1px solid #ccc;border-radius:4px;cursor:zoom-in;display:block;margin-top:2px;';
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          const big = document.getElementById('hermes-picker-zoom');
          if (big) { big.remove(); return; }
          const z = document.createElement('img');
          z.id = 'hermes-picker-zoom';
          z.src = it.snap;
          Object.assign(z.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 2147483647, maxWidth: '90vw', maxHeight: '85vh', border: '3px solid #0075ff', borderRadius: '8px', cursor: 'zoom-out' });
          z.addEventListener('click', () => z.remove());
          document.documentElement.appendChild(z);
        });
        row.append(img);
      }
      const del = document.createElement('button');
      del.textContent = '✕';
      del.title = 'Remove this pick';
      del.style.cssText = 'border:none;cursor:pointer;background:#eee;border-radius:4px;padding:0 6px;';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = Q(); n.splice(i, 1); saveQ(n); renderPanel();
      });
      row.append(label, del);
      panel.appendChild(row);
    });
    const copy = document.createElement('button');
    copy.textContent = 'Copy all';
    copy.style.cssText = 'margin-top:2px;padding:3px 8px;border:none;border-radius:6px;cursor:pointer;background:#888;color:#fff;';
    copy.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(JSON.stringify(Q(), null, 1)).then(() => { copy.textContent = 'Copied!'; setTimeout(() => { renderPanel(); }, 1200); });
    });
    const send = document.createElement('button');
    send.textContent = '📤 Send to Penny';
    send.style.cssText = 'margin-top:2px;padding:3px 8px;border:none;border-radius:6px;cursor:pointer;background:#0075ff;color:#fff;';
    send.addEventListener('click', (e) => {
      e.stopPropagation();
      const picks = Q();
      if (!picks.length) { send.textContent = 'Nothing picked'; setTimeout(renderPanel, 1200); return; }
      send.textContent = 'Sending…';
      const fail = () => { send.textContent = 'Relay down — use Copy all'; setTimeout(renderPanel, 2500); };
      const ok = () => { send.textContent = 'Sent! ✅'; localStorage.removeItem('hermes_pick_queue'); setTimeout(renderPanel, 1500); };
      if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        // post via background worker (avoids page mixed-content/PNA restrictions)
        try { const p = chrome.runtime.sendMessage({ type: 'relay', payload: { url: location.href, time: new Date().toISOString(), picks: picks } });
          p.then((res) => {
            if (!res) { send.textContent = 'Relay nores — use Copy all'; setTimeout(renderPanel, 4000); return; }
            if (res.ok) ok(); else { send.textContent = 'Relay err: ' + (res.error || '?'); setTimeout(renderPanel, 6000); }
          }).catch(e => { send.textContent = 'Relay ERR ' + String(e && e.message).slice(0, 60); setTimeout(renderPanel, 8000); });
        }
        catch (err) { fail(); }
      } else {
        fetch('http://127.0.0.1:8765/pick', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: location.href, time: new Date().toISOString(), picks: picks })
        }).then(r => r.ok ? ok() : fail()).catch(fail);
      }
    });
    panel.append(copy, send);
  };
  window.__hermesPickerPanel = renderPanel;

  const askNote = (el) => {
    pendingEl = el;
    pinOutline();
    if (noteBox) return; // switching selection: keep box and typed text
    noteBox = document.createElement('div');
    Object.assign(noteBox.style, { position: 'fixed', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
      background: '#fff', border: '2px solid #0075ff', borderRadius: '10px', padding: '8px',
      zIndex: 2147483647, display: 'flex', gap: '6px', font: '13px sans-serif', boxShadow: '0 2px 12px rgba(0,0,0,.25)' });
    noteInput = document.createElement('input');
    noteInput.placeholder = 'feedback for this element (Enter = save, Esc = skip)';
    noteInput.style.cssText = 'width:340px;padding:4px 8px;border:1px solid #ccc;border-radius:6px;';
    const ok = document.createElement('button'); ok.textContent = 'Save';
    const skip = document.createElement('button'); skip.textContent = 'Skip';
    ok.style.cssText = 'padding:4px 10px;border-radius:6px;border:none;cursor:pointer;background:#0075ff;color:#fff;';
    skip.style.cssText = 'padding:4px 10px;border-radius:6px;border:none;cursor:pointer;';
    const finish = (note) => {
      const item = fingerprint(pendingEl); item.note = note || null;
      // auto element screenshot: capture tab, crop to rect
      const cropAndPush = (dataUrl) => {
        try {
          if (dataUrl) {
            const img = new Image();
            img.onload = () => {
              try {
                const dpr = img.width / window.innerWidth;
                const c = document.createElement('canvas');
                const pad = 2;
                c.width = Math.round((item.rect.width + pad * 2) * dpr);
                c.height = Math.round((item.rect.height + pad * 2) * dpr);
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, (item.rect.x - pad) * dpr, (item.rect.y - pad) * dpr,
                  item.rect.width * dpr, item.rect.height * dpr, pad * dpr, pad * dpr,
                  item.rect.width * dpr, item.rect.height * dpr);
                item.snap = c.toDataURL('image/png');
              } catch (err) { log('crop ERR ' + err.message); }
              pushQ(item); log('queued #' + Q().length);
              badge('saved #' + Q().length + ' — keep clicking or Esc to finish');
              noteBox.remove(); noteBox = null; noteInput = null; pendingEl = null;
              outline && outline.remove();
              renderPanel();
            };
            img.onerror = () => { item.snap = null; cropAndPush(null); };
            img.src = dataUrl;
            return;
          }
        } catch (err) { log('snap ERR ' + err.message); }
        pushQ(item); log('queued #' + Q().length);
        badge('saved #' + Q().length + ' — keep clicking or Esc to finish');
        noteBox.remove(); noteBox = null; noteInput = null; pendingEl = null;
        outline && outline.remove();
        renderPanel();
      };
      if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        try { chrome.runtime.sendMessage({ type: 'capture' }, (res) => cropAndPush(res && res.dataUrl)); }
        catch (err) { cropAndPush(null); }
      } else cropAndPush(null); // non-extension (injected) context: no capture
    };
    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(noteInput.value.trim());
      if (e.key === 'Escape') finish(null);
      e.stopPropagation();
    });
    ok.addEventListener('click', () => finish(noteInput.value.trim()));
    skip.addEventListener('click', () => finish(null));
    noteBox.append(noteInput, ok, skip);
    document.documentElement.appendChild(noteBox);
    noteInput.focus();
  };

  const isPickerUI = (el) => el && (el.id === 'hermes-picker-btn' || el.id === 'hermes-picker-panel' || (noteBox && el.closest && el.closest('#hermes-picker-notebox')) || (panel && el.closest && panel === el));

  const click = (e) => {
    if (e.target && (e.target.id === 'hermes-picker-btn' || e.target.closest('#hermes-picker-panel'))) return;
    if (!on) return;
    if (noteBox) { // already picking: switch selection to the newly clicked element
      if (noteBox.contains(e.target) || e.target === outline) return;
      pendingEl = e.target; pinOutline();
      e.preventDefault(); e.stopPropagation();
      return;
    }
    log('pick tag=' + (e.target && e.target.tagName));
    try { askNote(e.target); } catch (err) { log('ERR ' + err.message); }
    e.preventDefault(); e.stopPropagation();
  };

  const toggle = (state) => {
    on = state ?? !on;
    if (!on && noteBox) { noteBox.remove(); noteBox = null; noteInput = null; pendingEl = null; outline && outline.remove(); }
    on ? badge('ON — click elements, Esc closes', true)
       : (badge('off — ' + Q().length + ' queued'), setTimeout(() => document.getElementById('hermes-picker-badge')?.remove(), 1500));
  };

  window.__hermesPicker2 = {
    toggle, isOn: () => on,
    queue: Q, clear: () => { localStorage.removeItem('hermes_pick_queue'); renderPanel(); },
    last: () => Q()[Q().length - 1] || null
  };

  // always-visible ON/OFF button (top-right)
  let btn = document.getElementById('hermes-picker-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'hermes-picker-btn';
    Object.assign(btn.style, { position: 'fixed', top: '8px', right: '8px', zIndex: 2147483647,
      padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      font: '12px sans-serif', background: '#888', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.3)' });
    btn.textContent = '🎯 Picker: OFF';
    document.documentElement.appendChild(btn);
  }
  const syncBtn = () => { btn.textContent = '🎯 Picker: ' + (on ? 'ON' : 'OFF'); btn.style.background = on ? '#0075ff' : '#888'; };
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); syncBtn(); });

  window.addEventListener('mousemove', over, true);
  window.addEventListener('click', click, true);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.altKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); toggle(); syncBtn(); }
    if (e.key === 'Escape' && on && !noteBox) { toggle(false); syncBtn(); }
  }, true);
})();
