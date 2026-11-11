# Datum Editorial

Lapisan tampilan di atas Datum Live. Keputusan: [D-069 sampai D-074](DECISIONS.md). Gambar layar: `docs/screens/editorial/`.

## Apa yang diperiksa pada acuan

Situs acuan dibuka di browser dan kodenya diperiksa. Temuan yang terukur:

- Tidak ada library animasi, tidak ada canvas, tidak ada pendengar scroll, tidak ada `IntersectionObserver`.
- Hanya tujuh keyframe CSS: marquee, satu objek yang terbang masuk, getaran, putar, fade, slide-up, dash.
- Tingkat kerajinan datang dari arah seni tunggal, huruf display berkarakter, bab bernomor, bagian gelap dan terang berselang-seling, tepi bagian yang dipotong dengan `clip-path`, ticker, dan satu momen hero.

Kesimpulan: yang perlu dinaikkan di Datum adalah arah seni, tipografi, ritme bagian, dan satu momen hero. Mesin efek yang sudah ada tidak ditambah.

## Yang diubah

| Area | Isi |
| --- | --- |
| Huruf | Big Shoulders Display 800 dan 900 (OFL, lisensi di `public/fonts/LICENSE-Big-Shoulders-Display.txt`), dipakai untuk h1 dan h2 huruf kapital. Chivo dan Chivo Mono tetap untuk teks dan angka. |
| Warna | Permukaan malam dan kuningan sebagai token di `tokens.css`. `.on-night` mendefinisikan ulang token semantik, jadi semua komponen lama ikut benar di atasnya. Kontras diukur: 7,4 sampai 14,1 : 1. |
| Beranda | Hero gelap, ticker, empat angka, Reading 01 sampai 04, contoh klaim berlabel, dan baris tetap "What this does not tell you" sebagai Reading 04. |
| Hero | SVG dari kode dan hidup terus: lingkaran tick berputar (36 detik per putaran), cincin putus-putus berputar berlawanan (24 detik), satu siklus ukur 10 detik (garis masuk, cakram mengunci, cap "Measured at slot N" muncul lalu memudar), cincin dalam bernapas, crosshair dan cincin condong ke kursor (hanya mouse). Angka slot dibaca ulang tiap 15 detik selama halaman terlihat dan berkedip saat berubah. Gerak mati: gambar diam lengkap. |
| Ticker | Klaim terbaru yang dibaca dari chain. Jeda saat hover atau fokus. |
| Tepi | `.ruler-edge`: dua gradien CSS berupa tick penggaris, di bawah ticker, di atas Reading 04, dan di atas footer. |
| Semua halaman | Header dan footer malam, huruf display, tepi penggaris. `/styleguide` memuat bagian "Night band and ruler edge". |

## Data nyata, bukan karangan

- Slot di cap hero dan angka "Latest slot read" berasal dari konteks slot `getLatestBlockhash` (allowlist relay tidak memuat `getSlot`).
- Ticker dan tiga dari empat angka berasal dari pembacaan klaim terbaru. Jika gagal, ticker menampilkan "No recent claims read right now." dan angka menampilkan tanda hubung. Diuji di `e2e/editorial.spec.ts`.
- Angka keempat, "Statement kinds this version reads", adalah jumlah `PREDICATES` pada versi protokol ini, bukan hasil pembacaan.

## Ukuran yang diambil

Lighthouse 13.6.0, profil mobile, ekspor produksi dengan mock RPC dan gzip, Google Chrome headless di lingkungan sesi ini. Baseline dibangun dari commit `c8a43e9` (Datum Live) di lingkungan yang sama, jadi perbandingan sebanding. Angka mutlak lebih lambat daripada tabel `VISUAL-LIVE.md` yang diukur di lingkungan lain.

Selisih antar ukuran di lingkungan ini besar, jadi angka dilaporkan sebagai rentang dari beberapa kali ukur, bukan satu angka.

| Rute | Versi | Jumlah ukur | Performa | TBT (rentang, median) | CLS | Aksesibilitas |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | baseline (Datum Live) | 5 | 84 sampai 98 | 166 sampai 663 ms, median 252 | 0 | tidak diukur ulang |
| `/` | Editorial dengan gerak penuh | 7 | 88 sampai 96 | 211 sampai 463 ms, median 302 | 0 | 100 |
| `/?motion=off` | Editorial, gerak mati | 3 | 89 sampai 96 | 236 sampai 457 ms, median 306 | 0 | tidak diukur ulang |
| `/t?m=…` | baseline dan Editorial | 1 dan 1 | 85 dan 85 | 270 dan 306 ms | 0 | 100 |

Dengan rentang sebesar itu, selisih median beranda (sekitar 50 ms) tidak dapat dipisahkan dari derau, dan gerak penuh dan gerak mati tidak berbeda nyata. Target TBT 50 ms tidak tercapai di lingkungan ini, baseline pun tidak.

- JS di HTML beranda (gzip, berkas unik): 200.755 menjadi 203.889 byte, naik 3.134 byte. Batas 20 KB.
- Font tambahan: 28.572 byte (dua berkas woff2).
- Ilustrasi: tidak ada berkas gambar baru; hero digambar oleh SVG dalam kode.
- Pembacaan klaim di beranda tampak menambah TBT pada pengukuran awal. Memberi giliran ke halaman antar transaksi (`setTimeout 0`) dipasang sebagai tindakan hati-hati; efeknya tidak dapat dipisahkan dari derau pengukuran.
- axe: 0 pelanggaran pada beranda, token, dan semua rute di 360, 768, 1440 px (`e2e/live.spec.ts`, `e2e/read.spec.ts`).
- Tes: 115 unit, 78 e2e lulus (70 + 8 baru); 40 e2e pembuat gambar layar dilewati pada jalan biasa.
- Kecepatan bingkai canvas yang sudah ada (Datum Live) diukur ulang oleh `live.spec.ts`: 59,6 sampai 60,0 fps di Chromium Headless Shell.

## Belum terukur

- Perangkat fisik berspesifikasi rendah.
- Safari dan Firefox. Perilaku `text-transform` pada salinan teks berbeda antar browser; karena itu alamat tidak pernah memakainya.
- TBT di profil lain atau di jaringan nyata.
- Rute `/t` hanya diukur satu kali, jadi selisih 270 ke 306 ms belum bisa dipisahkan dari derau.

## Yang sengaja tidak ditiru dari acuan

Tema medieval dan ukiran, huruf gotik, angka Romawi, "Plate", segel, tekstur perkamen, teks, nama, dan aset. Penomoran "Reading 01–04", cakram survei, cap slot, dan tepi penggaris adalah milik Datum.
