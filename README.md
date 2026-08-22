# fb-page-publisher

A small queue-based publisher for a Facebook Page: drop a Markdown file into `pending/`, run the script, and it posts through a browser profile you signed into by hand — then files the post into `sent/` or `failed/`.

## Read this first

**Automating posts through a browser is against Facebook's Terms of Service.** Meta provides a Graph API for programmatic posting, and that is the supported route. This tool does not use it; it drives a real browser session instead.

That is a deliberate trade-off, and the cost is yours to accept: accounts that automate the web interface can be rate-limited, checkpointed or disabled, with no appeal worth the name. Do not point this at an account you cannot afford to lose, and do not use it at a volume or cadence a person could not plausibly produce.

It is published as a worked example of the pattern — a filesystem queue driving a persistent browser context — not as a recommendation to use it.

## What it does / why

Posting to a Page from a script normally means registering an app, getting a Page access token, and keeping that token alive. For one person posting their own writing to their own Page, that is a lot of moving parts, and it means holding a long-lived credential.

This takes the other route. You log into Facebook once, by hand, in a dedicated browser profile. The script reuses that profile.

- **A filesystem queue.** `pending/` holds `.md` files. Images sit beside them, matched by filename prefix or date prefix.
- **Reuses a logged-in profile** via Playwright's `launchPersistentContext`. Your session lives in the profile directory, not in this repository.
- **No password is ever stored or typed by the script.** There is no credential in the code, in the config, or in the queue.
- **Every post is filed.** Success moves the file to `sent/`, failure to `failed/`, and both are logged with a timestamp.
- **A dry run** shows what would be posted without opening a browser.
- **A smoke test** opens the profile and checks the session is still valid, without posting anything.

## Requirements

- Node.js 18 or newer.
- `playwright-core` — `npm install`. It drives a browser you already have rather than downloading one.
- Google Chrome or Microsoft Edge installed.
- A Facebook account with rights to post to the Page.

## Install

```
git clone <repo-url> fb-page-publisher
cd fb-page-publisher
npm install
copy config.example.json config.json
```

Edit `config.json`. The directory values may be left relative — they resolve against the repository root, so a fresh clone works without editing any absolute paths in. `config.json` is gitignored.

Then log in once, by hand:

```
powershell -ExecutionPolicy Bypass -File .\scripts\open.login.profile.ps1
```

That opens the dedicated browser profile. Sign in, complete any two-factor prompt, close the window. The session persists in `profiles/<profileName>/`, which is gitignored and must stay that way — it *is* your logged-in session.

## Usage

Queue a post by writing a Markdown file into `pending/`. To attach images, put them beside it with the same filename stem, or the same date prefix.

```
npm run dry        # show what would be posted, no browser
npm run smoke      # open the profile and verify the session, no posting
npm run publish    # post everything in pending/
```

`scripts/run.daily.ps1` is the scheduled-task wrapper: it runs the publisher and writes to the log directory.

## Output

| Directory | Contents |
| --- | --- |
| `pending/` | Queued Markdown, with any images beside it |
| `sent/` | Posted successfully, moved here with its images |
| `failed/` | Attempted and failed, moved here for you to inspect |
| `logs/` | One log file per run, timestamped |
| `profiles/` | The browser profile holding your logged-in session |

All five are gitignored, as is `config.json`.

## Limitations

- **It is against Facebook's Terms of Service**, as above.
- **It breaks when Facebook redesigns.** Every control is located by visible text — the compose box, the photo button, the post button — and the config carries Chinese and English variants of each. A wording or layout change breaks it, and the fix is editing those strings.
- **Not headless.** `headless: false` is the default and should stay that way; a headless browser is much more likely to be challenged.
- **One profile, one Page.** No multi-account rotation, and adding one would make the terms problem worse rather than better.
- **A failed post is not retried.** It moves to `failed/` and stays there until you look at it.
- **Success is inferred from the page**, not confirmed against an API. A post that appears to publish but is later removed by an automated filter will still be filed under `sent/`.
- **Windows-oriented.** The helper scripts are PowerShell and the default browser paths are Windows. The JavaScript converts Windows paths for WSL, but the tool has not been exercised on Linux or macOS.
- **No tests.**

## License

MIT. See [LICENSE](LICENSE).
