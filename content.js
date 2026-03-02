// Auto-fills GitHub's fine-grained token creation form.
// Reads the target repo/permissions from chrome.storage.local (set by popup.js).

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(selector, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(150);
  }
  return null;
}

// Triggers React's synthetic onChange by using the native value setter.
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

function showBanner(msg) {
  document.getElementById('pushgit-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'pushgit-banner';
  Object.assign(banner.style, {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '99999',
    background: '#1f6feb', color: 'white', padding: '9px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });
  banner.innerHTML = `<strong>⬆ PushGit</strong> — ${msg}
    <button style="margin-left:auto;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);
    color:white;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:12px"
    onclick="this.parentNode.remove()">✕</button>`;
  document.body.prepend(banner);
}

async function fillForm(repo, perm, expiry) {
  const [, repoName] = repo.split('/');
  const today = new Date().toISOString().slice(0, 10);

  // 1. Token name
  const nameEl = await waitFor('#token_name, input[name="token_name"]');
  if (nameEl) {
    reactSet(nameEl, `push-${repoName}-${today}`);
    await sleep(150);
  }

  // 2. Expiration — GitHub uses a native <select> with day values
  const expiryEl = document.querySelector(
    'select[name="expiration"], select[id*="expiration"], select[aria-label*="xpir"]'
  );
  if (expiryEl) {
    // GitHub option values are like "7" or "custom"
    const opt = Array.from(expiryEl.options).find(o => o.value === expiry || o.text.includes(`${expiry} day`));
    if (opt) reactSet(expiryEl, opt.value);
    await sleep(200);
  }

  // 3. "Only select repositories" radio button
  await sleep(300);
  const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
  const selectRepo = radios.find(r => {
    const label = r.closest('label') || document.querySelector(`label[for="${r.id}"]`);
    return label?.textContent.includes('Only select');
  });
  if (selectRepo) {
    selectRepo.click();
    await sleep(600);
  }

  // 4. Search for and select the repo
  const searchEl = await waitFor(
    'input[placeholder*="Search"], input[aria-label*="repositories"], input[id*="repo-search"], input[name*="repository"]',
    4000
  );
  if (searchEl) {
    searchEl.focus();
    reactSet(searchEl, repoName);
    await sleep(900);

    // Click the matching option in the dropdown
    const options = document.querySelectorAll('[role="option"], .select-menu-item');
    for (const opt of options) {
      if (opt.textContent.includes(repoName)) {
        opt.click();
        break;
      }
    }
    await sleep(400);
  }

  // 5. Contents permission → Read and write
  // GitHub renders a table; find the row labelled "Contents"
  await sleep(300);
  const rows = document.querySelectorAll('tr');
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    const nameCell = cells[0];
    if (nameCell && /^Contents$/i.test(nameCell.textContent.trim())) {
      const sel = row.querySelector('select');
      if (sel) {
        const writeOpt = Array.from(sel.options).find(o =>
          o.text.toLowerCase().includes('read and write') || o.value === 'write'
        );
        if (writeOpt) reactSet(sel, writeOpt.value);
      }
      break;
    }
  }
}

// Main
chrome.storage.local.get(['pendingToken'], async ({ pendingToken }) => {
  if (!pendingToken) return;

  const { repo, perm, expiry } = pendingToken;
  chrome.storage.local.remove(['pendingToken']);

  showBanner(`Filling token form for <strong>${repo}</strong>…`);

  // Wait for the React app to fully mount
  await sleep(1500);

  await fillForm(repo, perm, expiry);

  showBanner(
    `Pre-filled for <strong>${repo}</strong>. ` +
    `Review the settings below, then click <strong>Generate token</strong>.`
  );
});
