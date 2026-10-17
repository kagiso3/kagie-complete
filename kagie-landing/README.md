# Kagie landing page

A responsive Next.js App Router landing page recreated from the supplied Kagie reference. Built with React, strict TypeScript, Tailwind CSS 4, and Lucide React. The latest requested primary color is `#e30000`; red accents use linear gradients. Dashboard mockups are HTML components, not screenshots.

## Run

From the repository root:

```sh
npm run dev:landing
```

For a production preview with the existing account and application pages:

```sh
npm run build:landing
npm run preview:landing
```

Open `http://127.0.0.1:3010`. The production preview serves the exported landing page and the existing public Kagie pages. It does not expose repository source, credentials, or configuration files. The Next.js development server only serves the landing app; for account links during development, set `NEXT_PUBLIC_KAGIE_APP_URL=https://kagie.app` in `kagie-landing/.env.local` before starting it.

## Prepare the existing static hosting release

```sh
npm run build:release:landing
```

The standard `npm run build` and `npm run build:release` commands now include this landing page. The release build compiles the Next.js static export, builds the existing application release, and installs the new homepage in both the project root and `web-release`. Publish `web-release` through the existing hosting flow when ready. Building a release does not publish it.

`index.html` and `/_next/` are generated output; edit the React source in this folder. The landing app is registered in the root npm workspaces, so a normal root dependency installation includes it. `npm run test:landing` checks that the generated homepages, referenced assets, and existing account/admin destinations are present.

## Maintain

- `src/lib/content.ts`: copy, routes, institutions, sample testimonials, and supplied marketing numbers. Verify the supplied figures and replace example testimonials with approved student stories before public publication.
- `src/app/globals.css`: shared color, typography, spacing, card, animation, and responsive styles. Tailwind is available for utility composition.
- `src/components/`: focused page sections and isolated interactive components.
- `public/images/`: existing institution logos and app assets; `students.webp` and `student-portraits.webp` are generated design imagery. Portraits illustrate the supplied example stories and do not identify actual reviewers. VUT, MUT, and CPUT use text wordmarks because official image assets were not present.
- Social buttons share Kagie on Facebook, X, and LinkedIn; the email button opens support. Replace them with verified profile destinations if preferred.

The desktop layout preserves the reference's seven feature cards and nine institution cards at widths above 700px. Smaller phones use mobile navigation and stacked content. The mobile navigation supports Escape and outside clicks; testimonials rotate through the supplied stories. FAQ and Help Centre open a native modal dialog with disclosure controls, keyboard dismissal, focus return, and a `#faq` deep link, preserving the reference's page section order. Scroll reveals, phone motion, and animated progress respect reduced motion. Authentication callback forwarding preserves the existing email-confirmation flow. The manifest and HTTPS service-worker registration remain connected; hashed Next.js assets participate in the existing static-asset cache.

The generated student asset used the built-in image generation tool with this brief: “Transparent waist-up cutout of two smiling South African university students, a woman with natural curly hair in a yellow hoodie holding a notebook and a man in a gray shirt with a backpack holding a phone; realistic campaign photography, no text or logos.”

The built-in image tool generated the portrait sheet with this brief: “A 3:1 contact sheet of three equally sized square head-and-shoulders portraits of fictional South African university-age Black students: a smiling man in a pale blue shirt, a smiling woman in a teal top, and a smiling man in a charcoal shirt; centred faces, matching head scale, natural studio lighting, pale grey backgrounds, no text, borders, or logos.” The project asset is `public/images/student-portraits.webp`.
