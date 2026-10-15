# SINYAL — Personal News Reader

Aplikasi pembaca headline yang responsif, siap deploy di **Vercel**, dengan pembelajaran preferensi sederhana berdasarkan rating **1–5**. Bahasa antarmuka Indonesia.

## Apa yang sudah ada?

- Headline dan tautan artikel dari Google News RSS, diperbarui saat halaman dimuat / tekan **Perbarui**. Permintaan sumber di-cache ±15 menit untuk mengurangi beban.
- Topik yang dapat diaktifkan, diurutkan dengan tombol naik/turun, diberikan bobot prioritas 0–5, dan ditambahkan sendiri lewat kata kunci.
- Tampilan kartu/daftar, 2/3 kolom di laptop, tema terang/gelap, cari judul, filter topik, urutkan kecocokan/terbaru.
- Rating bintang 1–5, bookmark, skor kecocokan berdasarkan topik, penerbit, kata-kata pada judul, bobot manual, dan kesegaran.
- Berjalan tanpa database menggunakan penyimpanan browser (localStorage).
- **Opsional tetapi direkomendasikan:** Supabase Auth + Postgres dengan Row Level Security (RLS), sehingga preferensi/rating/bookmark tersinkron antarlaptop dan ponsel.
- PWA manifest & ikon untuk **Add to Home Screen**. Dibutuhkan HTTPS (Vercel otomatis). Ini aplikasi web yang bisa ditambahkan ke home screen, bukan aplikasi native App Store/Play Store.

> Skor kecocokan 1–99 bukan probabilitas statistik atau model AI eksternal; angka ini indikator ranking heuristik yang berkembang setelah Anda memberi rating. Penilaian tersimpan akan mengubah posisi artikel berikutnya. Google News RSS bisa sesekali tidak dapat diakses, membatasi frekuensi, atau mengubah format. Sumber artikel dapat menampilkan tautan agregator Google News.

## 1. Jalankan di laptop (opsional)

Pastikan Node.js 20.9+ atau Node 22+.

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## 2. Simpan kode ke GitHub

1. Buat repository **private** baru di GitHub dengan nama `sinyal-berita`.
2. Unggah isi folder ini ke repository tersebut (GitHub → Add file → Upload files), **bukan** file ZIP secara utuh. File `app/`, `lib/`, `public/`, `supabase/`, `package.json`, dan lainnya harus berada di root repository.
3. Alternatif terminal:

```bash
git init
git add .
git commit -m "Initial Sinyal reader"
git branch -M main
git remote add origin https://github.com/USERNAME/sinyal-berita.git
git push -u origin main
```

## 3. Deploy ke Vercel

1. Buka https://vercel.com/new (pastikan akun Vercel yang terhubung ke GitHub sudah dipilih).
2. **Import Git Repository** → pilih `sinyal-berita`.
3. Framework preset akan mendeteksi **Next.js**. Root Directory: `./`.
4. Tekan **Deploy**. Tanpa environment variable pun, aplikasi berjalan dalam **Mode lokal**.
5. Buka URL berakhiran `.vercel.app` di laptop/ponsel.

Catatan: karena **Mode lokal** memakai localStorage browser, rating dan pengaturan pada laptop **tidak otomatis sama** dengan pada ponsel. Ikuti langkah Supabase untuk sinkronisasi.

## 4. Sinkronisasi preferensi dengan Supabase (direkomendasikan)

1. Buat project baru di https://supabase.com/dashboard.
2. Masuk **SQL Editor** → paste semua SQL dari [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Ini membuat tabel `reader_settings`, `reader_interactions`, dan kebijakan RLS sehingga pengguna hanya dapat membaca/mengubah datanya sendiri.
3. Ambil **Project URL** dan **anon/public key** dari Supabase Project Settings → API Keys / Connect. Gunakan hanya **publishable/anon key**, **jangan** service_role/secret key.
4. Di Vercel → proyek Sinyal → Settings → Environment Variables, tambahkan:

```
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

5. **Redeploy** dari tab Deployments → menu titik tiga pada deployment terbaru → Redeploy, karena environment variables Next.js `NEXT_PUBLIC_...` disematkan pada build.
6. Di Supabase → **Authentication → URL Configuration**: set Site URL ke `https://NAMA-PROYEK.vercel.app`, lalu tambahkan URL yang sama ke **Redirect URLs** (jika perlu, tambahkan `https://NAMA-PROYEK.vercel.app/**`).
7. Di Supabase → Authentication → Providers, pastikan **Email** aktif; siapkan pengiriman email Auth yang dapat mencapai inbox Anda. Anda bisa memakai magic link bawaan Supabase.
8. Pada aplikasi Sinyal, klik **Sinkronkan perangkat** → ketik email → klik tautan login yang diterima melalui email. Login dengan email **yang sama** pada laptop dan ponsel.

**Penting:** Supabase project harus tetap aktif. Pada paket gratis, pembatasan atau penangguhan project yang tidak aktif bisa berlaku. Lihat detail paket terkini di situs resmi.

## 5. Tambahkan ikon aplikasi ke ponsel

- iPhone Safari: Share → **Add to Home Screen**.
- Android Chrome: menu ⋮ → **Add to Home screen** atau **Install app** (jika ditawarkan).

## 6. Bagaimana aplikasi mempelajari minat?

Contoh: Anda sering memberi 5 bintang pada berita tentang AI dan penerbit tertentu, serta 1 bintang pada berita topik yang tidak diminati.

Skor untuk headline baru adalah kombinasi:

- Prioritas topik manual (slider 0–5).
- Preferensi topik berdasarkan rating sebelumnya.
- Preferensi sumber berita berdasarkan rating sebelumnya.
- Kecocokan kata-kata penting dalam judul dengan headline yang pernah dinilai.
- Usia headline (berita baru mendapatkan sedikit dorongan).

Semakin banyak rating, semakin terlihat dampak preferensi. Pada awal penggunaan, model hanya mengandalkan bobot topik manual dan kebaruan. Skor tidak dilatih oleh model AI eksternal atau layanan berbayar.

## Catatan teknis & batasan

- Aplikasi ini versi MVP dengan RSS pencarian. Tidak mengunduh isi penuh artikel, tidak melakukan scraping ilegal/paywall bypass.
- Maksimal 12 topik tersimpan dan 12 topik aktif diambil pada setiap permintaan. Feed dibatasi total hingga 130 headline. Ubah batas jika diperlukan.
- Pencarian dilakukan atas headline yang sudah diambil (bukan mesin pencari internet bebas).
- Secara default berita dimuat saat aplikasi dibuka atau tombol refresh ditekan; tidak ada job background harian karena ini belum diperlukan untuk pengalaman membaca setiap pagi. Kalau ingin pengiriman push/email terjadwal, itu pengembangan lanjutan.
- RSS Google News bukan API ber-SLA, sehingga terkadang respons lambat/kosong. Anda dapat mengganti `app/api/news/route.ts` jika ingin mengintegrasikan NewsAPI/GNews/Feedly dan lain-lain.
- Keamanan: tanpa Supabase, data hanya disimpan di browser tersebut. Dengan Supabase, setiap akun hanya memiliki akses ke baris miliknya lewat RLS. Jangan pernah menaruh database service role key pada variabel `NEXT_PUBLIC_...`.

## File penting

```
app/page.tsx            UI + settings + auth + penyimpanan
app/globals.css         desain responsif
app/api/news/route.ts   pengambil RSS server-side
lib/relevance.ts        algoritma kecocokan
lib/settings.ts         topik & opsi default
supabase/schema.sql     tabel dan kebijakan akses
```
