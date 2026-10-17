# Margin handwriting capture

`index.html` is a self-contained drawing page for a stylus, finger, or mouse. It runs without Google login, the AI API, or the Cloudflare backend. It saves the drawn samples on the current browser and exports `margin-handwriting-backup.json`, using the same version-1 profile format as the full Margin app. All six slots per character are retained, including intentionally empty slots.

## Enable this page on GitHub

1. Open the repository's **Settings → Pages**.
2. Under **Source**, choose **Deploy from a branch**.
3. Choose **main**, then **/docs**, and click **Save**.
4. Wait for the Pages deployment. GitHub will show the actual published address on that settings page.

Expected project address after activation:

https://arjuncoolkarni18-sudo.github.io/Annotater-Agent/

An allowed github.com repository does not guarantee that your school allows github.io. If the Pages address is blocked, use an approved device or request a site review. This page does not modify device or network filtering settings.

## Capture and transfer

Open the page on the stylus device, draw in the six sample boxes, and tap **Download handwriting**. Save the JSON file in Files or Downloads. Transfer that file through an approved file-sharing method to the personal device running Margin. In Margin, open the handwriting profile and choose **Import backup**. Wait for **Saved to your account** if you want to restore it later through your Margin account.

The capture page itself has no account sync. Its browser storage is separate from the full app's storage. A backup from the full app can also be imported here before drawing more samples. Existing samples are only replaced after confirmation when a new backup is imported.

## Maintenance

Run `npm run build:capture` to rebuild this file from `web/capture.html`, `web/capture.js`, and the app's shared profile validation and handwriting renderer. No external scripts, fonts, accounts, or data connections are required after loading the page. Its Content Security Policy disables network data connections.

Automated checks cover pointer-coordinate scaling, six-slot preservation, compatible backup export, and next-character selection. Actual stylus/browser behavior must be verified on the intended device.
