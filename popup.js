const repoInput = document.getElementById('repo');
const permSelect = document.getElementById('perm');
const expirySelect = document.getElementById('expiry');
const goBtn = document.getElementById('go');
const detectedBar = document.getElementById('detected-bar');
const detectedName = document.getElementById('detected-name');
const useDetectedBtn = document.getElementById('use-detected');

// Restore last-used repo and show detected repo
chrome.storage.local.get(['lastRepo', 'detectedRepo'], ({ lastRepo, detectedRepo }) => {
  if (lastRepo) repoInput.value = lastRepo;

  if (detectedRepo) {
    detectedName.textContent = detectedRepo;
    detectedBar.style.display = 'flex';
    useDetectedBtn.addEventListener('click', () => {
      repoInput.value = detectedRepo;
      repoInput.focus();
    });
  }
});

repoInput.addEventListener('input', () => {
  repoInput.classList.remove('err');
});

goBtn.addEventListener('click', async () => {
  const repo = repoInput.value.trim();

  if (!repo || !repo.includes('/') || repo.split('/').length !== 2) {
    repoInput.classList.add('err');
    repoInput.focus();
    return;
  }

  const perm = permSelect.value;
  const expiry = expirySelect.value;

  await chrome.storage.local.set({
    pendingToken: { repo, perm, expiry },
    lastRepo: repo,
  });

  chrome.tabs.create({ url: 'https://github.com/settings/personal-access-tokens/new' });
  window.close();
});

// Allow Enter key to submit
repoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') goBtn.click();
});
