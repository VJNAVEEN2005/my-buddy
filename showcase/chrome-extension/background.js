// Connects to the My Buddy sidecar on this computer and runs its commands in Chrome tabs.
// The sidecar only accepts this extension's origin (its ID is fixed by the key in manifest.json).
const BRIDGE = 'ws://127.0.0.1:47821';
let ws = null;

function connect() {
  if (ws && ws.readyState <= 1) return;
  ws = new WebSocket(BRIDGE);
  ws.onmessage = async (e) => {
    const { id, cmd, args } = JSON.parse(e.data);
    try {
      ws.send(JSON.stringify({ id, result: await handlers[cmd](args ?? {}) }));
    } catch (err) {
      ws.send(JSON.stringify({ id, error: String(err?.message ?? err) }));
    }
  };
  ws.onclose = () => { ws = null; };
}

// Service workers sleep after 30 s idle; the alarm wakes this one to reconnect, and the ping keeps it awake.
chrome.alarms.create('bridge', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => { connect(); if (ws?.readyState === 1) ws.send('{"ping":1}'); });
connect();

const loaded = (tabId) => new Promise((resolve) => {
  const done = (id, info) => { if (id === tabId && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(done); resolve(); } };
  chrome.tabs.onUpdated.addListener(done);
  setTimeout(() => { chrome.tabs.onUpdated.removeListener(done); resolve(); }, 20_000);
});

async function inPage(tab, func, arg) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId: tab }, func, args: [arg ?? null] });
  if (r?.result?.error) throw new Error(r.result.error);
  return r?.result;
}

const handlers = {
  tabs: async () => (await chrome.tabs.query({})).map((t) => ({ tab: t.id, title: t.title, url: t.url, active: t.active })),
  open: async ({ url, tab }) => {
    const t = tab ? await chrome.tabs.update(tab, { url }) : await chrome.tabs.create({ url, active: false });
    await loaded(t.id);
    return { tab: t.id };
  },
  read: ({ tab }) => inPage(tab, readPage),
  step: async ({ tab, step }) => {
    const r = await inPage(tab, doStep, step);
    if (step.do === 'click' || step.do === 'key') await new Promise((res) => setTimeout(res, 1200));
    return r;
  },
};

// Runs inside the page: numbers every visible control (data-buddy-ref) and returns them with the page text.
function readPage() {
  document.querySelectorAll('[data-buddy-ref]').forEach((e) => e.removeAttribute('data-buddy-ref'));
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=option]';
  const controls = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    const ref = controls.length + 1;
    el.setAttribute('data-buddy-ref', ref);
    el.setAttribute('data-buddy-text', (el.innerText || el.value || '').trim());
    const field = el.matches('input,select,textarea') && !['submit', 'button'].includes(el.type);
    const label = (el.getAttribute('aria-label') || (field ? el.labels?.[0]?.innerText || el.placeholder || el.name : el.innerText || el.value) || el.title || '')
      .trim().replace(/\s+/g, ' ').slice(0, 80);
    controls.push({ ref, kind: el.getAttribute('role') || el.tagName.toLowerCase(), type: el.type || '', label });
    if (controls.length >= 300) break;
  }
  return { title: document.title, url: location.href, text: document.body.innerText.slice(0, 8000), controls };
}

// Runs inside the page: one click, fill, choose or key press on a control from the last readPage.
function doStep(step) {
  const el = step.ref ? document.querySelector(`[data-buddy-ref="${step.ref}"]`) : document.activeElement;
  if (!el) return { error: `Control ${step.ref} is not on the page any more. Read the page again.` };
  // The yes (or no need for one) was for the words read earlier; a button whose words changed since is a different button.
  if (step.do === 'click' && (el.innerText || el.value || '').trim() !== el.getAttribute('data-buddy-text')) return { error: 'That control changed since the page was read. Read the page again.' };
  if (step.do === 'click') { el.scrollIntoView({ block: 'center' }); el.click(); return 'clicked'; }
  if (step.do === 'fill' || step.do === 'choose') {
    if (el.type === 'password' || /^cc-/.test(el.autocomplete || '')) return { error: 'That is a password or card field. The user must type it themselves.' };
    el.focus();
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const value = step.do === 'choose' ? [...el.options].find((o) => o.text.trim() === step.text || o.value === step.text)?.value : step.text;
    if (value == null) return { error: `No option "${step.text}" in that list.` };
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'done';
  }
  if (step.do === 'key') {
    for (const type of ['keydown', 'keyup']) el.dispatchEvent(new KeyboardEvent(type, { key: step.key, bubbles: true }));
    if (step.key === 'Enter' && el.form) el.form.requestSubmit();
    return 'pressed';
  }
  return { error: `Unknown step ${step.do}` };
}
