# Publishing

The public pages live on Cloudflare Pages at <https://vidlun-legal.pages.dev>
(`/privacy`, `/terms`, `-en` variants). After editing any document here:

    node scripts/build-legal.mjs        # the in-app screens
    node scripts/build-legal-site.mjs   # legal/site/
    npx wrangler pages deploy legal/site --project-name=vidlun-legal --branch=main --commit-dirty=true

App Store Connect's privacy policy URL points at `/privacy`.
