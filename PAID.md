# Paid services needed before real-world deployment

Everything in this app runs free during development and demos. But a few features depend on
third-party services that **charge money once the school actually starts using them for real** —
this document lists exactly which ones, why, and roughly what they cost, so there are no
surprises at go-live.

## 1. Twilio (or another SMS provider) — required for Mobile + OTP login

The "Phone number + OTP" login option sends a one-time code by SMS. Supabase Auth doesn't send
SMS itself — it relays through a provider you connect in the Supabase dashboard. The supported
options are **Twilio, MessageBird, Vonage, or TextLocal**; Twilio is the most common choice.

- Needs a Twilio account with a phone number purchased and SMS enabled.
- Billed per SMS sent (a few cents each) plus a small monthly number rental fee.
- Without this configured, the Phone + OTP login option will fail to send codes — Email +
  Password and Google login are unaffected.
- **Not required** if you decide to launch with Email + Password and Google login only, and add
  OTP later.

This is separate from the *existing* SMS fallback used for urgent message broadcasts
(`src/lib/notifications/sms.ts`), which is intentionally designed to run on a spare Android phone
acting as an SMS gateway — that one stays free (just the school's normal mobile plan). Only the
new OTP-login SMS goes through Twilio.

## 2. Vercel Pro plan — required for the every-15-minutes Cron job

The Google Sheets sync and reminder dispatch (`/api/cron/tick`, configured in `vercel.json`) runs
every 15 minutes. Vercel's free **Hobby** plan only allows cron jobs to run **once per day** — it
will silently downgrade or reject a 15-minute schedule.

- To keep the 15-minute sync/reminder cadence, the Vercel project needs to be on the **Pro plan**
  (currently ~$20/month per team member).
- Alternative if you want to stay on the free Hobby plan: reduce the cron schedule to once a day
  (edit `vercel.json`) and rely on the manual "Sync now" button in `/console/sync` for anything
  more time-sensitive. Reminders would then only fire once daily rather than within 15 minutes of
  their due time.

## 3. Google Cloud — Sheets + Drive API (usually free, but needs a billing account attached)

The roster/academic-config sync uses a Google Cloud **service account** to read/write the shared
Google Sheet via the Sheets API and Drive API.

- The Sheets and Drive APIs themselves are **free** at the usage levels a single school will hit —
  there's no per-call charge in the normal range.
- However, Google Cloud increasingly requires a **billing account linked to the project** (even if
  nothing on it is actually billed) to keep API access enabled long-term and to raise you past the
  default free quota. Attach a billing account to avoid the sync silently breaking later.
- Google Workspace accounts (if the school uses Workspace rather than free Gmail for staff email)
  may also have their own per-seat cost — but that's a pre-existing school decision, not something
  this project adds.

## 4. Supabase — likely fine on the free tier for now, revisit at scale

No new Supabase cost was introduced by this build — but worth flagging since usage grew a lot
(11 new tables, more RLS policies, more Edge/API traffic from the cron job). Supabase's free tier
has caps on database size, monthly active users, and Edge Function invocations. Keep an eye on the
Supabase dashboard's usage page after go-live; upgrading to the **Pro plan** (~$25/month) is the
likely next step once real student/parent traffic starts.

## 5. Firebase Storage — likely fine on the free (Spark) tier for now

Used for report-card PDFs, payment receipts, and message attachments. Free tier (5GB storage,
1GB/day download) is generally enough for a single school, but will need Firebase's pay-as-you-go
**Blaze plan** if attachment/PDF volume grows significantly.

## Free — no action needed

- **Web Push notifications** (VAPID) — free, no service to pay for.
- **Google SSO login** — free (no Google Cloud charge for OAuth sign-in itself, only the Sheets/
  Drive API usage above).
- **WhatsApp click-to-chat** — free (it's just a `wa.me` link, not the paid WhatsApp Business API).

---

## Security note: the Google service-account key file

`manthan-portal-296f3174bb19.json` (sitting in the project root) is the downloaded Google Cloud
service-account key — it grants direct programmatic access to the Sheets/Drive resources it's
scoped to. Treat it exactly like a password:

- It is now excluded from git via `.gitignore` (added in this pass) — it will not get committed.
- Even so, **don't leave it sitting in the project folder long-term**. Extract just the two fields
  the app actually needs — `client_email` and `private_key` — into the `GOOGLE_SHEETS_CLIENT_EMAIL`
  / `GOOGLE_SHEETS_PRIVATE_KEY` environment variables (in Vercel's project settings, not committed
  anywhere), then delete the JSON file from the project folder and store it somewhere access-
  controlled (a password manager or your cloud provider's secret store) in case you need it again.
- If this file is ever accidentally shared, committed, or uploaded anywhere, treat it as
  compromised and regenerate the service-account key in Google Cloud Console immediately.
