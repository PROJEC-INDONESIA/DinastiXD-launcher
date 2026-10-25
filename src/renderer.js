const names = {
  dashboard: 'DASHBOARD',
  library: 'LIBRARY',
  files: 'FILE GAME',
  mods: 'MODS',
  'resource-packs': 'RESOURCE PACKS',
  shaders: 'SHADERS',
  worlds: 'WORLDS',
  settings: 'PENGATURAN'
};

const views = {
  library: ['Library', 'Belum ada instalasi Minecraft yang terhubung.', 'Instalasi game belum tersedia di preview ini.'],
  mods: ['Mods', 'Kelola mod dalam satu tempat.', 'Pengunduh dan pengelola mod akan tersedia setelah integrasi instalasi selesai.'],
  'resource-packs': ['Resource packs', 'Atur tampilan duniamu.', 'Pengelola resource pack belum aktif di preview ini.'],
  shaders: ['Shaders', 'Ubah pencahayaan dan suasana game.', 'Pengelola shader belum aktif di preview ini.'],
  worlds: ['Worlds', 'Simpan dan temukan duniamu.', 'Pengelola world belum aktif di preview ini.'],
  settings: ['Pengaturan', 'Preferensi launcher', 'Pengaturan Java, memori, dan performa belum tersedia di preview ini.']
};

const pageContent = document.querySelector('#page-content');
const breadcrumb = document.querySelector('#breadcrumb-current');
const toast = document.querySelector('#toast');
const availableLoaders = ['Vanilla', 'Fabric', 'Forge', 'NeoForge'];
const savedLoader = localStorage.getItem('dinasti.selectedLoader');
let selectedLoader = availableLoaders.includes(savedLoader) ? savedLoader : 'Vanilla';
let currentAccount;
let toastTimer;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
}

function showDashboard() {
  window.location.reload();
}

