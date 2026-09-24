/* =========================================================
   ImMiku — Creado por Chizu
   Subida de archivos mediante la API pública de CatBox
   ========================================================= */

const CATBOX_API = "https://catbox.moe/user/api.php";
const PROXIES = [
  (url) => "https://corsproxy.io/?url=" + encodeURIComponent(url),
  (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
];
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

const $ = (id) => document.getElementById(id);
const dropzone   = $("dropzone");
const fileInput  = $("fileInput");
const filePreview= $("filePreview");
const fpName     = $("fpName");
const fpSize     = $("fpSize");
const btnUpload  = $("btnUpload");
const progressWrap = $("progressWrap");
const progressFill = $("progressFill");
const progressText = $("progressText");
const result     = $("result");
const resultUrl  = $("resultUrl");
const resultEmbed= $("resultEmbed");
const btnCopy    = $("btnCopy");
const errorMsg   = $("errorMsg");
const toast      = $("toast");

let currentFile = null;

/* ---------- Selección de archivo ---------- */
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) selectFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) selectFile(file);
});

function selectFile(file) {
  if (file.size > MAX_SIZE) {
    showError("⚠️ El archivo supera los 200 MB permitidos por CatBox.");
    return;
  }
  hideError();
  currentFile = file;
  fpName.textContent = file.name;
  fpSize.textContent = formatBytes(file.size);
  filePreview.hidden = false;
  result.hidden = true;
}

/* ---------- Subida a CatBox (directo, con respaldo por proxy) ---------- */
btnUpload.addEventListener("click", () => {
  if (!currentFile) return;
  hideError();
  setUploading(true);
  setProgress(0);
  uploadToCatBox(currentFile, {
    onProgress: setProgress,
    onSuccess: (url) => {
      setProgress(100);
      showResult(url, currentFile);
      saveToHistory(currentFile.name, url);
      showToast("✅ ¡Subida completada!");
      currentFile = null;
      fileInput.value = "";
      setUploading(false);
    },
    onError: (msg) => {
      setUploading(false);
      progressWrap.hidden = true;
      showError(msg);
    },
  });
});

function setUploading(state) {
  btnUpload.disabled = state;
  btnUpload.textContent = state ? "Subiendo…" : "Subir ahora ✨";
  if (state) { progressWrap.hidden = false; result.hidden = true; }
}

/**
 * Intenta la subida directa a CatBox. Si el navegador la bloquea
 * (CORS, adblock, firewall → status 0), reintenta automáticamente
 * a través de proxies CORS públicos hasta que una funcione.
 */
