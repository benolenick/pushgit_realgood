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

# Click the "Select repositories" button
run_js("document.querySelector('#repository-menu-list-button')?.click()", 1)
time.sleep(1.5)

# Dump visible inputs and interactive elements
result = run_js("""JSON.stringify([...document.querySelectorAll('input, [role="option"], [role="listbox"], [role="combobox"], dialog, [data-testid]')].filter(el => el.offsetParent !== null).map(el => ({tag:el.tagName,id:el.id||null,name:el.name||null,type:el.type||null,role:el.getAttribute('role'),placeholder:el.placeholder||null,ariaLabel:el.getAttribute('aria-label'),text:el.textContent?.trim().substring(0,80)||null,class:el.className?.substring(0,80)||null})))""", 2)

ws.close()
data = json.loads(result['result']['result']['value'])
for el in data:
    print(json.dumps(el))
