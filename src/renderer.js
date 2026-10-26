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
let selectedLoaderVersion = '';
let loaderRequestId = 0;
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
  if (view === 'mods') {
    breadcrumb.textContent = names.mods;
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
    renderModsView('mod');
    return;
  }
  if (view === 'resource-packs' || view === 'shaders') {
    breadcrumb.textContent = names[view];
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
    renderModsView(view === 'resource-packs' ? 'resourcepack' : 'shader');
    return;
  }
  if (view === 'settings') {
    breadcrumb.textContent = names.settings;
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
    renderSettingsView();
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

function renderModsView(contentType = 'mod') {
  const titles = { mod: 'Mods', resourcepack: 'Resource packs', shader: 'Shaders' };
  const title = titles[contentType] || 'Mods';
  pageContent.innerHTML = `
    <div class="welcome-row">
      <div><p class="eyebrow">CONTENT CATALOG <span class="eyebrow-line"></span> MODRINTH · CURSEFORGE</p><h1>${title}</h1></div>
      <span class="setup-note" id="mod-instance-label"></span>
    </div>
    <section class="mod-browser">
      <form class="mod-search" id="mod-search-form">
        <select id="mod-source" aria-label="Sumber mod"><option>Modrinth</option><option>CurseForge</option></select>
        <input id="mod-query" type="search" placeholder="Cari nama mod..." aria-label="Cari mod" />
        <button class="play-button" type="submit" id="mod-search-button">Cari</button>
      </form>
      <p class="mod-status" id="mod-status">Cari mod untuk versi dan loader yang dipilih.</p>
      <div class="mod-results" id="mod-results"></div>
    </section>
    <footer class="page-footer"><span>INSTALASI LANGSUNG KE INSTANCE TERPILIH</span><span>Unduhan diverifikasi dengan checksum</span></footer>`;

  const selection = getSelectedInstance();
  document.querySelector('#mod-instance-label').textContent = `${selection.loader} ${selection.loaderVersion || ''} · ${selection.minecraftVersion}`;
  const form = document.querySelector('#mod-search-form');
  const status = document.querySelector('#mod-status');
  const button = document.querySelector('#mod-search-button');
  const results = document.querySelector('#mod-results');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (contentType === 'mod' && selection.loader === 'Vanilla') {
      status.textContent = 'Pilih Fabric, Forge, atau NeoForge pada dashboard untuk mencari mod.';
      return;
    }
    const source = document.querySelector('#mod-source').value;
    button.disabled = true;
    status.textContent = `Mencari di ${source}...`;
    results.replaceChildren();
    try {
      const items = await window.dinasti.searchContent(source, document.querySelector('#mod-query').value, selection, contentType);
      status.textContent = `${items.length} hasil · ${source}`;
      for (const mod of items) {
        const row = document.createElement('article');
        row.className = 'mod-result';
        const copy = document.createElement('div');
        copy.className = 'mod-result-copy';
        const title = document.createElement('strong');
        title.textContent = mod.title;
        const description = document.createElement('p');
        description.textContent = mod.description || '';
        const meta = document.createElement('small');
        meta.textContent = `${mod.source} · ${new Intl.NumberFormat('id-ID').format(mod.downloads || 0)} unduhan`;
        copy.append(title, description, meta);
        const install = document.createElement('button');
        install.className = 'manage-button mod-install-button';
        install.type = 'button';
        install.textContent = 'Pasang';
        install.addEventListener('click', async () => {
          install.disabled = true;
          install.textContent = 'Mengunduh...';
          try {
            const files = await window.dinasti.installContent(mod.source, mod.id, selection, contentType);
            install.textContent = 'Terpasang';
            showToast(`${files.length} file mod berhasil dipasang.`);
          } catch (error) {
            install.textContent = 'Pasang';
            showToast(error.message, true);
          } finally {
            install.disabled = false;
          }
        });
        row.append(copy, install);
        results.append(row);
      }
    } catch (error) {
      status.textContent = error.message;
      if (source === 'CurseForge') {
        const settingsButton = document.createElement('button');
        settingsButton.className = 'manage-button';
        settingsButton.textContent = 'Buka pengaturan API key';
        settingsButton.addEventListener('click', () => showView('settings'));
        results.append(settingsButton);
      }
    } finally {
      button.disabled = false;
    }
  });
}

