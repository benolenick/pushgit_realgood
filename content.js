// Auto-fills GitHub's fine-grained token creation form.
// Selectors confirmed via Gemini research of GitHub's Primer/React form structure.

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

async function fillForm(repo, expiry) {
  const [, repoName] = repo.split('/');
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Token name ─────────────────────────────────────────────────────────
  showBanner('Filling token name…');
  const nameEl = await waitFor('input#name, input[name="name"]', 6000);
  if (nameEl) {
    reactSet(nameEl, `push-${repoName}-${today}`);
    await sleep(150);
  } else {
    showBanner('⚠️ Could not find token name input.', '#9a6700');
  }

  // ── 2. Expiration ─────────────────────────────────────────────────────────
  const expiryEl = document.querySelector('select#expires_in, select[name="expires_in"]');
  if (expiryEl) {
    const opt = Array.from(expiryEl.options).find(
      o => o.value === String(expiry) || o.text.startsWith(expiry + ' ')
    );
    if (opt) reactSet(expiryEl, opt.value);
    await sleep(200);
  }

  // ── 3. "Only select repositories" radio ───────────────────────────────────
  showBanner(`Selecting repository access scope…`);
  await sleep(300);
  const repoRadio = document.querySelector('input[name="repository_selection"][value="selected"]');
  if (repoRadio && !repoRadio.checked) {
    repoRadio.click();
    await sleep(800);
  }

  // ── 4. Repo search ────────────────────────────────────────────────────────
  showBanner(`Searching for <strong>${repoName}</strong>…`);

  // The repo picker may be a button that opens a panel, or an inline search input.
  let searchEl = await waitFor('input#repo-picker-search-input', 3000);

  if (!searchEl) {
    // Try clicking the picker button first
    const pickerBtn = document.querySelector('button#repo-picker-button');
    if (pickerBtn) {
      pickerBtn.click();
      await sleep(600);
      searchEl = await waitFor('input#repo-picker-search-input', 3000);
    }
  }

  if (!searchEl) {
    // Broader fallback
    searchEl = await waitFor(
      'input[placeholder="Search repositories"], input[aria-label="Search repositories"]',
      3000
    );
  }

  if (searchEl) {
    searchEl.focus();
    reactSet(searchEl, repoName);
    await sleep(1200); // wait for async search results to load

    // Click the matching result in the dropdown
    let picked = false;
    for (const opt of document.querySelectorAll('[role="option"], [role="listbox"] li, .ActionListItem')) {
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
      await sleep(600);
    }
  } else {
    showBanner(
      `⚠️ Repo search not found — please select <strong>${repo}</strong> manually.`,
      '#9a6700'
    );
    await sleep(4000);
  }

  // ── 5. Expand "Repository permissions" and set Contents ───────────────────
  showBanner('Setting Contents permission…');
  await sleep(600);

  // Expand the repository permissions accordion if collapsed
  const permHeader = document.querySelector('button#repository-permissions-header');
  if (permHeader && permHeader.getAttribute('aria-expanded') === 'false') {
    permHeader.click();
    await sleep(600);
  }

  // Set Contents → Read and write
  const contentsSelect = await waitFor(
    'select[name="permissions[contents]"]',
    4000
  );
  if (contentsSelect) {
    const writeOpt = Array.from(contentsSelect.options).find(
      o => o.value === 'write' || o.text.toLowerCase().includes('read and write')
    );
    if (writeOpt) reactSet(contentsSelect, writeOpt.value);
  } else {
    showBanner('⚠️ Contents permission select not found — please set it manually.', '#9a6700');
    await sleep(3000);
  }

  // ── 6. Click Generate token ────────────────────────────────────────────────
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
    const submitBtn = document.querySelector('button[type="submit"].btn-primary, button[type="submit"]');
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

// ── Entry point ───────────────────────────────────────────────────────────────
chrome.storage.local.get(['pendingToken'], async ({ pendingToken }) => {
  if (!pendingToken) return;
  const { repo, expiry } = pendingToken;
  chrome.storage.local.remove(['pendingToken']);

  showBanner(`Setting up token for <strong>${repo}</strong>…`);
  await sleep(2000); // wait for React to mount

  await fillForm(repo, expiry);
});
