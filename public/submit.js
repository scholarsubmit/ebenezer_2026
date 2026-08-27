(function () {
  const toastContainer = document.getElementById('toast-container');
  const submitterNameInput = document.getElementById('submitter-name-input');
  const submitPasswordInput = document.getElementById('submit-password-input');
  const websiteInput = document.getElementById('website-input'); // honeypot
  const albumSelect = document.getElementById('album-select');
  const newAlbumInput = document.getElementById('new-album-input');
  const dropzone = document.getElementById('dropzone');
  const dropzoneText = document.getElementById('dropzone-text');
  const fileInput = document.getElementById('file-input');
  const uploadList = document.getElementById('upload-list');
  const overallStatus = document.getElementById('overall-status');
  const submitBtn = document.getElementById('submit-btn');

  const { slugify, sanitizeName, prepareForUpload, blobToBase64 } = window.CAC_IMG;

  let queue = []; // { id, file, name, objectUrl, status }
  let nextId = 1;

  function showToast(message, type = 'info', duration = 5000) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${message}</span><button type="button" class="toast-close" aria-label="Dismiss">✕</button>`;
    const remove = () => { el.style.opacity = '0'; setTimeout(() => el.remove(), 150); };
    el.querySelector('.toast-close').addEventListener('click', remove);
    toastContainer.appendChild(el);
    setTimeout(remove, duration);
  }

  // ---------------- populate sessions dropdown from the real gallery ----------------
  (async function loadAlbums() {
    try {
      const res = await fetch('/api/gallery', { cache: 'no-store' });
      const data = await res.json();
      (data.albums || []).forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a.slug;
        opt.textContent = a.title;
        albumSelect.appendChild(opt);
      });
    } catch (e) { /* dropdown just stays with the default option */ }
  })();

  // ---------------- file queue ----------------
  function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    files.forEach((file) => {
      queue.push({ id: nextId++, file, name: file.name, objectUrl: URL.createObjectURL(file), status: 'ready' });
    });
    renderFileList();
  }

  function removeQueueItem(id) {
    const item = queue.find((q) => q.id === id);
    if (!item || item.status === 'uploading') return;
    URL.revokeObjectURL(item.objectUrl);
    queue = queue.filter((q) => q.id !== id);
    renderFileList();
  }

  function renderFileList() {
    uploadList.innerHTML = '';
    queue.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'upload-item';
      const statusLabel = { ready: 'Ready', uploading: 'Sending…', done: '✓ Submitted', error: '✕ Failed' }[item.status];
      li.innerHTML = `
        <div class="upload-item-row">
          <img class="upload-thumb" src="${item.objectUrl}" alt="Preview" />
          <div class="upload-item-body">
            <div class="upload-item-top">
              <span class="upload-name">${item.name}</span>
              <span class="upload-status" data-status-id="${item.id}">${statusLabel}</span>
            </div>
            <div class="upload-bar-track"><div class="upload-bar-fill ${item.status === 'error' ? 'upload-bar-error' : ''}" data-bar-id="${item.id}" style="width:${item.status === 'done' || item.status === 'error' ? '100' : '0'}%;"></div></div>
          </div>
          <div class="upload-item-actions">
            ${item.status === 'ready' ? `<button type="button" class="upload-remove-one" data-remove-id="${item.id}">✕</button>` : ''}
          </div>
        </div>
      `;
      uploadList.appendChild(li);
    });
    uploadList.querySelectorAll('.upload-remove-one').forEach((btn) => {
      btn.addEventListener('click', (e) => removeQueueItem(Number(e.target.dataset.removeId)));
    });
    const readyCount = queue.filter((q) => q.status === 'ready').length;
    submitBtn.disabled = readyCount === 0;
    dropzoneText.textContent = queue.length ? `${queue.length} photo(s) selected` : 'Tap to choose photos, or drag & drop here';
  }

  fileInput.addEventListener('change', (e) => addFiles(e.target.files));
  ['dragenter', 'dragover'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  // ---------------- submit ----------------
  async function submitOne(item, albumSlug, submitterName) {
    const statusEl = () => uploadList.querySelector(`[data-status-id="${item.id}"]`);
    const barEl = () => uploadList.querySelector(`[data-bar-id="${item.id}"]`);
    item.status = 'uploading';
    renderFileList();

    try {
      const prepared = await prepareForUpload(item.file);
      const dataBase64 = await blobToBase64(prepared.blob);
      const contentType = prepared.renamedJpeg ? 'image/jpeg' : (item.file.type || 'image/jpeg');
      let safeName = sanitizeName(item.name);
      if (prepared.renamedJpeg && !/\.jpe?g$/i.test(safeName)) safeName = safeName.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg';

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          album: albumSlug,
          submitterName,
          filename: safeName,
          contentType,
          dataBase64,
          password: submitPasswordInput ? submitPasswordInput.value.trim() : '',
          website: websiteInput ? websiteInput.value : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      item.status = 'done';
      const b = barEl(); if (b) b.style.width = '100%';
      const s = statusEl(); if (s) s.textContent = '✓ Submitted';
    } catch (err) {
      item.status = 'error';
      const b = barEl(); if (b) { b.style.width = '100%'; b.classList.add('upload-bar-error'); }
      const s = statusEl(); if (s) s.textContent = `✕ ${err.message || 'Failed'}`;
    }
    renderFileList();
  }

  submitBtn.addEventListener('click', async () => {
    const albumSlug = albumSelect.value || slugify(newAlbumInput.value || '');
    if (!albumSlug) { showToast('Please choose or name a session first.', 'error'); return; }
    const toSend = queue.filter((q) => q.status === 'ready');
    if (toSend.length === 0) return;

    const submitterName = submitterNameInput.value.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    for (let i = 0; i < toSend.length; i++) {
      overallStatus.textContent = `Sending photo ${i + 1} of ${toSend.length}…`;
      await submitOne(toSend[i], albumSlug, submitterName);
    }

    const doneCount = toSend.filter((q) => q.status === 'done').length;
    const failCount = toSend.length - doneCount;
    overallStatus.textContent = failCount === 0
      ? 'Thank you! Your photos have been sent for review.'
      : `${doneCount} sent, ${failCount} failed — check the messages above.`;

    if (doneCount > 0) {
      showToast(`Thank you! ${doneCount} photo${doneCount === 1 ? '' : 's'} sent to the media team for review.`, 'success', 6000);
    }
    if (failCount > 0) {
      showToast(`${failCount} photo${failCount === 1 ? '' : 's'} could not be sent — check the messages above.`, 'error');
    }

    queue.filter((q) => q.status === 'done').forEach((q) => URL.revokeObjectURL(q.objectUrl));
    queue = queue.filter((q) => q.status !== 'done');
    fileInput.value = '';
    renderFileList();

    submitBtn.textContent = 'Submit Photos for Review';
    submitBtn.disabled = queue.filter((q) => q.status === 'ready').length === 0;
  });
})();
