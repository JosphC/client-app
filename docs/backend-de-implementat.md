# Backend EchoPass: ce trebuie implementat

Documentul ăsta descrie **ce trebuie să facă backend-ul**, ca aplicația EchoPass să funcționeze cap-coadă.

- **Eu** fac aplicația mobilă și BFF-ul (stratul care vorbește cu aplicația). BFF-ul nu există încă.
- **Tu** faci backend-ul: endpoint-urile, regulile, baza de date, serverul.

Două tipuri de conținut, marcate clar:

- ✅ **Validat în aplicație**: modelele din [secțiunea 4](#4-modele-de-date) marcate așa au deja schemă `zod` în cod. Câmpurile trebuie să fie exact acestea.
- 📝 **Propunere**: endpoint-uri și modele pe care aplicația **nu le folosește încă**. Le putem schimba împreună înainte să le implementezi.

Căile endpoint-urilor sunt o propunere. Dacă vrei alte nume, spune-mi și mă adaptez.
Întrebările deschise sunt în [secțiunea 7](#7-de-confirmat).

---

## Cuprins

1. [Priorități](#1-priorități)
2. [Reguli de business](#2-reguli-de-business)
3. [Endpoint-uri](#3-endpoint-uri)
4. [Modele de date](#4-modele-de-date)
5. [Cerințe generale](#5-cerințe-generale)
6. [Cum verificăm că e gata](#6-cum-verificăm-că-e-gata)
7. [De confirmat](#7-de-confirmat)

---

## 1. Priorități

| Prioritate | Ce                                                                                                                                      | De ce                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 🔴 **P1**  | Cont, îmbarcare și taxare, metode de plată prin procesator (card + Google/Apple Pay), plată pe loc la fiecare urcare, bilete QR semnate | Fluxul principal: urci, confirmi plata, primești bilet |
| 🟡 **P2**  | Reînnoire abonament cu plată + catalogul de abonamente, istoric călătorii, notificări + push                                            | Ecranele există deja în aplicație                      |
| 🟢 **P3**  | Contestare (aplicația nu are încă ecranul), raportări, rute salvate, extras lunar PDF, sosiri în stație, inspector online               | Utile, dar aplicația merge și fără ele la început      |

---

## 2. Reguli de business

Toate regulile de mai jos sunt **doar pe server**. Aplicația și BFF-ul nu le calculează, doar afișează rezultatul.

### 2.1 Decizia de îmbarcare 📝

Telefonul nu trimite GPS. Proximitatea vine din BLE, mișcarea din GPS-ul ESP32.

Pasagerul e **în vehicul** când **ambele** condiții sunt adevărate:

1. ESP32-ul vehiculului s-a deplasat **≥ 120 m** față de poziția de la prima observație `inside`.
2. Ultima observație BLE a telefonului (mai nouă de ~10 s) e `inside`.

| Situație                       | BLE telefon           | GPS ESP32         | Rezultat                         |
| ------------------------------ | --------------------- | ----------------- | -------------------------------- |
| Pasager în autobuz care merge  | `inside`              | deplasare ≥ 120 m | ✅ confirmat                     |
| Om în stație, autobuz blocat   | `inside`              | staționar         | ⏳ în așteptare, **fără taxare** |
| Om în stație, autobuzul pleacă | `leaving` / `outside` | deplasare         | ❌ respins, **fără taxare**      |
| GPS ESP32 mai vechi de ~15 s   | oricare               | necunoscut        | ⏳ nu se confirmă                |
| Fără observații > 60 s         | –                     | –                 | ❌ sesiune anulată               |

Stările BLE (`outside`, `candidate`, `inside`, `leaving`) sunt cele calculate deja de aplicație pe telefon.

### 2.2 Confirmare la urcare sau taxare automată

**Implicit, pasagerul e întrebat la fiecare urcare** dacă plătește și pentru câte persoane.
În setări există opțiunea **„Taxare automată la urcare”** (`autoCharge`, **oprită implicit**).
Acum setarea e salvată **doar pe telefon**; trebuie mutată pe server, în profil (`/v1/me`).

- **Oprită (implicit):** la confirmarea îmbarcării, răspunzi `awaiting_confirmation`. Aplicația îl întreabă câte persoane plătesc și trimite confirmarea; abia atunci taxezi. Dacă refuză, nu taxezi și nu emiți bilet.
- **Pornită:** la confirmarea îmbarcării, taxezi direct pentru 1 persoană.
- **Fără răspuns:** dacă pasagerul nu răspunde în **2 minute** sau coboară înainte (BLE `outside`), sesiunea se anulează: **fără taxare, fără bilet**.

### 2.3 Tarife

| Regulă              | Valoare                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| Bilet / persoană    | **5 lei**                                                                    |
| Valabilitate bilet  | 60 minute de la prima taxare                                                 |
| Transfer            | gratuit în cele 60 de minute; după, bilet nou de 5 lei                       |
| Persoane per taxare | 1 – 10                                                                       |
| Plafon zilnic       | **nu există**: fiecare călătorie costă 5 lei, indiferent câte faci într-o zi |

Cum se calculează suma și cine plătește (aplicația folosește deja exact aceste reguli, în `paymentSource.ts`):

1. Dacă utilizatorul are un **abonament valid** pentru linia respectivă: titularul plătește 0, persoanele în plus plătesc 5 lei fiecare.
2. Restul se plătește de pe **cardul implicit**, sau de pe primul card salvat dacă nu e setat unul implicit.
3. Fără card și fără abonament valid: eroare `NO_PAYMENT_METHOD` (aplicația oferă să adauge un card).

**La urcare nu se cer niciodată datele cardului.** Exemplu: 3 persoane, fără abonament → 15 lei, de pe metoda salvată, cu o singură atingere în aplicație.

### 2.4 Statusurile unei taxări

| Status            | Când                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `in_progress`     | plătit (bilet emis), călătoria e în desfășurare până la coborâre |
| `completed`       | plătit, călătoria s-a încheiat (la coborâre, cu `endedAt`)       |
| `covered_by_pass` | acoperit de abonament (sumă 0)                                   |
| `cancelled`       | anulat (de exemplu după contestare acceptată)                    |

`Charge` se creează **doar după plata reușită**, deci are mereu `qrToken`. Plata refuzată nu creează `Charge` (vezi [2.8](#28-plăți-procesator-plată-pe-loc-la-fiecare-urcare)).

Schema din aplicație mai acceptă și `capped`, rămas din versiunea cu plafon. **Nu îl mai folosi**; îl scot din aplicație după ce confirmi.

### 2.5 Biletul QR

- `qrToken` **semnat** de server (de exemplu JWT sau Ed25519). Aplicația doar îl afișează, nu îl generează.
- Conține minim: `chargeId`, linia, numărul de persoane, ora emiterii, ora expirării (+60 min). Fără date personale.
- Inspectorul trebuie să-l poată verifica **fără internet**, deci publici cheia publică (`/v1/tickets/public-key`), cu un identificator de cheie (`kid`) pentru rotirea cheilor.
- Aplicația are pregătit un interval de **3 secunde** pentru reîmprospătarea QR-ului (ca o captură de ecran să nu fie suficientă), dar încă nu îl folosește. Vezi [întrebarea 4](#7-de-confirmat): token static sau rotativ.

> Acum aplicația arată controlorului un QR cu un text fix, nesemnat. Îl înlocuiesc cu `qrToken` imediat ce îl primesc de la server.

### 2.6 Raportări

| Regulă                                          | Valoare în aplicație |
| ----------------------------------------------- | -------------------- |
| Expirare raportare                              | 20 minute            |
| Confirmări necesare ca să fie considerată reală | 2                    |

Aplicația trimite la raportare doar `kind` și `line` (pasagerul e în autobuz). **`stopName` îl completezi tu** din poziția vehiculului (următoarea stație).

### 2.7 Reînnoire abonament

Aplicația arată catalogul oficial STPT (de exemplu „General – 30 de zile, 160 lei”) și butonul **„Confirmă reînnoirea · 160 lei”**. Deci serverul trebuie:

1. să primească **produsul ales** (`productId`, de exemplu `general-30`), nu doar numărul de zile;
2. să încaseze prețul de pe cardul ales;
3. să prelungească valabilitatea de la data expirării curente (sau de azi, dacă abonamentul a expirat).

Prețurile le ține **serverul** (`GET /v1/passes/catalog`), ca aplicația să arate exact suma pe care o încasezi. Până atunci aplicația folosește catalogul STPT inclus.

ID-urile produselor din aplicație: `general-30`, `linie-30`, `expres-30`, `general-365`, `nominalizat-30`, `nominalizat-30-plus`, `nenominalizat-30`.

### 2.8 Plăți: procesator, plată pe loc la fiecare urcare

**Datele cardului nu trec niciodată prin aplicație, BFF sau backend.** Totul trece printr-un singur procesator de plăți (Stripe, Adyen, Netopia sau EuPlătesc; vezi [întrebarea 7](#7-de-confirmat)). Nu există sold EchoPass și nici plafon.

| Cine                              | Ce face                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Pasager cu Google Pay / Apple Pay | adaugă cardul cu o atingere + amprentă (butonul apare doar dacă telefonul îl suportă) |
| Pasager cu orice alt card         | îl adaugă în formularul securizat al procesatorului; 3-D Secure o singură dată        |
| Abonat                            | abonamentul îl acoperă; însoțitorii se plătesc de pe card                             |
| Pasager fără card                 | folosește canalele STPT existente (bilet de hârtie, SMS, abonament de la ghișeu)      |

**Salvarea cardului:** metoda de plată se salvează la procesator ca **utilizabilă pentru plăți ulterioare fără prezența utilizatorului** (off-session / merchant-initiated). Așa îmbarcarea automată nu mai cere confirmare de la bancă.

**Plata la urcare (pe loc):**

1. Îmbarcarea e confirmată (și, dacă e cazul, utilizatorul a ales numărul de persoane).
2. Serverul **încasează imediat** suma de pe cardul salvat (ex. 3 persoane = 15 lei), cu `Idempotency-Key`.
3. Doar după ce plata reușește: creezi `Charge` cu `qrToken` și îl întorci aplicației. Biletul apare în 1–2 secunde.
4. Plată refuzată: **nu** se emite bilet; răspunzi `PAYMENT_DECLINED`, iar aplicația îi spune pasagerului să folosească alt card.
5. Transfer în 60 de minute: **nu** se încasează nimic, biletul existent rămâne valabil.

---

## 3. Endpoint-uri

Toate endpoint-urile pentru utilizator cer `Authorization: Bearer <token>`.

### 3.1 🔴 Cont și autentificare 📝

Propunerea mea: **cont în trepte, fără parole**. Pasagerul folosește harta și planificatorul fără cont; contul apare la prima plată, pentru că un card salvat trebuie legat de o persoană care îl poate recupera.

| Treaptă   | Când                                                                                  | Ce deblochează                                                                    |
| --------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Anonim    | automat, la prima pornire                                                             | hartă, sosiri, planificator (fără plată)                                          |
| Cont      | la prima plată: salvarea cardului cere cont (o atingere cu Google, Apple sau cod SMS) | card salvat, plată la urcare, taxare automată, istoric, recuperare pe alt telefon |
| Verificat | doar pentru abonamente nominale                                                       | abonamente cu nume, reduceri                                                      |

| Metodă | Cale                 | Ce face                                                                                     |
| ------ | -------------------- | ------------------------------------------------------------------------------------------- |
| POST   | `/v1/auth/anonymous` | creează utilizator anonim + dispozitiv; întoarce sesiunea                                   |
| POST   | `/v1/auth/refresh`   | tokenuri noi; tokenul de refresh se rotește la fiecare folosire                             |
| POST   | `/v1/auth/otp/start` | trimite codul SMS (cu limită pe număr și dispozitiv)                                        |
| POST   | `/v1/auth/link`      | leagă Google / Apple / telefon de utilizatorul curent; `409` dacă identitatea are deja cont |
| POST   | `/v1/auth/merge`     | mută datele contului anonim într-un cont existent, după confirmare                          |
| POST   | `/v1/auth/logout`    | invalidează sesiunea acestui dispozitiv                                                     |
| GET    | `/v1/me`             | `id`, treapta, `name?`, `email?`, identitățile legate, `settings` (vezi mai jos)            |
| PATCH  | `/v1/me`             | modifică setările sau numele                                                                |
| DELETE | `/v1/me`             | șterge contul (obligatoriu GDPR și magazine de aplicații)                                   |

`settings` (acum salvate doar pe telefon):

| Câmp              | Implicit | Folosit de server pentru                                                        |
| ----------------- | -------- | ------------------------------------------------------------------------------- |
| `autoCharge`      | `false`  | taxare automată la urcare ([2.2](#22-confirmare-la-urcare-sau-taxare-automată)) |
| `tripReminders`   | `false`  | push memento călătorii                                                          |
| `arrivalAlerts`   | `false`  | push sosiri live                                                                |
| `disruptions`     | `true`   | push întârzieri și perturbări                                                   |
| `locationSharing` | `false`  | partajare locație live                                                          |

Profilul afișează `name` (acum ia numele titularului cardului sau abonamentului).

Alternativa clasică (email + parolă: `register`, `login`) e în [întrebarea 1](#7-de-confirmat).

### 3.2 Vehicule și poziții: rămân pe STPT

**Nu trebuie să servești pozițiile vehiculelor aplicației.** Harta și sosirile folosesc direct feedul public STPT (`https://live.stpt.ro/gtfs-vehicles.php`), care funcționează deja în aplicație.

Backend-ul are nevoie de vehicule doar pentru îmbarcare:

| Metodă | Cale                     | Ce face                                                                    |
| ------ | ------------------------ | -------------------------------------------------------------------------- |
| POST   | `/v1/telemetry/position` | apelat de **ESP32**, nu de aplicație: `vehicleId`, `lat`, `lng`, `atMs` 📝 |

- **Obligatoriu:** ESP32-ul transmite prin BLE **numărul vehiculului STPT** (numele BLE `EP-<număr>`, ex. `EP-3114` → `3114`). Așa vehiculul detectat se potrivește cu cel de pe hartă.
- Linia și destinația vehiculului le iei din feedul STPT (după număr), ca să le pui în `BoardingResult.vehicle` și în `Charge`.
- Modelele `Bus` și `BusPosition` de mai jos sunt cele din feedul STPT, adaptat de aplicație; le păstrez pentru cazul în care, mai târziu, vrei să le servești tu.

### 3.3 🔴 Îmbarcare 📝

Aplicația detectează deja vehiculul local, prin BLE, dar **nu trimite încă nimic la server**. Propunerea pentru contract:

| Metodă | Cale                               | Ce face                                                                         |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| POST   | `/v1/boarding/observations`        | primește o observație BLE, întoarce [`BoardingResult`](#boardingresult)         |
| POST   | `/v1/boarding/{sessionId}/confirm` | utilizatorul confirmă plata (`passengers`: 1–10), întoarce `BoardingResult`     |
| POST   | `/v1/boarding/{sessionId}/exit`    | coborâre: setează `endedAt` (plata s-a făcut deja la urcare), întoarce `Charge` |
| GET    | `/v1/boarding/{sessionId}`         | starea curentă, întoarce `BoardingResult`                                       |

Cererea pentru observație:

```json
{
  "sessionId": "sess-123",
  "vehicleId": "3114",
  "rssi": -62,
  "bleState": "inside",
  "nonce": "a1b2c3",
  "atMs": 1792000000000
}
```

Aplicația va trimite o observație la ~5 secunde cât timp vede vehiculul. `nonce` vine din reclama BLE a ESP32-ului (de stabilit împreună cu firmware-ul).

### 3.3.1 🔴 Progresul cursei: poziția autobuzului și stația următoare 📝

**De ce:** cardul „La bord” din aplicație trebuie să arate stația următoare și minutele până la ea, calculate din poziția ESP32 (reală sau simulată). Acum aplicația nu poate citi poziția:

- `GET /rides/current` trimite despre vehicul doar `busId`, `line` și `destination`;
- `GET /buses/{id}/position` și `GET /buses/positions` cer `DISPLAY_TOKEN`, care e secret și **nu** poate fi pus în aplicație.

Serverul are deja tot ce trebuie: telemetria ESP32 (`lat`, `lon`, `speed_kmh`, `fix_ok`, `sim`), traseul autobuzului (`Route.points`, unde punctele cu `name` sunt stațiile) și funcțiile `nearest_stop`, `ride_window` și `bus_positions`.

**Ce trebuie adăugat:** un câmp nou, `progress`, în obiectul `Ride` (cel întors de `GET /rides/current` și de `POST /rides/{id}/confirm`, vezi `server-api.md` §2).

```json
{
  "status": "confirmed",
  "sessionId": "sess-123",
  "vehicle": { "busId": 101, "line": "E2", "destination": "Elbromplast" },
  "progress": {
    "position": {
      "lat": 45.7489,
      "lng": 21.2087,
      "speedKmh": 22.5,
      "at": "2026-11-14T20:40:12Z",
      "simulated": true
    },
    "boardedStop": "Piața Badea Cârțan",
    "nextStop": { "index": 5, "name": "Piața Mărăști", "distanceM": 320, "etaSec": 55 },
    "stops": [
      { "name": "Piața Badea Cârțan", "lat": 45.7512, "lng": 21.2311, "passed": true },
      { "name": "Piața Mărăști", "lat": 45.7563, "lng": 21.2290, "passed": false }
    ]
  }
}
```

| Câmp | Cum se calculează |
| --- | --- |
| `progress` | prezent la `confirmed`; la celelalte statusuri, `null`. Doar pentru cursa utilizatorului care cere, nimic despre alte autobuze. |
| `position` | ultima telemetrie a autobuzului cursei cu `fix_ok = true`, **mai nouă de 30 s**; altfel `null` (aplicația scrie „poziție indisponibilă”). Telemetria simulată (`sim = 1`) se ia în calcul doar în `TEST_MODE`, ca la `allow_sim`; atunci `simulated: true`. `lon` din telemetrie devine `lng`. |
| `stops` | punctele cu nume din traseul autobuzului (`Route.points`), **în ordinea traseului**. `passed: true` pentru stațiile dinaintea poziției proiectate pe traseu. |
| `boardedStop` | `nearest_stop` față de prima poziție a autobuzului din `ride_window`, ca la `from` din călătorii. |
| `nextStop` | proiectezi `position` pe linia traseului (punctele în ordine): `nextStop` e prima stație de după segmentul pe care se află autobuzul. `index` e poziția ei în `stops`. |
| `nextStop.distanceM` | distanța **de-a lungul traseului**, de la poziție până la stație, în metri, rotunjită. |
| `nextStop.etaSec` | `distanceM / max(viteza, 15 km/h)`, în secunde, rotunjit. Pragul de 15 km/h evită ETA uriașe la semafor. |

**Actualizare:**

- La `confirmed`, `pollAfterMs` trece de la `15000` la `5000`, ca stația următoare să se schimbe la timp.
- ETag-ul trebuie să se schimbe când se schimbă `progress`, altfel aplicația primește `304` și nu vede mișcarea. Propunere: la `confirmed`, ETag-ul include și `at` al ultimei poziții, de exemplu `"<sessionId>-v<version>-<at>"`.

**Erori:** niciuna nouă. Fără traseu, fără stații sau fără telemetrie, câmpurile respective sunt `null` (`stops`: `[]`), iar restul răspunsului rămâne neschimbat.

**De confirmat cu backend-ul:**

1. Punctele din `Route.points` sunt în sensul de mers? Dacă un traseu are ambele sensuri sau e circular, serverul trebuie să aleagă sensul după ultimele 2–3 poziții. Altfel `nextStop` poate fi stația din spate.
2. ESP32 simulat trimite telemetrie cu `fix_ok = true` și coordonate de-a lungul traseului E2?

### 3.4 🔴 Portofel

| Metodă | Cale                               | Ce face                                                                                                                             |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/wallet/items`                 | listă [`WalletItem`](#walletitem) ✅: carduri și abonamente                                                                         |
| POST   | `/v1/wallet/payment-methods/setup` | pregătește salvarea unei metode la procesator; întoarce datele de inițializare pentru SDK-ul procesatorului (ex. `clientSecret`) 📝 |
| POST   | `/v1/wallet/payment-methods`       | salvează metoda primită de la procesator ([`NewCardInput`](#newcardinput) ✅), întoarce `WalletItem`                                |
| POST   | `/v1/wallet/passes`                | adaugă un abonament existent ([`NewPassInput`](#newpassinput) ✅), întoarce `WalletItem`                                            |
| GET    | `/v1/passes/catalog`               | catalogul de abonamente: `id`, nume, `days`, `priceRon`, linii acoperite 📝                                                         |
| POST   | `/v1/wallet/passes/{id}/renew`     | reînnoiește cu plată (`productId`, `sourceId`), vezi [2.7](#27-reînnoire-abonament); întoarce `WalletItem` + `Charge` 📝            |
| DELETE | `/v1/wallet/items/{id}`            | șterge card sau abonament                                                                                                           |
| PUT    | `/v1/wallet/default-source`        | setează cardul implicit (`id`)                                                                                                      |

> **Carduri:** aplicația deschide formularul procesatorului (sau Google Pay / Apple Pay) și primește doar
> `paymentMethodId`. La backend ajung `paymentMethodId`, `walletPay?`, `network`, `last4`, `holder`, `expiry`.
> **Verifică `network`, `last4` și `expiry` direct la procesator**, nu te baza pe ce trimite aplicația.
> În `WalletItem`, câmpul `token` = `paymentMethodId`; `tag` = `"Google Pay"` / `"Apple Pay"` când e cazul.

### 3.5 🔴 Taxări și bilete

| Metodă | Cale                     | Ce face                                                 |
| ------ | ------------------------ | ------------------------------------------------------- |
| GET    | `/v1/charges`            | listă [`Charge`](#charge) ✅, cele mai noi primele      |
| GET    | `/v1/tickets/public-key` | cheile publice pentru verificarea QR offline (cu `kid`) |

Aplicația **nu creează și nu modifică** taxări: le primește din endpoint-urile de îmbarcare (3.3) și le citește cu `GET /v1/charges`.

### 3.6 🟡 Contestare 📝

| Metodă | Cale                       | Ce face                                               |
| ------ | -------------------------- | ----------------------------------------------------- |
| POST   | `/v1/charges/{id}/dispute` | contestare (`reason`), întoarce statusul contestației |

### 3.7 🟡 Istoric și notificări

| Metodă | Cale                          | Ce face                                                                             |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/v1/trips/recent`            | listă [`RecentTrip`](#recenttrip) ✅                                                |
| GET    | `/v1/notifications`           | listă [`Notification`](#notification) ✅                                            |
| POST   | `/v1/notifications/{id}/read` | marchează ca citită                                                                 |
| POST   | `/v1/devices`                 | înregistrează telefonul pentru push (`pushToken`, `platform`: `ios` / `android`) 📝 |

**Push-uri de trimis:**

| Când                               | Tip        |
| ---------------------------------- | ---------- |
| Taxare confirmată                  | `charge`   |
| Plată refuzată la urcare           | `charge`   |
| Întârziere pe o linie folosită des | `delay`    |
| Aglomerație raportată              | `crowding` |
| Abonamentul expiră în ≤ 5 zile     | `renewal`  |

Trimiți doar ce a activat pasagerul în `settings` (ex. `delay` doar dacă `disruptions` = true). Push-urile `charge` se trimit mereu.

### 3.8 🟢 Raportări, rute salvate, extras, sosiri, inspector

| Metodă | Cale                                                | Ce face                                                                           |
| ------ | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/v1/reports`                                       | raportări active, listă [`Report`](#report) ✅                                    |
| POST   | `/v1/reports`                                       | raportare nouă (`kind`, `line`); `stopName` îl completezi din poziția vehiculului |
| POST   | `/v1/reports/{id}/confirm`                          | confirmă o raportare, întoarce `Report`                                           |
| GET    | `/v1/trips/saved`                                   | listă [`SavedRoute`](#savedroute) ✅                                              |
| POST   | `/v1/trips/saved`                                   | adaugă rută salvată                                                               |
| DELETE | `/v1/trips/saved/{id}`                              | șterge rută salvată                                                               |
| GET    | `/v1/statements/{an-lună}`                          | extras lunar PDF pentru decontare (ex. `2026-10`)                                 |
| GET    | `/v1/stops/{stopId}/arrivals?limit=10&windowMin=60` | sosiri în stație, listă [`Arrival`](#arrival) ✅; `limit` 1–50, `windowMin` 1–180 |
| POST   | `/v1/tickets/verify`                                | verificare online a biletului (doar cont cu rol **inspector**)                    |

> Orarele, stațiile, traseele și planificarea rutelor **nu** trebuie făcute în backend: sunt incluse în aplicație și merg offline.

---

## 4. Modele de date

✅ = exact ce validează aplicația acum. 📝 = propunere. `?` = câmp opțional.

### Bus ✅ (din feedul STPT)

| Câmp          | Tip               | Note                             |
| ------------- | ----------------- | -------------------------------- |
| `id`          | string            | = ID-ul BLE al ESP32             |
| `line`        | string            | ex. `"15"`                       |
| `destination` | string            |                                  |
| `crowd`       | 1 / 2 / 3         | aglomerare: puțin / mediu / mult |
| `delayMin`    | întreg ≥ 0        |                                  |
| `delayReason` | string sau `null` |                                  |

### BusPosition ✅ (din feedul STPT)

| Câmp           | Tip        | Note             |
| -------------- | ---------- | ---------------- |
| `busId`        | string     | = `Bus.id`       |
| `lat`, `lng`   | număr      | din GPS-ul ESP32 |
| `nextStop`     | string     |                  |
| `arrivesInMin` | întreg ≥ 0 |                  |
| `updatedAt`    | dată ISO   |                  |
| `speedKmh?`    | număr ≥ 0  |                  |

### BoardingResult 📝

| Câmp       | Tip                                                            | Note                                                           |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `status`   | `pending` / `awaiting_confirmation` / `confirmed` / `rejected` |                                                                |
| `charge?`  | `Charge`                                                       | doar la `confirmed`                                            |
| `vehicle?` | `{ line, destination }`                                        | la `awaiting_confirmation`, ca aplicația să afișeze întrebarea |

### WalletItem ✅

Două tipuri, deosebite prin `kind`.

**Card** (`kind: "card"`)

| Câmp            | Tip                                  |
| --------------- | ------------------------------------ |
| `id`            | string                               |
| `network`       | `visa` / `mastercard` / `other`      |
| `last4`         | 4 cifre                              |
| `holder`        | string                               |
| `expiry`        | `"LL/AA"`                            |
| `token`         | string (de la procesatorul de plăți) |
| `bank?`, `tag?` | string                               |

**Abonament** (`kind: "pass"`)

| Câmp                      | Tip                                            |
| ------------------------- | ---------------------------------------------- |
| `id`                      | string                                         |
| `name`                    | string                                         |
| `holder`                  | string                                         |
| `validFrom`, `validUntil` | dată `AAAA-LL-ZZ`                              |
| `lines`                   | `"all"` sau listă de linii, ex. `["15", "33"]` |
| `theme`                   | `ocean` / `sunset` / `forest`                  |
| `cardNumber?`             | string                                         |

### NewCardInput ✅

Ce trimite aplicația după ce procesatorul a salvat cardul:

| Câmp              | Tip                             | Note                                            |
| ----------------- | ------------------------------- | ----------------------------------------------- |
| `paymentMethodId` | string                          | id-ul metodei la procesator                     |
| `walletPay?`      | `google_pay` / `apple_pay`      | dacă a fost adăugat prin Google Pay / Apple Pay |
| `network`         | `visa` / `mastercard` / `other` |                                                 |
| `last4`           | 4 cifre                         |                                                 |
| `holder`          | string                          |                                                 |
| `expiry`          | `"LL/AA"`                       |                                                 |

### NewPassInput ✅

`name`, `holder`, `validUntil` (`AAAA-LL-ZZ`), `lines`, `theme`.

### Charge ✅

| Câmp           | Tip                                     | Note                               |
| -------------- | --------------------------------------- | ---------------------------------- |
| `id`           | string                                  |                                    |
| `line`         | string                                  |                                    |
| `destination?` | string                                  |                                    |
| `amount`       | număr ≥ 0                               | lei                                |
| `currency`     | `"RON"`                                 |                                    |
| `status`       | vezi [2.4](#24-statusurile-unei-taxări) |                                    |
| `paidWith`     | string                                  | `id` al cardului sau abonamentului |
| `startedAt`    | dată ISO                                |                                    |
| `endedAt?`     | dată ISO                                | la coborâre                        |
| `qrToken`      | string                                  | semnat, obligatoriu                |

### RecentTrip ✅

| Câmp          | Tip          |
| ------------- | ------------ |
| `id`          | string       |
| `from`, `to`  | string       |
| `date`        | `AAAA-LL-ZZ` |
| `time?`       | `"HH:MM"`    |
| `line?`       | string       |
| `fareRon`     | număr ≥ 0    |
| `distanceKm`  | număr ≥ 0    |
| `durationMin` | întreg ≥ 0   |

`from` / `to` = stațiile de urcare și coborâre, calculate de tine din poziția vehiculului. `date` și `time` sunt în **ora României** (Europe/Bucharest).

### SavedRoute ✅

`id`, `from`, `to`, `line` (toate string).

### Notification ✅

| Câmp            | Tip                                         |
| --------------- | ------------------------------------------- |
| `id`            | string                                      |
| `kind`          | `delay` / `charge` / `crowding` / `renewal` |
| `title`, `body` | string                                      |
| `createdAt`     | dată ISO                                    |
| `read`          | true / false                                |

Schema din aplicație mai acceptă `cap`, rămas din versiunea cu plafon; nu îl folosi.

### Report ✅

| Câmp            | Tip                                                                    |
| --------------- | ---------------------------------------------------------------------- |
| `id`            | string                                                                 |
| `kind`          | `traffic` / `accident` / `breakdown` / `works` / `crowding` / `detour` |
| `line`          | string                                                                 |
| `stopName`      | string                                                                 |
| `confirmations` | întreg ≥ 0                                                             |
| `expiresAt`     | dată ISO                                                               |
| `createdAt?`    | dată ISO                                                               |

### Arrival ✅

| Câmp            | Tip                                            | Note                                                 |
| --------------- | ---------------------------------------------- | ---------------------------------------------------- |
| `tripId`        | string                                         |                                                      |
| `route`         | `{ id, shortName, color?, textColor?, mode? }` | `mode`: `bus` / `tram` / `trolley`; culori `#RRGGBB` |
| `headsign`      | string                                         |                                                      |
| `scheduledTime` | dată ISO sau `null`                            |                                                      |
| `predictedTime` | dată ISO sau `null`                            | obligatoriu dacă `isRealtime` = true                 |
| `isRealtime`    | true / false                                   |                                                      |
| `delayMin?`     | întreg ≥ 0                                     |                                                      |
| `busId?`        | string                                         |                                                      |

---

## 5. Cerințe generale

**Erori**: același format peste tot:

```json
{ "error": { "code": "PAYMENT_DECLINED", "message": "Plata a fost refuzată." } }
```

| Cod                 | HTTP | Când                                                 |
| ------------------- | ---- | ---------------------------------------------------- |
| `AUTH_INVALID`      | 401  | token lipsă, invalid sau expirat                     |
| `FORBIDDEN`         | 403  | fără drept (ex. verificare bilet fără rol inspector) |
| `NOT_FOUND`         | 404  | resursa nu există                                    |
| `VEHICLE_UNKNOWN`   | 404  | vehiculul nu există                                  |
| `VALIDATION_ERROR`  | 400  | date greșite în cerere                               |
| `NO_PAYMENT_METHOD` | 409  | fără card și fără abonament                          |
| `PAYMENT_DECLINED`  | 402  | plata refuzată                                       |
| `IDENTITY_IN_USE`   | 409  | la legarea contului: identitatea are deja cont       |
| `RATE_LIMITED`      | 429  | prea multe cereri                                    |
| `SERVER_ERROR`      | 500  | altceva                                              |

**Taxare dublă:** endpoint-urile care mișcă bani (confirmare îmbarcare, reînnoire abonament) acceptă header-ul `Idempotency-Key`. Aceeași cheie trimisă de două ori = **o singură** operație.

**Securitate**

- Doar HTTPS.
- Un utilizator vede doar datele lui.
- Nonce-ul BLE se verifică, ca un telefon să nu poată pretinde că e lângă un ESP32 fără să fie.
- Datele personale nu apar în loguri și nici în `qrToken`.
- Notificările procesatorului (webhook) se verifică după semnătură înainte de orice modificare de plată.

**Versiuni:** totul sub `/v1/`. Orice schimbare care strică aplicația merge în `/v2/` sau se anunță dinainte.

**Mediu de test (staging)**

- Conturi și carduri de test.
- Posibilitatea de a **simula un ESP32 în mișcare** (poziții trimise manual), ca să testăm îmbarcarea fără autobuz.

---

## 6. Cum verificăm că e gata

Pentru P1, testăm împreună pe staging:

- [ ] Pornesc aplicația prima dată: primesc un cont anonim, tokenul se reînnoiește singur.
- [ ] Leg contul (Google / Apple / SMS) și păstrez același istoric.
- [ ] Vehiculul detectat prin BLE (ex. `EP-3114`) e același cu cel de pe harta STPT.
- [ ] Nu răspund la întrebarea de plată 2 minute (sau cobor): sesiune anulată, fără taxare.
- [ ] **Autobuz simulat staționar lângă mine:** rămân `pending`, nu sunt taxat.
- [ ] **Autobuz simulat care pleacă fără mine:** `rejected`, nu sunt taxat.
- [ ] **Autobuz simulat care merge cu mine:** `confirmed`, primesc `Charge` de 5 lei cu `qrToken`.
- [ ] Adaug un card prin procesator (și prin Google Pay): la backend ajunge doar `paymentMethodId`.
- [ ] Implicit (`autoCharge` oprit): primesc `awaiting_confirmation`, confirm 3 persoane, sunt taxat 15 lei **fără să introduc date de card**.
- [ ] Cu `autoCharge` pornit: sunt taxat direct 5 lei, fără întrebare.
- [ ] Fiecare urcare e încasată pe loc; biletul apare doar după plata reușită.
- [ ] Card refuzat la urcare: `PAYMENT_DECLINED`, fără bilet.
- [ ] Cu abonament valid: `covered_by_pass`, sumă 0; cu încă o persoană: 5 lei.
- [ ] Al doilea vehicul în 60 de minute: transfer, 0 lei. După 60 de minute: 5 lei.
- [ ] A treia călătorie din aceeași zi: tot 5 lei (fără plafon).
- [ ] Aceeași cerere trimisă de două ori: o singură taxare.
- [ ] La coborâre, taxarea trece din `in_progress` în `completed` și primește `endedAt`.
- [ ] `qrToken` se verifică corect cu cheia publică, fără internet.
- [ ] Fără card și fără abonament: eroare `NO_PAYMENT_METHOD`.
- [ ] Cu ESP32 simulat pe E2 și `TEST_MODE`: după confirmare, `GET /rides/current` are `progress.nextStop`, iar la fiecare ~5 s `nextStop.distanceM` scade și `nextStop` trece la stația următoare după ce autobuzul o depășește.
- [ ] Telemetrie mai veche de 30 s: `progress.position` e `null`, restul cursei e neschimbat.

---

## Ce schimb eu în aplicație când e gata serverul

Ca să știi ce să aștepți de la mine:

- îmbarcarea: trimit observațiile BLE și confirmarea; nu mai creez taxări local (`createCharge` / `updateCharge` dispar);
- biletul: afișez `qrToken` primit de la tine în locul QR-ului de test;
- reînnoirea abonamentului: trimit `productId` și `sourceId` (acum trimit doar `days`) și citesc prețurile din `/v1/passes/catalog`;
- setările și profilul: le citesc și le salvez prin `/v1/me`;
- cardul: conectez SDK-ul procesatorului ales, în locul procesatorului de test.
- cardul „La bord”: citesc `progress` din `GET /rides/current` (stația următoare, minutele până la ea, stațiile trecute) în locul stațiilor demonstrative ([3.3.1](#331--progresul-cursei-poziția-autobuzului-și-stația-următoare-)).

---

## 7. De confirmat

| #   | Întrebare                                                                                  | Situația acum                                                                 |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | **Autentificare:** cont în trepte fără parole (propunerea din 3.1) sau email + parolă?     | aplicația nu are încă autentificare                                           |
| 2   | Pragul de 120 m e bun?                                                                     | propunere; trebuie calibrat pe teren după raza BLE reală                      |
| 3   | De unde vine `nonce`-ul BLE și cum se semnează?                                            | de stabilit cu firmware-ul ESP32                                              |
| 4   | **QR:** token static semnat (valabil 60 min) sau rotativ (aplicația schimbă QR-ul la 3 s)? | intervalul de 3 s există în aplicație, reîmprospătarea nu e încă implementată |
| 5   | Cum află BFF-ul că s-a taxat: interogare periodică sau notificare de la tine?              | nestabilit                                                                    |
| 6   | Cine trimite push-urile: backend-ul sau BFF-ul?                                            | nestabilit                                                                    |
| 7   | Procesatorul de plăți (Stripe / Adyen / Netopia / EuPlătesc)?                              | nestabilit; aplicația are deja interfața pregătită, cu un procesator de test  |
| 8   | Pot scoate `capped` și `cap` din schemele aplicației?                                      | rămase din versiunea cu plafon, nefolosite                                    |
