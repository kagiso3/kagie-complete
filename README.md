# Kagie Complete MVP

See [KAGIE_PROJECT_BIBLE.md](./KAGIE_PROJECT_BIBLE.md) for the full product vision, workflows, roles, and roadmap framing.

This package is a **full Kagie starter app** for tertiary applications with:

- User portal
- Assistant admin portal
- Master admin portal
- Learner details
- Document upload workflow
- Institution and course selection
- Cart
- Payment submission
- Application tracking
- Notes and status updates
- Document review

## Very important

This package runs **immediately in demo mode** using your browser storage.
That means you do **not** need coding experience to test the full flow.

## How to run right now

1. Extract the folder.
2. Open `index.html`.
3. Create a user account.
4. Test the full applicant flow.
5. Use the demo admin accounts:
   - Assistant: `assistant@kagie.app` / `123456`
   - Master admin: `admin@kagie.app` / `123456`

## Best way to deploy demo mode

Because this version is static HTML/CSS/JS, you can deploy it easily on:
- Netlify
- Vercel
- GitHub Pages
- Cloudflare Pages

### Simplest deployment on Netlify

1. Create a free Netlify account.
2. Drag and drop the whole `kagie-complete` folder into Netlify deploy.
3. Your app will go live.

## What this version uses

- Frontend: HTML, CSS, JavaScript
- Demo data/backend: localStorage in the browser

## Supabase placeholders

Some pages include placeholder Supabase values in the frontend source.
Those placeholders are automatically ignored in demo mode until you replace them with real project credentials.

## Production upgrade path

Inside the `supabase` folder there is a SQL starter file. Use that when you are ready to move from demo mode to a real backend.

That production step gives you:
- real database
- real authentication
- real storage
- safer deployment

## Pages included

### User pages
- index.html
- signup.html
- login.html
- home.html
- learner.html
- documents.html
- institutions.html
- cart.html
- payment.html
- tracking.html
- notifications.html
- profile.html

### Assistant pages
- assistant/dashboard.html
- assistant/applicant-view.html
- assistant/documents-review.html

### Master admin pages
- master-admin/dashboard.html
- master-admin/application-view.html

## Notes

- The current upload flow stores document names for demo/testing.
- The app is structured so you can later connect it to Supabase.
- This is already enough to show, test, and deploy as a working demo MVP.
