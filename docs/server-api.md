# EchoPass: ce trimite aplicația la server și ce primește

Doar contractul dintre aplicație și server: fiecare cerere a aplicației și răspunsul pe care îl așteaptă.

## Convenții

- Prefix `/api/v1`. Corp și răspuns JSON. Date ISO 8601 UTC (`AAAA-LL-ZZ` unde e doar data). Sume în lei (`RON`).
- Header pe toate cererile: `Authorization: Bearer <accessToken>`, în afară de `/auth/anonymous`, `/auth/refresh`, `/auth/otp/start`, `/auth/signin`. Pe serverul de test: `X-User-Id: <id>` în loc de token.
- `Idempotency-Key: <uuid>` pe `confirm` și `renew`.
- Listele (`/charges`, `/notifications`, `/trips/recent`): `?limit=` (implicit 50, maxim 100) și `?before=<id>`; răspuns cu cele mai noi primele.
- Eroare, același format pe toate endpoint-urile:

```json
{ "error": { "code": "PAYMENT_DECLINED", "message": "Plata a fost refuzată." } }
```

| Cod | HTTP | Când |
| --- | --- | --- |
| `AUTH_INVALID` | 401 | token lipsă, invalid sau expirat |
| `ACCOUNT_REQUIRED` | 403 | utilizator anonim care încearcă să plătească |
| `FORBIDDEN` | 403 | fără drept |
| `NOT_FOUND`, `VEHICLE_UNKNOWN` | 404 | resursă sau autobuz necunoscut |
| `VALIDATION_ERROR` | 400 | corp greșit |
| `PAYMENT_DECLINED` | 402 | plata refuzată |
| `NO_PAYMENT_METHOD` | 409 | fără card și fără abonament valid |
| `SESSION_EXPIRED` | 409 | `confirm` sau `decline` după expirarea sesiunii |
| `IDEMPOTENCY_CONFLICT` | 409 | aceeași `Idempotency-Key` cu alt corp |
| `IDENTITY_IN_USE` | 409 | identitatea are deja cont |
| `RATE_LIMITED` | 429 | prea multe cereri |
| `SERVER_ERROR` | 500 | altceva |

---

## 1. Sighting-uri ✅

**Aplicația trimite**

```
POST /sightings
{ "bus_id": 101, "slot": 59788182, "token": "a9f3c2104e7b19d05c8ae13f7726b4d1",
  "rssi": -54, "clock_synced": true }
```

| Câmp | Tip |
| --- | --- |
| `bus_id` | întreg 0–65535 |
| `slot` | întreg (`unix time / 30`) |
| `token` | 32 de caractere hex mici |
| `rssi` | întreg, dBm brut |
| `clock_synced` | boolean |

O cerere per autobuz și per slot (~30 s). La eroare de rețea, aplicația retrimite cel mult 2 minute.

Câmpuri opționale, trimise într-o versiune ulterioară a aplicației: `heard` (întreg), `rssi_min`, `rssi_max` (întregi), `activity` (`still` · `walking` · `running` · `on_bicycle` · `in_vehicle` · `unknown`), `speed_mps` (număr), `lat`, `lng`, `accuracy_m` (numere, doar cu consimțământul utilizatorului).

**Aplicația primește**

| HTTP | Corp |
| --- | --- |
| `200` | `{ "ok": true, "ride_status": "pending" }` (`ride_status` are valorile `status` din secțiunea 2) |
| `422` | `{ "ok": false, "reason": "token not issued by this bus recently" }` (token invalid sau mai vechi de ~2 minute, sau `clock_synced: false`) |
| `400` | – (corp invalid) |
| `401` | – (utilizator necunoscut) |

---

## 2. Îmbarcare 📝

**Aplicația trimite**

```
GET /rides/current
If-None-Match: "v42"
```

**Aplicația primește**

```
200
ETag: "v42"
{
  "status": "awaiting_confirmation",
  "sessionId": "sess-123",
  "updatedAt": "2026-11-04T10:15:02Z",
  "pollAfterMs": 3000,
  "vehicle": { "busId": 101, "line": "15", "destination": "T. Grozăvescu" },
  "candidates": [],
  "payment": null,
  "charge": null
}
```

