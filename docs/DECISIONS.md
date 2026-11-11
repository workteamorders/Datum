# Datum — Keputusan dan Gerbang S

Berkas ini mencatat setiap keputusan teknis, buktinya, dan selisih antara dokumentasi dan perilaku langsung.
Format: `D-NNN`, tanggal UTC, bukti, keputusan. Bila dokumentasi dan perilaku langsung berbeda, perilaku langsung menang.

Semua bukti Gerbang S diambil pada **2026-11-10, 17:56 sampai 18:35 UTC** (2026-11-11 dini hari WITA), kecuali disebut lain.

---

## Ringkasan Gerbang S

| Item | Hasil | Keputusan |
|---|---|---|
| a. Batas ukuran memo | Memo 512 byte: transaksi 839 byte, 180.118 CU di program Memo. Batas ukuran mentah 905 byte. | `MEMO_MAX_BYTES = 512` (D-003) |
| b. `getSignaturesForAddress` pada alamat off-curve yang tidak pernah menjadi akun | Berfungsi di `api.devnet.solana.com` dan `api.mainnet-beta.solana.com`. `solana-rpc.publicnode.com` (gratis tanpa token) mengembalikan `[]` untuk alamat yang jelas punya riwayat. Penyedia berkunci belum bisa diuji. | Lanjut (aturan BERHENTI tidak terpicu). publicnode dilarang sebagai upstream. Upstream produksi wajib lolos pemeriksaan riwayat (D-009). |
| c. `getTransaction` | Berfungsi; memuat `accountKeys` dengan flag penanda tangan (jsonParsed) atau `header` (json), `blockTime`, `meta.err`, `computeUnitsConsumed`, dan memo. | Relay menolak batch; panggilan tunggal, 10 klaim per muat, paginasi, cache transaksi (D-007). Pembaca memakai encoding `json` (D-005). |
| d. `getTokenLargestAccounts` | RPC publik devnet: `x-ratelimit-method-limit: 0` (metode dimatikan), 429. Mainnet publik: 429 sejak panggilan pertama. publicnode: 403 "Indexed requests require a personal token". | `top_holders_max_pct` **keluar dari v0**, masuk "Not in v0" (D-008). |
| e. Layout akun | SPL Token, Token-2022 (TLV), Metaplex Token Metadata, dan token metadata Token-2022 cocok dengan pustaka terpasang dan dengan pembacaan langsung lima akun mainnet. | Lihat D-010 sampai D-012. |
| f. Stabilitas predikat | Dibuktikan dengan simulasi langsung (SetAuthority, CloseAccount, Reallocate) dan status upgrade program yang dibaca langsung. | Aturan "Permanent" ketat (D-015). Token-2022 masih bisa di-upgrade, jadi predikatnya "Can change" selama itu berlaku. |
| g. pump.fun bonding curve | PDA `["bonding-curve", mint]` di `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`; field `creator` di offset 49..81. Dicek langsung pada satu kurva mainnet. | Hubungan "pump.fun creator" dibaca sekarang; bisa berubah (D-017). |
| h. Klaster | Devnet aktif (slot 520.825.505 pada 17:59 UTC). | Pengembangan di devnet. Airdrop hanya oleh pemilik. |
| i. Cloudflare | Pages Functions: 100.000 permintaan per hari (bersama Workers) di paket gratis; aset statis gratis tanpa batas. Binding Rate Limiting tidak tercantum di daftar binding Pages Functions. WAF gratis: 1 aturan rate limiting (IP, 10 detik). | Token bucket per isolate (upaya terbaik) di relay, binding opsional bila tersedia; aturan WAF sebagai langkah pemilik (D-025). |
| Toolchain | Lihat D-026. Solana CLI dan Anchor tidak ada di lingkungan mana pun. | Tahap 2 hanya spesifikasi. |

---

## Cara verifikasi dilakukan

- Shell kontainer cloud dan shell VM di perangkat pemilik **tidak bisa** menjangkau RPC Solana, `solana.com`, atau `developers.cloudflare.com` (proxy egress menjawab 403 pada CONNECT; dicatat, tidak dicoba ulang). Registry npm dan GitHub bisa.
- Panggilan RPC langsung dilakukan dari **panel browser bawaan di Mac pemilik** dengan `fetch()` JSON-RPC ke `api.devnet.solana.com` dan `api.mainnet-beta.solana.com`. Hanya metode baca dan `simulateTransaction` dengan `sigVerify: false` dan `replaceRecentBlockhash: true`. **Tidak ada tanda tangan, tidak ada `sendTransaction`, tidak ada airdrop.**
- Untuk membangun transaksi simulasi, `@solana/web3.js@1.98.4`, `@solana/spl-token@0.4.15`, dan `@solana/spl-token-metadata@0.1.6` dimuat ke halaman browser dari jsDelivr. Tidak ada yang dipasang di folder proyek.
- Fee payer simulasi: `41us3NZBQ1du85iJEBxzddB6o4pw7TfymPZmR6dju5bu`, fee payer transaksi Theorem di devnet dan mainnet (dompet uji pemilik). Simulasi tanpa verifikasi tanda tangan tidak membutuhkan kunci.
- Dokumentasi dibaca langsung (WebFetch). Kutipan dan selisihnya ada di bawah.
- Pustaka diperiksa di scratchpad sesi, bukan di folder proyek: `@solana/kit 8.6.0`, `@solana/web3.js 1.99.0`, `@solana/spl-token 0.4.15`, `@solana-program/token 0.18.0`, `@solana-program/token-2022 0.20.1`, `@solana-program/memo 0.16.0`, `@solana-program/system 0.16.0`, `@metaplex-foundation/mpl-token-metadata 4.0.0`, `@pump-fun/pump-sdk 4.3.1`.
- Pola kode dibaca (tanpa mengubah, tanpa membuka `.env*`, `.dev.vars`, `vercel.*.vars`): `../theorem/lib/sol/{launch,market,config,tx,pump,errors,polyfill}.ts`, `../Afterbell/src/server/rpc-handler.ts`, `../Afterbell/functions/api/rpc.ts`, `../Afterbell/src/lib/{geo,limiter}.ts`, `../Afterbell/src/lib/wallet/standard.ts`, dan `package.json` kedua proyek (hanya daftar dependensi).

---

## Keputusan

### D-001 Program Memo yang dipakai: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- Bukti langsung: di devnet dan mainnet, `MemoSq4…` dimiliki `BPFLoader2111111111111111111111111111111111` (loader non-upgradeable). `Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH` (Memo v4) aktif dan dimiliki `BPFLoaderUpgradeab1e…` dengan upgrade authority `GbX5VJUWBXgqDFKXZAmaneVHFuhauMVgvgGE7NPsJahD` (programdata `HPD8Gxq19uaXy6zDaEGBtkb9NEZwd4jRTnXQ4GM8qe86`). `Memo1Uh…` (v1) juga ada.
- Selisih: `@solana-program/memo 0.16.0` menjadikan `Memo4c2p…` sebagai `MEMO_PROGRAM_ADDRESS` bawaan dan menamai `MemoSq4…` `LEGACY_MEMO_PROGRAM_ADDRESS_V3` ("kept for reading memos emitted by older transactions"). Perilaku langsung: keduanya berjalan.
- Keputusan: `datum/0` memakai `MemoSq4…` untuk instruksi memo **dan** untuk turunan alamat. Pembaca hanya menerima memo dari `MemoSq4…`. Alasan: protokol tidak boleh bergantung pada program yang bisa diubah pemegang kunci upgrade. Kode tidak boleh memakai konstanta bawaan paket memo.

