// Auto-fills GitHub's fine-grained token creation form.

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function reactSet(el, value) {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value); else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function showBanner(msg, color = '#1f6feb') {
  document.getElementById('pushgit-banner')?.remove();
  const b = document.createElement('div');
  b.id = 'pushgit-banner';
  Object.assign(b.style, {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '99999',
    background: color, color: 'white', padding: '9px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });
  b.innerHTML = `<strong>⬆ PushGit</strong> &mdash; ${msg}
    <button style="margin-left:auto;background:rgba(255,255,255,0.15);border:1px solid
    rgba(255,255,255,0.3);color:white;border-radius:4px;padding:3px 10px;cursor:pointer;
    font-size:12px" onclick="this.parentNode.remove()">✕</button>`;
  document.body.prepend(b);
}

// Wait for a visible element matching selector to appear.
async function waitFor(selector, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const el of document.querySelectorAll(selector)) {
      if (el.offsetParent !== null || el.offsetWidth > 0) return el;
    }
    await sleep(200);
  }
  return null;
}

// Wait for a NEW visible input to appear that wasn't there before.
async function waitForNewVisibleInput(knownInputs, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const el of document.querySelectorAll('input[type="text"], input:not([type])')) {
      if (!knownInputs.has(el) && (el.offsetParent !== null || el.offsetWidth > 0)) {
        return el;
      }
    }
    await sleep(200);
  }
  return null;
}

// Find select whose nearest table row / container has text matching label.
function findSelectByLabel(labelText) {
  for (const sel of document.querySelectorAll('select')) {
    const row = sel.closest('tr') || sel.closest('[class*="row"]') || sel.parentElement?.parentElement;
    if (row && row.textContent.includes(labelText)) return sel;
    // Also check aria-label on the select itself
    const aria = sel.getAttribute('aria-label') || '';
    if (aria.toLowerCase().includes(labelText.toLowerCase())) return sel;
  }
  return null;
}

// Click a button by matching its visible text.
function clickButtonByText(text) {
  for (const btn of document.querySelectorAll('button, input[type="submit"]')) {
    if (btn.textContent.trim() === text || btn.value === text) {
      btn.click();
      return true;
    }
  }
  return false;
}

