# DinastiXD Launcher

Launcher desktop Electron untuk Minecraft Java Edition. Launcher memasang dan menjalankan Vanilla serta loader yang tersedia untuk versi Minecraft pilihan.

## Menjalankan

Perlu Node.js 24 atau lebih baru.

```sh
npm install
npm start
```

Dashboard mengambil daftar versi langsung dari manifest Mojang dan daftar Fabric/Forge/NeoForge dari feed resminya. Login Microsoft memeriksa kepemilikan Minecraft Java Edition. Login Ely.by memakai endpoint Yggdrasil HTTPS resmi dan authlib-injector; password tidak disimpan. Launcher memasang file, library, dan Java yang cocok sebelum menjalankan game. Data Vanilla disimpan di `%APPDATA%/.minecraft`; loader memakai direktori instance terpisah.

Katalog Mod, Resource packs, dan Shaders mencari konten kompatibel di Modrinth serta CurseForge. Modrinth dapat dipakai langsung; CurseForge mensyaratkan API key resmi yang disimpan terenkripsi oleh OS. Unduhan mod/resource menggunakan HTTPS dan checksum. File dipasang ke folder instance aktif.

## Status fitur

- Berfungsi: instalasi/launch Vanilla dan loader yang tersedia; login Microsoft dan Ely.by; runtime Java Windows terverifikasi; katalog/download mod, resource pack, dan shader.
- Belum tersedia: offline login, skin/cape, impor modpack, download world, dan pengaturan performa.
- Windows 32-bit dapat menjalankan versi lama dengan Java 8. Minecraft modern memerlukan Java 64-bit dan Windows x64.
- Klaim unduhan 90% lebih cepat atau FPS tertentu tidak dijanjikan; hasil bergantung jaringan dan perangkat.

## Build Windows

```sh
npm run dist:win
```

Perintah ini menghasilkan installer NSIS x64 dan ia32. Linux membutuhkan Wine untuk membuat installer NSIS; workflow GitHub Actions di `.github/workflows/release.yml` membangunnya di Windows saat tag `v*` dikirim. Rilis launcher tetap ditandai sebagai prerelease selama fitur selain Vanilla belum selesai.

```sh
git tag v0.4.0
git push origin v0.4.0
```