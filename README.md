# PushGit

**One-click scoped GitHub push tokens — pick a repo, get a token, done.**

A Chrome extension that eliminates the 10+ click process of creating a fine-grained GitHub personal access token for a single repo. Most of the time you just need a short-lived token to `git push`. PushGit makes it one click.

## How it works

1. Click the PushGit icon in your browser toolbar
2. Enter `owner/repo` — or just browse to a GitHub repo first and it auto-detects it
3. Choose how long the token should live (1–90 days)
4. Click **Open GitHub → Create Token**
5. PushGit opens GitHub's token page and fills in everything automatically:
   - Token name (`push-reponame-YYYY-MM-DD`)
   - Expiry date
   - Repository access scoped to just your repo
6. Clicks **Generate token** through GitHub's confirmation steps automatically
7. Your token appears — copy and use it

The token lives only in GitHub's system. PushGit never sees or stores it.

## Why

GitHub's fine-grained PATs are the right way to create short-lived, repo-scoped credentials — but creating one through the UI takes 10+ clicks across multiple dropdowns, search boxes, and confirmation pages. Nobody does it, so people fall back to classic tokens with broad access that never expire.

PushGit makes the secure option the easy option.

## Install

### From the Chrome Web Store
Search for **PushGit** or install directly: *(link coming soon)*

### From source (developer mode)
1. Clone this repo or [download the ZIP](https://github.com/benolenick/pushgit_realgood/archive/refs/heads/main.zip)
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked** and select the folder

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remember the last repo you used |
| `tabs` | Open the GitHub token page |
| `github.com/*` | Detect current repo from URL + auto-fill the token form |

No external servers. No network requests outside of github.com. Works entirely in your browser using your existing GitHub session.

## Security

- PushGit never touches your token value
- Tokens are scoped to a single repo with a short expiry
- The extension only has access to `github.com` pages
- All source code is [on GitHub](https://github.com/benolenick/pushgit_realgood) — fully auditable

## Contributing

Issues and PRs welcome. The main thing that breaks over time is GitHub updating their form — if selectors stop working, open an issue with what you see in DevTools.

## License

MIT
