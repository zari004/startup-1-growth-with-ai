# Marketplace Growth AI

Uzum Market sellerlari uchun: mahsulot kartochkalarini tayyorlash (Content Factory) va oylik AI monitoring (Growth OS).

Texnik yechim: **Node.js/npm shart emas** — toza HTML/CSS/JS + [Supabase](https://supabase.com) (Postgres + Auth + RLS). Fayllarni to'g'ridan-to'g'ri brauzerda ochish yoki oddiy statik server bilan ishga tushirish mumkin.

## Papka tuzilishi

```
marketplace-growth-ai/
├── site/                 # Marketing landing sahifa (mijozlar shu yerdan keladi)
│   ├── index.html
│   └── styles.css
├── app/                  # Webapp (seller va admin dashboard)
│   ├── login.html
│   ├── seller-dashboard.html
│   ├── admin-dashboard.html
│   └── assets/
│       ├── css/app.css
│       └── js/
│           ├── config.js          # Supabase URL/kalit shu yerda
│           ├── supabase-client.js
│           ├── auth.js
│           ├── rules-engine.js    # Impact x Confidence / Effort skorlash
│           ├── seller.js
│           └── admin.js
└── supabase/
    └── schema.sql        # Bazani sozlash uchun to'liq SQL
```

## 1-qadam — Supabase loyihasi yaratish (bepul)

1. https://supabase.com saytiga kiring, bepul account oching (Google bilan ham bo'ladi).
2. **New Project** tugmasini bosing, nom bering (masalan `marketplace-growth-ai`), parol o'rnating, region tanlang (masalan Singapore — O'zbekistonga eng yaqin).
3. Loyiha tayyor bo'lgach, chap menyudan **SQL Editor** ga o'ting.
4. Shu repo'dagi `supabase/schema.sql` faylining **to'liq matnini** nusxalab, SQL Editor'ga joylashtiring va **Run** tugmasini bosing. Bu barcha jadvallar, xavfsizlik qoidalari (RLS) va trigger'larni yaratadi.

## 2-qadam — API kalitlarni olish

1. Supabase loyihangizda **Project Settings → API** bo'limiga o'ting.
2. **Project URL** va **anon public key** ni nusxalang.
3. `app/assets/js/config.js` faylini oching va quyidagini almashtiring:

```js
export const SUPABASE_URL = 'https://XXXX.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

> Bu "anon public" kalit — parol emas, frontendda ishlatish uchun xavfsiz, chunki xavfsizlik Row Level Security (RLS) orqali ta'minlanadi (har bir seller faqat o'z ma'lumotini ko'radi).

## 3-qadam — Birinchi admin foydalanuvchini yaratish

1. `app/login.html` sahifasini oching (pastga qarang — qanday ochishni), **Ro'yxatdan o'tish** orqali o'zingiz uchun account oching.
2. Supabase Dashboard → **Table Editor → profiles** jadvaliga o'ting, o'z qatoringizni toping va `role` ustunini `seller` dan `admin` ga o'zgartiring.
3. Endi shu account bilan kirsangiz, tizim sizni admin-dashboard'ga yo'naltiradi.

## 4-qadam — Loyihani lokal ishga tushirish

Node kerak emas, lekin brauzer ES modullarni (`type="module"`) `file://` orqali to'liq ishlatishga ruxsat bermasligi mumkin — shuning uchun oddiy statik server orqali oching (Python allaqachon kompyuteringizda bor):

```bash
cd marketplace-growth-ai
python -m http.server 8000
```

Keyin brauzerda:
- Landing: http://localhost:8000/site/index.html
- Login: http://localhost:8000/app/login.html

## 5-qadam — Nashr qilish (deploy)

Bu statik fayllar bo'lgani uchun **GitHub Pages**, **Netlify**, yoki **Vercel** (drag-and-drop static deploy) orqali bepul joylashtirish mumkin — build qadam shart emas.

## CSV format (seller yuklaydigan fayl)

| sku_code | name | price | cost | stock | competitor_price | unanswered_reviews |
|---|---|---|---|---|---|---|
| ART-001 | Erkaklar futbolkasi | 120000 | 90000 | 12 | 110000 | 2 |

## Keyingi qadamlar (Uzum API paydo bo'lgach)

Hozircha Uzum'da ochiq seller API yo'q, shuning uchun ma'lumot CSV orqali "avtomatik" (yuklangan zahoti tahlil qilinadi) tarzda kiritiladi. Kelajakda API ochilsa, faqat bitta yangi modul (`app/assets/js/uzum-api-connector.js`) qo'shiladi — `seller.js`dagi `handleFile()` o'rniga API'dan ma'lumot tortib, xuddi o'sha `upsertSkus()` funksiyasiga uzatiladi. Qolgan barcha kod (rules-engine, dashboard, auth) **o'zgarishsiz qoladi** — aynan shuning uchun arxitektura shu tarzda ajratilgan.
