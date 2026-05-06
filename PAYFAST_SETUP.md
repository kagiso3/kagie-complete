# Kagie PayFast Setup

Use this when you want Kagie payments to come to your PayFast account and then settle to your own South African bank account.

## 1. Put your public banking details into Kagie

Set these Vercel environment variables:

- `KAGIE_MERCHANT_NAME`
- `KAGIE_BANK_NAME`
- `KAGIE_BANK_ACCOUNT_NUMBER`
- `KAGIE_BANK_ACCOUNT_TYPE`
- `KAGIE_BANK_BRANCH_CODE`
- `KAGIE_PAYMENT_REFERENCE_PREFIX`
- `KAGIE_PAYMENT_VERIFICATION_MESSAGE`

Also update:

- `KAGIE_SUPPORT_PHONE`
- `KAGIE_SUPPORT_EMAIL`

## 2. Keep PayFast enabled

In Vercel environment variables, keep:

- `KAGIE_PAYFAST_ENABLED=true`
- `KAGIE_YOCO_ENABLED=false`

## 3. Add the PayFast server keys in Vercel

In Vercel Project Settings -> Environment Variables, add:

- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`

And keep:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Use Kagie's live PayFast endpoints

Kagie already uses these live routes:

- Checkout: `/v1/payments/payfast/checkout`
- ITN: `/v1/payments/payfast/itn`

## 5. Redeploy

Redeploy the Vercel project after saving the environment variables.

## 6. Test

Open checkout and confirm:

- `PayFast secure checkout` shows first
- your bank details show in the manual payment panel
- PayFast redirects correctly
- successful payments return to Kagie