function uploadToCatBox(file, { onProgress, onSuccess, onError }, attempt = 0) {
  const direct = attempt === 0;
  const endpoint = direct ? CATBOX_API : PROXIES[attempt - 1](CATBOX_API);

  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("fileToUpload", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", endpoint, true);
  xhr.timeout = 300000; // 5 min

  if (direct) {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
  } else {
    // A través del proxy no hay eventos de progreso: mostramos animación indeterminada
    fakeProgress(onProgress);
  }

  xhr.addEventListener("load", () => {
    stopFakeProgress();
    const resp = (xhr.responseText || "").trim();

    if (xhr.status >= 200 && xhr.status < 300 && isCatBoxUrl(resp)) {
      onSuccess(resp);
      return;
    }

    // ¿La respuesta es un error de CatBox (ej. tipo de archivo prohibido)?
    if (xhr.status >= 200 && xhr.status < 300 && resp && !isCatBoxUrl(resp)) {
      stopFakeProgress();
      onError("❌ CatBox rechazó el archivo: " + resp + " (si es .exe/.scr/.bat, prueba comprimirlo en .zip o .7z)");
      return;
    }

    // Bloqueo de red/CORS → probar siguiente ruta
    if (attempt < PROXIES.length) {
      uploadToCatBox(file, { onProgress, onSuccess, onError }, attempt + 1);
    } else {
      onError(buildFailMsg(xhr));
    }
  });

  xhr.addEventListener("error", () => {
    stopFakeProgress();
    if (attempt < PROXIES.length) {
      uploadToCatBox(file, { onProgress, onSuccess, onError }, attempt + 1);
    } else {
      onError("❌ No se pudo conectar con CatBox. Revisa tu internet, desactiva el adblock para esta página e intenta de nuevo.");
    }
  });

  xhr.addEventListener("timeout", () => {
    stopFakeProgress();
    onError("⏱️ La subida tardó demasiado (más de 5 min). Intenta con un archivo más liviano.");
  });

  xhr.send(formData);
}

function isCatBoxUrl(text) {
  return /^https?:\/\/(files\.)?catbox\.moe\//i.test(text);
}

function buildFailMsg(xhr) {
  let detail = "";
  try { detail = (xhr.responseText || "").trim().slice(0, 200); } catch {}
  return "❌ Falló la subida (HTTP " + xhr.status + (detail ? ": " + detail : "") +
         "). Desactiva extensiones (adblock/VPN) y recarga la página.";
}

/* Barra de progreso "indeterminada" para cuando usamos proxy */
let fakeTimer = null;
function fakeProgress(onProgress) {
  let p = 5;
  onProgress(p);
  fakeTimer = setInterval(() => {
    p = Math.min(p + Math.random() * 4, 92); // nunca llega al 100 hasta confirmar
    onProgress(Math.round(p));
  }, 400);
}
function stopFakeProgress() {
  if (fakeTimer) { clearInterval(fakeTimer); fakeTimer = null; }
}

/* ---------- Resultado ---------- */
function showResult(url, file) {
  result.hidden = false;
  resultUrl.value = url;
  resultEmbed.innerHTML = "";
  resultEmbed.hidden = true;

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = url; img.alt = file.name;
    resultEmbed.appendChild(img); resultEmbed.hidden = false;
  } else if (file.type.startsWith("video/")) {
    const vid = document.createElement("video");
    vid.src = url; vid.controls = true;
    resultEmbed.appendChild(vid); resultEmbed.hidden = false;
  }
  result.scrollIntoView({ behavior: "smooth", block: "center" });
}

btnCopy.addEventListener("click", () => copyText(resultUrl.value));

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("📋 ¡Enlace copiado!");
  } catch {
    resultUrl.select();
    document.execCommand("copy");
    showToast("📋 ¡Enlace copiado!");
  }
}

/* ---------- Historial local ---------- */
const HISTORY_KEY = "immiku_history";
const historyList = $("historyList");
const historyEmpty = $("historyEmpty");

function loadHistory() {
  const items = getHistory();
  historyList.innerHTML = "";
  historyEmpty.hidden = items.length > 0;
  items.forEach((item) => historyList.appendChild(renderHistoryItem(item)));
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveToHistory(name, url) {
  const items = getHistory();
  items.unshift({ name, url, date: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
  loadHistory();
}
function renderHistoryItem({ name, url }) {
  const li = document.createElement("li");

  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(url)) {
    const img = document.createElement("img");
    img.src = url; img.className = "h-thumb"; img.loading = "lazy"; img.alt = "";
    li.appendChild(img);
  }
  const span = document.createElement("span");
  span.className = "h-name"; span.textContent = name; span.title = name;

  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  a.textContent = url.replace("https://", "");

  const btn = document.createElement("button");
  btn.className = "h-copy"; btn.textContent = "Copiar";
  btn.addEventListener("click", () => copyText(url));

  li.append(span, a, btn);
  return li;
}
$("btnClear").addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  loadHistory();
  showToast("🧹 Historial limpiado");
});
loadHistory();

/* ---------- Utilidades ---------- */
function setProgress(p) {
  progressFill.style.width = p + "%";
  progressText.textContent = p + "%";
}
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}
function hideError() { errorMsg.hidden = true; }
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => (toast.hidden = true), 300);
  }, 2500);
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}
