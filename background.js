// background worker: tab capture for element screenshots + relay POST to the local agent
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'capture' && sender.tab) {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl: dataUrl || null, error: chrome.runtime.lastError?.message || null });
    });
    return true; // async
  }
  if (msg && msg.type === 'relay' && msg.payload) {
    // save payload as a download; the relay watcher process picks it up
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(msg.payload));
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      const b64 = btoa(bin); // no unescape() here: not available in service workers
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      chrome.downloads.download({
        url: 'data:application/json;base64,' + b64,
        filename: 'picker-relay/picks_' + ts + '.json',
        conflictAction: 'uniquify', saveAs: false
      }, (id) => {
        if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        else sendResponse({ ok: !!id });
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true; // async
  }
});
