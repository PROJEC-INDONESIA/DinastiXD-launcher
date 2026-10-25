# DinastiXD Launcher

Preview desktop launcher berbasis Electron untuk Minecraft Java Edition. **Preview ini belum dapat mengunduh atau menjalankan game.** Pilihan versi dan loader saat ini hanya tersimpan sebagai preferensi lokal.

## Menjalankan

Perlu Node.js 24 atau lebih baru.

```sh
npm install
npm start
```

Dashboard menyediakan navigasi preview, pemilihan versi/loader, status folder, dan tombol untuk membuka folder `.minecraft` pengguna. Folder dibuat saat tombol buka digunakan.

## Status fitur

- Berfungsi: dashboard, navigasi preview, pilihan versi/loader lokal, deteksi dan buka folder `.minecraft`.
- Belum tersedia: unduh/launch Minecraft, pemasangan loader, Java runtime, akun Microsoft/Ely.by, skin/cape, unduh mod/modpack/resource pack/shader/world, serta pengaturan performa.
- Klaim unduhan 90% lebih cepat atau FPS tertentu belum dapat dijanjikan; hasilnya bergantung jaringan, perangkat, dan implementasi yang belum ada.

## Build Windows

```sh
npm run dist:win
```

Perintah ini menghasilkan installer NSIS x64 dan ia32. Linux membutuhkan Wine untuk membuat installer NSIS; workflow GitHub Actions di `.github/workflows/release.yml` membangunnya di Windows saat tag `v*` dikirim. Rilis ditandai sebagai prerelease sampai fitur inti launcher tersedia.

```sh
git tag v0.1.0
git push origin v0.1.0
```