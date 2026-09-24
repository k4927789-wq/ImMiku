/* =========================================================
   ImMiku — Creado por Chizu
   Subida multi-host: Uguu → Lain.la → envs.sh → 0x0.st
   (con reintentos automáticos vía proxy si el navegador bloquea)
   ========================================================= */

const MAX_SIZE = 100 * 1024 * 1024; // ~100 MB (límite seguro entre hosts)

const HOSTS = [
  {
    name: "Uguu",
    url: "https://uguu.se/upload.php",
    field: "files[]",
    note: "⚠️ Enlace temporal: dura 3 horas (host Uguu).",
    parse(text) {
      try {
        const j = JSON.parse(text);
        const item = Array.isArray(j) ? j[0] : j;
        return item && item.url ? item.url : null;
      } catch { return /^https?:\/\//.test(text.trim()) ? text.trim() : null; }
    },
  },
  {
    name: "Lain.la",
    url: "https://pomf.lain.la/upload.php",
    field: "files[]",
    note: "✅ Enlace permanente (host Lain.la).",
    parse(text) {
      try {
        const j = JSON.parse(text);
        if (j.success && j.files && j.files[0]) {
          let u = j.files[0].url;
          if (u.startsWith("/")) u = "https://pomf.lain.la" + u;
          return u;
        }
        return null;
      } catch { return /^https?:\/\//.test(text.trim()) ? text.trim() : null; }
    },
  },
  {
    name: "envs.sh",
    url: "https://envs.sh",
    field: "file",
    note: "✅ Enlace permanente (host envs.sh).",
    parse(text) { return /^https?:\/\/\S+$/.test(text.trim()) ? text.trim() : null; },
  },
  {
    name: "0x0.st",
    url: "https://0x0.st",
    field: "file",
    note: "✅ Enlace permanente mientras haya actividad (host 0x0.st).",
    parse(text) { return /^https?:\/\/\S+$/.test(text.trim()) ? text.trim() : null; },
  },
];

const PROXIES = [
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
];

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
const resultNote = $("resultNote");
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
    showError("⚠️ El archivo supera los ~100 MB. Prueba con uno más liviano.");
    return;
  }
  hideError();
  currentFile = file;
  fpName.textContent = file.name;
  fpSize.textContent = formatBytes(file.size);
  filePreview.hidden = false;
  result.hidden = true;
}

/* ---------- Subida multi-host ---------- */
btnUpload.addEventListener("click", () => {
  if (!currentFile) return;
  hideError();
  setUploading(true);
  setProgress(0);

  uploadWithFallback(currentFile, {
    onProgress: setProgress,
    onSuccess: (url, host) => {
      setProgress(100);
      showResult(url, currentFile, host);
      saveToHistory(currentFile.name, url);
      showToast("✅ ¡Subida completada con " + host.name + "!");
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

/** Recorre los hosts; en cada uno intenta directo y luego por proxy. */
function uploadWithFallback(file, handlers, hostIdx = 0, proxyIdx = -1) {
  if (hostIdx >= HOSTS.length) {
    handlers.onError(
      "❌ Ningún host disponible. Revisa tu internet, desactiva el adblock para esta página e intenta de nuevo."
    );
    return;
  }
  const host = HOSTS[hostIdx];
  const viaProxy = proxyIdx >= 0;
  const endpoint = viaProxy ? PROXIES[proxyIdx](host.url) : host.url;

  const formData = new FormData();
  formData.append(host.field, file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", endpoint, true);
  xhr.timeout = 300000; // 5 min

  if (!viaProxy) {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) handlers.onProgress(Math.round((e.loaded / e.total) * 100));
    });
  } else {
    fakeProgress(handlers.onProgress);
  }

  xhr.addEventListener("load", () => {
    stopFakeProgress();
    const resp = (xhr.responseText || "").trim();
    const url = host.parse(resp);

    if (xhr.status >= 200 && xhr.status < 300 && url) {
      handlers.onSuccess(url, host);
      return;
    }

    // El host respondió pero con error (ej. tipo prohibido)
    if (xhr.status >= 200 && xhr.status < 300 && resp && !url) {
      handlers.onError("❌ " + host.name + " rechazó el archivo: " + resp.slice(0, 160) +
        (resp.toLowerCase().includes("extension") || resp.toLowerCase().includes("banned")
          ? " (prueba comprimirlo en .zip)" : ""));
      return;
    }

    nextRoute();
  });

  xhr.addEventListener("error", () => { stopFakeProgress(); nextRoute(); });
  xhr.addEventListener("timeout", () => {
    stopFakeProgress();
    handlers.onError("⏱️ La subida tardó demasiado. Intenta con un archivo más liviano.");
  });

  function nextRoute() {
    if (!viaProxy) {
      uploadWithFallback(file, handlers, hostIdx, 0); // mismo host vía proxy 1
    } else if (proxyIdx + 1 < PROXIES.length) {
      uploadWithFallback(file, handlers, hostIdx, proxyIdx + 1); // proxy 2
    } else {
      uploadWithFallback(file, handlers, hostIdx + 1, -1); // siguiente host
    }
  }

  xhr.send(formData);
}

/* Barra indeterminada cuando usamos proxy (no hay eventos de progreso) */
let fakeTimer = null;
function fakeProgress(onProgress) {
  let p = 5;
  onProgress(p);
  fakeTimer = setInterval(() => {
    p = Math.min(p + Math.random() * 4, 92);
    onProgress(Math.round(p));
  }, 400);
}
function stopFakeProgress() {
  if (fakeTimer) { clearInterval(fakeTimer); fakeTimer = null; }
}

/* ---------- Resultado ---------- */
function showResult(url, file, host) {
  result.hidden = false;
  resultUrl.value = url;
  if (resultNote) {
    resultNote.textContent = host.note;
    resultNote.hidden = false;
  }
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
  a.textContent = url.replace(/^https?:\/\//, "");

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
