// Auto-fills GitHub's fine-grained token creation form.
// Selectors sourced from live CDP DOM inspection of the real page.

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

async function waitFor(selector, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(200);
  }
  return null;
}

// Wait for a new visible input to appear that wasn't in the original set.
async function waitForNewInput(known, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const el of document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')) {
      if (!known.has(el) && el.offsetParent !== null) return el;
    }
    await sleep(200);
  }
  return null;
}

async function fillForm(repo, expiry) {
  const [, repoName] = repo.split('/');
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Token name ──────────────────────────────────────────────────────────
  showBanner('Filling token name…');
  const nameEl = await waitFor(
    'input#user_programmatic_access_name, input[name="user_programmatic_access[name]"]',
    6000
  );
  if (nameEl) {
    reactSet(nameEl, `push-${repoName}-${today}`);
    await sleep(150);
  } else {
    showBanner('⚠️ Token name input not found.', '#9a6700');
  }

  // ── 2. Expiration ──────────────────────────────────────────────────────────
  // GitHub uses a hidden date input — compute the target date and set it directly.
  const expiryHidden = document.querySelector(
    'input[name="user_programmatic_access[default_expires_at]"]'
  );
  if (expiryHidden) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(expiry, 10));
    expiryHidden.value = d.toISOString().slice(0, 10);
    expiryHidden.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);
  }

  // Also click the matching expiry option button (updates the visible label).
  // Expiry buttons are in an ActionList; find by text.
  const expiryBtn = document.querySelector(
    `button#action-menu-${document.querySelector('[id^="action-menu-"][id$="-button"]')
      ?.id?.replace(/-button$/, '')?.replace('action-menu-', '')}-button`
  );
  // Simpler: just click the dropdown button and pick by text
  const expiryDropdownBtn = document.querySelector('[id$="-button"][class*="Button--secondary"]');
  if (expiryDropdownBtn) {
    expiryDropdownBtn.click();
    await sleep(400);
    // Click the matching day option
    const dayLabel = expiry === '1' ? '1 day' : `${expiry} days`;
    for (const btn of document.querySelectorAll('button[class*="ActionListContent"]')) {
      if (btn.textContent.trim().startsWith(expiry === '1' ? '1 day' : expiry + ' days') ||
          btn.textContent.trim().includes(dayLabel)) {
        btn.click();
        break;
      }
    }
    await sleep(300);
  }

  // ── 3. "Only select repositories" radio ───────────────────────────────────
  showBanner('Selecting repository scope…');
  await sleep(300);
  const knownInputs = new Set(
    document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')
  );
  const repoRadio = document.querySelector('input#install_target_selected');
  if (repoRadio && !repoRadio.checked) {
    repoRadio.click();
    await sleep(800);
  }

  // ── 4. Repo search ─────────────────────────────────────────────────────────
  showBanner(`Searching for <strong>${repoName}</strong>…`);

  // After clicking the radio, a picker panel/search input should appear.
  let searchEl = await waitForNewInput(knownInputs, 4000);

  // Fallback: look for type=search or placeholder containing repo-related text
  if (!searchEl) {
    searchEl = await waitFor(
      'input[type="search"][placeholder*="repo"], input[placeholder*="Search repo"]',
      3000
    );
  }

  if (searchEl) {
    searchEl.focus();
    reactSet(searchEl, repoName);
    await sleep(1200);

    // Click the matching result in the dropdown
    let picked = false;
    for (const opt of document.querySelectorAll(
      '[role="option"], .ActionListItem, [role="listbox"] li, [role="menuitem"]'
    )) {
      if (opt.textContent.trim().includes(repoName)) {
        opt.click();
        picked = true;
        break;
      }
    }

    if (!picked) {
      showBanner(
        `⚠️ Couldn't auto-select <strong>${repoName}</strong> — please click it in the list.`,
        '#9a6700'
      );
      await sleep(4000);
    } else {
      await sleep(500);
      // Confirm/close the panel if there's a confirm button
      for (const btn of document.querySelectorAll('button')) {
        if (/^(OK|Apply|Confirm|Done|Save)$/i.test(btn.textContent.trim())) {
          btn.click();
          break;
        }
      }
    }
  } else {
    showBanner(
      `⚠️ Repo picker didn't open — please select <strong>${repo}</strong> manually.`,
      '#9a6700'
    );
    await sleep(4000);
  }

  // ── 5. Contents → Read and write ──────────────────────────────────────────
  showBanner('Setting Contents permission…');
  await sleep(600);

  // GitHub renders permissions as hidden inputs.
  // name="integration[default_permissions][contents]"
  // Values: "none" | "read" | "write"
  const contentsInput = document.querySelector(
    'input[name="integration[default_permissions][contents]"]'
  );
  if (contentsInput) {
    contentsInput.value = 'write';
    contentsInput.dispatchEvent(new Event('change', { bubbles: true }));
    contentsInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    showBanner('⚠️ Contents permission input not found — please set it manually.', '#9a6700');
    await sleep(2000);
  }

  // ── 6. Generate token ──────────────────────────────────────────────────────
  showBanner(
    'Ready! Clicking <strong>Generate token</strong> in 2s… ' +
    '<button id="pg-abort" style="background:rgba(255,255,255,0.15);border:1px solid ' +
    'rgba(255,255,255,0.3);color:white;border-radius:4px;padding:3px 10px;cursor:pointer;' +
    'font-size:12px;margin-left:4px">Cancel</button>'
  );

  let aborted = false;
  document.getElementById('pg-abort')?.addEventListener('click', () => { aborted = true; });
  await sleep(2000);

  if (!aborted) {
    const submitBtn = document.querySelector(
      'button.js-integrations-install-form-submit, button[type="submit"].js-integrations-install-form-submit'
    );
    if (submitBtn) {
      submitBtn.click();
      showBanner('Token generated! Copy it from the green box below.', '#238636');
    } else {
      showBanner('⚠️ Could not find Generate token button — please click it manually.', '#9a6700');
    }
  } else {
    showBanner('Cancelled — review the form and click Generate token when ready.', '#6e7681');
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────
chrome.storage.local.get(['pendingToken'], async ({ pendingToken }) => {
  if (!pendingToken) return;
  const { repo, expiry } = pendingToken;
  chrome.storage.local.remove(['pendingToken']);

  showBanner(`Setting up token for <strong>${repo}</strong>…`);
  await sleep(2000);

  await fillForm(repo, expiry);
});
