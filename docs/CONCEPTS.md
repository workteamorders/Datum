# Langkah 0: tiga arah visual Datum

Papan konsep (data contoh, bukan klaim nyata): `docs/concepts/concept-a-scribe.png`, `concept-b-benchmark.png`, `concept-c-rod.png`. HTML sumbernya ada di folder yang sama. Setiap papan memuat palet, huruf, Ruler dalam tiga keadaan (di bawah batas, melewati batas, tanpa data), StatusMark berwarna dan abu-abu, MeasurementStamp, dan cuplikan halaman token di 360 px.

Ketiganya diperiksa terhadap daftar larangan: tanpa kontur, peta, topografi, kotak sumber ala diagram survei, teal-magenta, catatan kaki superscript, tabel almanak, bintang, bahasa bahari, tampilan Theorem, pixel, XP, panel krem bergaris tebal dengan bayangan keras, ukiran kayu atau perkamen, dan tanpa perisai, gembok, tengkorak, atau alarm merah-hijau. Di ketiga arah, status dibawa oleh bentuk dan kata, bukan oleh pasangan merah-hijau.

---

## A. Scribe

**a. Ide.** Setiap angka adalah garis yang digores menembus lapisan layout blue di atas baja: kamu bisa melihat persis di mana pengukuran memotong.

**b. Dunia.** Meja kerja masinis: pewarna layout (Dykem) yang dioles ke logam lalu digores dengan scriber sehingga garisnya berkilau. Cocok karena pembuat token dan pembeli crypto-native menghargai ketelitian teknis, dan goresan adalah bukti yang tidak bisa disamarkan.

**c. Palet.**
| Peran | Nama | Hex |
|---|---|---|
| Permukaan dasar | Bench | `#F2F4F5` |
| Permukaan kedua | Steel | `#DDE2E6` |
| Teks utama | Etch | `#12171B` (16,4 : 1) |
| Teks redup | Graphite | `#4E5963` (6,5 : 1) |
| Aksen, aksi utama | Layout blue | `#1D3FAF` (8,0 : 1) |
| Garis di atas biru | Scribe | `#E9EEF6` (7,6 : 1 di atas biru) |
| Not true now | Oxide | `#A8361B` (5,9 : 1) |

**d. Huruf.** B612 (judul dan isi) dan B612 Mono (alamat, tanda tangan). B612 digambar Airbus untuk layar kokpit: dibuat untuk dibaca sekilas tanpa salah baca. Angka jumlah memakai B612 biasa, karena koma di versi mono terlalu lebar.

**e. Bahasa bentuk.** Sudut dipotong 45° (chamfer 8 px, seperti tepi benda mesin), tanpa radius bulat. Garis 1 px. Lapisan dipisah oleh nada baja dan garis gores, tanpa bayangan. Ikon garis 1,6 px, ujung persegi. Gerak: garis tergores dari kiri ke kanan secara linear, singkat.

**f. Detail khas.** Ruler berupa batang biru dengan tik yang tergores terang; batas klaim adalah blok penahan hitam; kelebihan di atas batas tampil sebagai area yang terkikis (arsir terang).

**g. Risiko.** Bisa terasa dingin dan "dasbor teknik". Biru adalah warna aksen yang umum, jadi identitasnya bergantung penuh pada motif goresan. Chamfer berlebihan bisa terlihat seperti game fiksi ilmiah. B612 agak lebar untuk teks panjang di halaman Spec dan Methodology.

---

## B. Benchmark

**a. Ide.** Klaim adalah patok tetap yang dipasang seseorang; Datum datang kembali dan mengukur ulang dari patok itu.

**b. Dunia.** Cakram patok survei dari perunggu yang ditanam di beton, dengan bidik silang di tengah dan huruf yang dicap melingkar. Kata "datum" sendiri berarti titik acuan dalam survei. Metaforanya tepat untuk produk ini: titik acuan yang publik, tidak bisa dihapus, dan bisa diperiksa siapa saja.

**c. Palet.**
| Peran | Nama | Hex |
|---|---|---|
| Permukaan dasar | Concrete | `#E2E4E1` |
| Permukaan tertanam | Cured | `#D2D5D1` |
| Teks utama | Stamp | `#1B1C1A` (13,4 : 1) |
| Teks redup | Aggregate | `#4F534D` (6,1 : 1) |
| Aksen, aksi utama | Bronze | `#7E4C1E` (5,6 : 1) |
| Muka cakram (tanpa teks) | Cast | `#B98A55` |
| Not true now | Oxide | `#8F3520` (6,1 : 1) |

**d. Huruf.** Chivo 800 sampai 900 untuk judul, seperti huruf yang dicap pada cakram; Chivo 400 untuk isi; Chivo Mono untuk slot, jumlah, dan alamat. Satu keluarga, sehingga cap, isi, dan angka terasa dari pabrik yang sama.