### D-002 Akun tag ditaruh di instruksi transfer, bukan di instruksi memo
- Bukti langsung (devnet): instruksi Memo dengan satu akun read-only bukan penanda tangan gagal dengan `MissingRequiredSignature` ("missing required signature for instruction", 566 CU). Ini membenarkan dugaan di pola Theorem.
- Keputusan: KLAIM-MINT dan UMPAN menempel di transfer 0 lamport dari penerbit ke dirinya sendiri.

### D-003 `MEMO_MAX_BYTES = 512`
Bukti simulasi di devnet (transaksi v0, memo JSON bertanda kutip, transfer 0 lamport dengan dua akun tag, batas CU 1.400.000 untuk mengukur):

| Memo (byte) | Transaksi (byte) | CU program Memo | CU total |
|---|---|---|---|
| 200 | 527 | 71.777 | 72.077 |
| 300 | 627 | 106.437 | 106.737 |
| 400 | 727 | 141.312 | 141.612 |
| 459 (klaim valid terbesar, lihat bawah) | 786 | 162.563 | 162.863 |
| 512 | 839 | 180.118 | 180.418 |
| 600 | 927 | 210.592 | 210.892 |
| 800 | 1.127 | 280.616 | 280.916 |
| 880 | 1.207 | 308.218 | 308.518 |

- Batas ukuran mentah (dihitung dengan serialisasi web3.js, 1.232 byte): 905 byte memo (v0 dengan instruksi batas CU), 893 byte (ditambah harga CU), 945 byte (tanpa instruksi compute budget).
- Memo tidak valid UTF-8 ditolak program: `InvalidInstructionData` ("Invalid UTF-8, from byte 1").
- Program Memo mencatat isi memo ke log; biayanya sekitar 350 CU per byte untuk JSON (lebih mahal dari teks polos karena tanda kutip di-escape di log). Pembanding langsung: memo Theorem 184 byte memakai 66.424 CU.
- Klaim v0 valid terbesar (8 predikat terpanjang dengan nilai maksimum, mint 44 karakter, label 48 byte) = **459 byte**.
- Keputusan: 512 byte. Alasan: (1) muat semua klaim v0 valid; (2) 180.118 CU masih di bawah batas bawaan 200.000 CU per instruksi, jadi transaksi tetap berhasil walau wallet mengganti instruksi compute budget; (3) transaksi 839 byte (851 byte bila harga CU ikut diset) menyisakan paling sedikit 381 byte dari batas 1.232 untuk instruksi yang disisipkan wallet. Batas CU diisi dari hasil simulasi ditambah margin, tidak ditebak.
- Tidak terverifikasi: berapa byte yang ditambahkan wallet tertentu (mis. instruksi penjaga dari Phantom). Ruang sisa dipilih lebar karena itu.

### D-004 `getSignaturesForAddress`: perilaku langsung
- Alamat turunan off-curve yang tidak pernah menjadi akun: `getAccountInfo` = `null`, tetapi riwayatnya terbaca. Bukti: TAG Theorem `8ZabDiS386zXpS2yYV253iEG1a1VmQ6hFGjCoj5rJtZA` mengembalikan 2 tanda tangan di devnet dan 1 di mainnet; UMPAN Datum `6LfGebjFQ5o9qNCQgcGF5HP5johg5MygapbSd2kNb3nK` mengembalikan `[]` (belum pernah dipakai, bukan galat).
- `limit` maksimum 1000 (`limit: 1001` → `-32602 "Invalid limit; max 1000"`). Datum menjepitnya ke 50 di relay sesuai spesifikasi.
- `before` dan `until` bekerja seperti yang diharapkan (diuji dengan dua tanda tangan di devnet).
- Commitment di bawah `confirmed` ditolak (`"Method does not support commitment below confirmed"`).
- Urutan: terbaru ke terlama (dokumentasi dan perilaku sama).
- Field `memo` di hasil berbentuk `"[<panjang>] <teks>"`, mis. `"[183] {\"t\":\"theorem/1\",…"`. Dokumentasi hanya menyebut `string | null`.
- Selisih: dokumentasi tidak menyebut batas `limit`, `before`/`until`, atau commitment minimum. Perilaku langsung dicatat di atas.

### D-005 Pembaca memakai `getTransaction` dengan `encoding: "json"`, bukan `jsonParsed`
- Bukti langsung (mainnet, tanda tangan `GWfwJFUp…EbGY9w`): pada `jsonParsed`, instruksi transfer System hanya menampilkan `source`, `destination`, `lamports`; akun tambahan (TAG) **tidak** terlihat di instruksi itu. Pada `json`, instruksi transfer berisi `accounts: [0, 0, 4]` sehingga keberadaan tag di instruksi transfer bisa dibuktikan.
- `json` juga memberi `header.numRequiredSignatures` (penanda tangan = indeks di bawah angka itu), data instruksi dalam base58, `meta.err`, `meta.loadedAddresses`, `blockTime`, `slot`, `version`.
- Keputusan: pembaca mem-parse transaksi mentah sendiri. Tidak bergantung pada parser RPC.

### D-006 Field `memo` hanya dipakai sebagai saringan awal
- Keputusan: tanda tangan yang field `memo`-nya tidak memuat `"t":"datum/0"` dilewati tanpa `getTransaction`. Ini menghemat panggilan saat umpan dipenuhi spam. Kebenaran tetap hanya dari `getTransaction`.

### D-007 Tanpa batch di relay; panggilan tunggal
- Bukti: RPC publik menerima batch JSON-RPC (dua `getSlot` dalam satu array, HTTP 200). Relay Afterbell menolak batch.
- Keputusan: relay Datum tetap menolak batch (validasi per metode tetap sederhana dan sama dengan pola Afterbell yang teruji; batas laju RPC publik dihitung per metode). Klien memuat paling banyak **10 klaim per muat** dengan tombol muat lagi, konkurensi kecil, dan cache transaksi dalam memori (transaksi yang sudah dikonfirmasi tidak berubah). UI menjelaskan batas ini.

### D-008 `top_holders_max_pct` keluar dari v0
- Bukti langsung: devnet publik `x-ratelimit-method-limit: 0` dan 429 untuk `getTokenLargestAccounts`; mainnet publik 429 pada panggilan pertama dan setelah jeda 12 detik; publicnode 403 "Indexed requests require a personal token".
- Dokumentasi: "Up to 20 of the largest token accounts", berupa akun token, bukan pemilik.
- Keputusan: sesuai aturan keputusan, predikat ini dikeluarkan dan dicantumkan di "Not in v0" (SPEC §11). Metode ini tidak masuk allowlist relay.