async function renderSettingsView() {
  pageContent.innerHTML = `
    <div class="welcome-row"><div><p class="eyebrow">AKUN & API <span class="eyebrow-line"></span> PREFERENSI</p><h1>Pengaturan</h1></div></div>
    <section class="settings-page">
      <div class="settings-section">
        <div><h2>CurseForge</h2><p>API key diperlukan untuk mencari dan mengunduh mod dari CurseForge. Key disimpan terenkripsi oleh sistem operasi.</p></div>
        <form id="curseforge-key-form" class="key-form"><label for="curseforge-api-key">API key</label><input id="curseforge-api-key" type="password" autocomplete="off" placeholder="Tempel API key CurseForge" /><button class="play-button" type="submit">Simpan key</button><small id="curseforge-key-status">Memeriksa...</small></form>
      </div>
    </section>
    <footer class="page-footer"><span>KREDENSIAL DISIMPAN SECARA LOKAL</span><span>Jangan bagikan API key kamu</span></footer>`;

  const status = document.querySelector('#curseforge-key-status');
  try {
    status.textContent = await window.dinasti.curseForgeKeyStatus() ? 'API key tersimpan terenkripsi.' : 'API key belum diatur.';
  } catch (error) {
    status.textContent = error.message;
  }
  document.querySelector('#curseforge-key-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.querySelector('#curseforge-api-key');
    const apiKey = input.value;
    try {
      await window.dinasti.saveCurseForgeKey(apiKey);
      input.value = '';
      status.textContent = 'API key tersimpan terenkripsi.';
      showToast('API key CurseForge tersimpan.');
    } catch (error) {
      status.textContent = error.message;
      showToast(error.message, true);
    }
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
  loadLoaderVersions();
});

document.querySelector('#version-select').addEventListener('change', () => {
  loadLoaderVersions();
});

const versionSelect = document.querySelector('#version-select');
const loaderVersionSelect = document.querySelector('#loader-version-select');
const savedVersion = localStorage.getItem('dinasti.selectedVersion');
document.querySelectorAll('#loader-options button').forEach((button) => {
  button.classList.toggle('selected', button.dataset.loader === selectedLoader);
});

function updateSelection() {
  const version = versionSelect.value;
  document.querySelector('#selection-summary').textContent = `${selectedLoader}${selectedLoaderVersion ? ` ${selectedLoaderVersion}` : ''} · ${version}`;
  localStorage.setItem('dinasti.selectedLoader', selectedLoader);
  localStorage.setItem('dinasti.selectedVersion', version);
  if (selectedLoaderVersion) localStorage.setItem(`dinasti.loader.${version}.${selectedLoader}`, selectedLoaderVersion);
}

function getSelectedInstance() {
  return {
    minecraftVersion: versionSelect.value,
    loader: selectedLoader,
    loaderVersion: selectedLoader === 'Vanilla' ? '' : selectedLoaderVersion
  };
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
    await loadLoaderVersions();
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
    const instance = getSelectedInstance();
    const installed = await window.dinasti.isVersionInstalled(instance);
    setGameStatus(installed ? `${selectedLoader} ${selectedLoaderVersion || version} siap dimainkan.` : `${selectedLoader} ${selectedLoaderVersion || version} belum terpasang. Klik Main untuk memasang.`);
  } catch (error) {
    setGameStatus(error.message);
  }
}

