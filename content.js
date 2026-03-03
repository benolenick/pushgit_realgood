// Auto-fills GitHub's fine-grained token creation form.
// Selectors confirmed via live CDP/Pinchtab DOM inspection.

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

// ── Confirmation page handler ──────────────────────────────────────────────────
// Called on reload after form submit — clicks "Generate token" through any
// confirmation steps until the final token is displayed.
async function handleConfirmationPage() {
  await sleep(1500);

  // If the token value is already visible we're done
  const tokenEl = document.querySelector(
    'input[value^="github_pat_"], code[id*="token"], .js-newly-generated-token'
  );
  if (tokenEl) {
    showBanner('✅ Token ready — copy it before leaving this page!', '#238636');
    chrome.storage.local.remove(['pendingConfirm', 'pendingToken']);
    return;
  }

  // Otherwise find and click the Generate token button on the confirmation page
  const generateBtn = Array.from(document.querySelectorAll('button[type="submit"], button'))
    .find(b => b.textContent.trim() === 'Generate token');

  if (generateBtn) {
    showBanner('Confirming token generation…');
    await sleep(800);
    generateBtn.click();
    // Keep the flag — may need another round if GitHub adds permissions
  } else {
    // No button found — probably on the final token display page
    showBanner('✅ Token ready — copy it before leaving this page!', '#238636');
    chrome.storage.local.remove(['pendingConfirm', 'pendingToken']);
  }
}

// ── Main form filler ───────────────────────────────────────────────────────────
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
  }

  // ── 2. Expiration ──────────────────────────────────────────────────────────
  const expiryHidden = document.querySelector(
    'input[name="user_programmatic_access[default_expires_at]"]'
  );
  if (expiryHidden) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(expiry, 10));
    expiryHidden.value = d.toISOString().slice(0, 10);
    expiryHidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── 3. "Only select repositories" radio ───────────────────────────────────
  showBanner('Selecting repository scope…');
  await sleep(300);
  const repoRadio = document.querySelector('input#install_target_selected');
  if (repoRadio && !repoRadio.checked) {
    repoRadio.click();
    await sleep(800);
  }

  // ── 4. Open the repository picker ─────────────────────────────────────────
  showBanner('Opening repository picker…');
  const pickerBtn = await waitFor('button#repository-menu-list-button', 4000);
  if (!pickerBtn) {
    showBanner('⚠️ "Select repositories" button not found.', '#9a6700');
    await sleep(3000);
  } else {
    pickerBtn.click();
    await sleep(800);

    // ── 5. Search for the repo ───────────────────────────────────────────────
    showBanner(`Searching for <strong>${repoName}</strong>…`);
    const searchEl = await waitFor('input#repository-menu-list-filter', 4000);
    if (searchEl) {
      searchEl.focus();
      reactSet(searchEl, repoName);

      // Poll up to 6s for results (remote fetch)
      let picked = false;
      const resultsEnd = Date.now() + 6000;
      while (Date.now() < resultsEnd && !picked) {
        await sleep(400);
        const candidates = document.querySelectorAll(
          '#repository-menu-list button[role="option"], ' +
          'select-panel#repository-menu-list button[role="option"]'
        );
        for (const opt of candidates) {
          const text = opt.textContent.replace(/\s+/g, ' ').trim();
          if (text.toLowerCase().includes(repoName.toLowerCase())) {
            opt.click();
            picked = true;
            break;
          }
        }
      }

      if (!picked) {
        showBanner(`⚠️ Couldn't auto-select <strong>${repoName}</strong> — please click it.`, '#9a6700');
        await sleep(4000);
      } else {
        await sleep(400);
        // Close scoped to the repo picker — avoid hitting other dialogs
        const closeBtn =
          document.querySelector('#repository-menu-list .Overlay-closeButton') ||
          document.querySelector('#repository-menu-list button.close-button') ||
          document.querySelector('dialog[open] .Overlay-closeButton');
        if (closeBtn) closeBtn.click();

        // Wait until the dialog is gone
        const dialogGoneEnd = Date.now() + 4000;
        while (Date.now() < dialogGoneEnd) {
          const dlg = document.querySelector('#repository-menu-list dialog');
          if (!dlg || !dlg.open) break;
          await sleep(200);
        }
        await sleep(300);
      }
    } else {
      showBanner('⚠️ Repo search input not found — please select manually.', '#9a6700');
      await sleep(4000);
    }
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
    const submitBtn = await waitFor('button.js-integrations-install-form-submit', 4000);
    if (submitBtn) {
      // Set flag before navigating away so confirmation pages auto-click too.
      // Clear pendingToken only after submit is pressed; this preserves state
      // if GitHub interrupts with auth checks before reaching this step.
      await chrome.storage.local.set({ pendingConfirm: true });
      await chrome.storage.local.remove(['pendingToken']);
      submitBtn.click();
    } else {
      showBanner('⚠️ Generate token button not found — please click it manually.', '#9a6700');
    }
  } else {
    showBanner('Cancelled — review the form and click Generate token when ready.', '#6e7681');
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────
chrome.storage.local.get(['pendingToken', 'pendingConfirm'], async (data) => {
  if (data.pendingToken) {
    const { repo, expiry } = data.pendingToken;
    showBanner(`Setting up token for <strong>${repo}</strong>…`);
    await sleep(2000);
    await fillForm(repo, expiry);

  } else if (data.pendingConfirm) {
    // On a confirmation/reload page — keep clicking Generate token until done
    await handleConfirmationPage();
  }
});
