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

# Step 3: Click the picker button
run_js("document.querySelector('button#repository-menu-list-button')?.click()", 2)
time.sleep(1)

# Step 5: Type into the search
run_js("""
const el = document.querySelector('input#repository-menu-list-filter');
el.focus();
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'skipvid');
el.dispatchEvent(new Event('input',{bubbles:true}));
""", 3)
time.sleep(1.5)

# Step 7: Dump everything visible in the dropdown/panel area
result = run_js("""JSON.stringify([...document.querySelectorAll('[role="option"], [role="listbox"], [role="listitem"], li, .ActionListItem')].filter(el => el.offsetParent !== null).map(el => ({
  tag: el.tagName,
  id: el.id||null,
  role: el.getAttribute('role'),
  ariaSelected: el.getAttribute('aria-selected'),
  dataValue: el.getAttribute('data-value'),
  text: el.textContent?.trim().substring(0,80),
  class: el.className?.substring(0,100)
})))""", 4)

ws.close()
data = json.loads(result['result']['result']['value'])
for el in data:
    print(json.dumps(el))