### D-009 Upstream RPC
- Bukti: publicnode mengembalikan `[]` untuk `getSignaturesForAddress(TAG Theorem)` di mainnet, padahal RPC resmi mengembalikan satu tanda tangan; `getTransaction` untuk tanda tangan yang sama mengembalikan `null`. Kegagalan ini **diam**: pembaca akan menyimpulkan "belum ada klaim" padahal salah.
- Dokumentasi Solana: endpoint publik "are not intended for production applications"; batas 100 permintaan per 10 detik per IP, 40 per 10 detik per metode, 40 koneksi, 100 MB per 30 detik.
- Helius Free (halaman harga dibaca): 1 juta kredit per bulan, 10 permintaan per detik; halaman itu tidak menyebut metode standar satu per satu.
- Keputusan: upstream bawaan untuk pengembangan lokal adalah `api.devnet.solana.com` (bukan publicnode seperti `DEFAULT_DEV_UPSTREAM` Afterbell). Produksi memakai penyedia berkunci tingkat gratis yang dipilih pemilik, dan wajib lolos skrip pemeriksaan (akan ditulis sebagai `pnpm rpc:check`) yang membandingkan riwayat alamat yang diketahui sebelum deploy.
- Tidak terverifikasi di sesi ini: penyedia berkunci (Helius, Alchemy, QuickNode) karena tidak ada kunci. Itu langkah pemilik.

### D-010 Layout akun yang dipakai (dari pustaka terpasang, dicocokkan dengan data langsung)
- **SPL Token mint** (`@solana/spl-token 0.4.15`, `MintLayout`, 82 byte): `mintAuthorityOption u32`, `mintAuthority [32]`, `supply u64`, `decimals u8`, `isInitialized bool`, `freezeAuthorityOption u32`, `freezeAuthority [32]`.
- **Token-2022 mint**: 82 byte dasar; bila lebih panjang, byte ke-165 adalah tipe akun (`1` = Mint) dan TLV mulai di byte 166. Tiap entri: `type u16`, `length u16`, data. Tata letak ekstensi yang dipakai:
  - `TransferFeeConfig` (1): `transferFeeConfigAuthority [32]`, `withdrawWithheldAuthority [32]`, `withheldAmount u64`, `olderTransferFee {epoch u64, maximumFee u64, bps u16}`, `newerTransferFee {…}`.
  - `MintCloseAuthority` (3): `closeAuthority [32]`.
  - `DefaultAccountState` (6): `state u8` (1 = Initialized, 2 = Frozen).
  - `PermanentDelegate` (12): `delegate [32]`.
  - `TransferHook` (14): `authority [32]`, `programId [32]`.
  - `MetadataPointer` (18): `authority [32]`, `metadataAddress [32]`.
  - `TokenMetadata` (19, `@solana/spl-token-metadata`): `updateAuthority [32]`, `mint [32]`, `name`, `symbol`, `uri` (string u32), `additionalMetadata` (vec pasangan string).
  - `ConfidentialMintBurn` (24) dan `PausableConfig` (26: `authority [32]`, `paused bool`) dicatat sebagai fakta.
- **Metaplex Token Metadata** (`mpl-token-metadata 4.0.0`, program `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`, PDA `["metadata", programId, mint]`): `key u8` (4 = MetadataV1), `updateAuthority [32]`, `mint [32]`, `name`, `symbol`, `uri` (string u32), `sellerFeeBasisPoints u16`, `creators option<vec<{address [32], verified bool, share u8}>>`, `primarySaleHappened bool`, `isMutable bool`, lalu field opsional.
- Dicocokkan langsung (mainnet): BONK (SPL, authority None, Metaplex `isMutable = 1`), USDC (SPL, authority ada, Metaplex `isMutable = 1`), PYUSD (Token-2022, 8 ekstensi), koin Theorem `4o1pkc…sizWv` (Token-2022, `MetadataPointer` ke mint sendiri, `TokenMetadata` dengan `updateAuthority` None). Untuk keempat mint, hasil dekode sama dengan `jsonParsed` RPC (supply, mint authority, freeze authority).

### D-011 Pubkey opsional bernilai nol berarti None
- Bukti: PYUSD `TransferHook.programId` terbaca `11111111111111111111111111111111` (32 byte nol) oleh `TransferHookLayout`, sementara `getMetadataPointerState` memetakan nol ke `null`. Token-2022 memakai `OptionalNonZeroPubkey`.
- Keputusan: dekoder Datum menormalkan semua field pubkey opsional Token-2022 dan token metadata: 32 byte nol = None. Diuji dengan fixture.

### D-012 Nama ekstensi dari `@solana-program/token-2022`, bukan `@solana/spl-token`
- Bukti: PYUSD memuat ekstensi tipe 16; enum `ExtensionType` di `@solana/spl-token 0.4.15` tidak punya 16 (dan 24), sementara `@solana-program/token-2022 0.20.1` punya `ConfidentialTransferFee` (16) dan `ConfidentialMintBurn` (24).
- Keputusan: daftar nama mengikuti `@solana-program/token-2022`. Tipe yang tidak dikenal ditampilkan sebagai "Unknown extension (type N)" dan tidak pernah dianggap aman.

### D-013 Status upgrade program (dibaca langsung, mainnet)
| Program | Loader | Upgrade authority |
|---|---|---|
| SPL Token `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Upgradeable | **Tidak ada** (tidak bisa diubah) |
| Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | Upgradeable | `AeLmXCbPaQHGWRLr2saFsEVfmMNuKnxRAbWCT9P5twgz` |
| Metaplex Token Metadata `metaqbxx…518x1s` | Upgradeable | **Tidak ada** |
| pump.fun `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Upgradeable | `7gZufwwAo17y5kg8FMyJy2phgpvv9RSdzWtdXiWHjFr8` |
| Memo `MemoSq4…` | BPF Loader 2 | Tidak bisa di-upgrade |

Keputusan: status upgrade program token dibaca langsung saat evaluasi (dua `getAccountInfo`, di-cache per sesi), bukan disimpan sebagai konstanta.

### D-014 Bukti stabilitas (simulasi langsung, mainnet kecuali disebut)
| Uji | Hasil |
|---|---|
| SPL Token `SetAuthority(MintTokens)` pada BONK (mint authority None) | `Custom 5`: "the total supply of this token is fixed" |
| SPL Token `SetAuthority(FreezeAccount)` pada BONK (freeze authority None) | `Custom 16`: "This token mint cannot freeze accounts" |
| Token-2022 `SetAuthority(MintTokens)` pada koin Theorem (None) | `Custom 5`, pesan sama |
| Token-2022 `SetAuthority(FreezeAccount)` pada koin Theorem (None) | `Custom 16`, pesan sama |
| SPL Token `CloseAccount` pada mint BONK | `InvalidAccountData` (mint SPL tidak bisa ditutup) |
| Token-2022 `CloseAccount` pada mint tanpa `MintCloseAuthority` | `InvalidAccountData` |
| Token-2022 `Reallocate` pada mint untuk menambah `PermanentDelegate` | `UninitializedAccount` (Reallocate hanya untuk akun token) |

