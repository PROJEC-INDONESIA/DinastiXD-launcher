# DinastiXD Launcher

Launcher desktop Electron untuk Minecraft Java Edition. Jalur Vanilla terhubung ke manifest resmi Mojang untuk memasang dan menjalankan game.

## Menjalankan

Perlu Node.js 24 atau lebih baru.

```sh
npm install
npm start
```

Dashboard mengambil daftar versi langsung dari manifest Mojang. Tombol **Login & main** membuka autentikasi Microsoft resmi, memeriksa kepemilikan Minecraft Java Edition, memasang versi Vanilla yang dipilih, lalu menjalankan game. File game disimpan di `%APPDATA%/.minecraft`; Java yang cocok dideteksi dari perangkat atau, di Windows, diunduh dari Adoptium dan diverifikasi dengan SHA-256.

## Status fitur

- Berfungsi: instalasi dan launch Minecraft Vanilla melalui akun Microsoft yang memiliki Java Edition; pilihan versi; deteksi dan buka folder `.minecraft`; runtime Java Windows terverifikasi.
- Belum tersedia: Ely.by/offline login, Fabric/Forge/NeoForge, skin/cape, pengunduh mod/modpack/resource pack/shader/world, dan pengaturan performa.
- Windows 32-bit dapat menjalankan versi lama dengan Java 8. Minecraft modern memerlukan Java 64-bit dan Windows x64.
- Klaim unduhan 90% lebih cepat atau FPS tertentu tidak dijanjikan; hasil bergantung jaringan dan perangkat.

## Build Windows

```sh
npm run dist:win
```

Perintah ini menghasilkan installer NSIS x64 dan ia32. Linux membutuhkan Wine untuk membuat installer NSIS; workflow GitHub Actions di `.github/workflows/release.yml` membangunnya di Windows saat tag `v*` dikirim. Rilis launcher tetap ditandai sebagai prerelease selama fitur selain Vanilla belum selesai.

```sh
git tag v0.2.0
git push origin v0.2.0
```