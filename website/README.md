# squibble.pro website

The public marketing/download page for Squibble — separate from the self-hosted
app in the rest of this repo. This is a plain static site (no build step, no
framework) so it can deploy independently to squibble.pro without touching the
self-hosted product's routing.

It's a recreation of the original squibble.pro landing page (from back when
Squibble was a hosted, paid SaaS with Google Sign-In and Stripe billing),
adapted for the free/open-source/self-hosted pivot: sign-in buttons became
"Download on GitHub" links, the paid pricing tiers became a "Get started"
section with a quick-start snippet, and the Privacy Policy/Terms of Service
were rewritten to reflect that there's no Squibble server or account anymore.

## Structure

```
website/
├── index.html      # home page (hero, demo, social proof, get-started, FAQ)
├── about.html       # founder story
├── privacy.html      # privacy policy
├── terms.html         # terms of service
├── css/landing.css     # design system, ported from the original SaaS landing page
├── js/main.js            # nav scroll state, scroll-reveal, FAQ accordion
├── js/workflow-diagram.js # animated hero diagram (vanilla-JS port of the old React component)
└── assets/                # logos, university marks, workflow icons, proof screenshot
```

## Preview locally

No build step — just serve the folder:

```bash
cd website
npx serve .
# or: python3 -m http.server 8080
```

## Deploying

This is a static site — deploy it to Vercel, Netlify, GitHub Pages, or any
static host, pointed at the `website/` folder. It has no dependency on the
Next.js app in the rest of this repo (no shared build, no shared server).

## Updating the GitHub link

The download CTAs and quick-start snippet point at
`https://github.com/pal2156/squibble`. If the repo ever moves, update it in:
`index.html`, `about.html`, `privacy.html`, `terms.html`.
