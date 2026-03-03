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

def dump_state(msg_id, label):
    url = run_js("window.location.href", msg_id)
    print(f"\n=== {label} ===")
    print("URL:", url['result']['result'].get('value'))
    els = run_js("""JSON.stringify([...document.querySelectorAll('button, h1, h2, .flash, [class*="token"], .js-newly-created-token, input[type="text"][readonly], code')].filter(e => e.offsetParent !== null || e.offsetWidth > 0).map(e => ({tag:e.tagName, text:e.textContent.trim().substring(0,80), class:e.className.substring(0,80), id:e.id||null, type:e.type||null})))""", msg_id+1)
    if els['result']['result'].get('value'):
        for el in json.loads(els['result']['result']['value']):
            print(json.dumps(el))

# Step 1: Navigate
print("Step 1: Navigating to token page...")
run_js("window.location.href = 'https://github.com/settings/personal-access-tokens/new'", 1)
time.sleep(3)
dump_state(2, "After navigation")

# Step 2: Fill token name
print("\nStep 2: Filling token name...")
run_js("""
const inp = document.querySelector('input#user_programmatic_access_name');
inp.value = 'pushgit-test-DELETE';
inp.dispatchEvent(new Event('input', {bubbles:true}));
""", 10)
time.sleep(0.5)

# Step 3: Click radio
print("Step 3: Clicking 'Only select repositories' radio...")
run_js("document.querySelector('input#install_target_selected').click()", 11)
time.sleep(1)

# Step 4: Click picker button
print("Step 4: Clicking 'Select repositories' button...")
run_js("document.querySelector('button#repository-menu-list-button').click()", 12)
time.sleep(1)

# Step 5: Focus and type via CDP Input.insertText
print("Step 5: Focusing search input and typing 'pushgit'...")
run_js("document.querySelector('input#repository-menu-list-filter').focus()", 13)
time.sleep(0.3)
r = send(14, "Input.insertText", {"text": "pushgit"})
print("Input.insertText result:", r)
time.sleep(2)

# Dump what appeared in the dialog
print("\nRepo search results:")
items = run_js("""JSON.stringify([...document.querySelectorAll('dialog button[role="option"]')].map(el => ({
  id: el.id,
  dataValue: el.getAttribute('data-value'),
  text: el.textContent.trim().substring(0,80)
})))""", 15)
if items['result']['result'].get('value'):
    for el in json.loads(items['result']['result']['value']):
        print(json.dumps(el))

# Step 6: Click first result
print("\nStep 6: Clicking first repo result...")
r = run_js("document.querySelector('#repository-menu-list button[role=\"option\"]').click()", 16)
print("Click result:", r['result']['result'])
time.sleep(1)

# Step 7: Close dialog
print("Step 7: Closing dialog...")
r = run_js("""document.querySelector('dialog button[aria-label="Close"], dialog .Overlay-closeButton')?.click()""", 17)
print("Close result:", r['result']['result'])
time.sleep(0.5)

# Check what permissions inputs exist
print("\nChecking permissions inputs...")
perms = run_js("""JSON.stringify([...document.querySelectorAll('select[name*="permissions"], input[name*="permissions"]')].map(el => ({
  tag: el.tagName, name: el.name, type: el.type||null, value: el.value
})))""", 18)
if perms['result']['result'].get('value'):
    data = json.loads(perms['result']['result']['value'])
    print(f"Found {len(data)} permission inputs")
    for el in data[:5]:
        print(json.dumps(el))

# Step 8: Set contents permission
print("\nStep 8: Setting contents permission to write...")
r = run_js("""
const sel = document.querySelector('select[name="integration[default_permissions][contents]"]');
if (sel) {
  sel.value = 'write';
  sel.dispatchEvent(new Event('change', {bubbles:true}));
  'set to write';
} else { 'selector not found'; }
""", 19)
print("Permission set:", r['result']['result'].get('value'))

# Step 9: Click Generate token (first time)
print("\nStep 9: Clicking Generate token...")
r = run_js("document.querySelector('button.js-integrations-install-form-submit').click()", 20)
print("Click result:", r['result']['result'])
time.sleep(3)

dump_state(21, "After first Generate token click")

# Step 10: Check if there's another Generate token button (confirmation page)
another = run_js("""JSON.stringify([...document.querySelectorAll('button, input[type="submit"]')].filter(e => e.offsetParent !== null && /generate/i.test(e.textContent + e.value)).map(e => ({tag:e.tagName, text:(e.textContent||e.value).trim().substring(0,80), class:e.className.substring(0,80), id:e.id||null})))""", 30)
if another['result']['result'].get('value'):
    btns = json.loads(another['result']['result']['value'])
    print(f"\nFound {len(btns)} more 'generate' button(s):")
    for b in btns:
        print(json.dumps(b))

    if btns:
        print("\nStep 11: Clicking second Generate token...")
        btn_id = btns[0]["id"]
        click_js = f"document.querySelector('button#{btn_id}')?.click() || document.querySelector('button.js-integrations-install-form-submit')?.click()" if btn_id else "document.querySelector('button.js-integrations-install-form-submit')?.click()"
        run_js(click_js, 31)
        time.sleep(3)
        dump_state(32, "After second Generate token click")

ws.close()
print("\nDone.")
