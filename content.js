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
  // Set the hidden date input directly — it's the actual form field.
  const expiryHidden = document.querySelector(
    'input[name="user_programmatic_access[default_expires_at]"]'
  );
  if (expiryHidden) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(expiry, 10));
    expiryHidden.value = d.toISOString().slice(0, 10);
    expiryHidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── 3. Click "Only select repositories" radio ──────────────────────────────
  showBanner('Selecting repository scope…');
  await sleep(300);
  const repoRadio = document.querySelector('input#install_target_selected');
  if (repoRadio && !repoRadio.checked) {
    repoRadio.click();
    await sleep(800);
  }

  // ── 4. Click "Select repositories" button to open the picker ──────────────
  showBanner(`Opening repository picker…`);
  const pickerBtn = await waitFor('button#repository-menu-list-button', 4000);
  if (!pickerBtn) {
    showBanner('⚠️ "Select repositories" button not found.', '#9a6700');
    await sleep(3000);
  } else {
    pickerBtn.click();
    await sleep(800);

    // ── 5. Type into the search filter ──────────────────────────────────────
    showBanner(`Searching for <strong>${repoName}</strong>…`);
    const searchEl = await waitFor('input#repository-menu-list-filter', 4000);
    if (searchEl) {
      searchEl.focus();
      reactSet(searchEl, repoName);

      // Poll for results to actually appear (remote fetch, takes variable time)
      showBanner(`Waiting for results for <strong>${repoName}</strong>…`);
      let picked = false;
      const resultsEnd = Date.now() + 5000;
      while (Date.now() < resultsEnd && !picked) {
        await sleep(300);
        // GitHub's select-panel renders items as li.ActionListItem inside the dialog
        const candidates = document.querySelectorAll(
          'dialog li, dialog [role="option"], dialog .ActionListItem, ' +
          '#repository-menu-list li, #repository-menu-list [role="option"]'
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
        showBanner(
          `⚠️ Couldn't auto-select <strong>${repoName}</strong> — please click it in the list.`,
          '#9a6700'
        );
        await sleep(4000);
      } else {
        await sleep(400);
        // Catalyst select-panel may need a "Save changes" confirm, or just closes on click
        const saveBtn = Array.from(document.querySelectorAll('dialog button, button')).find(
          b => /save|apply|confirm|done/i.test(b.textContent.trim())
        );
        if (saveBtn) { saveBtn.click(); await sleep(400); }
        // Close dialog if still open
        const closeBtn = document.querySelector('dialog button[aria-label="Close"], dialog .close-button');
        if (closeBtn) { closeBtn.click(); await sleep(400); }
      }
    } else {
      showBanner('⚠️ Repo search input not found — please select manually.', '#9a6700');
      await sleep(4000);
    }
  }

  // ── 7. Contents → Read and write ──────────────────────────────────────────
  showBanner('Setting Contents permission…');
  await sleep(600);

  const contentsInput = document.querySelector(
    'input[name="integration[default_permissions][contents]"]'
  );
  if (contentsInput) {
    contentsInput.value = 'write';
    contentsInput.dispatchEvent(new Event('change', { bubbles: true }));
    contentsInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    showBanner('⚠️ Contents permission input not found — set it manually.', '#9a6700');
    await sleep(2000);
  }

  // ── 8. Generate token ──────────────────────────────────────────────────────
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
    const submitBtn = document.querySelector('button.js-integrations-install-form-submit');
    if (submitBtn) {
      submitBtn.click();
      showBanner('Token generated! Copy it from the green box below.', '#238636');
    } else {
      showBanner('⚠️ Generate token button not found — please click it manually.', '#9a6700');
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