Dokumentasi pendukung:
- solana.com/docs/tokens/extensions: "Most extensions can't be added after an account is initialized."
- solana.com/docs/tokens/extensions/close-mint: tanpa `MintCloseAuthority` "a mint account cannot be closed"; supply harus nol; "`InitializeMintCloseAuthority` must come before `InitializeMint`".
- Daftar instruksi `@solana/spl-token` dan `@solana-program/token-2022`: tidak ada instruksi yang mengubah `decimals`; `Reallocate` didokumentasikan untuk "The token account to reallocate".
- Metaplex: kelas galat `IsMutableCanOnlyBeFlippedToFalse` ada di klien `mpl-token-metadata 4.0.0`; dokumen update: "When changing this to false, any future updates will fail."
- Selisih: dokumen Metaplex tidak menyatakan bahwa `isMutable` tidak bisa dibalik; itu hanya terlihat dari daftar galat program. Dokumen juga tidak menyatakan apakah update authority masih bisa dipindah saat immutable.

### D-015 Aturan "Permanent"
Hasil sebuah predikat bertanda **Permanent** hanya bila semua ini terbukti saat evaluasi:
1. Sifat itu tidak bisa berubah menurut kode program saat ini (bukti D-014);
2. Program token pemilik mint **tidak punya upgrade authority** (dibaca langsung, D-013);
3. Mint tidak bisa ditutup (SPL Token: selalu; Token-2022: tidak ada `MintCloseAuthority` atau authority-nya None).

Selain itu **Can change**, dengan satu kalimat alasan. Akibatnya hari ini: predikat SPL Token yang terbukti bisa Permanent; semua predikat Token-2022 (termasuk koin pump.fun) tampil "Can change" dengan alasan "Token-2022 can be upgraded by its upgrade authority; under its current code this cannot change." Ini disengaja: lebih baik jujur dan berhati-hati daripada menjanjikan hal yang belum terbukti.

### D-016 `metadata_immutable` dan `update_authority_eq` selalu "Can change" di v0
- Metaplex: `closeAccounts` ("Authority to close ownerless accounts") dan jalur burn ada di klien; sesi ini tidak bisa membuktikan bahwa akun metadata fungible tidak pernah bisa ditutup. `createMetadataAccountV3` mewajibkan tanda tangan mint authority.
- Token-2022 metadata: program bisa di-upgrade.
- Keputusan: kedua predikat selalu "Can change" dengan alasan tertulis. Bila kelak terbukti, aturan bisa diperketat di versi berikutnya.

### D-017 Hubungan "pump.fun creator"
- Bukti: IDL `@pump-fun/pump-sdk 4.3.1` (`src/idl/pump.json`): `BondingCurve` = diskriminator 8 byte `[23,183,248,55,96,216,172,96]`, 5 × u64, `complete bool`, `creator pubkey`, lalu field tambahan. Jadi `creator` di offset 49..81. Kurva langsung koin Theorem (`3skkRVgz…ePSQ`, 166 byte, pemilik program pump) memberi `creator = 41us3NZ…`, sama dengan fee payer peluncurannya.
- IDL memuat `set_creator` (oleh `Global::set_creator_authority`), `set_metaplex_creator`, dan `migrate_bonding_curve_creator`. Field `creator` bisa berubah.
- Keputusan: hubungan ditampilkan "Is the pump.fun creator of this coin" bila `creator` saat ini sama dengan penerbit; teks menyebut bahwa ini dibaca sekarang dari bonding curve. Panjang akun bervariasi (SDK menyebut kurva 115 byte masih ada), jadi dekoder hanya membaca prefiks yang dibutuhkan dan mengecek pemilik dan diskriminator.

### D-018 Hubungan penanda tangan saat authority dicabut
- Keputusan: bila penerbit tidak cocok dengan authority mana pun dan setidaknya satu authority yang relevan (mint, freeze, update metadata) sudah None, hasilnya "Authority revoked; cannot establish who signed". "Unrelated wallet" hanya dipakai bila semua authority yang relevan ada dan tidak ada yang cocok. Hanya hubungan yang terbukti masuk ke "From the token's authorities".

### D-019 Urutan klaim pengganti memakai slot, bukan blockTime
- Alasan: `blockTime` adalah perkiraan dan bisa `null`. Kunci urutan: `slot` menurun; seri di slot yang sama memakai urutan respons `getSignaturesForAddress` (terbaru dulu). `blockTime` hanya untuk tampilan. Karena pembacaan selalu dari terbaru ke terlama, klaim pengganti sudah termuat sebelum klaim yang digantikannya.

### D-020 Waktu pengukuran
- Allowlist spesifikasi tidak memuat `getBlockTime`. Keputusan: setiap evaluasi menyimpan `slot` dari `context.slot` respons RPC dan waktu terima menurut jam perangkat (`observedAt`). UI menulis "Measured at slot N, 12 s ago", dan laci bukti menjelaskan bahwa waktunya dari jam perangkat. Ini selisih kecil dari teks spesifikasi ("slot dan blockTime pengukuran"); dipilih supaya allowlist tidak bertambah.

### D-021 Biaya jaringan
- Bukti langsung: transaksi Theorem dengan batas 200.000 CU dan harga 20.000 microlamport/CU membayar `fee = 9000` lamport = 5.000 (dasar per tanda tangan) + 200.000 × 20.000 / 1.000.000.
- Keputusan: biaya dihitung lokal dengan rumus itu dari batas CU hasil simulasi dan harga CU yang dipakai, lalu ditampilkan sebelum tanda tangan. Tidak ada biaya platform.

### D-022 Wallet dan pengiriman
- Pola Afterbell: Wallet Standard langsung (`@wallet-standard/app 1.1.1`, `@solana/wallet-standard-features 1.5.0`), `solana:signTransaction`, lalu kirim lewat relay.
- Keputusan: ikuti pola itu. Setelah wallet menandatangani, aplikasi memeriksa bahwa instruksi memo dan transfer masih utuh, mensimulasikan ulang bytes yang sudah ditandatangani, baru mengirim. Karena itu `sendTransaction` tetap di allowlist relay (dan diblokir untuk negara di `BLOCKED_COUNTRIES`, seperti `simulateTransaction`). Theorem memakai `wallet-adapter-react`; tidak dipilih karena lebih berat dan Afterbell sudah punya pola Wallet Standard yang teruji.

### D-023 Commitment baca: `confirmed`
- Sesuai batas minimum `getSignaturesForAddress`. `confirmationStatus` ditampilkan di laci bukti.

### D-024 Versi stack (dicek di registry npm pada 2026-11-10; dicek ulang saat pemasangan)
next 16.4.6, react 19.3.1, @solana/kit 8.6.0, @solana-program/token 0.18.0, @solana-program/token-2022 0.20.1, @solana-program/memo 0.16.0 (hanya untuk perbandingan; konstanta Memo ditulis sendiri, D-001), @wallet-standard/app 1.1.1, @solana/wallet-standard-features 1.5.0, zod 4.6.7, vitest 5.1.0, typescript 7.0.2, wrangler 4.160.0, @playwright/test 1.65.0, fast-check 4.10.2. Catatan: `@solana-program/memo` mendeklarasikan `devEngines` node ≥ 24; node di lingkungan kerja 22.23.4.

