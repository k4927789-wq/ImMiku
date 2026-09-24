/* ImMiku — subida a Catbox, historial en localStorage */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const size = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const MAX_MB = 200;
const fmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2000);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('💚 Enlace copiado'); }
  catch { prompt('Copia el enlace:', text); }
}

/* ---------- subida ---------- */
const drop = $('#drop'), input = $('#file');

$('#pick').onclick = () => input.click();
input.onchange = () => { addFiles(input.files); input.value = ''; };
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });

function addFiles(files) {
  [...files].forEach(f => {
    if (f.size > MAX_MB * 1048576) return toast('"' + f.name + '" supera ' + MAX_MB + ' MB');
    upload(f);
  });
}

function thumbOf(f) {
  if (f.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.className = 'thumb'; img.src = URL.createObjectURL(f); img.alt = 'vista previa';
    return img;
  }
  return null;
}

async function upload(file) {
  const li = document.createElement('li');
  li.className = 'q';
  li.innerHTML = `<b>${esc(file.name)}</b><small>${size(file.size)} · subiendo…</small>
    <div class="bar"><i></i></div>`;
  const th = thumbOf(file);
  if (th) li.append(th);
  $('#queue').prepend(li);

  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', file);

  const x = new XMLHttpRequest();
  x.open('POST', 'https://catbox.moe/user/api.php');
  x.upload.onprogress = e => { if (e.lengthComputable) li.querySelector('i').style.width = (e.loaded / e.total * 100) + '%'; };
  x.onload = () => {
    const url = (x.responseText || '').trim();
    li.querySelector('.bar').remove();
    if (x.status !== 200 || !/^https?:\/\//.test(url)) {
      li.classList.add('fail');
      li.querySelector('small').textContent = 'No se pudo subir 😢 inténtalo de nuevo';
      return;
    }
    li.classList.add('done');
    li.querySelector('small').textContent = size(file.size) + ' · enlace permanente 💚';
    const u = document.createElement('div'); u.className = 'url';
    u.innerHTML = `<input readonly value="${esc(url)}" aria-label="Enlace"><button class="btn solid small">Copiar</button>`;
    u.querySelector('input').onfocus = e => e.target.select();
    u.querySelector('button').onclick = () => copy(url);
    li.append(u);
    saveHist({ name: file.name, url, size: file.size, ts: Date.now() });
    toast('🎧 ¡Subido! Aquí tienes tu enlace');
  };
  x.onerror = () => {
    li.classList.add('fail');
    li.querySelector('small').textContent = 'Error de conexión';
    li.querySelector('.bar').remove();
  };
  x.send(fd);
}

/* ---------- historial ---------- */
const KEY = 'immiku-hist';
const getHist = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
function saveHist(item) {
  const h = getHist(); h.unshift(item);
  localStorage.setItem(KEY, JSON.stringify(h.slice(0, 50)));
  loadHist();
}
function loadHist() {
  const h = getHist();
  $('#clear').hidden = !h.length;
  $('#list').innerHTML = h.length ? h.map(f => `
    <div class="row" data-url="${esc(f.url)}">
      <div class="n">${esc(f.name)}<small>${fmt.format(new Date(f.ts))}</small></div>
      <div class="s">${size(f.size)}</div>
      <div class="acts">
        <button class="link" data-a="copy">Copiar enlace</button>
        <a class="link" href="${esc(f.url)}" target="_blank" rel="noopener">Abrir</a>
        <button class="link" data-a="del">Quitar</button>
      </div>
    </div>`).join('')
    : '<p class="empty">Todavía no tienes enlaces. ¡Sube una foto o video de Miku y aparecerá aquí! 💚</p>';
}
$('#list').onclick = e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const row = b.closest('.row');
  if (b.dataset.a === 'copy') return copy(row.dataset.url);
  const h = getHist().filter(f => f.url !== row.dataset.url);
  localStorage.setItem(KEY, JSON.stringify(h));
  loadHist(); toast('Enlace quitado del historial');
};
$('#clear').onclick = () => { localStorage.removeItem(KEY); loadHist(); toast('Historial vaciado'); };

loadHist();