sau `304` fără corp dacă starea nu s-a schimbat.

| `status` | Sens |
| --- | --- |
| `none` | nicio călătorie |
| `pending` | încă nu e sigur că utilizatorul e în autobuz |
| `awaiting_confirmation` | e în autobuz, așteaptă confirmarea plății |
| `payment_failed` | plata a eșuat |
| `confirmed` | plătit, bilet emis |
| `rejected` | nu a urcat sau a refuzat |
| `ended` | a coborât |

| Câmp | Valoare |
| --- | --- |
| `sessionId` | `null` la `none` |
| `pollAfterMs` | după câte milisecunde interoghează din nou: `3000` la `pending`, `awaiting_confirmation`, `payment_failed`; `15000` la `confirmed`; `null` la `none`, `rejected`, `ended` |
| `vehicle` | prezent la `awaiting_confirmation`, `payment_failed`, `confirmed`, `ended`; altfel `null`; `destination` e opțională |
| `candidates` | `[]`, sau `[{ "busId", "line" }]` când pasagerul aude mai multe autobuze și serverul nu poate alege (atunci `vehicle` e `null`) |
| `payment` | la `payment_failed`: `{ "reason": "card_declined" \| "authentication_required", "clientSecret"? }`; `clientSecret` doar la `authentication_required`; altfel `null` |
| `charge` | `Charge` la `confirmed` și `ended`; altfel `null` |

**Confirmare**

```
POST /rides/{sessionId}/confirm
Idempotency-Key: <uuid>
{ "passengers": 2, "sourceId": "card-1", "busId": 101 }
```

`passengers` 1–10. `sourceId` opțional (implicit cardul implicit). `busId` obligatoriu doar când `candidates` nu e gol.
Aplicația primește același obiect ca la `GET /rides/current`. Erori: `PAYMENT_DECLINED` (cu `reason`), `NO_PAYMENT_METHOD`, `ACCOUNT_REQUIRED`, `SESSION_EXPIRED`.

**Refuz**

```
POST /rides/{sessionId}/decline
```

Aplicația primește același obiect (`rejected`). Eroare: `SESSION_EXPIRED`.

**„Sunt în autobuz"**

```
POST /rides/manual
```

Aplicația primește același obiect. `422` dacă nu există un sighting valid din ultimele 2 minute.

**Push** primit când aplicația e închisă:

```json
{ "type": "awaiting_confirmation" | "payment_failed" | "charge_cancelled", "sessionId": "sess-123" }
```

---

## 3. Autentificare și cont 📝

| Aplicația trimite | Aplicația primește |
| --- | --- |
| `POST /auth/anonymous` `{ "deviceId" }` | `{ "userId", "accessToken", "refreshToken", "expiresIn" }` |
| `POST /auth/refresh` `{ "refreshToken" }` | la fel |
| `POST /auth/otp/start` `{ "phone" }` | `204` |
| `POST /auth/link` `{ "provider": "google"\|"apple"\|"phone", "idToken" \| "phone", "code" }` | `{ "userId", "tier", "accessToken", "refreshToken" }` (același `userId`); `409 IDENTITY_IN_USE` |
| `POST /auth/signin` `{ "provider", "idToken" \| "phone", "code", "deviceId" }` | `{ "userId", "tier", "accessToken", "refreshToken" }` ale contului existent |
| `POST /auth/logout` | `204` |
| `GET /me` | `{ "id", "tier": "anonymous"\|"account", "name?", "email?", "identities": [], "settings" }` |
| `PATCH /me` `{ "name?", "settings?" }` | `/me` actualizat |
| `DELETE /me` | `204` |

`settings`: `autoCharge` (`false`), `tripReminders` (`false`), `arrivalAlerts` (`false`), `disruptions` (`true`), `locationSharing` (`false`).

---

## 4. Portofel 📝

