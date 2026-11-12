// ===================== KONTEN DOKUMEN LEGAL INDIIGOO =====================
// Client-safe: modul data murni (tanpa impor server). Dipakai oleh
// LegalDocsDialog pada halaman Masuk/Daftar.
// Ketentuan panjang: Syarat & Ketentuan dan Kebijakan Privasi masing-masing
// minimal 2.500 karakter sesuai kebutuhan pendaftaran akun.

export type LegalDocId = "terms" | "privacy" | "help";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const TERMS: LegalDoc = {
  id: "terms",
  title: "Syarat & Ketentuan",
  updated: "1 Januari 2025",
  intro:
    "Selamat datang di IndiGoo — aplikasi komunikasi dan pengelolaan bisnis untuk UMKM Indonesia. Dengan mendaftar, mengakses, atau menggunakan IndiGoo dalam bentuk apa pun, Anda menyatakan telah membaca, memahami, dan menyetujui untuk terikat pada Syarat & Ketentuan ini beserta Kebijakan Privasi kami. Apabila Anda tidak menyetujui satu pun bagian dari ketentuan ini, Anda tidak diperkenankan mendaftar atau menggunakan layanan kami. Kami menyarankan Anda membaca dokumen ini dengan saksama sebelum menekan tombol Daftar, karena ketentuan di dalamnya mengatur seluruh hak dan kewajiban Anda sebagai Pengguna IndiGoo.",
  sections: [
    {
      heading: "1. Definisi",
      paragraphs: [
        "Dalam Syarat & Ketentuan ini, istilah berikut memiliki arti sebagaimana dijelaskan di bawah ini.",
      ],
      bullets: [
        "\u201cIndiGoo\u201d berarti aplikasi dan layanan komunikasi bisnis bergaya pesan instan yang menyediakan fitur chat, status, panggilan, katalog produk, marketplace, siaran, channel, komunitas, serta statistik untuk pelaku usaha mikro, kecil, dan menengah.",
        "\u201cPengguna\u201d atau \u201cAnda\u201d berarti setiap orang yang mendaftar dan memiliki Akun aktif di IndiGoo, termasuk pemilik usaha, staf, dan pengguna umum.",
        "\u201cID Akses\u201d berarti nomor akun unik berformat ID-xxxxxx yang dibuat otomatis oleh sistem pada saat pendaftaran dan dapat digunakan sebagai identitas masuk selain username.",
        "\u201cAkun\u201d berarti rekaman data pendaftaran Anda yang terdiri atas ID Akses, username, PIN, password, dan pengaturan profil yang terkait.",
        "\u201cKonten\u201d berarti segala materi yang dikirim, diunggah, atau ditampilkan melalui IndiGoo, termasuk teks, foto, video, dokumen, lokasi, produk, dan informasi profil bisnis.",
      ],
    },
    {
      heading: "2. Akun Pengguna, ID Akses, dan Keamanan",
      paragraphs: [
        "Pada saat pendaftaran, sistem IndiGoo membuatkan ID Akses secara otomatis. Nomor ini bersifat unik, permanen, dan tidak dapat Anda pilih sendiri, sehingga dapat digunakan untuk masuk kapan pun tanpa bergantung pada username. Anda dianjurkan mencatat ID Akses Anda pada tempat yang aman.",
        "Anda bertanggung jawab penuh atas segala aktivitas yang terjadi pada Akun Anda. Jagalah kerahasiaan username, PIN 6 angka, dan password Anda; jangan pernah membagikannya kepada siapa pun, termasuk orang yang mengaku sebagai petugas IndiGoo. Kami tidak pernah meminta PIN atau password Anda melalui pesan, telepon, maupun surel.",
        "Segera laporkan kepada kami bila Anda menduga Akun Anda digunakan tanpa izin, atau bila perangkat yang masuk ke Akun Anda bukan milik Anda. Sejauh diizinkan oleh hukum yang berlaku, kami tidak bertanggung jawab atas kehilangan atau kerugian yang timbul akibat kelalaian Anda menjaga kerahasiaan kredensial Akun.",
        "Satu orang hanya diperkenankan memiliki satu Akun pribadi. Membuat Akun ganda dengan identitas palsu, nama orang lain, atau untuk tujuan menyesatkan merupakan pelanggaran berat terhadap ketentuan ini.",
      ],
    },
    {
      heading: "3. Ketentuan Penggunaan Layanan",
      paragraphs: [
        "Dalam menggunakan IndiGoo, Anda setuju untuk tidak melakukan hal-hal berikut:",
      ],
      bullets: [
        "Mengirim, mengunggah, atau menyebarkan konten yang melanggar hukum Republik Indonesia, menyinggung SARA, mengandung kebencian, kekerasan, pornografi, perjudian, atau penipuan.",
        "Mengirim pesan massal yang tidak diminta (spam), melakukan komunikasi beruntun yang mengganggu, atau memakai fitur siaran untuk menekan pihak lain.",
        "Menyalahgunakan fitur marketplace untuk menjual barang atau jasa yang dilarang, termasuk barang bajakan, obat tanpa izin edar, senjata, satwa dilindungi, dan jasa ilegal.",
        "Mengakses Akun milik orang lain tanpa izin, merekayasa sosial, atau mengumpulkan data Pengguna lain tanpa persetujuannya.",
        "Mengganggu, membebani, atau merusak infrastruktur layanan, termasuk upaya scraping otomatis, pengujian keamanan tanpa izin tertulis, dan penyebaran kode berbahaya.",
        "Menyalahgunakan nama, logo, atau identitas IndiGoo untuk kepentingan komersial tanpa persetujuan tertulis dari kami.",
      ],
    },
    {
      heading: "4. Konten Pengguna",
      paragraphs: [
        "Anda memegang hak kepemilikan atas Konten yang Anda buat dan kirim melalui IndiGoo. Dengan mengunggah Konten, Anda memberikan kepada kami lisensi terbatas, non-eksklusif, dan dapat dicabut untuk menyimpan, menampilkan, serta mengedarkan Konten tersebut di dalam lingkup layanan IndiGoo semata-mata untuk mengoperasikan fitur yang Anda gunakan.",
        "Anda menjamin bahwa Konten Anda tidak melanggar hukum dan tidak melanggar hak pihak ketiga, termasuk hak cipta, merek, dan privasi. Kami berhak meninjau, membatasi, atau menghapus Konten yang dilaporkan atau terindikasi melanggar ketentuan ini, tanpa mengurangi hak Anda untuk menyampaikan keberatan melalui kanal dukungan.",
      ],
    },
    {
      heading: "5. Transaksi, Marketplace, dan Fitur Bisnis",
      paragraphs: [
        "IndiGoo menyediakan sarana komunikasi, katalog, dan marketplace agar pelaku UMKM dapat memperkenalkan produk dan melayani pelanggannya. Segala penawaran, pemesanan, pembayaran, dan pengiriman yang terjadi melalui atau setelah komunikasi di IndiGoo adalah kesepakatan langsung antara penjual dan pembeli; kami bukan pihak dalam transaksi tersebut dan tidak menampung dana pembayaran Anda.",
        "Penjual bertanggung jawab atas kebenaran deskripsi produk, harga, stok, keaslian, serta pemenuhan pesanan. Pembeli bertanggung jawab memeriksa informasi produk sebelum memutuskan pembelian. Apabila terjadi sengketa, kami mendorong kedua belah pihak menyelesaikannya secara musyawarah; berdasarkan permintaan yang wajar, kami dapat membantu menyediakan salinan komunikasi yang tersedia pada sistem.",
      ],
    },
    {
      heading: "6. Ketersediaan dan Perubahan Layanan",
      paragraphs: [
        "IndiGoo disediakan sebagaimana adanya dan sebagaimana tersedia. Kami berupaya menjaga layanan tetap berjalan 24 jam setiap hari, namun kami tidak menjamin layanan bebas dari gangguan, jeda pemeliharaan, atau kegagalan fungsi. Fitur tertentu dapat ditambahkan, diubah, atau dihentikan sewaktu-waktu untuk perbaikan, penyesuaian teknis, atau alasan bisnis lainnya.",
        "Untuk lingkungan uji coba atau demo, sebagian data yang tampil dapat berupa data contoh dan tidak mencerminkan transaksi sungguhan. Kami tidak menjamin keakuratan data pihak ketiga yang ditampilkan dalam aplikasi, seperti lokasi, rating, atau harga produk marketplace.",
      ],
    },
    {
      heading: "7. Suspensi dan Penghentian Akun",
      paragraphs: [
        "Kami dapat memberikan peringatan, membatasi fitur, menonaktifkan sementara, atau menghentikan Akun Anda apabila kami berdasarkan laporan atau temuan sendiri yakin bahwa Anda melanggar Syarat & Ketentuan ini, menyalahgunakan layanan, atau membahayakan Pengguna lain. Tindakan disertai pemberitahuan melalui kanal yang tersedia, kecuali pemberitahuan dilarang oleh hukum atau membahayakan penyelidikan.",
        "Anda dapat berhenti menggunakan IndiGoo kapan pun dengan menghapus Akun atau meminta penghapusan melalui kanal dukungan. Setelah Akun dihapus, data pribadi Anda akan diperlakukan sesuai Kebijakan Privasi, termasuk masa retensi tertentu untuk keperluan keamanan dan kewajiban hukum.",
      ],
    },
    {
      heading: "8. Batasan Tanggung Jawab",
      paragraphs: [
        "Sejauh diizinkan oleh hukum yang berlaku, IndiGoo tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, kehilangan data, atau kerugian konsekuensial lain yang timbul dari penggunaan atau ketidakmungkinan menggunakan layanan, meskipun kami telah diberi tahu akan kemungkinan kerugian tersebut. Total tanggung jawab kami kepada Anda dalam keadaan apa pun dibatasi maksimum sebesar biaya yang Anda bayarkan kepada kami dalam 12 (dua belas) bulan terakhir, atau USD 10 (sepuluh dolar Amerika) bila Anda tidak pernah melakukan pembayaran.",
      ],
    },
    {
      heading: "9. Perubahan Syarat & Ketentuan",
      paragraphs: [
        "Kami dapat memperbarui Syarat & Ketentuan ini dari waktu ke waktu seiring perkembangan layanan dan peraturan yang berlaku. Versi terbaru selalu tersedia pada aplikasi beserta tanggal pembaruannya. Apabila perubahan bersifat material, kami akan berupaya memberitahukan Anda melalui pesan dalam aplikasi atau kanal resmi lainnya.",
        "Penggunaan IndiGoo secara berkelanjutan setelah perubahan berlaku dianggap sebagai persetujuan Anda terhadap ketentuan yang diperbarui. Bila Anda tidak menyetujui perubahan tersebut, Anda dapat berhenti menggunakan layanan dan menghapus Akun Anda.",
      ],
    },
    {
      heading: "10. Hukum yang Berlaku dan Penyelesaian Sengketa",
      paragraphs: [
        "Syarat & Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Republik Indonesia. Setiap perselisihan yang timbul akan diupayakan penyelesaiannya terlebih dahulu secara musyawarah untuk mufakat dalam waktu 30 (tiga puluh) hari kalender. Bila musyawarah tidak mencapai kesepakatan, para pihak sepakat menyelesaikannya melalui pengadilan yang berwenang di wilayah Hukum Yogyakarta.",
      ],
    },
    {
      heading: "11. Kontak",
      paragraphs: [
        "Pertanyaan mengenai Syarat & Ketentuan ini dapat disampaikan melalui halaman Bantuan pada aplikasi, atau menghubungi tim kami pada jam layanan kerja hari Senin sampai Jumat pukul 08.00–17.00 WIB. Informasi kontak terbaru selalu tersedia di menu Bantuan IndiGoo.",
      ],
    },
  ],
};

