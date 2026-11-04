import type { ReligionKey } from "./constants";

export type RoutineTemplate = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: "ibadah" | "kesehatan" | "produktivitas" | "keluarga" | "sosial";
  religion: ReligionKey;
  points: number;
};

/** Rutinitas dasar untuk seluruh umat (berlaku lintas agama). */
export const UNIVERSAL_ROUTINES: RoutineTemplate[] = [
  {
    title: "Bangun & Niat Hari Baru",
    description: "Bangun pukul 03.30 WIB, rapikan tempat tidur, dan tetapkan niat hari ini.",
    startTime: "03:30",
    endTime: "03:50",
    category: "kesehatan",
    religion: "semua",
    points: 40,
  },
  {
    title: "Minum Air & Peregangan",
    description: "Minum 2 gelas air putih dan peregangan ringan 10 menit.",
    startTime: "03:50",
    endTime: "04:15",
    category: "kesehatan",
    religion: "semua",
    points: 30,
  },
  {
    title: "Sarapan Bersama Keluarga",
    description: "Sarapan sederhana dan mengobrol singkat dengan keluarga.",
    startTime: "05:30",
    endTime: "06:00",
    category: "keluarga",
    religion: "semua",
    points: 35,
  },
  {
    title: "Bersihkan Rumah & Siapkan Bekal",
    description: "Area utama rumah dibereskan, bekal dan kebutuhan hari ini siap.",
    startTime: "06:00",
    endTime: "06:45",
    category: "keluarga",
    religion: "semua",
    points: 30,
  },
  {
    title: "Fokus Kerja / Belajar Sesi 1",
    description: "Deep work tanpa gangguan notifikasi selama 90 menit.",
    startTime: "08:00",
    endTime: "09:30",
    category: "produktivitas",
    religion: "semua",
    points: 60,
  },
  {
    title: "Istirahat & Jalan Kaki",
    description: "Jeda layar, jalan kaki 15 menit, dan minum air.",
    startTime: "10:00",
    endTime: "10:20",
    category: "kesehatan",
    religion: "semua",
    points: 25,
  },
  {
    title: "Makan Siang & Tidur Singkat",
    description: "Makan siang bergizi dan power nap maksimal 20 menit.",
    startTime: "12:00",
    endTime: "13:00",
    category: "kesehatan",
    religion: "semua",
    points: 30,
  },
  {
    title: "Fokus Kerja / Belajar Sesi 2",
    description: "Selesaikan pekerjaan prioritas dan tindak lanjuti pesan penting.",
    startTime: "13:00",
    endTime: "15:30",
    category: "produktivitas",
    religion: "semua",
    points: 60,
  },
  {
    title: "Bantu Sesama / Kegiatan Warga",
    description: "Aksi kecil untuk tetangga, komunitas, atau kegiatan sosial.",
    startTime: "16:00",
    endTime: "16:45",
    category: "sosial",
    religion: "semua",
    points: 45,
  },
  {
    title: "Evaluasi Hari & Rencana Esok",
    description: "Tulis 3 syukur, evaluasi target, dan susun rencana besok.",
    startTime: "20:30",
    endTime: "21:00",
    category: "produktivitas",
    religion: "semua",
    points: 40,
  },
  {
    title: "Bersih Diri & Tidur Cukup",
    description: "Matikan layar pukul 22.00 WIB, siapkan tubuh untuk tidur berkualitas.",
    startTime: "21:00",
    endTime: "22:00",
    category: "kesehatan",
    religion: "semua",
    points: 40,
  },
];