### D-025 Cloudflare
- Pages Functions: "billed as Cloudflare Workers requests"; paket gratis 100.000 permintaan per hari bersama Workers, reset tengah malam UTC; aset statis gratis tanpa batas.
- Binding Rate Limiting: dokumen binding Pages Functions tidak mencantumkannya ("Pages Functions only support a subset of all bindings"). Dokumen Workers: periode 10 atau 60 detik, per lokasi, "eventually consistent".
- WAF rate limiting rules paket Free: 1 aturan, karakteristik IP, periode 10 detik, timeout 10 detik (butuh domain di Cloudflare).
- Syarat (Self-Serve Subscription Agreement, terakhir diperbarui 12 September 2025): layanan gratis bisa dihentikan kapan saja tanpa tanggung jawab (§2.6); dilarang mengumpulkan data kartu kredit di properti gratis (§2.2.1(h)); tidak ditemukan larangan khusus penggunaan komersial. Pemilik tetap perlu membaca syaratnya.
- Keputusan: relay memakai token bucket per isolate (upaya terbaik, keterbatasannya dicatat) dan memakai binding `RATE_LIMITER` bila suatu saat tersedia; aturan WAF gratis disarankan sebagai langkah pemilik.

### D-026 Toolchain
| Lingkungan | node | pnpm | Rust | Solana CLI | Anchor |
|---|---|---|---|---|---|
| VM di perangkat pemilik (tempat folder proyek dipasang) | 22.23.4 | tidak ada (corepack 0.36.0 ada) | tidak ada | tidak ada | tidak ada |
| Kontainer cloud sesi | 22.23.4 | 10.28.0 | rustc 1.97.0 | tidak ada | tidak ada |

- Keputusan: Tahap 2 hanya spesifikasi (`docs/STAGE2-REGISTRY-SPEC.md`). Tidak ada pemasangan otomatis.

### D-027 Memo kanonis
- Keputusan: byte memo harus sama persis dengan serialisasi kanonis hasil parse (urutan kunci tetap, tanpa spasi). Ini menutup variasi spasi, kunci ganda, dan urutan berbeda, dan membuat round-trip tepat. Karakter yang diizinkan tidak pernah butuh escape JSON.

### D-028 Bentuk transaksi yang diterima pembaca
- Tepat satu instruksi Memo `MemoSq4…` tingkat atas yang memuat memo `datum/0`; tepat satu transfer System tingkat atas 0 lamport dari fee payer ke fee payer dengan akun tambahan persis `[KLAIM-MINT(m), UMPAN]`; kedua akun tag harus kunci statis (bukan dari lookup table). Instruksi lain diizinkan (compute budget, penjaga dari wallet). Detail di SPEC §4.

### D-029 Nama dan domain
- "Datum" adalah nama kerja. Ketersediaan nama dan domain belum diperiksa (langkah pemilik).

### D-030 Arah visual: B Benchmark (dipilih pemilik)
- Mode terang saja untuk v0 (`color-scheme: light`). Token ada di satu berkas, `apps/web/src/styles/tokens.css`; warna mentah di luar berkas itu ditolak oleh `pnpm check:tokens`.
- Kontras teks diukur (WCAG 2.x): semua pasangan teks 4,5 : 1 atau lebih, termasuk di atas permukaan "Cured". Warna Cast dan Seam hanya dekorasi.

### D-031 Tempat membangun
- `pnpm` (10.28.0) dan Chromium tersedia di workspace cloud, jadi pemasangan, build, uji, dan screenshot dijalankan di sana. Berkas sumber disalin ke folder Datum di Mac lewat jembatan perangkat. `node_modules`, `.next`, dan `out` tidak disalin; pemilik menjalankan `pnpm install` dan `pnpm build` di Mac-nya.
- Tidak ada yang dipasang otomatis di Mac (aturan D-026).

### D-032 Next.js 16.4.6, dibaca dari `node_modules/next/dist/docs` sebelum menulis kode
- Static export (`output: "export"`) tidak mendukung `headers`, `redirects`, `rewrites`, `proxy`, Server Actions, dan route handler yang memakai Request. Header respons (CSP dan lain-lain) dan pengalihan karena itu ditulis di `public/_headers` dan `public/_redirects` untuk Cloudflare Pages pada tahap build.
- Halaman statis yang memakai `useSearchParams` wajib dibungkus `Suspense`, atau build gagal. Ini berlaku untuk `/t?m=<mint>`.
- `images.unoptimized: true` karena pemuat gambar bawaan tidak jalan di export statis. Situs tidak memakai gambar raster.
- Dokumen yang terpasang adalah sumber kebenaran; hasilnya sama dengan yang tertulis di prompt, tanpa selisih.

### D-033 Ruler dibuat dari HTML dan CSS
- Bukan SVG yang diskalakan, supaya teks tidak mengecil di 360 px. Garis tik diposisikan dengan persentase; label memakai posisi normal dan membungkus baris. Teks 12 px hanya dipakai untuk label tik.
- Bacaan layar: gambar disembunyikan (`aria-hidden`), satu kalimat penuh dibacakan lewat `role="img"` dan `aria-label`.

### D-034 Pemeriksaan otomatis
- `pnpm check:tokens`: warna mentah hanya di `tokens.css`. `pnpm copy:check`: kata terlarang (safe, verified, secure, trusted, audited, legit, rug-proof, guaranteed, score dan bentuk turunannya) di `src/` dan `public/`. Keduanya dijalankan di awal `pnpm build`.
- Audit axe-core 4.10.2 pada `/styleguide` di 360 dan 1440 px: 0 pelanggaran. Satu item "perlu ditinjau manual" untuk teks pada `textPath` di stempel; kontras ink di atas Cast diukur 5,6 : 1.
- Telemetri Next dimatikan (`next telemetry disable`).

### D-035 Kosakata UI sementara
- `src/lib/view.ts`, `predicates.ts`, dan `memo.ts` memuat cermin dari SPEC (status, relasi, kamus predikat, pembangun memo kanonis) hanya untuk review desain. Pada tahap build, pemilik tunggalnya menjadi `packages/protocol` dan berkas ini mengimpor dari sana. Tidak boleh ada dua sumber yang berbeda.

### D-036 Navigasi
- Header memuat semua halaman (Look up, Recent, Publish, Spec, Methodology, Risk and terms). Halaman yang belum dibangun mengembalikan 404 sampai tahap build.

### D-037 Lisensi huruf
- Chivo dan Chivo Mono (SIL OFL 1.1) di-host sendiri dari paket `@fontsource` 5.3.0, subset Latin. Teks lisensi ada di `apps/web/public/fonts/LICENSE-*.txt`.

