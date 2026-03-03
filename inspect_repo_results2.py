import json, time, urllib.request
import websocket

tabs = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
github_tabs = [t for t in tabs if 'github.com' in t.get('url','') and 'personal-access-tokens' in t.get('url','')]
if not github_tabs:
    github_tabs = [t for t in tabs if 'github.com' in t.get('url','')]
tab = github_tabs[0]
print("Using tab:", tab['url'])

ws = websocket.WebSocket()
ws.connect(tab['webSocketDebuggerUrl'], suppress_origin=True)

def run_js(js, msg_id):
    ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": {"expression": js, "returnByValue": True, "awaitPromise": False}}))
    while True:
        r = json.loads(ws.recv())
        if r.get('id') == msg_id:
            return r

# Step 1: Click the radio
run_js("document.querySelector('input#install_target_selected')?.click()", 1)
time.sleep(1)

# Step 2: Click the picker button
run_js("document.querySelector('button#repository-menu-list-button')?.click()", 2)
time.sleep(1)

# Check if the search input exists and panel is open
check = run_js("""JSON.stringify({
  filterExists: !!document.querySelector('input#repository-menu-list-filter'),
  filterVisible: (function() { const el = document.querySelector('input#repository-menu-list-filter'); return el ? el.offsetParent !== null : false; })(),
  panelHTML: document.querySelector('[id*="repository-menu"]')?.outerHTML?.substring(0, 300) || 'not found'
})""", 3)
print("Panel check:", check['result']['result']['value'])
time.sleep(0.5)

# Step 3: Type using keyboard simulation - character by character
run_js("""
const el = document.querySelector('input#repository-menu-list-filter');
if (el) {
  el.focus();
  // Clear first
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'');
  el.dispatchEvent(new Event('input',{bubbles:true}));
}
""", 4)
time.sleep(0.3)

# Type each character with full keyboard events
for i, char in enumerate(['s','k','i','p','v','i','d'], start=10):
    run_js(f"""
(function() {{
  const el = document.querySelector('input#repository-menu-list-filter');
  if (!el) return;
  el.focus();
  const cur = el.value;
  el.dispatchEvent(new KeyboardEvent('keydown', {{key: '{char}', code: 'Key{char.upper()}', bubbles: true}}));
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, cur + '{char}');
  el.dispatchEvent(new KeyboardEvent('keypress', {{key: '{char}', code: 'Key{char.upper()}', bubbles: true}}));
  el.dispatchEvent(new Event('input', {{bubbles: true}}));
  el.dispatchEvent(new KeyboardEvent('keyup', {{key: '{char}', code: 'Key{char.upper()}', bubbles: true}}));
  el.dispatchEvent(new Event('change', {{bubbles: true}}));
}})();
""", i)
    time.sleep(0.1)

time.sleep(2)

# Dump the full panel contents including any loaded results
result = run_js("""JSON.stringify([...document.querySelectorAll('[role="option"], [role="listbox"], [role="listitem"], li, .ActionListItem, [class*="SelectPanel"], [class*="Overlay"]')].filter(el => el.offsetParent !== null).map(el => ({
  tag: el.tagName,
  id: el.id||null,
  role: el.getAttribute('role'),
  ariaSelected: el.getAttribute('aria-selected'),
  dataValue: el.getAttribute('data-value'),
  text: el.textContent?.trim().substring(0,80),
  class: el.className?.substring(0,100)
})))""", 20)

ws.close()
data = json.loads(result['result']['result']['value'])
for el in data:
    print(json.dumps(el))
