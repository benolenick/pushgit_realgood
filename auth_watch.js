function pgShowAuthBanner(message) {
  document.getElementById('pushgit-auth-banner')?.remove();
  const b = document.createElement('div');
  b.id = 'pushgit-auth-banner';
  Object.assign(b.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '99999',
    background: '#9a6700',
    color: 'white',
    padding: '10px 14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
  });
  b.innerHTML = `
    <strong>PushGit paused</strong>
    <span>${message}</span>
    <button id="pushgit-resume-btn" style="margin-left:auto;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px">Resume PushGit</button>
    <button id="pushgit-close-btn" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:4px;padding:4px 9px;cursor:pointer;font-size:12px">✕</button>
  `;
  document.body.prepend(b);

  document.getElementById('pushgit-resume-btn')?.addEventListener('click', () => {
    window.location.href = 'https://github.com/settings/personal-access-tokens/new';
  });
  document.getElementById('pushgit-close-btn')?.addEventListener('click', () => {
    b.remove();
  });
}

function pgIsAuthGate(pathname) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/sessions') ||
    pathname.startsWith('/users/') ||
    pathname.startsWith('/two-factor') ||
    pathname.includes('/verified-device') ||
    pathname.includes('/sudo')
  );
}

chrome.storage.local.get(['pendingToken', 'pendingConfirm'], ({ pendingToken, pendingConfirm }) => {
  if (!pendingToken && !pendingConfirm) return;

  const path = window.location.pathname;
  const onTokenPages = path.startsWith('/settings/personal-access-tokens');
  if (onTokenPages) return;

  if (pgIsAuthGate(path)) {
    pgShowAuthBanner('Complete GitHub verification (email/code/password), then click "Resume PushGit".');
  } else {
    pgShowAuthBanner('Finish GitHub checks, then click "Resume PushGit" to return to token creation.');
  }
});

