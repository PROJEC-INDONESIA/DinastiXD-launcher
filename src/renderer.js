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
      <div><p class="eyebrow">DINASTIXD LAUNCHER <span class="eyebrow-line"></span> PREVIEW</p><h1>${title}</h1></div>
      <button class="text-button" data-action="open-folder"><span>⌁</span> Buka folder game</button>
    </div>
    <section class="empty-view"><div class="empty-content">
      <span class="empty-symbol">${view === 'settings' ? '⚙' : '✳'}</span>
      <h2>${heading}</h2><p>${description}</p>
      <button data-action="open-folder">Buka folder .minecraft</button>
    </div></section>
    <footer class="page-footer"><span>DINASTIXD LAUNCHER <b>·</b> PREVIEW</span><span>Fitur terhubung akan ditampilkan di sini</span></footer>`;

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
    <footer class="page-footer"><span>DINASTIXD LAUNCHER <b>·</b> PREVIEW</span><span>${breadcrumbPath}</span></footer>`;

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

document.querySelector('#version-select').addEventListener('change', updateSelection);

const versionSelect = document.querySelector('#version-select');
const savedVersion = localStorage.getItem('dinasti.selectedVersion');
if ([...versionSelect.options].some((option) => option.value === savedVersion)) {
  versionSelect.value = savedVersion;
}
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

document.querySelector('#welcome-date').textContent = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
}).format(new Date()).toUpperCase();

document.querySelector('#play-button').addEventListener('click', () => {
  showToast('Peluncuran game belum tersedia di preview ini.');
});

document.querySelector('#profile-button').addEventListener('click', () => {
  showToast('Login Microsoft dan Ely.by belum terhubung.');
});

window.dinasti.getStatus().then(({ minecraftDirectory, folderExists }) => {
  document.querySelector('#folder-status').textContent = folderExists ? 'Terdeteksi' : 'Belum dibuat';
  document.querySelector('#footer-path').textContent = minecraftDirectory;
}).catch(() => {
  document.querySelector('#folder-status').textContent = 'Status tidak tersedia';
});