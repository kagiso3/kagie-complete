# Kagie Final QA Checklist

Use this checklist before public launch.

Mark each item:

- `PASS`
- `FAIL`
- `SKIP`

If anything fails, take a screenshot and note the page name.

---

## 1. Student Web Flow

### A. Signup

Open:

- `signup.html`

Test:

1. Create a new student account with a fresh email
2. Confirm signup completes without error

Expected:

- account is created
- no red error message
- user appears in Supabase Auth users

### B. Login

Open:

- `login.html?switch=1`

Test:

1. Log in with the same student account

Expected:

- login succeeds
- user lands in `home.html`

### C. Forms

Open:

- `forms.html`

Test:

1. Fill learner details
2. Save learner details
3. Fill guardian details
4. Save guardian details
5. Fill school details
6. Save school details
7. Add at least 5 subjects
8. Save marks
9. Select one package
10. Add at least 1 institution with all 3 choices

Expected:

- no `stack depth limit exceeded`
- no broken `Next` or dead buttons
- package saves correctly
- institution adds correctly
- shortlist appears on the page

### D. Cart

Open:

- `cart.html`

Test:

1. Check the selected package
2. Check the added institutions
3. Test `Clear cart`
4. Re-add package and institution from forms

Expected:

- correct package name and price
- institutions listed correctly
- clear cart works
- re-adding works

### E. Checkout

Open:

- `checkout.html`

Test:

1. Enter payer full name
2. Enter payer phone
3. Enter payment reference
4. Choose payment method
5. Confirm payment

Expected:

- checkout submits without error
- application moves to `Application being processed`
- payment moves to `Pending Verification`

### F. Dashboard

Open:

- `Dashboard.html`

Expected:

- latest application appears
- correct application status appears
- correct payment status appears
- notifications count updates
- progress/readiness shows meaningful data

### G. Notifications

Open:

- `notifications.html`

Test:

1. View notifications
2. Mark one as read

Expected:

- notifications display
- marked notifications stay read

### H. Support

Open:

- `personal-assistance.html`

Test:

1. Send one support message
2. Request one callback

Expected:

- support message appears
- callback request saves
- dashboard/inbox reflects support activity

---

## 2. Student Mobile Flow

Run:

1. Kagie API
2. Kagie mobile app

Test:

1. Register or log in
2. Open mobile dashboard
3. Fill learner details
4. Fill guardian details
5. Fill school details
6. Add marks
7. Choose package
8. Add institution
9. Open cart
10. Submit checkout
11. Open inbox
12. Send support message
13. Open profile
14. Open explore

Expected:

- app opens without crash
- login works
- data saves
- package and institution flow works
- checkout works
- inbox works
- explore shows updates, services, and prospectus

---

## 3. Master Admin Web Flow

Open:

- `master-admin/dashboard.html`

Test:

1. Log in as master admin
2. View applications
3. Create assistant account
4. Assign assistant to an application
5. Send a global notification

Expected:

- dashboard loads
- assistant creation works
- application assignment works
- notification sending works

---

## 4. Assistant Web Flow

Open:

- `assistant/dashboard.html`

Test:

1. Log in as assistant
2. View assigned applications
3. Open applicant view
4. Review documents
5. Check support/callback data

Expected:

- assistant can access assigned work
- review pages open
- support/callback data is visible

---

## 5. Domain And Deploy Check

### Web

Expected:

- deployed site opens on Netlify URL
- deployed site opens on custom domain
- HTTPS works

### Domain

Expected:

- `kagie.app` loads
- `www.kagie.app` redirects correctly
- SSL certificate is active

---

## 6. API Check

Expected:

- deployed API health route responds
- mobile app can connect to live API
- no CORS errors on live site

Suggested test:

- open `/v1/health` on the API URL

---

## 7. Play Store Readiness

Expected:

- Android icon is set
- splash screen is set
- app name is correct
- privacy policy URL works
- support email is correct
- `.aab` build completes

---

## 8. Launch Decision

Launch only if:

1. student web flow = PASS
2. mobile flow = PASS
3. master admin flow = PASS
4. assistant flow = PASS
5. custom domain + HTTPS = PASS
6. API live check = PASS

If any of those fail:

- do not launch publicly yet
- fix the failure first

---

## 9. Screenshot List To Keep

Keep screenshots of:

1. signup success
2. forms package selection
3. cart
4. checkout success
5. dashboard with live status
6. master admin dashboard
7. assistant dashboard
8. mobile dashboard
9. mobile cart
10. mobile inbox

These help with debugging and Play Store/store listing preparation.
