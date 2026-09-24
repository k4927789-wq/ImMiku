document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const fileLabel = document.getElementById('fileLabel');
    const uploadForm = document.getElementById('uploadForm');
    const loader = document.getElementById('loader');
    const resultContainer = document.getElementById('resultContainer');
    const urlResult = document.getElementById('urlResult');
    const preview = document.getElementById('preview');
    const submitBtn = document.getElementById('submitBtn');
    const copyBtn = document.getElementById('copyBtn');

    // Cambiar texto y vista previa al elegir archivo
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileLabel.innerText = "Seleccionado: " + file.name;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
            }
        }
    });

    // Subida del archivo a Catbox
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!fileInput.files.length) return;

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', fileInput.files[0]);

        submitBtn.disabled = true;
        loader.style.display = 'block';
        resultContainer.style.display = 'none';

        fetch('https://corsproxy.io/?' + encodeURIComponent('https://catbox.moe/user/api.php'), {
            method: 'POST',
            body: formData
        })
        .then(response => response.text())
        .then(url => {
            loader.style.display = 'none';
            submitBtn.disabled = false;

            if (url.startsWith('https://files.catbox.moe/')) {
                urlResult.value = url.trim();
                resultContainer.style.display = 'block';
            } else {
                alert('Error al subir el archivo: ' + url);
            }
        })
        .catch(error => {
            loader.style.display = 'none';
            submitBtn.disabled = false;
            alert('Ocurrió un error al intentar subir el archivo.');
            console.error('Error:', error);
        });
    });

    // Copiar la URL
    copyBtn.addEventListener('click', () => {
        urlResult.select();
        document.execCommand('copy');
        alert('¡Enlace copiado al portapapeles!');
    });
});

