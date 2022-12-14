# Public Quiz Device

- For users: 🏃 [Setup and usage](#setup-and-usage), 🔑 [Security claims](#security-claims), and ☠️ [Security limitations](#security-limitations)
- Developers should also read about ✍️ [Local testing](#local-testing) and 📦 [Production](#production-builds)

## Setup and usage

- [Fork this repository][FORK_THIS] and add [GitHub Pages](../../settings/pages) via GitHub Actions.
- Keep the description. It defines an [OAuth App](https://github.com/settings/applications/new) w/ Device Flow.
- ⭐ Star your fork to create your GitHub Pages environment.

### Register via your GitHub Pages URL

1. Copying one-time public key to a link on your fork.
3. Pasting one-time GitHub code to a link on GitHub.
4. 🔑 Choosing a secure master password.

### The page gives you a login link.
- 💾 Bookmark or save the login link.
- ✏️ Memorize your master password.

## Security claims

Before activation, [GitHub Pages][HELP_PAGES] publicly host one-time-use public keys and asymmetrically encrypted messages. After activation, symmetrically encrypted messages move to/from GitHub Actions via private [GitHub Projects][HELP_PROJECTS]. *Your master password never leaves your browser*. Each login takes ≈30 seconds to complete the password-authenticated [key exchange][PAKE] by:

- Authenticating your password against the [output of a pseudorandom function][OPRF].
- Returning a single-session [AES-GCM][GCM] key for authenticated encryption.

### After login, all queries or mutations related to your passwords:

- Are encrypted/decrypted locally with the [Argon2][Argon2] hash of your password.
- Move to/from GitHub Actions encrypted with your single-session AES-GCM key.

## Security limitations

Unauthorized 3rd parties _can reset/clear your passwords_ if:

- ⚠️ your fork has allowed outside [collaborators][HELP_COLLAB]
- ⚠️ or your fork's wiki has become [publicly editable][HELP_WIKI]
- ☠️ or your GitHub account has [been compromised][HELP_SECURE]

### Your passwords only be viewed/edited with:

Your master password AND your bookmarked login link.

## Local Testing

- In [environment.csv](./docs/environment.csv), set `REMOTE` to `your_username/public-quiz-device`.
- Open a terminal, and clone your forked repository:

```properties
YOU=your_username
REPO_URL=$YOU/public-quiz-device
git clone git@github.com:$REPO_URL.git
cd public-quiz-device
```

Install `pnpm`, `node 18`, and dependencies:

```properties
wget -qO- https://get.pnpm.io/install.sh | sh -
pnpm env use --global 18
pnpm install -g node-gyp
CXX=gcc pnpm install
```

In a separate terminal, run:

```properties
cd public-quiz-device
npx http-server docs -p 8000
```

Run `bash develop.bash` twice or more, following instructions.

### On 1st run, it registers your master password
  - It uses the OAuth App in this repostory's description.
  - It writes an OAuth Token to `.env` and a new login link.

### Afterwards, it allows revisiting your login link
  - If you want to make a new login link, press `n` after running.
  - To use your existing login link, press `y` after running.

## Production builds

Update the version in `package.json` and with a tag:

```properties
git tag v3.x.y
git push origin main --tags
```
On each pushed tag, the `build` workflow will:

- Create a pull request for compiled (`tsc`) packaged (`pkg`) linux executable
- Upload the `docs` directory to GitHub Pages.

[HELP_COLLAB]: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-access-to-your-personal-repositories/inviting-collaborators-to-a-personal-repository
[HELP_WIKI]: https://docs.github.com/en/communities/documenting-your-project-with-wikis/changing-access-permissions-for-wikis
[HELP_SECURE]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure
[HELP_PROJECTS]: https://docs.github.com/en/issues/planning-and-tracking-with-projects
[HELP_PAGES]: https://pages.github.com/

[FORK_THIS]: https://github.com/tvquizphd/public-quiz-device/fork
[PAKE]: https://blog.cloudflare.com/opaque-oblivious-passwords/
[OPRF]: https://www.npmjs.com/package/oprf#security-guarantees
[Argon2]: https://github.com/p-h-c/phc-winner-argon2
[GCM]: https://www.aes-gcm.com/
