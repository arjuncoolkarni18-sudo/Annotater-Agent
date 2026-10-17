# Launch Margin with Google login

This version can run at a separate Cloudflare address without ChatGPT sign-in. The code is prepared; Google login is not live until the account setup below is finished. The existing ChatGPT-hosted Site stays available during the move.

## 1. Connect your repository to Cloudflare

1. Open https://dash.cloudflare.com/ and sign in or create an account.
2. Open **Workers & Pages → Create application**, choose the GitHub import option, and authorize access to `arjuncoolkarni18-sudo/Annotater-Agent`.
3. Select that repository and its `main` branch. Set the Worker name to **annotater-agent**.
4. Use these settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (leave blank) |
| Build command | `npm run build:google` |
| Deploy command | `npm run deploy:google` |
| Preview deployments | Disable while setting up Google |

5. Deploy. Wrangler uses `wrangler.google.jsonc`, automatically creates or reconnects the `DB` database, then applies the SQL migration. The page initially says **Almost ready** until sign-in is configured.
6. Copy the actual Worker address Cloudflare returns. Do not guess the account subdomain. Future pushes to this connected GitHub branch trigger a deployment.

## 2. Register Google sign-in

1. Open https://console.cloud.google.com/ and select or create a project.
2. Open **Google Auth Platform**. Configure branding with the name **Margin** and your support/contact email.
3. Configure its audience. For personal access during setup, use **External**, leave the app in testing, and add the Google email you will actually sign in with as a test user.
4. Create a client with application type **Web application**.
5. Add this **Authorized redirect URI**, replacing the address with the actual origin from Cloudflare:

   `https://YOUR-WORKER-ADDRESS/auth/callback`

6. Save the client ID and client secret. Do not commit the client secret to GitHub or paste it into a chat. This code uses a server-side authorization-code flow, not a browser popup or an unverified ID token.

## 3. Configure the deployed Worker

Open the Worker in Cloudflare, then **Settings → Variables and Secrets → Add**. Store all five values as **Secret** so they persist independently of committed code:

| Name | Value |
| --- | --- |
| `APP_ORIGIN` | The actual HTTPS address, without a trailing slash |
| `ALLOWED_EMAILS` | Your Google email; comma-separate additional approved emails if needed |
| `GOOGLE_CLIENT_ID` | The web client ID from Google |
| `GOOGLE_CLIENT_SECRET` | Its client secret |
| `OPENAI_API_KEY` | Your existing OpenAI API key, entered directly into Cloudflare |

Deploy the settings, open the address, and click **Continue with Google**. No API key is included in this project. The secret configured on the old Site is not automatically copied to Cloudflare.

Only verified Google emails on the allowlist can sign in. Google accounts use their stable subject ID for data ownership. Opaque, expiring session cookies are HttpOnly and Secure; signing out revokes the session on the server. Drafting defaults to 25 requests per signed-in account per UTC day. `DAILY_AI_LIMIT` in the configuration can change this; this is a request cap, not a guaranteed dollar budget.

## 4. Bring your existing handwriting and PDFs

Google accounts and the old Site have separate account identities and storage. Signing in with an email that looks the same does not automatically merge the two accounts.

1. On your computer, open the original Site and its handwriting profile.
2. Click **Backup profile** to save `margin-handwriting-backup.json`. The existing export preserves all six sample slots.
3. Open the new address, sign in with Google, open the handwriting profile, and click **Import backup**. Select that JSON file.
4. Wait for **Saved to your account** before switching devices.
5. On the iPad, open the same new address and sign in to the same Google account. Its handwriting profile should restore from the new account database.

PDF history remains device-local. Export any annotated PDFs you want to transfer, send those files to the iPad, and reopen them in Margin. Editable exports restore text, positions, styles, and the document's handwriting. Repeated exports do not bake duplicate copies of those notes onto the page.

## 5. Check before relying on the new address

- Sign in, import your backup, and wait for account saving.
- Generate a suggestion on a small selectable-text PDF. A reference textbook is optional.
- Move, resize, and edit a note, export, and reopen the resulting PDF in Margin.
- Open the new address on your iPad and verify handwriting restoration. Your school must allow the host and Google sign-in; this setup cannot guarantee that a managed device permits them.

## Development and checks

Use Node 24 for the full test suite (the server tests use built-in SQLite). Run `npm run check:google`; its tests include mocked Google authentication against real SQLite plus the existing handwriting, account-sync, and editable-PDF checks. `npm run build:google` copies the frontend to `dist-google/`. `wrangler deploy --config wrangler.google.jsonc --dry-run` bundles the independent Worker. Google account consent, real Cloudflare provisioning, and browser/iPad behavior require live verification after configuration.

The existing `app/` routes and original build scripts remain as the previous Sites implementation. The Google deployment uses only `standalone/worker.mjs`, its imported helpers, and `web/`; it does not trust ChatGPT identity headers or contact the old Site.

Official references:

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.google.com/identity/protocols/oauth2/web-server