**e. Bahasa bentuk.** Lingkaran untuk penanda (cakram, cincin, StatusMark); persegi panjang dengan radius 4 px untuk panel. Lapisan dipisah oleh nada beton (permukaan yang "tertanam" sedikit lebih gelap dengan garis dalam 1 px), tanpa bayangan jatuh. Garis 1 sampai 2 px. Ikon garis 1,6 px, ujung bulat. Gerak: cakram "dicap" saat pengukuran selesai (sedikit menekan lalu kembali, sekitar 120 ms).

**f. Detail khas.** MeasurementStamp berupa cakram perunggu dengan tulisan "MEASURED AT SLOT" melingkar dan nomor slot di tengah; di Ruler, batas klaim adalah cakram patok kecil yang duduk di garis ukur. Versi baris (cakram kecil + kalimat) selalu ada untuk HP dan pembaca layar.

**g. Risiko.** Teks melingkar sulit dibaca, jadi hanya boleh dekoratif dengan teks linear di sampingnya. Perunggu bisa terbaca "antik" bila terlalu banyak. Kontras keseluruhan lebih kalem, sehingga hierarki harus dijaga lewat ukuran dan bobot, bukan warna. Lingkaran memakan ruang di kolom sempit.

---

## C. Rod

**a. Ide.** Setiap nilai dibaca dari rambu ukur: graduasi hitam yang tegas, angka merah, dan target geser yang duduk tepat di bacaan. Merah menandai bacaan, tidak pernah vonis.

**b. Dunia.** Rambu ukur sipat datar (levelling rod) dengan pola E hitam, angka merah setiap sepuluh unit, dan target bundar yang digeser surveyor ke titik bidik. Cocok karena dibuat untuk dibaca dari jauh tanpa ragu, persis seperti verdict yang harus terbaca sekilas.

**c. Palet.**
| Peran | Nama | Hex |
|---|---|---|
| Permukaan dasar | Rod white | `#FAFAF8` |
| Permukaan kedua | Fibreglass | `#E9EAE6` |
| Graduasi dan teks | Rod black | `#1A1A1A` (16,7 : 1) |
| Teks redup | Weathered | `#595955` (6,7 : 1) |
| Aksen: bacaan, aksi utama | Rod red | `#C21F2D` (5,7 : 1) |
| Keadaan pudar (tanpa teks) | Chalk | `#C9CAC5` |

Status sengaja tidak memakai merah: keempat StatusMark hitam atau abu-abu, dibedakan bentuknya.

**d. Huruf.** Barlow Condensed 800 untuk angka dan judul gaya rambu, tetap besar di kolom sempit; Barlow untuk teks isi; angka tabular untuk semua jumlah. Satu keluarga besar, tanpa mono.

**e. Bahasa bentuk.** Radius nol, blok hitam padat, garis tebal (6 px di bawah header). Lapisan dipisah oleh pita hitam dan ruang putih, bukan garis tipis. Ikon blok penuh. Gerak: target rambu meluncur ke bacaan dalam langkah-langkah pendek, lalu berhenti.

**f. Detail khas.** Target rambu (cakram berkuadran merah-putih) yang meluncur ke nilai sekarang di Ruler; garis merah tegak di batas klaim.

**g. Risiko.** Kontras hitam-merah-putih bisa terasa keras dan mendekati "alarm", berlawanan dengan larangan menakut-nakuti. Huruf kondensasi tebal mudah terdengar berteriak. Gayanya paling dekat ke estetika poster Swiss, jadi butuh disiplin supaya tidak menjadi tren umum.

---

## Rekomendasi: B. Benchmark

1. Metaforanya sama dengan nama dan perilaku produk: datum adalah titik acuan yang dipasang sekali dan diukur ulang siapa saja. Itu persis yang dilakukan klaim Datum.
2. Palet beton dan perunggu kalem dan jujur: tidak menakut-nakuti, tidak meniru pemindai penipuan, dan tidak memakai merah-hijau.
3. Cakram dengan bidik silang memberi satu bentuk yang bisa dimiliki: dengan logo ditutup, halaman tetap terbaca sebagai Datum.
4. Bentuk StatusMark (cakram penuh dengan silang, cincin dengan X, cincin putus, cincin dengan titik) tetap berbeda dalam abu-abu.

Mode: terang saja untuk v0. Beton di siang hari adalah konsepnya, dan teks panjang di Spec dan Methodology lebih nyaman di latar terang. `color-scheme: light`. Varian gelap bisa ditambahkan nanti tanpa mengubah bentuk.

Bila ingin yang paling berani secara visual, C adalah alternatifnya, dengan catatan risiko di atas. Ketiga arah tidak dicampur.
