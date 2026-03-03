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

msg_id = [0]
def next_id():
    msg_id[0] += 1
    return msg_id[0]

def send(method, params=None):
    mid = next_id()
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get('id') == mid:
            return r

def js(expr):
    r = send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": False})
    result = r.get('result', {}).get('result', {})
    return result.get('value')

def dump_state(label):
    url = js("window.location.href")
    print(f"\n=== {label} ===")
    print("URL:", url)
    raw = js("""JSON.stringify([...document.querySelectorAll('button, h1, h2, .flash, [class*="flash"], [class*="token"], [class*="Token"], input[readonly], code, .js-newly-created-token')].filter(e => e.offsetParent !== null || e.offsetWidth > 0).map(e => ({tag:e.tagName, text:e.textContent.trim().substring(0,100), class:e.className.substring(0,80), id:e.id||null, type:e.getAttribute('type'), value:(e.value||'').substring(0,60)})))""")
    if raw:
        for el in json.loads(raw):
            print(json.dumps(el))

# Step 1: Navigate
print("\nStep 1: Navigating...")
js("window.location.href = 'https://github.com/settings/personal-access-tokens/new'")
time.sleep(3)
print("URL now:", js("window.location.href"))

# Step 2: Fill name using native setter
print("\nStep 2: Filling token name...")
result = js("""
(function() {
  const inp = document.querySelector('input#user_programmatic_access_name');
  if (!inp) return 'NOT FOUND';
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(inp, 'pushgit-test-DELETE');
  inp.dispatchEvent(new Event('input', {bubbles: true}));
  inp.dispatchEvent(new Event('change', {bubbles: true}));
  return 'value: ' + inp.value;
})()
""")
print("Name fill result:", result)

# Step 3: Click radio
print("\nStep 3: Clicking radio...")
result = js("(function(){ const el = document.querySelector('input#install_target_selected'); if(!el) return 'NOT FOUND'; el.click(); return 'clicked, checked='+el.checked; })()")
print("Radio result:", result)
time.sleep(1)

# Step 4: Click picker button
print("\nStep 4: Clicking picker button...")
result = js("(function(){ const el = document.querySelector('button#repository-menu-list-button'); if(!el) return 'NOT FOUND'; el.click(); return 'clicked: '+el.textContent.trim().substring(0,40); })()")
print("Picker result:", result)
time.sleep(1)

# Step 5: Focus filter
print("\nStep 5: Focusing filter input...")
result = js("(function(){ const el = document.querySelector('input#repository-menu-list-filter'); if(!el) return 'NOT FOUND'; el.focus(); return 'focused, visible='+(el.offsetParent!==null); })()")
print("Focus result:", result)
time.sleep(0.3)

# Step 6: CDP Input.insertText
print("\nStep 6: Typing 'pushgit' via CDP Input.insertText...")
r = send("Input.insertText", {"text": "pushgit"})
print("insertText result:", r)
time.sleep(2)

# Check what appeared
print("Filter value now:", js("document.querySelector('input#repository-menu-list-filter')?.value"))
options_raw = js("""JSON.stringify([...document.querySelectorAll('#repository-menu-list button[role="option"]')].map(el => ({
  id: el.id, dataValue: el.getAttribute('data-value'),
  text: el.textContent.trim().substring(0,80), tabindex: el.getAttribute('tabindex')
})))""")
print("Options found:", options_raw)

# Step 7: Click first option
print("\nStep 7: Clicking first option...")
result = js("""(function(){
  const el = document.querySelector('#repository-menu-list button[role="option"]');
  if(!el) return 'NOT FOUND';
  el.click();
  return 'clicked: '+el.textContent.trim().substring(0,60);
})()""")
print("Option click result:", result)
time.sleep(0.5)

# Step 8: Close dialog
print("\nStep 8: Closing dialog...")
result = js("""(function(){
  const el = document.querySelector('button.close-button.Overlay-closeButton');
  if(!el) return 'NOT FOUND - trying aria-label';
  el.click();
  return 'clicked close button';
})()""")
print("Close result:", result)
time.sleep(1)

# Step 9: Verify dialog closed
print("\nStep 9: Verifying dialog closed...")
dialog_open = js("!!document.querySelector('#repository-menu-list dialog')?.open")
picker_btn_text = js("document.querySelector('button#repository-menu-list-button')?.textContent.trim()")
print("Dialog open:", dialog_open)
print("Picker button text:", picker_btn_text)

# Also check no overlay visible
overlay_visible = js("!!document.querySelector('.Overlay-backdrop, dialog[open]')")
print("Any open dialog/overlay:", overlay_visible)

# Step 10: Set permissions (hidden input)
print("\nStep 10: Setting contents permission...")
result = js("""(function(){
  const inp = document.querySelector('input[name="integration[default_permissions][contents]"]');
  if(!inp) return 'NOT FOUND';
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(inp, 'write');
  inp.dispatchEvent(new Event('input', {bubbles:true}));
  inp.dispatchEvent(new Event('change', {bubbles:true}));
  return 'value now: '+inp.value;
})()""")
print("Permission result:", result)

# Step 11: Click Generate token
print("\nStep 11: Clicking Generate token (first time)...")
result = js("""(function(){
  const el = document.querySelector('button.js-integrations-install-form-submit');
  if(!el) return 'NOT FOUND';
  el.click();
  return 'clicked: '+el.textContent.trim();
})()""")
print("Generate result:", result)
time.sleep(3)

dump_state("After first Generate token click")

# Step 12: Check for second Generate token button
print("\nStep 12: Checking for second Generate token button...")
more_generate = js("""JSON.stringify([...document.querySelectorAll('button, input[type="submit"]')].filter(e => (e.offsetParent !== null || e.offsetWidth > 0) && /generate/i.test(e.textContent + (e.value||''))).map(e => ({tag:e.tagName, text:(e.textContent||e.value).trim().substring(0,80), class:e.className.substring(0,80), id:e.id||null})))""")
if more_generate:
    btns = json.loads(more_generate)
    print(f"Found {len(btns)} more generate button(s):", more_generate)
    if btns:
        print("\nStep 13: Clicking second Generate token...")
        result = js("""(function(){
          const el = document.querySelector('button.js-integrations-install-form-submit');
          if(!el) return 'NOT FOUND';
          el.click();
          return 'clicked: '+el.textContent.trim();
        })()""")
        print("Second generate result:", result)
        time.sleep(3)
        dump_state("After second Generate token click")
else:
    print("No more generate buttons.")

# Final: look specifically for token value display
print("\nFinal: searching for token value...")
token_search = js("""JSON.stringify([...document.querySelectorAll('input[type="text"], input[readonly], code, [class*="token"], [class*="Token"], .js-newly-created-token, [data-testid*="token"]')].filter(e => e.offsetParent !== null || e.offsetWidth > 0).map(e => ({tag:e.tagName, class:e.className.substring(0,80), id:e.id||null, value:(e.value||e.textContent||'').trim().substring(0,100)})))""")
print("Token elements:", token_search)

ws.close()
print("\nDone.")
