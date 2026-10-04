# Resume Tailor: standalone website

This folder is the whole site. Anyone with the link can use it, with no Claude account needed.

## What's in it
- `index.html`: the app (same as the Claude artifact version).
- `netlify/edge-functions/ai.js`: a small server piece that holds your Anthropic API key and passes requests to Claude. The key never reaches visitors' browsers.
- `netlify.toml`: tells Netlify to publish this folder.

## Set it up on Netlify (about 10 minutes)
1. **Get an API key.** Sign in at console.anthropic.com, add a payment method under Billing (API usage is billed separately from a Claude.ai subscription), then create a key under API keys. A monthly spend limit under Billing > Limits is a good idea.
2. **Deploy the folder.** Drag-and-drop uploads skip the server function, so use one of these:
   - **GitHub:** put this folder in a GitHub repository, then in Netlify choose Add new project > Import an existing project and pick that repository. Later changes pushed to GitHub go live automatically.
   - **Command line:** with Node installed, open a terminal in this folder and run `npx netlify-cli deploy --prod`.
3. **Add the key.** Site configuration > Environment variables > Add:
   - `ANTHROPIC_API_KEY` = your key
   - `ACCESS_CODE` = a code people must type to use the site (optional; share it only with people you want to allow, so strangers can't spend your credits)
   - `MODEL` = leave unset to use `claude-sonnet-5-5`
4. **Redeploy** (Deploys > Trigger deploy) so the function picks up the variables.
5. Open the site. If the Tailor button is enabled, it's working.

## Cost
Each tailored resume is one request: roughly 5,000–15,000 input tokens and 2,000–4,000 output tokens, plus a little more for photo uploads. At Sonnet-class pricing, that's typically a few cents per resume. Check current rates on Anthropic's pricing page.

## Privacy
Resume text and job descriptions go from the visitor's browser to your Netlify function and on to Anthropic's API. Nothing is stored on the server. Each visitor's drafts are saved only in their own browser.
