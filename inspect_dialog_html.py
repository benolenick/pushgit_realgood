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

def send(msg_id, method, params=None):
    ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get('id') == msg_id:
            return r

def run_js(js, msg_id):
    return send(msg_id, "Runtime.evaluate", {"expression": js, "returnByValue": True, "awaitPromise": False})

# Step 1: Navigate
run_js("window.location.href = 'https://github.com/settings/personal-access-tokens/new'", 1)
time.sleep(3)

# Step 2: Click radio
run_js("document.querySelector('input#install_target_selected')?.click()", 2)
time.sleep(1)

# Step 3: Click picker button
run_js("document.querySelector('button#repository-menu-list-button')?.click()", 3)
time.sleep(1)

# Step 4a: Focus the search input
run_js("document.querySelector('input#repository-menu-list-filter')?.focus()", 4)
time.sleep(0.3)

# Step 4b: Use CDP Input.insertText for real keystrokes
result = send(10, "Input.insertText", {"text": "skipvid"})
print("Input.insertText result:", result)
time.sleep(2)

# Step 5a: Dump dialog innerHTML
dialog_html = run_js("document.querySelector('dialog')?.innerHTML", 11)
val = dialog_html['result']['result'].get('value', '')
print("\n=== dialog innerHTML (first 5000 chars) ===")
print(val[:5000])

# Step 5b: Dump all li and role=option inside dialog
items = run_js("""JSON.stringify([...document.querySelectorAll('dialog li, dialog [role="option"]')].map(el => ({
  outerHTML: el.outerHTML.substring(0, 300),
  text: el.textContent?.trim().substring(0, 100),
  classes: el.className,
  role: el.getAttribute('role'),
  id: el.id
})))""", 12)

ws.close()
print("\n=== dialog li / role=option items ===")
if items['result']['result'].get('value'):
    data = json.loads(items['result']['result']['value'])
    for el in data:
        print(json.dumps(el))
else:
    print("No value returned:", items)
