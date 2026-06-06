# WhatsApp capture — setup

Nudge lets users forward messages, photos and voice notes to a WhatsApp number;
the webhook runs them through the same extraction pipeline as every other
capture. Replies are sent inside the 24-hour customer-service window the user
opens by messaging first, so **no message templates are required**.

The UI (Settings → Connect WhatsApp) only appears once `WHATSAPP_DISPLAY_NUMBER`
is set, so you can deploy this code before the Meta side is ready.

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
