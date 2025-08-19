
document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('status');

    dropZone.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length) {
            uploadFile(e.target.files[0]);
        }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('highlight');
    }

    function unhighlight() {
        dropZone.classList.remove('highlight');
    }

    dropZone.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];

        if (file) {
            uploadFile(file);
        }
    });

    function uploadFile(file) {
        statusDiv.textContent = 'Загрузка...';

        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                statusDiv.textContent = 'Ошибка: ' + data.error;
                statusDiv.style.color = 'red';
            } else {
                statusDiv.textContent = 'Файл успешно загружен: ' + data.info;
                statusDiv.style.color = 'green';
            }
        })
        .catch(error => {
            statusDiv.textContent = 'Ошибка: ' + error;
            statusDiv.style.color = 'red';
        });
    }
});
