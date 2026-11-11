# Datum Live

Pertahankan Benchmark dengan cakram silang, tanda registrasi, garis tegas, tick, dan angka mono. Bidang ukur netral berada di belakang permukaan solid. Koordinat reticle berasal dari pointer.

- Chrome situs mengelola kontrol Motion, pemuatan canvas setelah paint dan idle, serta transisi rute.
- Cakram, cap, penggaris, skeleton, dan progres memakai transform dan opacity. Perubahan bacaan dan konfirmasi transaksi menjadi pemicu terpisah.
- Generator lokal menghasilkan cakram, cap, ilustrasi, tanda alamat, dan gambar metadata dari token yang ada. Contoh tetap diberi label.
- Bandingkan build produksi melalui mock RPC. Batasnya 20 KB gzip tambahan per rute, Performance ≥90 dan penurunan ≤3 poin, Accessibility/Best Practices/SEO 100, CLS 0, TBT ≤150 ms, axe 0 dan tanpa scroll horizontal pada 360 px. Target desktop 55 fps. Governor menurunkan kepadatan atau berhenti saat laju frame turun.

## Implementasi

Canvas Bench field memakai tanda registrasi, cakram, tick, reticle koordinat pointer, jejak, patok, dan parallax. Pemuatan menunggu kandidat LCP tenang lalu menunggu idle. Governor mengurangi kepadatan setelah jendela frame lambat dan menahan frame statis ketika laju tetap di bawah ambang. Pengaturan Motion tersedia di header, menu ponsel, dan footer.

Cakram, cap pengukuran, penggaris, progres, serta pita ukur memakai CSS atau Web Animations API. Token menandai perubahan hasil pada pembacaan ulang. Recent menandai klaim yang baru muncul di umpan. Publish menampilkan cap dan partikel setelah status transaksi terkonfirmasi. Generator menghasilkan aset dari palet Benchmark dan contoh tetap berlabel EXAMPLE. [Inventaris aset](ASSETS.md)

## Tangkapan layar

Tangkapan layar baru memakai `?motion=off` dan jam tetap. Matriks mencakup sembilan rute pada 360, 768, dan 1440 px, satu pass grayscale pada 1440 px, alur Publish, dan sheet ponsel.

| Lebar | Home sebelum | Home sesudah |
|---|---|---|
| 360 px | [Sebelum](screens/home-360.png) | [Sesudah](screens/live/home-360.png) |
| 768 px | [Sebelum](screens/home-768.png) | [Sesudah](screens/live/home-768.png) |
| 1440 px | [Sebelum](screens/home-1440.png) | [Sesudah](screens/live/home-1440.png) |
| 1440 px grayscale | [Sebelum](screens/home-1440-gray.png) | [Sesudah](screens/live/home-1440-gray.png) |

[Arsip sebelum](screens/) · [Arsip Datum Live](screens/live/)

## Hasil ukur

Lighthouse 13.6.0 memakai profil mobile pada ekspor produksi yang dilayani mock RPC dengan gzip. Baseline dibangun dari sumber pada commit `9100b70`. Kolom JS menjumlahkan ukuran gzip berkas JS unik yang diminta tiap rute, termasuk renderer canvas setelah idle. Kolom axe menampilkan jumlah pelanggaran dengan canvas aktif pada 360, 768, dan 1440 px.

| Rute | Performance | A11y / Best Practices / SEO | CLS | TBT (ms) | JS gzip (KB) | Δ JS (KB) | axe |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 100 → 100 | 100 / 100 / 100 → 100 / 100 / 100 | 0 → 0 | 1.5 → 1.5 | 158.74 → 163.07 | +4.33 | 0 / 0 / 0 |
| `/t` | 95 → 93 | 100 / 100 / 100 → 100 / 100 / 100 | 0 → 0 | 10 → 7 | 171.81 → 178.14 | +6.34 | 0 / 0 / 0 |
| `/recent` | 100 → 100 | 100 / 100 / 100 → 100 / 100 / 100 | 0.00988 → 0 | 0.5 → 2.5 | 180.04 → 187.22 | +7.18 | 0 / 0 / 0 |
| `/publish` | 95 → 94 | 100 / 100 / 100 → 100 / 100 / 100 | 0 → 0 | 16 → 5 | 182.44 → 188.27 | +5.84 | 0 / 0 / 0 |
| `/spec` | 100 → 100 | 100 / 100 / 100 → 100 / 100 / 100 | 0 → 0 | 2 → 2.5 | 160.06 → 164.73 | +4.67 | 0 / 0 / 0 |
| `/methodology` | 100 → 100 | 100 / 100 / 100 → 100 / 100 / 100 | 0 → 0 | 1 → 1.5 | 159.44 → 164.09 | +4.64 | 0 / 0 / 0 |
| `/terms` | 100 → 100 | 100 / 100 / 100 → 100 / 100 / 100 | 0 → 0 | 5 → 9.5 | 159.44 → 164.09 | +4.64 | 0 / 0 / 0 |
| `/styleguide` | 100 → 100 | 100 / 100 / 55 → 100 / 100 / 55 | 0 → 0 | 4 → 2 | 166.22 → 172.48 | +6.26 | 0 / 0 / 0 |
| 404 | — | — | — | — | 159.44 → 164.09 | +4.64 | 0 / 0 / 0 |

Performance mencapai 93–100 dengan penurunan terbesar 2 poin. CLS akhir 0 di delapan rute yang diberi skor. TBT maksimum 9,5 ms terhadap batas 150 ms. Tambahan JS terbesar 7,18 KB terhadap batas 20 KB. Axe menemukan 0 pelanggaran pada 27 kombinasi rute dan lebar, dengan 0 overflow horizontal pada matriks tersebut.

`/styleguide` menghasilkan SEO 55 karena `noindex`. Lighthouse berhenti pada respons HTTP 404 sehingga metrik Lighthouse untuk rute itu kosong. Playwright menguji status HTTP, tampilan, dan axe pada 404. [Keputusan D-062 sampai D-068](DECISIONS.md#datum-live)

### Laju frame

| Lebar | Chromium Headless Shell rata-rata / p5 | Google Chrome headless rata-rata / p5 |
|---|---:|---:|
| 360 px | 60.0 / 59.5 fps | 30.0 / 29.9 fps |
| 768 px | 60.0 / 59.9 fps | 30.0 / 29.9 fps |
| 1440 px | 60.0 / 59.5 fps | 30.0 / 29.9 fps |

Target desktop 55 fps tercapai di Chromium Headless Shell pada 1440 px. Google Chrome headless pada mesin pengujian berada di 30 fps. Perilaku governor ketika laju turun diuji dengan simulasi frame time. Pemakaian baterai dan laju frame pada perangkat fisik kelas bawah belum diukur.

### Pemeriksaan

- Typecheck, build statis, pemeriksaan token, copy, dan kontras lulus. Kontras teks koordinat terhadap bidang yang disimulasikan 5,41:1.
- Unit lulus dengan 95 tes protokol dan 115 tes web, termasuk 38 tes relay. Generator lulus perbandingan SHA-256 pada dua eksekusi.
- Playwright lulus dengan 31 tes baseline, 69 tes pada build Datum Live, dan 40 tes pengambilan gambar. Transaksi Publish menggunakan dompet dan RPC tiruan.
- Pemindaian signature kredensial pada sumber dan dokumentasi menghasilkan 0 kecocokan.

Watch dilewati sesuai D-063. Pembacaan ulang berjalan atas permintaan pengguna sehingga tidak ada polling tambahan pada relay.
