# Put Margin in your GitHub repository

This source package includes application code, assets, tests, dependency locks, and the handwriting database migration. It excludes API keys, uploaded PDFs, personal handwriting samples, local databases, dependency folders, generated builds, and Git credentials.

## Easiest: GitHub Desktop

1. Unzip the source package.
2. Install and sign in to GitHub Desktop if you do not already have it.
3. Choose **File → Add Local Repository**, select the unzipped `margin-notes` directory, and choose **create a repository here** if prompted.
4. Review the changes. `.env.local` must not appear in the commit list.
5. Make the initial commit, then choose **Publish repository**. Keep it private if desired.

Publishing the repository uploads source code. It does not replace the running Margin Site or transfer the live database. Your existing hosted API secret remains separate from GitHub.

You do not need to paste the source into a single GitHub file. Publish the entire unzipped project directory so its folders and filenames stay intact.

## Editing your exported PDFs

You can edit text and move or resize annotation boxes before export. Exported PDFs also contain editable annotations and the Margin editing data. Upload an exported PDF to Margin again to resume editing, including its personal handwriting. Other PDF editors can display the annotations but may replace the handwriting appearance with a standard font if you change the text there.

## With Git in a terminal

Create an empty repository in GitHub without adding a README or license, then run these commands inside the unzipped `margin-notes` directory. Replace the repository URL with your own:

```bash
git init
git add .
git status
git commit -m "Import Margin PDF annotation app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Check `git status` before committing: secret env files must stay ignored. Do not paste an API key into source files or commit it to GitHub.

## Project map

- `web/`: dashboard, editor, handwriting capture, rendering, and profile sync.
- `app/api/draft/route.ts`: authenticated OpenAI content generation.
- `app/api/profile/route.ts`: authenticated handwriting account storage.
- `app/api/session/route.ts`: signed-in session information.
- `db/schema.ts` and `drizzle/`: database schema and generated migration.
- `tests/`: automated behavior checks.
- `.openai/hosting.json`: the existing Site's deployment identity and DB binding.

## Run and deploy

Use the package manager declared in `package.json`. Run `pnpm install`, then `pnpm dev` for development, `pnpm build` for production, and `pnpm exec tsc --noEmit` plus `npm run check` for checks. The supplied Sites build integration and D1 binding are intended for Sites hosting. Other hosts need equivalent authenticated user identity, server-side secrets, and database bindings; GitHub Pages alone cannot run these API routes.

For a new local checkout, create an ignored `.env.local` based on `.env.example` and provision the key securely. Hosted secrets are configured separately in Sites. Keep the current Site and database if you want to keep existing account profiles; source imports alone do not copy user data.