function showView(view) {
  if (view === 'dashboard') {
    showDashboard();
    return;
  }
  if (view === 'files') {
    breadcrumb.textContent = names.files;
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    renderFileBrowser();
    return;
  }

  const [title, heading, description] = views[view];
  breadcrumb.textContent = names[view];
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  pageContent.innerHTML = `
    <div class="welcome-row">
      <div><p class="eyebrow">DINASTIXD LAUNCHER <span class="eyebrow-line"></span> ${view === 'settings' ? 'PENGATURAN' : 'SEGERA HADIR'}</p><h1>${title}</h1></div>
      <button class="text-button" data-action="open-folder"><span>⌁</span> Buka folder game</button>
    </div>
    <section class="empty-view"><div class="empty-content">
      <span class="empty-symbol">${view === 'settings' ? '⚙' : '✳'}</span>
      <h2>${heading}</h2><p>${description}</p>
      <button data-action="open-folder">Buka folder .minecraft</button>
    </div></section>
    <footer class="page-footer"><span>DINASTIXD LAUNCHER <b>·</b> JAVA EDITION</span><span>Fitur ini belum tersedia</span></footer>`;

  pageContent.querySelectorAll('[data-action="open-folder"]').forEach((button) => {
    button.addEventListener('click', openMinecraftFolder);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function renderFileBrowser(relativeDirectory = '') {
  const parts = relativeDirectory ? relativeDirectory.split(/[\\/]/).filter(Boolean) : [];
  const breadcrumbPath = ['.minecraft', ...parts].map(escapeHtml).join(' / ');
  pageContent.innerHTML = `
    <div class="welcome-row">
      <div><p class="eyebrow">KONTEN LOKAL <span class="eyebrow-line"></span> .MINECRAFT</p><h1>File game</h1></div>
      <button class="text-button" data-action="open-folder"><span>⌁</span> Buka di Explorer</button>
    </div>
    <section class="file-browser">
      <div class="file-toolbar"><div class="file-path">${breadcrumbPath}</div><button class="file-refresh" data-action="refresh-files" title="Muat ulang" aria-label="Muat ulang">↻</button></div>
      <div class="file-columns"><div class="file-list" id="file-list"><div class="file-empty">Memuat file...</div></div><div class="file-preview" id="file-preview"><span class="preview-placeholder">Pilih file teks untuk melihat pratinjaunya.</span></div></div>
    </section>
    <footer class="page-footer"><span>DINASTIXD LAUNCHER <b>·</b> JAVA EDITION</span><span>${breadcrumbPath}</span></footer>`;

  pageContent.querySelector('[data-action="open-folder"]').addEventListener('click', openMinecraftFolder);
  pageContent.querySelector('[data-action="refresh-files"]').addEventListener('click', () => renderFileBrowser(relativeDirectory));

  const fileList = pageContent.querySelector('#file-list');
  try {
    const items = await window.dinasti.listMinecraftDirectory(relativeDirectory);
    if (pageContent.querySelector('#file-list') !== fileList) return;

    const rows = [];
    if (parts.length) {
      rows.push('<button class="file-entry parent-entry" data-action="parent-directory"><span class="file-type-icon">↰</span><span class="file-name">Kembali</span><span></span></button>');
    }
    for (const item of items) {
      const safeName = escapeHtml(item.name);
      const relativePath = [...parts, item.name].join('/');
      rows.push(`<button class="file-entry" data-file-path="${escapeHtml(relativePath)}" data-is-directory="${item.directory}"><span class="file-type-icon">${item.directory ? '▰' : '·'}</span><span class="file-name">${safeName}</span><span class="file-size">${item.directory ? 'Folder' : formatFileSize(item.size)}</span></button>`);
    }
    fileList.innerHTML = rows.length ? rows.join('') : '<div class="file-empty">Folder ini kosong.</div>';

    fileList.querySelector('[data-action="parent-directory"]')?.addEventListener('click', () => {
      renderFileBrowser(parts.slice(0, -1).join('/'));
    });
    fileList.querySelectorAll('[data-file-path]').forEach((button) => {
      button.addEventListener('click', async () => {
        const filePath = button.dataset.filePath;
        if (button.dataset.isDirectory === 'true') {
          renderFileBrowser(filePath);
          return;
        }
        const preview = pageContent.querySelector('#file-preview');
        preview.innerHTML = '<span class="preview-placeholder">Membuka pratinjau...</span>';
        try {
          const contents = await window.dinasti.readMinecraftTextFile(filePath);
          if (pageContent.querySelector('#file-preview') === preview) {
            preview.innerHTML = `<div class="preview-title">${escapeHtml(filePath)}</div><pre>${escapeHtml(contents)}</pre>`;
          }
        } catch (error) {
          if (pageContent.querySelector('#file-preview') === preview) {
            preview.innerHTML = `<span class="preview-placeholder">${escapeHtml(error.message)}</span>`;
          }
        }
      });
    });
  } catch (error) {
    if (pageContent.querySelector('#file-list') === fileList) {
      fileList.innerHTML = `<div class="file-empty">Folder tidak dapat dibaca: ${escapeHtml(error.message)}</div>`;
    }
  }
}

async function openMinecraftFolder() {
  try {
    const error = await window.dinasti.openMinecraftFolder();
    if (error) throw new Error(error);
    showToast('Folder .minecraft dibuka.');
  } catch (error) {
    showToast(`Folder tidak dapat dibuka: ${error.message}`, true);
  }
}

document.querySelectorAll('.nav-item[data-view], .hero-secondary[data-view]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

document.querySelectorAll('[id^="open-folder"]').forEach((button) => {
  button.addEventListener('click', openMinecraftFolder);
});

document.querySelector('#loader-options').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-loader]');
  if (!button) return;
  selectedLoader = button.dataset.loader;
  document.querySelectorAll('#loader-options button').forEach((option) => {
    option.classList.toggle('selected', option === button);
  });
  updateSelection();
});

document.querySelector('#version-select').addEventListener('change', () => {
  updateSelection();
  updateVersionStatus();
});

const versionSelect = document.querySelector('#version-select');
const savedVersion = localStorage.getItem('dinasti.selectedVersion');
document.querySelectorAll('#loader-options button').forEach((button) => {
  button.classList.toggle('selected', button.dataset.loader === selectedLoader);
});

function updateSelection() {
  const version = versionSelect.value;
  document.querySelector('#selection-summary').textContent = `${selectedLoader} · ${version}`;
  localStorage.setItem('dinasti.selectedLoader', selectedLoader);
  localStorage.setItem('dinasti.selectedVersion', version);
}

updateSelection();

async function loadVersions() {
  versionSelect.disabled = true;
  try {
    const manifest = await window.dinasti.getVersions();
    versionSelect.replaceChildren(...manifest.versions.map((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = `${version.id}${version.id === manifest.latest ? ' · Terbaru' : ''}`;
      return option;
    }));
    const preferredVersion = manifest.versions.some((version) => version.id === savedVersion)
      ? savedVersion
      : manifest.latest;
    versionSelect.value = preferredVersion;
    versionSelect.disabled = false;
    updateSelection();
    const installed = await window.dinasti.isVersionInstalled(preferredVersion);
    setGameStatus(installed ? `Minecraft ${preferredVersion} siap dimainkan.` : `Minecraft ${preferredVersion} belum terpasang. Klik Main untuk mengunduh file resmi.`);
  } catch (error) {
    versionSelect.replaceChildren(new Option('Versi Mojang tidak dapat dimuat', ''));
    setGameStatus(`Tidak dapat mengambil manifest Mojang: ${error.message}`);
  }
}

function setGameStatus(message) {
  document.querySelector('#game-status-text').textContent = message;
}

async function updateVersionStatus() {
  const version = versionSelect.value;
  if (!version) return;
  try {
    const installed = await window.dinasti.isVersionInstalled(version);
    setGameStatus(installed ? `Minecraft ${version} siap dimainkan.` : `Minecraft ${version} belum terpasang. Klik Main untuk mengunduh file resmi.`);
  } catch (error) {
    setGameStatus(error.message);
  }
}

async function refreshAccount() {
  currentAccount = await window.dinasti.getAccount();
  const name = currentAccount?.name ?? 'Belum login';
  document.querySelector('#sidebar-account-name').textContent = name;
  document.querySelector('#sidebar-account-provider').textContent = currentAccount ? 'Microsoft · Java Edition' : 'Akun Microsoft';
  document.querySelector('#account-indicator').setAttribute('aria-label', currentAccount ? 'Sudah login' : 'Belum login');
  document.querySelector('#profile-button').querySelector('span:nth-child(2)').textContent = currentAccount ? 'Keluar' : 'Login Microsoft';
  document.querySelector('#play-button-label').textContent = currentAccount ? 'Mainkan Minecraft' : 'Login & main';
}

async function loginMicrosoft() {
  setGameStatus('Membuka login Microsoft resmi...');
  try {
    const account = await window.dinasti.loginMicrosoft();
    await refreshAccount();
    showToast(`Login berhasil: ${account.name}`);
    return true;
  } catch (error) {
    setGameStatus(error.message);
    showToast(error.message, true);
    return false;
  }
}

document.querySelector('#play-button').addEventListener('click', async () => {
  const version = versionSelect.value;
  if (!version || versionSelect.disabled) {
    showToast('Versi Minecraft resmi belum siap.', true);
    return;
  }

  const button = document.querySelector('#play-button');
  button.disabled = true;
  try {
    if (!currentAccount && !await loginMicrosoft()) return;
    const installed = await window.dinasti.isVersionInstalled(version);
    if (!installed) await window.dinasti.installVersion(version);
    const result = await window.dinasti.launchGame(version);
    setGameStatus(`Minecraft berjalan dengan Java ${result.javaMajor}. Kamu bisa kembali ke launcher saat bermain.`);
  } catch (error) {
    setGameStatus(error.message);
    showToast(error.message, true);
  } finally {
    button.disabled = false;
    await refreshAccount();
  }
});

document.querySelector('#profile-button').addEventListener('click', async () => {
  if (!currentAccount) {
    await loginMicrosoft();
    return;
  }
  await window.dinasti.logoutMicrosoft();
  await refreshAccount();
  showToast('Keluar dari akun Microsoft.');
});

window.dinasti.onProgress(({ stage, message }) => {
  setGameStatus(message);
  if (stage === 'error') showToast(message, true);
});

refreshAccount().catch(() => {});
loadVersions();

document.querySelector('#welcome-date').textContent = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
}).format(new Date()).toUpperCase();

window.dinasti.getStatus().then(({ minecraftDirectory, folderExists }) => {
  document.querySelector('#folder-status').textContent = folderExists ? 'Terdeteksi' : 'Belum dibuat';
  document.querySelector('#footer-path').textContent = minecraftDirectory;
}).catch(() => {
  document.querySelector('#folder-status').textContent = 'Status tidak tersedia';
});