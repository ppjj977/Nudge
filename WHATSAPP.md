# WhatsApp capture — setup

Nudge lets users forward messages, photos and voice notes to a WhatsApp number;
the webhook runs them through the same extraction pipeline as every other
capture. Replies are sent inside the 24-hour customer-service window the user
opens by messaging first, so **no message templates are required**.

The UI (Settings → Connect WhatsApp) only appears once `WHATSAPP_DISPLAY_NUMBER`
is set, so you can deploy this code before the Meta side is ready.

## Quickstart: free test number (£0, no business verification)

This gets the whole loop working for **you + up to ~5 test numbers** at zero cost,
on the real Cloud API. No number to buy, no verification. Do the public-launch
steps later (bottom of this doc).

**1. Create the app**
- Go to <https://developers.facebook.com/> → **My Apps → Create App**.
- Choose use-case **Other** → type **Business** → name it "Nudge".
- (If prompted to pick/create a Business portfolio, create one — name + your
  email is enough; no documents at this stage.)

**2. Add WhatsApp**
- On the app dashboard, find **WhatsApp** → **Set up**.
- This lands you on **WhatsApp → API Setup**, which immediately shows:
  - a **Test number** ("From"),
  - its **Phone number ID** ← copy → `WHATSAPP_PHONE_NUMBER_ID`,
  - a **temporary access token** (24h) ← copy → `WHATSAPP_ACCESS_TOKEN` (swap for
    a permanent one later, step 6 of the full guide below).

**3. Add your mobile as a test recipient**
- Still on **API Setup**, under **To**, click **Manage phone number list** and add
  your own mobile (in E.164, e.g. +447…). WhatsApp sends it a confirmation code;
  enter it. (Test mode only lets you message numbers on this list — that's the
  only limitation of the free tier.)

**4. Grab the app secret**
- **App settings → Basic → App secret → Show** → copy → `WHATSAPP_APP_SECRET`.

**5. Set the env vars on Render**
- In Render → your service → **Environment**, add (see the table below):
  - `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`
  - `WHATSAPP_VERIFY_TOKEN` = any random string you invent (you'll paste the same
    value into Meta next)
  - `WHATSAPP_DISPLAY_NUMBER` = the **test number** in bare digits (e.g.
    `15550001234`) — this makes the Settings → Connect WhatsApp UI appear.
- Save → let Render redeploy.

**6. Wire the webhook**
- Back in Meta → **WhatsApp → Configuration → Webhook → Edit**:
  - **Callback URL:** `https://nudgelive.co.uk/api/whatsapp/webhook`
  - **Verify token:** the exact `WHATSAPP_VERIFY_TOKEN` value
  - Click **Verify and save** (Meta calls our GET handshake — it should go green).
  - Under **Webhook fields**, **Subscribe** to **messages**.

**7. Test the round-trip**
- Open Nudge → **Settings → Connect WhatsApp → Connect** (sends `NUDGE-XXXX` to the
  test number from your phone). You should get "✅ Connected!".
- Now forward a message / photo / voice note → it should reply "✅ Added …" and the
  task should appear in your timeline.

> ⚠️ The **temporary token expires in 24h**. For anything beyond a quick test,
> create a permanent System-User token (full guide, step 3) before it lapses.

When you're happy, do the **public-launch** steps at the bottom (own number +
business verification) — the code doesn't change, only the number and token.

## What you need from Meta

1. A **Meta Business account** and an app in the [Meta developer portal](https://developers.facebook.com/).
2. Add the **WhatsApp** product → you get a **test number** and a **phone number id** immediately (enough to build/test unverified).
3. A **permanent access token** (create a System User in Business Settings, assign the app, generate a token with `whatsapp_business_messaging` + `whatsapp_business_management`).
4. **Business Verification** before you can message real users at scale / use your own number (this is the step that needs a registered business — see the launch notes).

## Env vars (Render → Environment)

| Var | Where it comes from |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | A random string you invent; paste the same value into Meta's webhook config |
| `WHATSAPP_APP_SECRET` | App → Settings → Basic → App secret |
| `WHATSAPP_ACCESS_TOKEN` | The system-user token from step 3 |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp → API setup → "Phone number ID" |
| `WHATSAPP_DISPLAY_NUMBER` | The number in E.164 digits, e.g. `447700900123` (drives the wa.me link) |
| `WHATSAPP_GRAPH_VERSION` | Optional; defaults to `v21.0` |

## Wire the webhook

In Meta → WhatsApp → Configuration → Webhook:

- **Callback URL:** `https://nudgelive.co.uk/api/whatsapp/webhook`
- **Verify token:** the same value as `WHATSAPP_VERIFY_TOKEN`
- **Subscribe** to the `messages` field.

Meta calls the URL with a `GET` handshake (the route echoes `hub.challenge`),
then `POST`s inbound messages (the route verifies the signature and processes
them).

## How linking works

1. User opens **Settings → Connect WhatsApp**, taps **Connect** (a `wa.me` deep-link
   pre-filled with `Link my Nudge: NUDGE-XXXX`).
2. They send it. The webhook matches the `NUDGE-XXXX` code to their account,
   stores the sender's number, and replies "✅ Connected!".
3. Every later message from that number is captured and turned into reminders.

## Cost & gating notes

- **Inbound capture is free** (user-initiated service messages). The real cost is
  the Groq extraction per message — already covered by the free-tier 10/month cap
  enforced in `lib/pipeline.ts`.
- To make WhatsApp **Pro-only**, add an `isPro(user)` check in
  `app/api/whatsapp/webhook/route.ts` before `captureMessage`.
- **Reminders out** would be business-initiated and need approved templates (paid).
  Nudge deliberately keeps reminders on push/email; WhatsApp is capture-only.

## Going live (public launch)

The code is identical — you only swap the test number/token for real ones:

1. **Add your own number** — WhatsApp → API Setup → **Add phone number** (must be a
   number *not* currently on any WhatsApp/WhatsApp Business app; it receives an
   OTP). Update `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_DISPLAY_NUMBER`.
2. **Business Verification** — Business Settings → **Security Centre → Start
   verification**. This is the step that needs a **registered business** (legal
   name, address, and a registration document or matching business domain/phone).
   Free, but can take a few days. Until it passes you're capped to the ~5 test
   recipients; after it passes you can receive from anyone who messages you.
3. **Permanent token** — replace the 24h token with a System-User token (full
   guide, step 3) so it never lapses.
4. **Display-name review** — set the business display name; Meta reviews it before
   it shows to users.

Nothing in the app changes between test and live — same webhook, same pipeline.
