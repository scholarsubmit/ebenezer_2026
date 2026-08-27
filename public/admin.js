(function () {
  const gate = document.getElementById('gate');
  const panel = document.getElementById('panel');
  const passwordInput = document.getElementById('password-input');
  const unlockBtn = document.getElementById('unlock-btn');
  const gateError = document.getElementById('gate-error');

  const albumSelect = document.getElementById('album-select');
  const manageAlbumSelect = document.getElementById('manage-album-select');
  const newAlbumInput = document.getElementById('new-album-input');
  const dropzone = document.getElementById('dropzone');
  const dropzoneText = document.getElementById('dropzone-text');
  const fileInput = document.getElementById('file-input');
  const uploadList = document.getElementById('upload-list');
  const uploadBtn = document.getElementById('upload-btn');
  const cancelAllBtn = document.getElementById('cancel-all-btn');
  const overallStatus = document.getElementById('overall-status');
  const manageGrid = document.getElementById('manage-grid');
  const storageValueEl = document.getElementById('storage-value');
  const storageSubEl = document.getElementById('storage-sub');
  const navLinks = document.querySelectorAll('.admin-nav-link[data-panel]');
  const panels = {
    upload: document.getElementById('panel-upload'),
    manage: document.getElementById('panel-manage'),
    submissions: document.getElementById('panel-submissions'),
    speakers: document.getElementById('panel-speakers'),
  };
  const submissionsGrid = document.getElementById('submissions-grid');
  const submissionsBadge = document.getElementById('submissions-badge');
  const toastContainer = document.getElementById('toast-container');
  const confirmOverlay = document.getElementById('confirm-overlay');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmOkBtn = document.getElementById('confirm-ok');
  const confirmCancelBtn = document.getElementById('confirm-cancel');

  // ---------------- in-page notifications (no native alert/confirm) ----------------

  function showToast(message, type = 'info', duration = 4500) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${message}</span><button type="button" class="toast-close" aria-label="Dismiss">✕</button>`;
    const remove = () => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 150);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    toastContainer.appendChild(el);
    setTimeout(remove, duration);
  }

  function showConfirm(message) {
    return new Promise((resolve) => {
      confirmMessage.textContent = message;
      confirmOverlay.classList.add('open');

      const cleanup = (result) => {
        confirmOverlay.classList.remove('open');
        confirmOkBtn.removeEventListener('click', onOk);
        confirmCancelBtn.removeEventListener('click', onCancel);
        confirmOverlay.removeEventListener('click', onOverlay);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onOverlay = (e) => { if (e.target === confirmOverlay) cleanup(false); };

      confirmOkBtn.addEventListener('click', onOk);
      confirmCancelBtn.addEventListener('click', onCancel);
      confirmOverlay.addEventListener('click', onOverlay);
    });
  }

  // ---------------- sidebar panel switching ----------------

  function switchPanel(name) {
    Object.entries(panels).forEach(([key, el]) => {
      if (el) el.style.display = key === name ? '' : 'none';
    });
    navLinks.forEach((btn) => btn.classList.toggle('active', btn.dataset.panel === name));
    if (name === 'speakers') refreshSpeakers();
    if (name === 'submissions') refreshSubmissions();
  }
  navLinks.forEach((btn) => btn.addEventListener('click', () => switchPanel(btn.dataset.panel)));

  // ---------------- storage widget (real numbers from Blob metadata) ----------------

  function formatBytes(bytes) {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  function updateStorageWidget() {
    if (!storageValueEl) return;
    let totalBytes = 0;
    let totalPhotos = 0;
    currentAlbums.forEach((a) => a.photos.forEach((p) => { totalBytes += p.size || 0; totalPhotos++; }));
    storageValueEl.textContent = formatBytes(totalBytes);
    storageSubEl.textContent = `${totalPhotos} photo${totalPhotos === 1 ? '' : 's'} across ${currentAlbums.length} session${currentAlbums.length === 1 ? '' : 's'}`;
  }

  let password = sessionStorage.getItem('ebenezer_admin_pw') || '';
  let currentAlbums = [];
  let isUploading = false;
  let batchCancelled = false;

  // Each queued file is tracked as an object, not a raw File, so we can
  // attach a thumbnail, an editable name, per-item status, and (while
  // uploading) a live XHR reference we can abort.
  let queue = []; // { id, file, name, objectUrl, status, xhr }
  let nextId = 1;

  // Compression, base64 encoding, and name-sanitizing helpers are shared
  // with the public submission page — see img-compress.js.
  const { slugify, sanitizeName, prepareForUpload, blobToBase64 } = window.CAC_IMG;

  async function fetchGallery() {
    const res = await fetch('/api/gallery', { cache: 'no-store' });
    const data = await res.json();
    currentAlbums = data.albums || [];
    return currentAlbums;
  }

  function populateAlbumSelect() {
    const prevValue = albumSelect.value;
    const prevManageValue = manageAlbumSelect ? manageAlbumSelect.value : '';

    albumSelect.innerHTML = '<option value="">— Select existing session —</option>';
    if (manageAlbumSelect) manageAlbumSelect.innerHTML = '<option value="">— Select a session —</option>';

    currentAlbums.forEach((a) => {
      const label = `${a.title} (${a.count})`;
      const opt = document.createElement('option');
      opt.value = a.slug;
      opt.textContent = label;
      albumSelect.appendChild(opt);

      if (manageAlbumSelect) {
        const opt2 = document.createElement('option');
        opt2.value = a.slug;
        opt2.textContent = label;
        manageAlbumSelect.appendChild(opt2);
      }
    });

    if (currentAlbums.some((a) => a.slug === prevValue)) albumSelect.value = prevValue;
    if (manageAlbumSelect && currentAlbums.some((a) => a.slug === prevManageValue)) {
      manageAlbumSelect.value = prevManageValue;
    }
  }

  function renderManageGrid() {
    const chosenSlug = manageAlbumSelect ? manageAlbumSelect.value : '';
    const album = currentAlbums.find((a) => a.slug === chosenSlug);
    manageGrid.innerHTML = '';
    if (!chosenSlug) {
      manageGrid.innerHTML = '<p class="admin-hint">Choose a session above to see its photos.</p>';
      return;
    }
    if (!album || !album.photos.length) {
      manageGrid.innerHTML = '<p class="admin-hint">No photos in this session yet.</p>';
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
    const ok = await showConfirm('Remove this photo permanently? This cannot be undone.');
    if (!ok) return;
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
      showToast('Photo removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete this photo.', 'error');
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
      fetchSubmissions().then((subs) => updateSubmissionsBadge(subs.length));
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
    updateStorageWidget();
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
      showToast('Please choose or type an album name first.', 'error');
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

    if (!batchCancelled) {
      const doneCount = toUpload.filter((q) => q.status === 'done').length;
      const failCount = toUpload.length - doneCount;
      if (failCount === 0) {
        showToast(`${doneCount} photo${doneCount === 1 ? '' : 's'} uploaded successfully.`, 'success');
      } else if (doneCount === 0) {
        showToast(`Upload failed for all ${failCount} photo(s). Check the message next to each one.`, 'error');
      } else {
        showToast(`${doneCount} uploaded, ${failCount} failed — check the messages below.`, 'error');
      }
    } else {
      showToast('Upload batch cancelled.', 'info');
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
    if (manageAlbumSelect) {
      const opt2 = Array.from(manageAlbumSelect.options).find((o) => o.value === albumSlug);
      if (opt2) manageAlbumSelect.value = albumSlug;
    }
    renderManageGrid();
  }

  function cancelAllUploads() {
    batchCancelled = true;
    queue.filter((q) => q.status === 'uploading' && q.xhr).forEach((q) => q.xhr.abort());
  }

  // ---------------- Speaker management ----------------

  const speakerNameInput = document.getElementById('speaker-name-input');
  const speakerTitleInput = document.getElementById('speaker-title-input');
  const speakerTagInput = document.getElementById('speaker-tag-input');
  const speakerBioInput = document.getElementById('speaker-bio-input');
  const speakerDropzone = document.getElementById('speaker-dropzone');
  const speakerDropzoneText = document.getElementById('speaker-dropzone-text');
  const speakerFileInput = document.getElementById('speaker-file-input');
  const speakerPreviewWrap = document.getElementById('speaker-preview-wrap');
  const speakerPreviewImg = document.getElementById('speaker-preview-img');
  const speakerSaveBtn = document.getElementById('speaker-save-btn');
  const speakersManageGrid = document.getElementById('speakers-manage-grid');

  let speakerFile = null;

  function updateSpeakerSaveState() {
    if (speakerSaveBtn) speakerSaveBtn.disabled = !(speakerNameInput.value.trim() && speakerFile);
  }

  function setSpeakerFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    speakerFile = file;
    speakerPreviewImg.src = URL.createObjectURL(file);
    speakerPreviewWrap.style.display = 'block';
    speakerDropzoneText.textContent = file.name;
    updateSpeakerSaveState();
  }

  if (speakerFileInput) {
    speakerFileInput.addEventListener('change', (e) => setSpeakerFile(e.target.files[0]));
  }
  if (speakerDropzone) {
    ['dragenter', 'dragover'].forEach((evt) =>
      speakerDropzone.addEventListener(evt, (e) => { e.preventDefault(); speakerDropzone.classList.add('dragover'); })
    );
    ['dragleave', 'drop'].forEach((evt) =>
      speakerDropzone.addEventListener(evt, (e) => { e.preventDefault(); speakerDropzone.classList.remove('dragover'); })
    );
    speakerDropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length) setSpeakerFile(e.dataTransfer.files[0]);
    });
  }
  if (speakerNameInput) speakerNameInput.addEventListener('input', updateSpeakerSaveState);

  async function fetchSpeakers() {
    try {
      const res = await fetch('/api/speakers', { cache: 'no-store' });
      const data = await res.json();
      return data.speakers || [];
    } catch (e) {
      return [];
    }
  }

  async function refreshSpeakers() {
    const speakers = await fetchSpeakers();
    speakersManageGrid.innerHTML = '';
    if (speakers.length === 0) {
      speakersManageGrid.innerHTML = '<p class="admin-hint">No speakers added yet.</p>';
      return;
    }
    speakers.forEach((s) => {
      const cell = document.createElement('div');
      cell.className = 'manage-cell';
      cell.innerHTML = `
        <img src="${s.photoUrl}" alt="${s.name}" loading="lazy" />
        <button type="button" class="manage-delete" title="Delete speaker">Delete</button>
      `;
      cell.querySelector('.manage-delete').addEventListener('click', () => deleteSpeaker(s.id, s.name, cell));
      speakersManageGrid.appendChild(cell);
    });
  }

  async function deleteSpeaker(id, name, cellEl) {
    const ok = await showConfirm(`Remove ${name} from the speakers list? This cannot be undone.`);
    if (!ok) return;
    cellEl.style.opacity = '0.4';
    try {
      const res = await fetch('/api/speakers-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      cellEl.remove();
      showToast(`${name} removed.`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete this speaker.', 'error');
      cellEl.style.opacity = '1';
    }
  }

  if (speakerSaveBtn) {
    speakerSaveBtn.addEventListener('click', async () => {
      const name = speakerNameInput.value.trim();
      if (!name || !speakerFile) return;

      speakerSaveBtn.disabled = true;
      speakerSaveBtn.textContent = 'Saving…';

      try {
        const prepared = await prepareForUpload(speakerFile);
        const dataBase64 = await blobToBase64(prepared.blob);
        const contentType = prepared.renamedJpeg ? 'image/jpeg' : (speakerFile.type || 'image/jpeg');

        const res = await fetch('/api/speakers-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
          body: JSON.stringify({
            name,
            title: speakerTitleInput.value.trim(),
            tag: speakerTagInput.value.trim(),
            bio: speakerBioInput.value.trim(),
            contentType,
            dataBase64,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save speaker');

        showToast(`${name} added.`, 'success');
        speakerNameInput.value = '';
        speakerTitleInput.value = '';
        speakerTagInput.value = '';
        speakerBioInput.value = '';
        speakerFile = null;
        speakerPreviewWrap.style.display = 'none';
        speakerDropzoneText.textContent = 'Tap to choose a photo, or drag & drop here';
        speakerFileInput.value = '';
        await refreshSpeakers();
      } catch (err) {
        showToast(err.message || 'Could not save speaker.', 'error');
      } finally {
        speakerSaveBtn.textContent = 'Add Speaker';
        updateSpeakerSaveState();
      }
    });
  }

  // ---------------- Submission review ----------------

  async function fetchSubmissions() {
    try {
      const res = await fetch('/api/submissions', {
        cache: 'no-store',
        headers: { 'x-admin-password': password },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load submissions');
      return data.submissions || [];
    } catch (e) {
      return [];
    }
  }

  function updateSubmissionsBadge(count) {
    if (!submissionsBadge) return;
    if (count > 0) {
      submissionsBadge.textContent = String(count);
      submissionsBadge.style.display = 'inline-flex';
    } else {
      submissionsBadge.style.display = 'none';
    }
  }

  async function refreshSubmissions() {
    const submissions = await fetchSubmissions();
    updateSubmissionsBadge(submissions.length);

    if (!submissionsGrid) return;
    submissionsGrid.innerHTML = '';
    if (submissions.length === 0) {
      submissionsGrid.innerHTML = '<p class="admin-hint">No pending submissions right now.</p>';
      return;
    }

    submissions.forEach((s) => {
      const when = s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '';
      const who = s.submitterName ? `From ${s.submitterName}` : 'Submitted anonymously';
      const card = document.createElement('div');
      card.className = 'submission-card';
      card.innerHTML = `
        <div class="thumb"><img src="${s.url}" alt="Submitted photo for ${s.album}" loading="lazy" /></div>
        <div class="info">
          <p class="album">${s.album}</p>
          <p class="meta">${who} · ${when}</p>
          <div class="submission-actions">
            <button type="button" class="submission-approve">Approve</button>
            <button type="button" class="submission-reject">Reject</button>
          </div>
        </div>
      `;
      card.querySelector('.submission-approve').addEventListener('click', () => reviewSubmission(s.id, 'approve', card));
      card.querySelector('.submission-reject').addEventListener('click', () => reviewSubmission(s.id, 'reject', card));
      submissionsGrid.appendChild(card);
    });
  }

  async function reviewSubmission(id, action, cardEl) {
    if (action === 'reject') {
      const ok = await showConfirm('Reject and permanently discard this photo?');
      if (!ok) return;
    }
    cardEl.style.opacity = '0.4';
    const endpoint = action === 'approve' ? '/api/submissions-approve' : '/api/submissions-reject';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Could not ${action} submission`);
      cardEl.remove();
      updateSubmissionsBadge((data.submissions || []).length);
      showToast(action === 'approve' ? 'Photo approved and added to the gallery.' : 'Photo rejected.', 'success');
      if (action === 'approve') await refreshAlbums();
      if (submissionsGrid && submissionsGrid.children.length === 0) {
        submissionsGrid.innerHTML = '<p class="admin-hint">No pending submissions right now.</p>';
      }
    } catch (err) {
      showToast(err.message || `Could not ${action} this submission.`, 'error');
      cardEl.style.opacity = '1';
    }
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
  albumSelect.addEventListener('change', () => { newAlbumInput.value = ''; });
  newAlbumInput.addEventListener('input', () => { if (newAlbumInput.value) albumSelect.value = ''; });
  if (manageAlbumSelect) manageAlbumSelect.addEventListener('change', renderManageGrid);

  if (password) {
    gate.style.display = 'none';
    panel.style.display = 'block';
    refreshAlbums();
    fetchSubmissions().then((subs) => updateSubmissionsBadge(subs.length));
  }
})();