### Relay /api/rpc
- **D-038.** Allowlist relay: `getAccountInfo`, `getMultipleAccounts`, `getSignaturesForAddress`, `getTransaction`, `getLatestBlockhash`, `getSignatureStatuses`, `getGenesisHash`, `simulateTransaction`, `sendTransaction`. `getGenesisHash` ditambahkan agar situs bisa memberi label cluster yang dibaca (SPEC: pembaca "SHOULD show which cluster"). Selain itu ditolak dengan 403, termasuk `getProgramAccounts`, `getTokenLargestAccounts` (D-008), `getBlockTime` (D-020).
- **D-039.** Permintaan: objek JSON-RPC tunggal, `zod.strict()`, params maks 3, badan maks 16 KB, batch ditolak (D-007). Kunci konfigurasi hanya dari daftar putih; `commitment` dan `preflightCommitment` harus `confirmed` atau `finalized` (riwayat butuh minimal `confirmed`, lihat tabel selisih); `encoding` hanya `base64` atau `json`; `accounts` pada simulasi ditolak; `maxSupportedTransactionVersion` harus 0. `getSignaturesForAddress`: `limit` dijepit ke 50 dan default 50. Daftar alamat maks 10.
- **D-040.** Origin wajib ada dan sama dengan host permintaan atau terdaftar di `ALLOWED_ORIGINS`. Pembatas laju per IP: token bucket per isolate (default 120 per menit, `RATE_LIMIT_PER_MINUTE`), dan binding `RATE_LIMITER` dipakai bila ada. Pembatas per isolate hanya upaya terbaik di Pages Functions; perlindungan sebenarnya adalah satu aturan WAF gratis milik pemilik (daftar langkah pemilik).
- **D-041.** Geoblok hanya untuk `simulateTransaction` dan `sendTransaction`, dari header `cf-ipcountry` dan `BLOCKED_COUNTRIES`. Pembacaan tetap terbuka. `GET /api/rpc` mengembalikan `{country, blocked}` tanpa menyentuh upstream. Negara tak diketahui tidak diblokir oleh relay; situs memperlakukan status tak diketahui sebagai tampilan-saja (pola `geo.ts` Afterbell).
- **D-042.** Upstream hanya dari `RPC_UPSTREAM_URL`. Tanpa itu relay menjawab 503; `https://api.devnet.solana.com` dipakai hanya bila `ALLOW_DEFAULT_UPSTREAM=1` (pengembangan lokal). Galat tidak pernah memuat URL upstream. Timeout 10 detik; 429 dipetakan ke galat laju; non-2xx menjadi 502.
- **D-043.** CSP di `public/_headers`: `script-src 'self' 'unsafe-inline'` karena ekspor statis Next menyisipkan skrip inline; tanpa hash per build. `connect-src 'self'` saja, jadi semua RPC lewat relay. Diperketat dengan hash bila nanti ada langkah build yang menghasilkannya.

### Transaksi klaim dan pembacaan cluster
- **D-044.** Hash genesis dibaca langsung dengan `getGenesisHash` dari tiga endpoint publik pada 2026-11-11 (mainnet `5eykt4Us…2N9d`, devnet `EtWTRABZ…rZBG`, testnet `4uhcVJyU…NsNY`; nilai lengkap di `apps/web/src/lib/cluster.ts`). Situs memakainya untuk label cluster dan identifier chain Wallet Standard (`solana:mainnet`, `solana:devnet`, `solana:testnet`, dari `@solana/wallet-standard-chains 1.1.2`). Cluster yang hash-nya tidak dikenal diberi label "Unknown cluster" dan penerbitan dinonaktifkan.
- **D-045.** Transaksi klaim memakai format **legacy** (tanpa tabel lookup; semua akun statis, sesuai SPEC bagian 4), dengan urutan: set batas CU, set harga CU, Memo, transfer 0 lamport dengan empat akun. Harga CU tetap 1.000 micro-lamport per CU di v0 (sekitar 160 lamport untuk 160.000 CU; keputusan keamanan-biaya: cukup kecil untuk tidak mengejutkan, cukup besar agar tidak berprioritas nol). Batas CU = pemakaian hasil simulasi + 15% (maksimum 1.400.000). Bukti langsung: simulasi `simulateTransaction` (tanpa tanda tangan, `sigVerify: false`, `replaceRecentBlockhash: true`, tanpa siaran) di mainnet menerima bentuk ini; memo 111 byte memakai 41.144 CU total dan memo 447 byte (8 predikat, label 48 byte) memakai 158.772 CU dengan ukuran transaksi 784 byte. Memo 512 byte tetap di bawah batas 1.232 byte.
- **D-046.** Setelah wallet menandatangani, aplikasi memeriksa byte yang kembali: fee payer sama, blockhash sama, sudah bertanda tangan, dan menjalankan `parseClaimTransaction` dari paket protokol pada byte itu; teks memo dan penerbit harus sama dengan yang ditampilkan. Instruksi tambahan dari wallet (misalnya penjaga) tidak ditolak tetapi dicantumkan dengan alamat programnya. Lalu simulasi ulang dengan `sigVerify: true`, baru kirim lewat relay. Pengiriman ulang byte yang sama menghasilkan tanda tangan yang sama sehingga tidak bisa menerbitkan dua kali. Status akhir dibaca dengan `getSignatureStatuses` (tanpa `getBlockHeight`, yang tidak ada di allowlist); bila belum terlihat, UI menawarkan "Check again" dan tidak mengirim ulang otomatis.