async function fillForm(repo, expiry) {
  const [, repoName] = repo.split('/');
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Token name ────────────────────────────────────────────────────────
  showBanner(`Filling token name…`);
  const nameEl = await waitFor('#token_name, input[name="token_name"]', 5000);
  if (nameEl) {
    reactSet(nameEl, `push-${repoName}-${today}`);
    await sleep(200);
  }

  // ── 2. Expiration ────────────────────────────────────────────────────────
  // GitHub uses a native <select> with numeric day values.
  const expiryEl = document.querySelector('select[name="expiration"], select[id*="expiration"]');
  if (expiryEl) {
    const opt = Array.from(expiryEl.options).find(
      o => o.value === expiry || o.value === String(expiry) || o.text.startsWith(expiry + ' ')
    );
    if (opt) reactSet(expiryEl, opt.value);
    await sleep(200);
  }

  // ── 3. "Only select repositories" radio ──────────────────────────────────
  showBanner(`Selecting repository scope…`);
  await sleep(400);

  // Snapshot existing visible inputs before clicking the radio.
  const inputsBefore = new Set(document.querySelectorAll('input[type="text"], input:not([type])'));

  // Find the radio by checking associated label text.
  let clicked = false;
  for (const input of document.querySelectorAll('input[type="radio"]')) {
    const label =
      input.closest('label') ||
      document.querySelector(`label[for="${input.id}"]`);
    const text = label?.textContent || '';
    if (text.includes('Only select') || text.includes('Selected repositories')) {
      if (!input.checked) input.click();
      clicked = true;
      break;
    }
  }

  // Also try clicking a visible button/label that says "Only select repositories"
  if (!clicked) {
    for (const el of document.querySelectorAll('label, [role="radio"]')) {
      if (el.textContent.includes('Only select') || el.textContent.includes('Selected repositories')) {
        el.click();
        clicked = true;
        break;
      }
    }
  }

  // ── 4. Wait for & fill repo search ───────────────────────────────────────
  showBanner(`Waiting for repository search…`);
  await sleep(500);

  // After clicking the radio a search input (or a button to open a picker) should appear.
  // Strategy A: a new text input appeared
  let searchEl = await waitForNewVisibleInput(inputsBefore, 5000);

  // Strategy B: look by placeholder/aria-label
  if (!searchEl) {
    searchEl = await waitFor(
      'input[placeholder*="Search"], input[aria-label*="Search repositories"], ' +
      'input[aria-label*="repository"], input[placeholder*="repository"]',
      3000
    );
  }

  // Strategy C: GitHub sometimes shows a "Select repositories" button that opens a dialog
  if (!searchEl) {
    const pickerBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent.includes('Select repositories') || b.textContent.includes('Choose repositories')
    );
    if (pickerBtn) {
      pickerBtn.click();
      await sleep(800);
      searchEl = await waitFor(
        'input[placeholder*="Search"], input[aria-label*="Search"], dialog input',
        3000
      );
    }
  }

  if (searchEl) {
    showBanner(`Searching for <strong>${repoName}</strong>…`);
    searchEl.focus();
    reactSet(searchEl, repoName);
    searchEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    await sleep(1200); // wait for async search results

    // Look for the matching option in the dropdown
    let picked = false;
    for (const opt of document.querySelectorAll(
      '[role="option"], .select-menu-item, li[data-value], [role="listbox"] li, [role="menu"] li'
    )) {
      if (opt.textContent.includes(repoName) || opt.textContent.includes(repo)) {
        opt.click();
        picked = true;
        break;
      }
    }

    if (!picked) {
      // Try clicking anything in a dropdown that contains the repo name
      for (const el of document.querySelectorAll('[aria-selected], [data-repository]')) {
        if (el.textContent.includes(repoName)) {
          el.click();
          picked = true;
          break;
        }
      }
    }

    if (!picked) {
      showBanner(
        `⚠️ Couldn't auto-select <strong>${repoName}</strong> — please click it in the dropdown.`,
        '#9a6700'
      );
      await sleep(4000);
    }

    // Close picker dialog if there's a confirm/OK button
    await sleep(400);
    clickButtonByText('OK') || clickButtonByText('Confirm') || clickButtonByText('Apply');
    await sleep(600);
  } else {
    showBanner(
      `⚠️ Couldn't find repo search — please select <strong>${repo}</strong> manually, then wait.`,
      '#9a6700'
    );
    await sleep(5000);
  }

  // ── 5. Contents → Read and write ─────────────────────────────────────────
  showBanner(`Setting Contents permission…`);
  await sleep(1000); // permissions render after repo selection

  let permSet = false;

  // Expand "Repository permissions" section if it's collapsed
  for (const summary of document.querySelectorAll('summary, [aria-expanded="false"]')) {
    if (summary.textContent.includes('Repository permissions') ||
        summary.textContent.includes('Permissions')) {
      summary.click();
      await sleep(500);
      break;
    }
  }

  // Find the Contents select
  const contentsSelect = findSelectByLabel('Contents');
  if (contentsSelect) {
    const writeOpt = Array.from(contentsSelect.options).find(
      o => o.text.toLowerCase().includes('read and write') ||
           o.value === 'write' || o.value === 'read_write' || o.value === '2'
    );
    if (writeOpt) {
      reactSet(contentsSelect, writeOpt.value);
      permSet = true;
    }
  }

  if (!permSet) {
    showBanner(
      `⚠️ Couldn't set Contents permission — please set it to "Read and write" manually.`,
      '#9a6700'
    );
    await sleep(3000);
  }

  // ── 6. Click Generate token ───────────────────────────────────────────────
  showBanner(`Almost done — clicking Generate token in 2 seconds… <button id="pg-abort"
    style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);
    color:white;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:12px;margin-left:4px">
    Cancel</button>`);

  let aborted = false;
  document.getElementById('pg-abort')?.addEventListener('click', () => { aborted = true; });
  await sleep(2000);

  if (!aborted) {
    const generated = clickButtonByText('Generate token');
    if (generated) {
      showBanner(`Token generated! Copy it from the green box below.`, '#238636');
    } else {
      showBanner(`Couldn't find Generate token button — please click it manually.`, '#9a6700');
    }
  } else {
    showBanner(`Aborted. Review the form and click Generate token when ready.`, '#6e7681');
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
chrome.storage.local.get(['pendingToken'], async ({ pendingToken }) => {
  if (!pendingToken) return;
  const { repo, expiry } = pendingToken;
  chrome.storage.local.remove(['pendingToken']);

  showBanner(`Setting up token for <strong>${repo}</strong>…`);
  await sleep(2000); // wait for React to mount

  await fillForm(repo, expiry);
});
