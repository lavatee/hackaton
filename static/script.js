document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const processingTableBody = document.getElementById('processing-table-body');
    const uploadQueue = [];
    let isProcessing = false;

    dropZone.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
        this.value = '';
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
        const files = dt.files;

        if (files.length) {
            handleFiles(files);
        }
    });

    function handleFiles(files) {
        if (processingTableBody.querySelector('.empty-table-message')) {
            processingTableBody.innerHTML = '';
        }

        const fragment = document.createDocumentFragment();
        const newItems = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!file.type.match('image.*')) {
                continue;
            }

            const tableRow = createTableRow(file.name);
            newItems.push({
                file: file,
                tableRow: tableRow
            });

            if (fragment.firstChild) {
                fragment.insertBefore(tableRow, fragment.firstChild);
            } else {
                fragment.appendChild(tableRow);
            }
        }

        if (processingTableBody.firstChild) {
            processingTableBody.insertBefore(fragment, processingTableBody.firstChild);
        } else {
            processingTableBody.appendChild(fragment);
        }

        uploadQueue.unshift(...newItems);

        if (!isProcessing) {
            processQueue();
        }
    }

    function createTableRow(filename) {
        const tr = document.createElement('tr');
        tr.className = 'queued';

        const fileNameTd = document.createElement('td');
        fileNameTd.className = 'file-name-cell';
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'file-name';
        fileNameSpan.textContent = filename;
        fileNameTd.appendChild(fileNameSpan);

        const statusTd = document.createElement('td');
        statusTd.className = 'status-cell';
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status-queued';
        statusSpan.textContent = 'В очереди';
        statusTd.appendChild(spinner);
        statusTd.appendChild(statusSpan);

        const checkTd = document.createElement('td');
        const checkSpan = document.createElement('span');
        checkSpan.className = 'check-not-matched';
        checkSpan.textContent = 'Не соответствует';
        checkTd.appendChild(checkSpan);

        tr.appendChild(fileNameTd);
        tr.appendChild(statusTd);
        tr.appendChild(checkTd);

        return tr;
    }

    function updateTableRowStatus(tableRow, status, isSuccess = false) {
        const statusCell = tableRow.querySelector('.status-cell');
        const statusSpan = statusCell.querySelector('span');
        const spinner = statusCell.querySelector('.spinner');

        statusSpan.className = '';
        tableRow.className = '';

        switch(status) {
            case 'В очереди':
                statusSpan.className = 'status-queued';
                tableRow.className = 'queued';
                spinner.style.opacity = '0';
                break;
            case 'Обрабатывается...':
                statusSpan.className = 'status-processing';
                tableRow.className = 'processing';
                spinner.style.opacity = '1';
                break;
            case 'Готово':
                statusSpan.className = 'status-success';
                tableRow.className = 'success';
                spinner.style.opacity = '0';
                break;
            case 'Ошибка':
                statusSpan.className = 'status-error';
                tableRow.className = 'error';
                spinner.style.opacity = '0';
                break;
        }

        statusSpan.textContent = status;
    }

    async function processQueue() {
        if (uploadQueue.length === 0) {
            isProcessing = false;

            if (processingTableBody.children.length === 0) {
                processingTableBody.innerHTML = '<tr><td colspan="3" class="empty-table-message">Файлы не добавлены</td></tr>';
            }
            return;
        }

        isProcessing = true;
        const item = uploadQueue.pop();

        updateTableRowStatus(item.tableRow, 'Обрабатывается...');

        try {
            const formData = new FormData();
            formData.append('file', item.file);

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                updateTableRowStatus(item.tableRow, 'Готово', true);

                const checkSpan = item.tableRow.querySelector('td:last-child span');
                if (data.matches_rules) {
                    checkSpan.className = 'check-matched';
                    checkSpan.textContent = 'Соответствует';
                } else {
                    checkSpan.className = 'check-not-matched';
                    checkSpan.textContent = 'Не соответствует';
                }

            } else {
                updateTableRowStatus(item.tableRow, 'Ошибка');
                const checkSpan = item.tableRow.querySelector('td:last-child span');
                checkSpan.className = 'check-not-matched';
                checkSpan.textContent = data.error || 'Ошибка загрузки';
            }

        } catch (error) {
            updateTableRowStatus(item.tableRow, 'Ошибка');
            const checkSpan = item.tableRow.querySelector('td:last-child span');
            checkSpan.className = 'check-not-matched';
            checkSpan.textContent = 'Ошибка сети';
        }

        setTimeout(() => processQueue(), 100);
    }
});