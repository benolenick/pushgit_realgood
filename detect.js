// Detects the current GitHub repo from the page URL and stores it for the popup.
const parts = window.location.pathname.split('/').filter(Boolean);

if (parts.length >= 2) {
  const SYSTEM_PATHS = new Set([
    'settings', 'orgs', 'apps', 'marketplace', 'features', 'pricing',
    'about', 'login', 'join', 'explore', 'notifications', 'pulls', 'issues',
    'trending', 'topics', 'collections', 'events', 'sponsors', 'organizations',
    'search', 'new', 'account', 'contact', 'security', 'enterprise',
    'codespaces', 'copilot', 'actions', 'packages', 'mobile', 'readme',
  ]);

  if (!SYSTEM_PATHS.has(parts[0])) {
    chrome.storage.local.set({ detectedRepo: `${parts[0]}/${parts[1]}` });
  }
}
