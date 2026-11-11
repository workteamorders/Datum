# Aset Datum

Seluruh aset pada inventaris ini dibuat oleh generator dan menjadi hak milik pemilik proyek. Generator memakai bentuk geometris, seed tetap, dan palet Benchmark dari `tokens.css`. Ia berjalan tanpa jaringan dan tanpa dependensi tambahan.

```sh
node apps/web/scripts/make-art.mjs
```

| Lokasi | Aset dan asal |
|---|---|
| `apps/web/public/art/disc-*.svg` | Enam cakram ukur dari kombinasi cincin, crosshair, tick, patok, dan indeks. |
| `apps/web/public/art/registration-*.svg` | Tiga tanda registrasi dari garis dan titik. |
| `apps/web/public/art/seal-*.svg` | Cap MEASURED, EXAMPLE, CONFIRMED, CHANGED, SUPERSEDED, dan Draft. |
| `apps/web/public/art/{no-claims,no-wallet,no-network,not-found,other-cluster}.svg` | Ilustrasi keadaan dari garis, cincin, dan tanda registrasi. |
| `apps/web/public/art/halftone.svg` | Lingkaran dengan radius yang ditentukan seed tetap. |
| `apps/web/src/art/benchmark.ts` | Katalog aset dan tanda alamat enam warna yang diturunkan dari alamat. Tanda diberi label di antarmuka. |
| `apps/web/public/art/datum-card.png` | Kartu Open Graph dan Twitter, diraster dari cakram dan bentuk huruf buatan generator. |
| `apps/web/src/app/icon.svg`, `apps/web/public/art/icon.svg`, `apps/web/public/art/apple-touch-icon.png`, `apps/web/public/favicon.ico` | Varian ikon tab, sentuh, dan favicon dari cakram Datum. |
| `apps/web/src/components/fx/field.ts` | Bentuk canvas dirender langsung dari geometri dan token warna yang dibaca saat runtime. |
