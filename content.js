// Auto-fills GitHub's fine-grained token creation form.
// Reads target repo/permissions from chrome.storage.local (set by popup.js).

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Poll until an element matching selector exists and is visible, or timeout.
async function waitFor(selector, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el && el.offsetParent !== null) return el;
    await sleep(200);
  }
  return null;
}

// Poll until at least one element matching selector exists, or timeout.
async function waitForAny(selector, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const els = document.querySelectorAll(selector);
    if (els.length > 0) return Array.from(els);
    await sleep(200);
  }
  return [];
}

// Triggers React's synthetic onChange via the native value setter.
function reactSet(el, value) {
  const proto = el.tagName === 'SELECT'
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function showBanner(msg, color = '#1f6feb') {
  document.getElementById('pushgit-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'pushgit-banner';
  Object.assign(banner.style, {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '99999',
    background: color, color: 'white', padding: '9px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });
  banner.innerHTML = `<strong>⬆ PushGit</strong> &mdash; ${msg}
    <button style="margin-left:auto;background:rgba(255,255,255,0.15);border:1px solid
    rgba(255,255,255,0.3);color:white;border-radius:4px;padding:3px 10px;cursor:pointer;
    font-size:12px" onclick="this.parentNode.remove()">✕</button>`;
  document.body.prepend(banner);
}

async function fillForm(repo, perm, expiry) {
  const [, repoName] = repo.split('/');
  const today = new Date().toISOString().slice(0, 10);
  let step = '';

  try {
    // ── 1. Token name ──────────────────────────────────────────────────────
    step = 'token name';
    const nameEl = await waitFor('#token_name, input[name="token_name"]');
    if (nameEl) {
      reactSet(nameEl, `push-${repoName}-${today}`);
      await sleep(150);
    }

    // ── 2. Expiration ──────────────────────────────────────────────────────
    step = 'expiration';
    const expiryEl = document.querySelector(
      'select[name="expiration"], select[id*="expiration"], select[aria-label*="xpir"]'
    );
    if (expiryEl) {
      const opt = Array.from(expiryEl.options).find(
        o => o.value === expiry || o.text.includes(`${expiry} day`)
      );
      if (opt) reactSet(expiryEl, opt.value);
      await sleep(200);
    }

    // ── 3. "Only select repositories" radio ───────────────────────────────
    step = 'repository scope';
    await sleep(300);
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const selectRepoRadio = radios.find(r => {
      const label = r.closest('label') || document.querySelector(`label[for="${r.id}"]`);
      return label?.textContent.includes('Only select') ||
             label?.textContent.includes('Selected repositories');
    });
    if (selectRepoRadio && !selectRepoRadio.checked) {
      selectRepoRadio.click();
      await sleep(800); // wait for the repo search input to appear
    }

    // ── 4. Search for and select the repo ─────────────────────────────────
    step = 'repository search';
    showBanner(`Searching for <strong>${repo}</strong>…`);

    const searchEl = await waitFor(
      'input[placeholder*="Search"], ' +
      'input[aria-label*="repositories"], ' +
      'input[id*="repo-search"], ' +
      'input[name*="repository"], ' +
      '.SelectMenu input[type="text"], ' +
      'input[aria-label*="Select repositories"]',
      6000
    );

    if (searchEl) {
      searchEl.focus();
      reactSet(searchEl, repoName);
      await sleep(300);
      // Also simulate keydown to trigger GitHub's search handler
      searchEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));

      // Wait up to 5s for dropdown results to appear
      const results = await waitForAny(
        '[role="option"], .select-menu-item, li[data-value], .ActionListItem',
        5000
      );

      let clicked = false;
      for (const opt of results) {
        const text = opt.textContent.trim();
        if (text.includes(repoName) || text.includes(repo)) {
          opt.click();
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        showBanner(
          `⚠️ Couldn't auto-select <strong>${repo}</strong> — please select it manually in the repository list.`,
          '#9a6700'
        );
        await sleep(3000);
      }

      await sleep(600);
    } else {
      showBanner(
        `⚠️ Repository search not found — please select <strong>${repo}</strong> manually.`,
        '#9a6700'
      );
      await sleep(2000);
    }

    // ── 5. Set Contents permission → Read and write ───────────────────────
    step = 'permissions';
    showBanner(`Setting permissions for <strong>${repo}</strong>…`);

    // Wait for the permissions section to appear (it loads after repo selection)
    await sleep(800);
    await waitForAny('select[aria-label*="ontents"], tr, .permission-row', 4000);
    await sleep(400);

    // Try multiple strategies to find the Contents row
    let permSet = false;

    // Strategy A: <tr> with "Contents" text
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      const firstCell = row.querySelector('td:first-child, th:first-child');
      if (firstCell && /^contents$/i.test(firstCell.textContent.trim())) {
        const sel = row.querySelector('select');
        if (sel) {
          const writeOpt = Array.from(sel.options).find(
            o => o.text.toLowerCase().includes('read and write') || o.value === 'write'
          );
          if (writeOpt) {
            reactSet(sel, writeOpt.value);
            permSet = true;
          }
        }
        break;
      }
    }

    // Strategy B: select with aria-label containing "Contents"
    if (!permSet) {
      const sel = document.querySelector(
        'select[aria-label*="ontents"], select[aria-label*="CONTENTS"]'
      );
      if (sel) {
        const writeOpt = Array.from(sel.options).find(
          o => o.text.toLowerCase().includes('read and write') || o.value === 'write'
        );
        if (writeOpt) {
          reactSet(sel, writeOpt.value);
          permSet = true;
        }
      }
    }

    // ── Done ───────────────────────────────────────────────────────────────
    showBanner(
      `Ready! Pre-filled for <strong>${repo}</strong>. ` +
      `Check the settings and click <strong>Generate token</strong>.`
    );

  } catch (err) {
    showBanner(`Error at step "${step}" — ${err.message}. Please finish manually.`, '#cf222e');
  }
}

// Main entry
chrome.storage.local.get(['pendingToken'], async ({ pendingToken }) => {
  if (!pendingToken) return;

  const { repo, perm, expiry } = pendingToken;
  chrome.storage.local.remove(['pendingToken']);

  showBanner(`Setting up token for <strong>${repo}</strong>…`);

  // Wait for React to mount the form
  await sleep(2000);

  await fillForm(repo, perm, expiry);
});