const PRIVACY: LegalDoc = {
  id: "privacy",
  title: "Kebijakan Privasi",
  updated: "1 Januari 2025",
  intro:
    "Privasi Anda adalah kepercayaan yang kami jaga. Kebijakan Privasi ini menjelaskan data apa yang kami kumpulkan saat Anda mendaftar dan menggunakan IndiGoo, alasan kami mengumpulkannya, cara kami menggunakan, menyimpan, dan melindunginya, serta hak-hak yang Anda miliki atas data pribadi Anda. Kebijakan ini disusun mengacu pada prinsip perlindungan data pribadi berdasarkan peraturan perundang-undangan Republik Indonesia. Dengan mendaftar dan menggunakan IndiGoo, Anda menyatakan telah membaca dan menyetujui praktik yang dijelaskan di bawah ini.",
  sections: [
    {
      heading: "1. Data yang Kami Kumpulkan",
      paragraphs: ["Kami mengumpulkan data secukupnya agar layanan berfungsi dengan baik:"],
      bullets: [
        "Data pendaftaran: ID Akses yang dibuat otomatis, username, dan nama tampilan pada Akun Anda.",
        "Data keamanan: PIN 6 angka dan password, yang selalu disimpan dalam bentuk hash satu arah (scrypt dengan salt unik) — kami tidak pernah menyimpannya sebagai teks asli dan tidak dapat membacanya kembali.",
        "Data profil (bila Anda mengisinya): nama usaha, deskripsi, kategori, alamat, nomor telepon, surel, situs, media sosial, jam operasional, dan logo bisnis.",
        "Data konten dan aktivitas: pesan chat, status, panggilan, unggahan katalog/marketplace, siaran, serta statistik interaksi seperti pesan terkirim dan dibaca.",
        "Data teknis: jenis perangkat dan peramban, serta catatan waktu akses yang diperlukan untuk keamanan dan pemecahan masalah.",
      ],
    },
    {
      heading: "2. Cara Kami Menggunakan Data",
      paragraphs: ["Data Anda kami gunakan untuk keperluan berikut:"],
      bullets: [
        "Menyediakan, mengoperasikan, dan memelihara seluruh fitur IndiGoo — chat, status, panggilan, katalog, marketplace, siaran, channel, komunitas, dan statistik.",
        "Mengautentikasi sesi masuk Anda, termasuk verifikasi kredensial dan pemulihan akses.",
        "Menjaga keamanan layanan: mencegah, mendeteksi, dan menindak penyalahgunaan, spam, penipuan, serta aktivitas melanggar hukum.",
        "Meningkatkan kualitas layanan berdasarkan pola penggunaan secara agregat yang tidak mengidentifikasi pribadi Anda.",
        "Menyediakan dukungan pelanggan dan menanggapi keluhan serta pertanyaan Anda.",
      ],
    },
    {
      heading: "3. Yang Tidak Pernah Kami Lakukan",
      paragraphs: [
        "Kami tidak menjual data pribadi Anda. Kami tidak membagikan data pribadi Anda kepada pengiklan untuk kepentingan iklan perilaku. Kami tidak membaca, memindai, atau menganalisis isi percakapan pribadi Anda untuk tujuan periklanan, dan tidak menampilkan iklan pihak ketiga di dalam ruang percakapan Anda.",
      ],
    },
    {
      heading: "4. Penyimpanan dan Keamanan Data",
      paragraphs: [
        "Kami menerapkan langkah pengamanan teknis dan organisasi yang wajar sesuai standar industri. PIN dan password disimpan sebagai hash scrypt dengan salt unik per pengguna sehingga tidak dapat dibaca bahkan oleh kami. Sesi masuk dilindungi token bertanda tangan digital (HMAC-SHA256) yang disimpan pada cookie httpOnly dan cadangan token di penyimpanan lokal peramban.",
        "Data disimpan pada basis data yang aksesnya dibatasi hanya untuk keperluan operasional. Meskipun demikian, tidak ada sistem yang sepenuhnya bebas risiko; karena itu kami menyarankan Anda memilih PIN yang berbeda dari password, tidak memakai kombinasi yang mudah ditebak, dan segera melapor bila menduga Akun Anda disusupi.",
      ],
    },
    {
      heading: "5. Cookie dan Penyimpanan Lokal",
      paragraphs: [
        "IndiGoo menggunakan cookie sesi untuk menjaga Anda tetap masuk, serta penyimpanan lokal peramban untuk menyimpan token sesi cadangan dan preferensi tampilan Anda seperti Mode Gelap, Mode Hemat, dan bahasa tujuan terjemahan. Data preferensi ini hanya tersimpan di perangkat Anda dan tidak dikirim ke server kami. Anda dapat menghapusnya kapan pun melalui pengaturan peramban, dengan konsekuensi sesi dan preferensi akan diatur ulang.",
      ],
    },
    {
      heading: "6. Berbagi Data dengan Pihak Ketiga",
      paragraphs: [
        "Kami hanya membagikan data dalam kondisi terbatas berikut: atas persetujuan Anda; bila diwajibkan oleh hukum, perintah pengadilan, atau instansi berwenang; serta kepada penyedia infrastruktur (misalnya layanan hosting) yang bekerja untuk kami dan terikat kewajiban menjaga kerahasiaan serta keamanan data. Kami tidak mengizinkan pihak ketiga menggunakan data Anda untuk tujuan mereka sendiri.",
      ],
    },
    {
      heading: "7. Hak Anda sebagai Pengguna",
      paragraphs: ["Sesuai peraturan yang berlaku, Anda berhak untuk:"],
      bullets: [
        "Mengakses dan meminta salinan data pribadi Anda yang kami simpan.",
        "Meminta perbaikan atas data yang tidak akurat atau tidak lengkap.",
        "Meminta penghapusan data pribadi Anda, sepanjang tidak bertentangan dengan kewajiban hukum kami.",
        "Menarik persetujuan atas pemrosesan tertentu kapan pun, dengan ketentuan tidak memengaruhi pemrosesan yang telah dilakukan sebelumnya.",
        "Menyampaikan keberatan atau komplain mengenai pemrosesan data Anda melalui kanal dukungan kami.",
      ],
    },
    {
      heading: "8. Retensi dan Penghapusan Data",
      paragraphs: [
        "Kami menyimpan data pribadi Anda selama Akun Anda aktif atau selama diperlukan untuk menyediakan layanan. Setelah Anda menghapus Akun, data akan dihapus atau dianonimkan dalam waktu yang wajar, kecuali data tertentu wajib dipertahankan lebih lama berdasarkan hukum atau untuk kepentingan pembelaan hukum yang sah, dengan tetap menerapkan pembatasan akses.",
      ],
    },
    {
      heading: "9. Privasi Anak",
      paragraphs: [
        "IndiGoo tidak ditujukan bagi anak di bawah usia 13 (tiga belas) tahun. Pengguna di bawah 18 (delapan belas) tahun wajib memperoleh persetujuan orang tua atau wali sebelum mendaftar. Apabila kami mengetahui adanya Akun yang dibuat oleh anak di bawah 13 tahun tanpa persetujuan wali yang sah, kami akan menonaktifkan Akun tersebut dan menghapus data terkait sesegera mungkin.",
      ],
    },
    {
      heading: "10. Perubahan Kebijakan Privasi",
      paragraphs: [
        "Kebijakan Privasi ini dapat kami perbarui dari waktu ke waktu. Tanggal pembaruan terakhir selalu tercantum pada bagian atas dokumen ini. Untuk perubahan yang bersifat material, kami akan memberitahukan Anda melalui aplikasi atau kanal resmi IndiGoo sebelum perubahan berlaku. Penggunaan layanan berkelanjutan setelah tanggal berlaku dianggap sebagai persetujuan atas kebijakan yang diperbarui.",
      ],
    },
    {
      heading: "11. Kontak Perlindungan Data",
      paragraphs: [
        "Untuk pertanyaan, permintaan, atau keluhan seputar privasi dan data pribadi Anda, hubungi kami melalui halaman Bantuan pada aplikasi pada hari kerja Senin–Jumat pukul 08.00–17.00 WIB. Kami berupaya menanggapi setiap permintaan dalam waktu paling lambat 14 (empat belas) hari kalender sejak permintaan lengkap diterima.",
      ],
    },
  ],
};

