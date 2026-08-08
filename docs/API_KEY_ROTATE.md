# Cleanverse API key rotation

If `CLEANVERSE_API_KEY` was ever included in a zip, shared chat, or non-git channel, rotate it at the Cleanverse UAT portal before submission.

## Steps

1. Log in to Cleanverse UAT / partner dashboard (credentials in local `cleanverse.env` or team vault — **not** in this repo).
2. Revoke or rotate the key that was exposed.
3. Update local files only (never commit):
   - `clearnote.keys.env` or `cleanverse.env` — `CLEANVERSE_API_ID`, `CLEANVERSE_API_KEY`
   - App dev: `app/.env.local` if used (`NEXT_PUBLIC_*` does not need the secret; server routes read from env)
4. Verify: `pnpm cleanverse:doctor` — should return live or documented fallback, not 401.

## Git history

This repo has no committed `.env.local` or API key strings in `git log`. Rotation is still recommended if the upload zip or chat ever contained the key.