### Halaman, alur, dan kinerja (tahap akhir)
- **D-047.** Strip verdict di halaman token hanya menghitung klaim dari otoritas token ("3 of 4 claims by this token's authorities are true now" atau "No claims from this token's authorities yet"). Klaim dari dompet lain tidak ikut hitungan dan dilipat di bagian "From other wallets (N)" dengan peringatan bahwa siapa pun bisa menerbitkan klaim tentang token apa pun. Bila hanya ada klaim dari dompet lain, strip menyebut jumlahnya tetapi tidak menghitungnya. "On the chain now" selalu tampil (program token, suplai, decimals, otoritas, metadata mutable, ekstensi), juga saat klaim gagal dimuat.
- **D-048.** "Since your last visit": catatan hasil per pernyataan disimpan di localStorage per cluster dan mint (`datum.visit.v0.<cluster>.<mint>`), hanya di perangkat ini. Semua akses dibungkus try/catch (`lib/storage.ts`); tanpa penyimpanan atau dengan catatan rusak, bagian itu tidak tampil dan tidak ada galat. Catatan tidak disimpan bila ada transaksi yang tidak terbaca, supaya "New" tidak muncul palsu pada kunjungan berikutnya. Tidak ada riwayat "kapan pertama kali salah" (butuh indexer).
- **D-049.** Laci bukti memakai elemen `<dialog>` modal sebagai bottom sheet di layar sempit (`max-width: 40rem`) dan panel inline di layar lebar. Fokus masuk dan kembali ke pemicu, Esc menutup, latar tidak bisa di-scroll (bawaan dialog dan `html:has(dialog[open])`). Menu navigasi di HP memakai komponen `Sheet` yang sama. Laci memuat "How it is checked" (rumus dalam kata biasa dari `formulaOf`) dan Ruler untuk predikat numerik (`supply_max`, `t22_transfer_fee_max_bps`; geometri memakai Number, teks selalu bigint penuh).
- **D-050.** Publish dipecah menjadi tiga langkah dengan indikator (Token and statements, Wallet and check, Review and sign). Isian tidak hilang saat Back. Di langkah 2 setiap pernyataan dievaluasi dengan evaluator yang sama seperti halaman token ("Would be true now" / "Would not be true now" / "Cannot check right now"), dengan Ruler untuk angka. Saat tinjauan, token dibaca ulang supaya pemeriksaan "tidak benar sekarang" sama segarnya dengan biaya. Bila ada pernyataan yang tidak benar sekarang: peringatan keras, dan tombol tanda tangan butuh kotak centang terpisah "I understand this claim will show as Not true now." selain "public and cannot be withdrawn". Hubungan dompet terhubung dengan token ditampilkan sebelum tanda tangan. Bila token tidak terbaca, status "cannot_check" dan tidak ada kotak centang tambahan (tidak mengarang "salah").
- **D-051.** Pemberitahuan risiko satu kali sebelum klaim pertama: kunci `datum.risk.v0` ditulis hanya setelah klaim terkirim. Tanpa localStorage, pemberitahuan tampil setiap kali (pilihan paling hati-hati).
- **D-052.** Recent mengevaluasi tiap baris secara langsung: satu snapshot per token, tiga token sekaligus, urutan terbit (terbaru dulu), tanpa peringkat atau kata "trending". Baris menyebut slot pengukuran. Penggantian klaim tidak dihitung di Recent (butuh riwayat per mint); halaman menyuruh membuka token untuk daftar terkini.
- **D-053.** Home menampilkan satu klaim buatan berlabel EXAMPLE (`lib/example.ts`), berbingkai putus-putus, dengan keterangan bahwa ini bukan klaim tentang token nyata. Data statis, bukan hasil baca chain, supaya tidak pernah bisa dikira nyata.
- **D-054.** Halaman Spec dirender saat build dari `docs/SPEC.md` dan setiap blok kode punya tombol "Copy code" (peningkatan progresif; tanpa skrip blok tetap terbaca). Contoh pembaca minimal ada di SPEC bagian 15 (garis besar, bukan paket siap pakai). Halaman Terms diberi catatan "Draft, awaiting legal review." (belum ditinjau pengacara). Methodology menjelaskan komitmen `confirmed`, batas RPC gratis, jumlah memo cacat yang diabaikan, dan dasar bukti label Permanent.
- **D-055.** Tidak ada service worker di v0, jadi tidak ada rute /offline: keadaan tanpa jaringan ditangani di dalam halaman ("The network did not answer.", dengan "Try again"). Selisih dari daftar halaman di prompt (Bagian 4); dicatat sebagai keputusan sadar karena service worker menambah permukaan serangan dan cache yang bisa basi untuk data yang harus segar.
- **D-056.** Relay mengizinkan `getGenesisHash` (untuk label cluster dan chain wallet) tetapi tidak `getSlot` atau `getBlockHeight`; slot diambil dari `context.slot` jawaban RPC dan status akhir dari `getSignatureStatuses`. Selisih dari prompt, yang memperkirakan daftar metode lebih sempit.
- **D-057.** Tata letak tanpa pergeseran: `min-height` untuk halaman token dan publish, slot tetap untuk status dan catatan, fallback Suspense setinggi halaman; CSS disisipkan (`experimental.inlineCss`, tanpa permintaan CSS yang memblokir render); font utama di-preload; ikon aplikasi `icon.svg`. CLS 0 sampai 0,012 di semua halaman yang diukur.
- **D-058.** Hasil Lighthouse seluler (simulasi throttling bawaan, build produksi, server tiruan dengan kompresi gzip seperti Cloudflare Pages): Performance 91 sampai 96 (Home 95, Publish 91, Token 96), Accessibility 100, Best Practices 100, SEO 100, CLS 0. LCP simulasi 2,5 sampai 3,1 detik: Token memenuhi target 2,5 detik, Home dan Publish sedikit di atasnya (2,9 dan 3,1 detik). Tanpa kompresi server, skor turun ke 79 sampai 82, jadi kompresi dari host adalah bagian dari syarat. Muatan JS awal sekitar 500 KB tanpa kompresi (kerangka Next, React, dan `@datum/protocol`). Angka ini dari simulasi lokal, bukan dari jaringan nyata.
- **D-059.** Pengujian ujung ke ujung memakai server tiruan (`e2e/serve.ts`) yang menyajikan `out/` dan RPC tiruan dengan rantai benih (akun mint nyata dari fixture, klaim buatan). Hook `/__mock/clear` membangun ulang seluruh rantai sehingga setiap tes berdiri sendiri. Dompet diuji dengan dompet palsu Wallet Standard (mode ok, tolak, ubah memo). Tidak ada transaksi yang pernah disiarkan ke klaster publik oleh sesi ini; semua jalur kirim hanya terhadap tiruan, dan jalur baca langsung hanya `getAccountInfo`, `getMultipleAccounts`, `getGenesisHash`, dan `simulateTransaction` lewat browser pemilik.
- **D-060.** Tahap 2 hanya spesifikasi (`docs/STAGE2-REGISTRY-SPEC.md`) karena Rust, Solana CLI, dan Anchor tidak terpasang dan tidak dipasang otomatis. Temuan desain: bacaan "klaim dari otoritas token" bisa dilakukan dengan satu `getMultipleAccounts` atas PDA para otoritas, tanpa indexer dan kebal spam. Tidak ada ID program yang ditulis.
- **D-061.** Konteks Afterbell (opsional di prompt, "hanya bila sisa pekerjaan selesai") tidak dikerjakan: menyalin ringkasan editorial dari registri lain berarti memelihara data yang bukan milik Datum dan menambah label baru di halaman token. Dicatat sebagai belum dibuat.

---

## Selisih dokumentasi dan perilaku langsung

| Topik | Dokumentasi | Perilaku langsung (2026-11-10) | Yang dipakai |
|---|---|---|---|
| Program Memo bawaan | `@solana-program/memo 0.16.0`: Memo v4 `Memo4c2p…` bawaan, `MemoSq4…` "legacy" | Keduanya aktif; v4 bisa di-upgrade | `MemoSq4…` (D-001) |
| `getSignaturesForAddress` limit | Tidak disebut | Maks 1000 | Relay jepit 50 |
| `getSignaturesForAddress` commitment | Tidak disebut | Minimal `confirmed` | `confirmed` |
| Field `memo` | `string \| null` | `"[len] text"` | Saringan awal saja |
| `getTokenLargestAccounts` | Sampai 20 akun | Dimatikan atau dibatasi di RPC gratis | Keluar dari v0 |
| `jsonParsed` transfer | Tidak dijelaskan | Akun tambahan tidak terlihat | `encoding: "json"` |
| Enum ekstensi `@solana/spl-token 0.4.15` | Tanpa 16 dan 24 | PYUSD memakai 16 | Enum `@solana-program/token-2022` |
| `TransferHook.programId` | Layout pubkey | Nol berarti None | Normalisasi D-011 |
| Metaplex `isMutable` | "any future updates will fail" | Galat `IsMutableCanOnlyBeFlippedToFalse` ada | Tetap "Can change" (D-016) |
| Publicnode | Endpoint gratis | `[]` diam untuk riwayat | Dilarang (D-009) |
| `getSlot` untuk cap pengukuran | Metode standar | Tidak dipakai | Slot dari `context.slot` jawaban (D-056) |
| Layout `<dialog>` di layar sentuh | Modal bawaan | Berfungsi di Chromium; fokus kembali ke pemicu | Dipakai untuk sheet (D-049) |
| Lighthouse tanpa kompresi server | Skor kinerja | 79 sampai 82 tanpa gzip, 91 sampai 96 dengan gzip | Diuji dengan gzip seperti host (D-058) |