export const WORSHIP_ROUTINES: Record<string, RoutineTemplate[]> = {
  islam: [
    {
      title: "Salat Tahajud & Witir",
      description: "Bangun qiyamul lail, salat tahajud, lalu witir sebelum subuh.",
      startTime: "03:30",
      endTime: "04:20",
      category: "ibadah",
      religion: "islam",
      points: 100,
    },
    {
      title: "Salat Subuh & Zikir Pagi",
      description: "Salat subuh berjamaah, dilanjut zikir dan membaca Al-Qur'an.",
      startTime: "04:25",
      endTime: "05:15",
      category: "ibadah",
      religion: "islam",
      points: 80,
    },
    {
      title: "Salat Dzuhur & Ashar",
      description: "Jaga salat wajib tepat waktu di tengah aktivitas.",
      startTime: "12:00",
      endTime: "15:30",
      category: "ibadah",
      religion: "islam",
      points: 80,
    },
    {
      title: "Salat Maghrib & Isya Berjamaah",
      description: "Salat berjamaah, tadarus, dan doa bersama keluarga.",
      startTime: "18:00",
      endTime: "19:30",
      category: "ibadah",
      religion: "islam",
      points: 90,
    },
  ],
  kristen: [
    {
      title: "Doa Pagi & Renungan Firman",
      description: "Saat teduh, membaca firman, dan menuliskan doa syukur.",
      startTime: "04:00",
      endTime: "04:45",
      category: "ibadah",
      religion: "kristen",
      points: 100,
    },
    {
      title: "Ibadah Keluarga / Saat Teduh",
      description: "Menyanyi pujian, berdoa, dan berbagi firman bersama keluarga.",
      startTime: "18:30",
      endTime: "19:15",
      category: "ibadah",
      religion: "kristen",
      points: 90,
    },
  ],
  katolik: [
    {
      title: "Doa Pagi & Lectio Divina",
      description: "Membaca bacaan harian dan merenungkan Sabda dengan hening.",
      startTime: "04:00",
      endTime: "04:45",
      category: "ibadah",
      religion: "katolik",
      points: 100,
    },
    {
      title: "Doa Malam & Rukat / Angelus",
      description: "Doa malam, rosario, dan pemeriksaan batin.",
      startTime: "19:00",
      endTime: "19:45",
      category: "ibadah",
      religion: "katolik",
      points: 90,
    },
  ],
  hindu: [
    {
      title: "Sembahyang Tri Sandhya Pagi",
      description: "Sembahyang pagi, matur piuning, dan yoga ringan.",
      startTime: "04:00",
      endTime: "04:45",
      category: "ibadah",
      religion: "hindu",
      points: 100,
    },
    {
      title: "Sembahyang Sandhya Sore",
      description: "Sembahyang sore, dharmawacana singkat, dan hening.",
      startTime: "18:30",
      endTime: "19:15",
      category: "ibadah",
      religion: "hindu",
      points: 90,
    },
  ],
  buddha: [
    {
      title: "Meditasi Pagi & Paritta",
      description: "Duduk hening, melatih pernapasan, dan membacakan paritta.",
      startTime: "04:00",
      endTime: "04:45",
      category: "ibadah",
      religion: "buddha",
      points: 100,
    },
    {
      title: "Puja Bhakti & Meditasi Malam",
      description: "Puja bhakti singkat, sharing dhamma, dan meditasi cinta kasih.",
      startTime: "19:00",
      endTime: "19:45",
      category: "ibadah",
      religion: "buddha",
      points: 90,
    },
  ],
  konghucu: [
    {
      title: "Sembahyang Pagi & Jingzuo",
      description: "Sembahyang di depan altar leluhur, membaca kitab, dan hening.",
      startTime: "04:00",
      endTime: "04:45",
      category: "ibadah",
      religion: "konghucu",
      points: 100,
    },
    {
      title: "Sembahyang Malam & Ren",
      description: "Sembahyang malam, refleksi kebajikan (Ren), dan doa keluarga.",
      startTime: "19:00",
      endTime: "19:45",
      category: "ibadah",
      religion: "konghucu",
      points: 90,
    },
  ],
  kepercayaan: [
    {
      title: "Sujud Pagi & Laku Hening",
      description: "Doa pagi kepada Sang Pencipta dan hening untuk menenangkan batin.",
      startTime: "04:00",
      endTime: "04:45",
      category: "ibadah",
      religion: "kepercayaan",
      points: 100,
    },
    {
      title: "Doa Malam & Tirakat Syukur",
      description: "Matur nuwun atas hari yang dilalui dan puasa kecil sukarela.",
      startTime: "19:00",
      endTime: "19:45",
      category: "ibadah",
      religion: "kepercayaan",
      points: 90,
    },
  ],
};

export function starterRoutines(religion: string): RoutineTemplate[] {
  const worship = WORSHIP_ROUTINES[religion] ?? WORSHIP_ROUTINES.islam;
  return [...UNIVERSAL_ROUTINES, ...worship].sort((a, b) => a.startTime.localeCompare(b.startTime));
}
