# Publishing

The public pages live at <https://vidlun.app> (Cloudflare Pages; the
vidlun-legal.pages.dev address keeps working as an alias)
(`/privacy`, `/terms`, `-en` variants). After editing any document here:

    node scripts/build-legal.mjs        # the in-app screens
    node scripts/build-legal-site.mjs   # legal/site/
    npx wrangler pages deploy legal/site --project-name=vidlun-legal --branch=main --commit-dirty=true

App Store Connect's privacy policy URL points at https://vidlun.app/privacy,
the support URL at https://vidlun.app/support.
