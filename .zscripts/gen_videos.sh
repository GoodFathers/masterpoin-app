#!/bin/bash
# Generate 10 sample videos + posters untuk Beranda (feed video)
set -e
OUT=/home/z/my-project/public/videos
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
mkdir -p "$OUT"

gen() {
  local file="$1"; local c0="$2"; local c1="$3"; local c2="$4"
  local title="$5"; local sub="$6"; local dur="$7"
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "gradients=s=720x1280:d=${dur}:n=3:c0=${c0}:c1=${c1}:c2=${c2}:speed=0.06" \
    -f lavfi -i "sine=frequency=392:sample_rate=44100:duration=${dur}" \
    -vf "drawbox=x=0:y=1020:w=720:h=260:color=black@0.35:t=fill,\
drawtext=fontfile=${FONT}:text='${title}':fontcolor=white:fontsize=46:x=(w-text_w)/2:y=1080,\
drawtext=fontfile=${FONT}:text='${sub}':fontcolor=white@0.85:fontsize=28:x=(w-text_w)/2:y=1160,\
drawtext=fontfile=${FONT}:text='IndiGoo':fontcolor=white@0.55:fontsize=26:x=(w-text_w)/2:y=120" \
    -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.1 -crf 31 -preset veryfast \
    -c:a aac -b:a 72k -movflags +faststart -shortest "$OUT/$file.mp4"
  ffmpeg -y -hide_banner -loglevel error -i "$OUT/$file.mp4" -frames:v 1 -q:v 4 "$OUT/$file.jpg"
  echo "OK $file"
}

# --- HIBURAN (amber/orange) ---
gen hiburan-1 0xf59e0b 0xf97316 0x7c2d12 "Busana Batik Prambanan" "Hiburan - Rina Putri" 9
gen hiburan-2 0xfbbf24 0xea580c 0x431407 "Gig Kotagede Malam" "Hiburan - Dedi Setia" 8
gen hiburan-3 0xfdba74 0xc2410c 0x1c0a03 "Cover Gamelan Modern" "Hiburan - Sanggar Svara" 8

# --- DOMISILI (teal/green) ---
gen domisili-1 0x14b8a6 0x0d9488 0x134e4a "Suasana Pagi Malioboro" "Domisili - Bayu Amanta" 9
gen domisili-2 0x2dd4bf 0x0f766e 0x042f2e "Kalasan dari Drone" "Domisili - JogjaDrone ID" 8
gen domisili-3 0x5eead4 0x115e59 0x020617 "Senja Pantai Indrayanti" "Domisili - Wisata Keluarga" 8

# --- PROMO (red/rose) ---
gen promo-1 0xef4444 0xbe123c 0x4c0519 "Promo Keripik 20 Persen" "Promo - IndiGoo Official" 9
gen promo-2 0xf87171 0x9f1239 0x1e0208 "Diskon Batik Cap 30" "Promo - Batik Larasati" 8
gen promo-3 0xfda4af 0xa30d2d 0x33020c "Bundling Kopi Klotok" "Promo - Kopi Klotok Yuk" 8
gen promo-4 0xdc2626 0x881337 0x27040f "Grand Opening Solo" "Promo - IndiGoo Official" 8

ls -la "$OUT" | tail -12