const HELP: LegalDoc = {
  id: "help",
  title: "Bantuan",
  updated: "Selalu tersedia",
  intro:
    "Pusat Bantuan IndiGoo merangkum cara memulai, jawaban atas pertanyaan yang paling sering diajukan, serta kanal untuk menghubungi tim dukungan. Bila jawaban yang Anda cari tidak ada di halaman ini, jangan ragu menghubungi kami — tim kami siap membantu pada jam kerja.",
  sections: [
    {
      heading: "Cara Mendaftar Akun Baru",
      paragraphs: [
        "Buka halaman masuk IndiGoo, lalu ketuk tombol Daftar di bagian bawah kartu masuk. ID Akses berformat ID-xxxxxx dibuat otomatis oleh sistem — Anda tidak perlu mengisinya dan dapat menekan ikon muat ulang untuk membuat nomor baru. Selanjutnya isi username pilihan Anda (3–24 karakter huruf kecil, angka, titik, atau garis bawah), PIN berupa 6 angka, dan password minimal 6 karakter. Centang persetujuan pada Syarat & Ketentuan dan Kebijakan Privasi, lalu tekan Daftar. Akun Anda langsung aktif dan otomatis masuk ke aplikasi dengan peran Pengguna.",
      ],
    },
    {
      heading: "Apa itu ID Akses dan untuk apa digunakan?",
      paragraphs: [
        "ID Akses adalah nomor akun unik milik Anda yang dibuat otomatis saat pendaftaran. Nomor ini bersifat permanen dan dapat dipakai untuk masuk sebagai pengganti username, misalnya saat Anda lupa username. Kami menyarankan mencatatnya di tempat aman setelah pendaftaran selesai.",
      ],
    },
    {
      heading: "Apa bedanya PIN dan password?",
      paragraphs: [
        "Password adalah kredensial utama untuk masuk dari peramban mana pun, sedangkan PIN 6 angka dimaksudkan untuk masuk cepat di perangkat pribadi. Keduanya disimpan dalam bentuk hash terenkripsi satu arah. Untuk keamanan, gunakan PIN yang berbeda dari password Anda dan hindari kombinasi berurutan seperti 123456 atau tanggal lahir.",
      ],
    },
    {
      heading: "Lupa password atau PIN, bagaimana?",
      paragraphs: [
        "Saat ini pemulihan akun pada lingkungan demo dilakukan melalui Super Admin atau tim dukungan kami. Siapkan ID Akses Anda agar proses verifikasi lebih cepat. Setelah identitas terkonfirmasi, kredensial baru akan dibuat untuk akun Anda dan Anda dapat menggantinya kembali dari pengaturan.",
      ],
    },
    {
      heading: "Mengapa muncul \u201cUsername sudah dipakai\u201d?",
      paragraphs: [
        "Username di IndiGoo bersifat unik untuk setiap akun. Bila username yang Anda pilih sudah terdaftar, coba variasikan dengan menambahkan angka atau titik, misalnya dari \u201cbudi\u201d menjadi \u201cbudi.santoso\u201d atau \u201cbudi88\u201d. Pastikan juga username terdiri atas 3–24 karakter huruf kecil, angka, titik, atau garis bawah tanpa spasi.",
      ],
    },
    {
      heading: "Akun saya dinonaktifkan, apa yang terjadi?",
      paragraphs: [
        "Akun yang dinonaktifkan tidak dapat masuk sementara data di dalamnya tetap aman. Pemberitahuan alasan dikirim melalui kanal yang tersedia. Bila Anda yakin penonaktifan ini keliru, ajukan sanggahan melalui tim dukungan dengan menyertakan ID Akses dan penjelasan singkat; kami akan meninjaunya kembali sesuai Syarat & Ketentuan.",
      ],
    },
    {
      heading: "Tips menjaga keamanan akun",
      paragraphs: ["Langkah sederhana berikut melindungi akun Anda:"],
      bullets: [
        "Gunakan PIN dan password yang berbeda, dan jangan bagikan keduanya kepada siapa pun.",
        "Selalu keluar dari akun saat memakai perangkat orang lain atau komputer publik.",
        "Waspada pesan yang meminta PIN/password — petugas IndiGoo tidak pernah memintanya.",
        "Perbarui aplikasi peramban Anda agar mendapat perbaikan keamanan terbaru.",
      ],
    },
    {
      heading: "Hubungi Dukungan",
      paragraphs: [
        "Tim dukungan IndiGoo siap membantu pada hari Senin–Jumat pukul 08.00–17.00 WIB melalui kanal kontak yang tercantum pada profil bisnis di aplikasi. Sertakan ID Akses, perkiraan waktu kejadian, dan tangkapan layar bila ada, agar kami dapat membantu lebih cepat. Rata-rata tanggapan pertama kami kurang dari satu hari kerja.",
      ],
    },
  ],
};

/** Peta dokumen legal — urutan tampil mengikuti kunci. */
export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  help: HELP,
};