## Hal yang belum bisa diverifikasi di sesi ini
- Penyedia RPC berkunci tingkat gratis (butuh kunci pemilik).
- Jumlah byte yang disisipkan wallet tertentu saat menandatangani.
- Apakah akun metadata Metaplex fungible bisa ditutup dan dibuat ulang; apakah update authority bisa dipindah saat immutable.
- Siapa yang berwenang pada `confidentialMint` (Token-2022 `ConfidentialMintBurn`). Akibatnya `supply_max` menjadi "cannot_check" bila ekstensi itu ada.
- Syarat komersial Cloudflare secara rinci, nama, dan domain.

### Datum Live

- **D-062.** Benchmark tetap bertema terang sesuai token yang ada. Motion Reduced menampilkan bidang statis, Off menyembunyikannya. Preferensi sistem, Save-Data, dan tab tersembunyi menghentikan gerak. Pilihan UI disimpan dengan wrapper penyimpanan yang sudah ada.
- **D-063.** Watch opsional dilewati. Relay memakai default 120 permintaan per IP per menit, sedangkan pembacaan riwayat bisa memindai beberapa halaman. Pembacaan ulang Token dan Recent tetap dimulai pengguna.
- **D-064.** Pembacaan ulang Token mempertahankan bacaan yang sedang ditampilkan selama request berlangsung. Penanda perubahan hanya muncul untuk pernyataan yang sudah ditampilkan dan hasilnya berbeda. Cap konfirmasi Publish hanya mengikuti cabang transaksi terkonfirmasi yang sudah ada.
- **D-065.** Generator lokal menurunkan palet dari token yang sudah ada. Tanda alamat hanya berfungsi sebagai penanda visual; perbandingan identitas tetap memakai alamat lengkap. Teks Risk and terms tidak diubah.
- **D-066.** Playwright menolak memakai server yang sudah berjalan. Variabel `PORT` memungkinkan mock Datum memakai port kosong ketika port standar digunakan proyek lain.
- **D-067.** Recent menyediakan tempat untuk hasil, slot, dan relasi begitu memo tersedia. Teks pernyataan dapat diambil dari memo sebelum snapshot selesai; hasil tetap menunggu pembacaan. Bidang canvas menggunakan palet dekorasi tersendiri.
- **D-068.** `/styleguide` tetap memakai `noindex` dan rute yang tidak ada tetap menjawab HTTP 404. Kartu sosial mengambil origin publik dari `DATUM_SITE_URL` saat build.
- **D-069.** Tampilan "Editorial" mengubah tingkat kerajinan, bukan mesin efek. Situs acuan diperiksa langsung di browser: tidak memakai library animasi, canvas, atau pendengar scroll, hanya tujuh keyframe CSS. Kualitasnya datang dari arah seni tunggal, huruf display berkarakter, bab bernomor, ritme bagian gelap dan terang, tepi bagian yang tidak lurus, ticker, dan satu momen hero. Datum mengambil tingkat kerajinan itu dengan identitas Benchmark sendiri. Tema, nama, teks, dan aset acuan tidak ditiru.
- **D-070.** Permukaan malam (`.on-night`) mendefinisikan ulang token semantik (`--color-bg`, `--color-ink`, `--color-accent`, dan seterusnya) sehingga semua komponen yang sudah ada tampil benar di atasnya tanpa varian baru. Header, footer, hero, dan Reading 04 memakainya. Kontras diukur dan dicatat di `tokens.css`; semuanya di atas 7 : 1.
- **D-071.** Huruf display Big Shoulders Display (OFL, dua bobot, ±28 KB) dipakai untuk h1 dan h2 dalam huruf kapital. Alamat tidak pernah diubah menjadi kapital karena alamat Solana peka huruf besar-kecil; ada tes e2e untuk itu. Teks isi tetap Chivo.
- **D-072.** Hero adalah SVG yang digambar dengan kode: garis ukur masuk, cakram mengunci, lalu cap "Measured at slot N" muncul sekali, kurang dari 1,6 detik. Slot diambil dari `getLatestBlockhash` (konteks slot) karena `getSlot` tidak ada dalam allowlist relay. Jika pembacaan gagal, cap menampilkan tanda hubung, bukan angka karangan.
- **D-073.** Ticker dan empat angka di beranda berasal dari satu pembacaan (slot terakhir dan klaim terbaru) yang dimulai setelah halaman selesai dimuat dan idle. Saat tidak ada yang terbaca, ticker menampilkan satu baris tetap. Salinan kedua untuk perulangan disembunyikan dari pembaca layar dan tidak dapat difokuskan. Saat gerak tidak penuh, ticker menjadi baris biasa yang dapat digulir tangan. Angka keempat ("Statement kinds this version reads") bersifat tetap menurut versi, bukan hasil pembacaan.
- **D-074.** Tepi penggaris (`.ruler-edge`) dibuat dengan dua gradien CSS, bukan clip-path atau gambar, sehingga tidak menambah byte gambar dan tetap tajam di semua lebar. Pembacaan klaim memberi giliran ke halaman (`setTimeout 0`) di antara transaksi agar halaman klaim panjang tidak membekukan pengetikan.
- **D-075.** Hero berstatus hidup, bukan animasi sekali jalan. Satu siklus ukur 10 detik, dial 36 detik per putaran dengan penanda kuningan agar putarannya terbaca, dan kecondongan ke kursor. Semuanya CSS dan satu pendengar `pointermove` (mouse saja, satu bingkai per giliran) yang hanya bekerja saat gerak penuh. Kunci keyframe putar memakai `rotate(0deg)` ke `rotate(360deg)`; `rotate(1turn)` dari matriks identitas tidak bergerak karena interpolasi matriks. Lingkaran putar dibungkus grup terpisah dari grup paralaks agar animasi tidak menimpa translasi kursor. Slot dibaca ulang tiap 15 detik hanya saat halaman terlihat (`document.hidden` salah), memakai satu panggilan `getLatestBlockhash` yang ringan. Jika pembacaan klaim gagal, angka klaim ditampilkan sebagai tanda hubung, bukan nol.
- **D-076.** Halaman dalam (Risk and terms, Methodology, Spec, Recent, Publish, dan kepala halaman Token) memakai kepala malam bersama: `PageHero` dengan judul besar, kalimat pembuka, `PageDisc` yang berputar, dan tepi penggaris. Setiap halaman punya pusat cakram berbeda (salib, cincin ganda, tonggak, penunjuk, cincin terbelah) dan nomor "Sheet NN"; bentuk, bukan warna, yang membedakan. Halaman prosa mendapat daftar isi "On this page" yang dibangun dari h2 yang ada di artikel, sehingga tidak pernah memuat bagian yang tidak ada, dan nomor bagian besar dari penghitung CSS. Dokumen yang menomori bagiannya sendiri (Spec: "1. What a claim is") memakai nomornya sendiri dan tidak diberi nomor CSS kedua. Satu h1 per halaman tetap terjaga; h1 Spec diambil dari judul pertama dokumen `docs/SPEC.md` dan dihapus dari badan.
