# PushGit

A Chrome extension that makes scoped GitHub push tokens easy. Pick a repo, set an expiry, and PushGit opens GitHub's token page with everything pre-filled — you just click Generate.

## Why

Creating a fine-grained PAT scoped to a single repo through GitHub's UI takes 10+ clicks. Most of the time you just need a short-lived token to `git push`. This makes it one click.

## How it works

1. Click the PushGit icon
2. Enter `owner/repo` (auto-detected if you're already on the repo's GitHub page)
3. Choose permission (push only or push + pull) and expiry (1–90 days)
4. Click **Open GitHub → Create Token**
5. PushGit opens `github.com/settings/personal-access-tokens/new` and pre-fills:
   - Token name (`push-reponame-YYYY-MM-DD`)
   - Expiration
   - Repository access (only the repo you selected)
   - Contents permission (Read and write)
6. Click **Generate token** on GitHub and copy your token

The token lives only in GitHub's system — PushGit never sees or stores it.

## Install (development)

1. Clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

## Permissions used

| Permission | Why |
|---|---|
| `storage` | Remember the last repo you used |
| `tabs` | Open the GitHub token page |
| `github.com/*` | Detect current repo + auto-fill the token form |

No network requests. No external servers. Works entirely in your browser.
