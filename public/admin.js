(function () {
  const gate = document.getElementById('gate');
  const panel = document.getElementById('panel');
  const passwordInput = document.getElementById('password-input');
  const unlockBtn = document.getElementById('unlock-btn');
  const gateError = document.getElementById('gate-error');

  const albumSelect = document.getElementById('album-select');
  const newAlbumInput = document.getElementById('new-album-input');
  const dropzone = document.getElementById('dropzone');
  const dropzoneText = document.getElementById('dropzone-text');
  const fileInput = document.getElementById('file-input');
  const uploadList = document.getElementById('upload-list');
  const uploadBtn = document.getElementById('upload-btn');
  const cancelAllBtn = document.getElementById('cancel-all-btn');
  const overallStatus = document.getElementById('overall-status');
  const manageGrid = document.getElementById('manage-grid');

  let password = sessionStorage.getItem('ebenezer_admin_pw') || '';
  let currentAlbums = [];
  let isUploading = false;
  let batchCancelled = false;

  // Each queued file is tracked as an object, not a raw File, so we can
  // attach a thumbnail, an editable name, per-item status, and (while
  // uploading) a live XHR reference we can abort.
  let queue = []; // { id, file, name, objectUrl, status, xhr }
  let nextId = 1;

  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function sanitizeName(name) {
    return String(name).replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  // ---------------- client-side image compression ----------------
  // Vercel's serverless functions cap request bodies at 4.5MB, so rather
  // than fail on large phone photos, we shrink them in the browser first
  // (resize to a sane max dimension + re-encode as JPEG). This keeps
  // uploads fast, keeps the gallery light for visitors on mobile data,
  // and avoids the size limit almost entirely.
  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) resolve(blob);
            else reject(new Error('Could not process image'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read image'));
      };
      img.src = objectUrl;
    });
  }

  // Tries progressively smaller/lower-quality passes until the result
  // fits comfortably under the server's limit, or gives up after a few tries.
  // Target is lower than the server's raw limit because the file is sent
  // as base64 text, which is ~33% larger than the original bytes.
  async function prepareForUpload(file) {
    const SAFE_LIMIT = 2.2 * 1024 * 1024; // ~2.2MB blob -> ~2.9MB base64, well under the 4MB server check
    if (file.size <= SAFE_LIMIT && /^image\/(jpeg|png|webp)$/.test(file.type)) {
      return { blob: file, renamedJpeg: false };
    }
    const attempts = [
      { maxDim: 2000, quality: 0.82 },
      { maxDim: 1600, quality: 0.78 },
      { maxDim: 1300, quality: 0.72 },
      { maxDim: 1000, quality: 0.68 },
    ];
    let lastErr;
    for (const attempt of attempts) {
      try {
        const blob = await compressImage(file, attempt.maxDim, attempt.quality);
        if (blob.size <= SAFE_LIMIT) {
          return { blob, renamedJpeg: true };
        }
        lastErr = new Error('Still too large after compression');
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Could not compress image enough to upload.');
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error('Could not read the compressed image'));
      reader.readAsDataURL(blob);
    });
  }

  async function fetchGallery() {
    const res = await fetch('/api/gallery', { cache: 'no-store' });
    const data = await res.json();
    currentAlbums = data.albums || [];
    return currentAlbums;
  }

  function populateAlbumSelect() {
    const prevValue = albumSelect.value;
    albumSelect.innerHTML = '<option value="">— Select existing album —</option>';
    currentAlbums.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.slug;
      opt.textContent = `${a.title} (${a.count})`;
      albumSelect.appendChild(opt);
    });
    if (currentAlbums.some((a) => a.slug === prevValue)) albumSelect.value = prevValue;
  }

  function renderManageGrid() {
    const chosenSlug = albumSelect.value || slugify(newAlbumInput.value || '');
    const album = currentAlbums.find((a) => a.slug === chosenSlug);
    manageGrid.innerHTML = '';
    if (!album || !album.photos.length) {
      manageGrid.innerHTML = '<p class="admin-hint">No photos in this album yet.</p>';
      return;
    }
    album.photos.forEach((p) => {
      const cell = document.createElement('div');
      cell.className = 'manage-cell';
      cell.innerHTML = `
        <img src="${p.src}" alt="${p.alt}" loading="lazy" />
        <button type="button" class="manage-delete" title="Delete photo">Delete</button>
      `;
      cell.querySelector('.manage-delete').addEventListener('click', () => deletePhoto(p.pathname, cell));
      manageGrid.appendChild(cell);
    });
  }

  async function deletePhoto(pathname, cellEl) {
    if (!confirm('Remove this photo permanently?')) return;
    cellEl.style.opacity = '0.4';
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ pathname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      cellEl.remove();
    } catch (err) {
      alert(err.message);
      cellEl.style.opacity = '1';
    }
  }

  async function unlock() {
    const val = passwordInput.value.trim();
    if (!val) return;
    gateError.textContent = '';
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Checking…';
    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': val },
        body: JSON.stringify({ pathname: 'gallery/__password_check__' }),
      });
      if (res.status === 401) {
        gateError.textContent = 'Incorrect password. Please try again.';
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Unlock';
        return;
      }
      password = val;
      sessionStorage.setItem('ebenezer_admin_pw', password);
      gate.style.display = 'none';
      panel.style.display = 'block';
      await refreshAlbums();
    } catch (err) {
      gateError.textContent = 'Could not reach the server. Please try again.';
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Unlock';
    }
  }

  async function refreshAlbums() {
    await fetchGallery();
    populateAlbumSelect();
    renderManageGrid();
  }

  // ---------------- file queue: add / remove / preview / edit ----------------

  function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    files.forEach((file) => {
      queue.push({
        id: nextId++,
        file,
        name: file.name,
        objectUrl: URL.createObjectURL(file),
        status: 'ready', // ready | uploading | done | error | cancelled
        xhr: null,
      });
    });
    renderFileList();
  }

  function removeQueueItem(id) {
    const item = queue.find((q) => q.id === id);
    if (!item) return;
    if (item.status === 'uploading') return; // must cancel first
    if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    queue = queue.filter((q) => q.id !== id);
    renderFileList();
  }

  function cancelQueueItem(id) {
    const item = queue.find((q) => q.id === id);
    if (!item || !item.xhr) return;
    item.xhr.abort();
  }

  function renderFileList() {
    uploadList.innerHTML = '';
    queue.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'upload-item';
      li.dataset.id = item.id;

      const canEdit = item.status === 'ready';
      const statusLabel = {
        ready: 'Ready',
        uploading: 'Uploading…',
        done: '✓ Uploaded',
        error: '✕ Failed',
        cancelled: 'Cancelled',
      }[item.status];

      li.innerHTML = `
        <div class="upload-item-row">
          <img class="upload-thumb" src="${item.objectUrl}" alt="Preview of ${item.name}" />
          <div class="upload-item-body">
            <div class="upload-item-top">
              <input type="text" class="upload-name-input" value="${item.name.replace(/"/g, '&quot;')}"
                     ${canEdit ? '' : 'disabled'} data-id="${item.id}" />
              <span class="upload-status" data-status-id="${item.id}">${statusLabel}</span>
            </div>
            <div class="upload-bar-track">
              <div class="upload-bar-fill ${item.status === 'error' || item.status === 'cancelled' ? 'upload-bar-error' : ''}"
                   data-bar-id="${item.id}"
                   style="width:${item.status === 'done' || item.status === 'error' || item.status === 'cancelled' ? '100' : '0'}%;"></div>
            </div>
          </div>
          <div class="upload-item-actions">
            ${item.status === 'uploading'
              ? `<button type="button" class="upload-cancel-one" data-cancel-id="${item.id}" title="Cancel this upload">Cancel</button>`
              : `<button type="button" class="upload-remove-one" data-remove-id="${item.id}" title="Remove from list">✕</button>`}
          </div>
        </div>
      `;
      uploadList.appendChild(li);
    });

    uploadList.querySelectorAll('.upload-name-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const id = Number(e.target.dataset.id);
        const item = queue.find((q) => q.id === id);
        if (item) item.name = e.target.value;
      });
    });
    uploadList.querySelectorAll('.upload-remove-one').forEach((btn) => {
      btn.addEventListener('click', (e) => removeQueueItem(Number(e.target.dataset.removeId)));
    });
    uploadList.querySelectorAll('.upload-cancel-one').forEach((btn) => {
      btn.addEventListener('click', (e) => cancelQueueItem(Number(e.target.dataset.cancelId)));
    });

    const readyCount = queue.filter((q) => q.status === 'ready').length;
    uploadBtn.disabled = readyCount === 0 || isUploading;
    dropzoneText.textContent = queue.length
      ? `${queue.length} photo(s) in list — add more, edit names, or upload`
      : 'Tap to choose photos, or drag & drop here';
  }

  // ---------------- upload ----------------

  function xhrUpload(payload, item, statusEl, barEl) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      item.xhr = xhr;

      xhr.open('POST', '/api/upload', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('x-admin-password', password);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          const b = barEl(), s = statusEl();
          if (b) b.style.width = pct + '%';
          if (s) s.textContent = pct < 100 ? `Uploading… ${pct}%` : 'Finishing…';
        }
      });

      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300) {
          item.status = 'done';
          const b = barEl(); if (b) b.style.width = '100%';
          const s = statusEl(); if (s) s.textContent = '✓ Uploaded';
        } else {
          item.status = 'error';
          const b = barEl(); if (b) { b.style.width = '100%'; b.classList.add('upload-bar-error'); }
          const s = statusEl(); if (s) s.textContent = `✕ ${data.error || `Upload failed (HTTP ${xhr.status})`}`;
        }
        item.xhr = null;
        resolve();
      };

      xhr.onabort = () => {
        item.status = 'cancelled';
        item.xhr = null;
        const s = statusEl(); if (s) s.textContent = 'Cancelled';
        const b = barEl(); if (b) { b.style.width = '100%'; b.classList.add('upload-bar-error'); }
        resolve();
      };

      xhr.onerror = () => {
        item.status = 'error';
        item.xhr = null;
        const s = statusEl(); if (s) s.textContent = '✕ Network error — could not reach the server';
        const b = barEl(); if (b) { b.style.width = '100%'; b.classList.add('upload-bar-error'); }
        resolve();
      };

      xhr.send(JSON.stringify(payload));
    });
  }

  async function uploadOne(item, albumSlug) {
    const statusEl = () => uploadList.querySelector(`[data-status-id="${item.id}"]`);
    const barEl = () => uploadList.querySelector(`[data-bar-id="${item.id}"]`);

    item.status = 'uploading';
    renderFileList();
    let s = statusEl(); if (s) s.textContent = 'Compressing…';

    let prepared;
    try {
      prepared = await prepareForUpload(item.file);
    } catch (err) {
      item.status = 'error';
      s = statusEl(); if (s) s.textContent = `✕ ${err.message || 'Could not process photo'}`;
      const b = barEl(); if (b) { b.style.width = '100%'; b.classList.add('upload-bar-error'); }
      renderFileList();
      return;
    }

    let safeName = sanitizeName(item.name || item.file.name);
    if (prepared.renamedJpeg && !/\.jpe?g$/i.test(safeName)) {
      safeName = safeName.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg';
    }
    const contentType = prepared.renamedJpeg ? 'image/jpeg' : (item.file.type || 'application/octet-stream');

    s = statusEl(); if (s) s.textContent = 'Encoding…';
    let dataBase64;
    try {
      dataBase64 = await blobToBase64(prepared.blob);
    } catch (err) {
      item.status = 'error';
      s = statusEl(); if (s) s.textContent = `✕ ${err.message || 'Could not prepare photo for upload'}`;
      const b = barEl(); if (b) { b.style.width = '100%'; b.classList.add('upload-bar-error'); }
      renderFileList();
      return;
    }

    const payload = { album: albumSlug, filename: safeName, contentType, dataBase64 };
    await xhrUpload(payload, item, statusEl, barEl);
    renderFileList();
  }

  async function uploadAll() {
    const albumSlug = albumSelect.value || slugify(newAlbumInput.value || '');
    if (!albumSlug) {
      alert('Please choose or type an album name first.');
      return;
    }
    const toUpload = queue.filter((q) => q.status === 'ready');
    if (toUpload.length === 0) return;

    isUploading = true;
    batchCancelled = false;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading…';
    if (cancelAllBtn) cancelAllBtn.style.display = 'inline-block';

    for (let i = 0; i < toUpload.length; i++) {
      if (batchCancelled) break;
      if (overallStatus) overallStatus.textContent = `Uploading photo ${i + 1} of ${toUpload.length}…`;
      await uploadOne(toUpload[i], albumSlug);
    }

    if (overallStatus) {
      overallStatus.textContent = batchCancelled
        ? 'Upload batch cancelled.'
        : `Done — ${toUpload.length} photo(s) processed.`;
    }

    isUploading = false;
    uploadBtn.textContent = 'Upload Photos';
    if (cancelAllBtn) cancelAllBtn.style.display = 'none';

    queue.filter((q) => q.status === 'done').forEach((q) => URL.revokeObjectURL(q.objectUrl));
    queue = queue.filter((q) => q.status !== 'done');
    renderFileList();

    newAlbumInput.value = '';
    await refreshAlbums();
    const opt = Array.from(albumSelect.options).find((o) => o.value === albumSlug);
    if (opt) albumSelect.value = albumSlug;
    renderManageGrid();
  }

  function cancelAllUploads() {
    batchCancelled = true;
    queue.filter((q) => q.status === 'uploading' && q.xhr).forEach((q) => q.xhr.abort());
  }

  unlockBtn.addEventListener('click', unlock);
  passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });

  fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  uploadBtn.addEventListener('click', uploadAll);
  if (cancelAllBtn) cancelAllBtn.addEventListener('click', cancelAllUploads);
  albumSelect.addEventListener('change', () => { newAlbumInput.value = ''; renderManageGrid(); });
  newAlbumInput.addEventListener('input', () => { if (newAlbumInput.value) albumSelect.value = ''; renderManageGrid(); });

  if (password) {
    gate.style.display = 'none';
    panel.style.display = 'block';
    refreshAlbums();
  }
})();