async function loadLoaderVersions() {
  const requestId = ++loaderRequestId;
  const minecraftVersion = versionSelect.value;
  const field = document.querySelector('#loader-version-field');
  selectedLoaderVersion = '';

  if (!minecraftVersion || selectedLoader === 'Vanilla') {
    field.hidden = true;
    updateSelection();
    await updateVersionStatus();
    return;
  }

  field.hidden = false;
  loaderVersionSelect.disabled = true;
  loaderVersionSelect.replaceChildren(new Option('Memuat versi loader...', ''));
  setGameStatus(`Mencari ${selectedLoader} yang kompatibel dengan Minecraft ${minecraftVersion}...`);

  try {
    const versions = await window.dinasti.getLoaderVersions(minecraftVersion, selectedLoader);
    if (requestId !== loaderRequestId) return;
    if (!versions.length) {
      loaderVersionSelect.replaceChildren(new Option(`Tidak tersedia untuk ${minecraftVersion}`, ''));
      updateSelection();
      setGameStatus(`${selectedLoader} belum menyediakan loader untuk Minecraft ${minecraftVersion}.`);
      return;
    }

    loaderVersionSelect.replaceChildren(...versions.map((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = `${version.id}${version.stable ? ' · Stabil' : ''}`;
      return option;
    }));
    const saved = localStorage.getItem(`dinasti.loader.${minecraftVersion}.${selectedLoader}`);
    selectedLoaderVersion = versions.some((version) => version.id === saved)
      ? saved
      : (versions.find((version) => version.stable) ?? versions[0]).id;
    loaderVersionSelect.value = selectedLoaderVersion;
    loaderVersionSelect.disabled = false;
    updateSelection();
    await updateVersionStatus();
  } catch (error) {
    if (requestId !== loaderRequestId) return;
    loaderVersionSelect.replaceChildren(new Option('Versi loader tidak dapat dimuat', ''));
    updateSelection();
    setGameStatus(error.message);
  }
}

loaderVersionSelect.addEventListener('change', () => {
  selectedLoaderVersion = loaderVersionSelect.value;
  updateSelection();
  updateVersionStatus();
});

async function refreshAccount() {
  currentAccount = await window.dinasti.getAccount();
  const name = currentAccount?.name ?? 'Belum login';
  const provider = currentAccount?.provider;
  document.querySelector('#sidebar-account-name').textContent = name;
  document.querySelector('#sidebar-account-provider').textContent = currentAccount ? `${provider} · Java Edition` : 'Pilih Microsoft atau Ely.by';
  document.querySelector('#account-indicator').setAttribute('aria-label', currentAccount ? 'Sudah login' : 'Belum login');
  document.querySelector('#profile-button').querySelector('span:nth-child(2)').textContent = currentAccount ? `Keluar ${provider}` : 'Login Microsoft';
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
  const instance = getSelectedInstance();
  if (!instance.minecraftVersion || versionSelect.disabled || selectedLoader !== 'Vanilla' && !selectedLoaderVersion) {
    showToast('Versi Minecraft resmi belum siap.', true);
    return;
  }

  const button = document.querySelector('#play-button');
  button.disabled = true;
  try {
    if (!currentAccount && !await loginMicrosoft()) return;
    const installed = await window.dinasti.isVersionInstalled(instance);
    if (!installed) await window.dinasti.installVersion(instance);
    const result = await window.dinasti.launchGame(instance);
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

const elyDialog = document.querySelector('#ely-login-dialog');
const elyForm = document.querySelector('#ely-login-form');

document.querySelector('#ely-login-button').addEventListener('click', () => elyDialog.showModal());
document.querySelector('#ely-cancel').addEventListener('click', () => elyDialog.close());
elyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#ely-submit');
  const data = new FormData(elyForm);
  const credentials = {
    username: data.get('username'),
    password: data.get('password'),
    twoFactorToken: data.get('twoFactorToken')
  };
  submit.disabled = true;
  setGameStatus('Mengautentikasi akun melalui Ely.by...');
  try {
    const account = await window.dinasti.loginEly(credentials);
    elyDialog.close();
    await refreshAccount();
    showToast(`Login Ely.by berhasil: ${account.name}`);
  } catch (error) {
    setGameStatus(error.message);
    showToast(error.message, true);
  } finally {
    elyForm.elements.password.value = '';
    elyForm.elements.twoFactorToken.value = '';
    submit.disabled = false;
  }
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