| Aplicația trimite | Aplicația primește |
| --- | --- |
| `GET /wallet/items` | `WalletItem[]` |
| `POST /wallet/payment-methods/setup` | `{ "clientSecret" }` |
| `POST /wallet/payment-methods` `NewCardInput` | `WalletItem` |
| `POST /wallet/passes` `NewPassInput` | `WalletItem` |
| `DELETE /wallet/items/{id}` | `204` |
| `PUT /wallet/default-source` `{ "id" }` | `204` |
| `GET /passes/catalog` | `[{ "id", "name", "days", "priceRon", "lines" }]` |
| `POST /wallet/passes/{id}/renew` `{ "productId", "sourceId" }` + `Idempotency-Key` | `{ "item": WalletItem, "charge": Charge }` |

---

## 5. Taxări, extras și bilet 📝

| Aplicația trimite | Aplicația primește |
| --- | --- |
| `GET /charges` | `Charge[]` |
| `GET /statements/{AAAA-LL}` (de ex. `/statements/2026-10`) | `200` cu `Content-Type: application/pdf`: extrasul lunii, cu călătoriile (`RecentTrip`) și totalul; `404 NOT_FOUND` dacă luna nu are călătorii |
| `GET /tickets/public-key` | `{ "keys": [{ "kid", "alg": "EdDSA", "publicKey" }] }` (`publicKey` base64url) |
| `POST /tickets/verify` `{ "qrToken" }` (doar rol inspector) | `{ "valid", "line", "passengers", "expiresAt", "paid" }` |

`qrToken` e JWT EdDSA, cu header `kid` și claim-urile `cid`, `line`, `pax`, `iat`, `exp`.

---

## 6. Istoric, notificări, raportări 📝

| Aplicația trimite | Aplicația primește |
| --- | --- |
| `GET /trips/recent` | `RecentTrip[]` |
| `GET /trips/saved` | `SavedRoute[]` |
| `GET /notifications` | `Notification[]` |
| `POST /notifications/{id}/read` | `204` |
| `POST /devices` `{ "pushToken", "platform": "ios"\|"android" }` (`pushToken` = token Expo) | `204` |
| `GET /reports` | `Report[]` |
| `POST /reports` `{ "kind", "line" }` | `Report` |
| `POST /reports/{id}/confirm` | `Report` |

---

## 7. Modele

`?` = opțional.

**Charge**: `id`, `line`, `destination?`, `amount` (≥ 0), `currency` (`"RON"`), `status` (`in_progress` · `completed` · `covered_by_pass` · `cancelled`), `paidWith` (id card sau abonament), `startedAt`, `endedAt?`, `qrToken`.

**WalletItem**
- Card (`kind: "card"`): `id`, `network` (`visa`/`mastercard`/`other`), `last4`, `holder`, `expiry` (`"LL/AA"`), `token`, `bank?`, `tag?` (`"Google Pay"`/`"Apple Pay"`).
- Abonament (`kind: "pass"`): `id`, `name`, `holder`, `validFrom`, `validUntil`, `lines` (`"all"` sau `["15","33"]`), `theme` (`ocean`/`sunset`/`forest`), `cardNumber?`, `verified` (boolean).

**NewCardInput**: `paymentMethodId`, `walletPay?` (`google_pay`/`apple_pay`), `network`, `last4`, `holder`, `expiry`.

**NewPassInput**: `cardNumber`, `name`, `holder`, `validUntil`, `lines`, `theme`.

**RecentTrip**: `id`, `from`, `to`, `date`, `time?` (`HH:MM`), `line?`, `fareRon`, `distanceKm`, `durationMin`.

**SavedRoute**: `id`, `from`, `to`, `line`.

**Notification**: `id`, `kind` (`delay`/`charge`/`crowding`/`renewal`), `title`, `body`, `createdAt`, `read`.

**Report**: `id`, `kind` (`traffic`/`accident`/`breakdown`/`works`/`crowding`/`detour`), `line`, `stopName`, `confirmations`, `expiresAt`, `createdAt?`.
