document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const processingTableBody = document.getElementById('processing-table-body');
    const uploadQueue = [];
    let isProcessing = false;
    const taskCheckIntervals = new Map();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Детальная информация</h3>
            <div id="modal-body"></div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };

    modal.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

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
        checkSpan.className = 'check-pending';
        checkSpan.textContent = 'Идёт проверка...';
        checkTd.appendChild(checkSpan);

        tr.appendChild(fileNameTd);
        tr.appendChild(statusTd);
        tr.appendChild(checkTd);

        tr.addEventListener('click', function() {
            const info = this.dataset.info;
            if (info) {
                showModal(JSON.parse(info));
            }
        });

        return tr;
    }

    function updateTableRowStatus(tableRow, status, isSuccess = false) {
        const statusCell = tableRow.querySelector('.status-cell');
        const statusSpan = statusCell.querySelector('span');
        const spinner = statusCell.querySelector('.spinner');
        const checkSpan = tableRow.querySelector('.check-pending, .check-matched, .check-not-matched');

        statusSpan.className = '';
        tableRow.className = '';

        switch(status) {
            case 'В очереди':
                statusSpan.className = 'status-queued';
                tableRow.className = 'queued';
                spinner.style.opacity = '0';
                if (checkSpan) {
                    checkSpan.className = 'check-pending';
                    checkSpan.textContent = 'В очереди';
                }
                break;
            case 'Обрабатывается...':
                statusSpan.className = 'status-processing';
                tableRow.className = 'processing';
                spinner.style.opacity = '1';
                if (checkSpan) {
                    checkSpan.className = 'check-pending';
                    checkSpan.textContent = 'Идёт проверка...';
                }
                break;
            case 'Готово':
                statusSpan.className = 'status-success';
                tableRow.className = 'success';
                spinner.style.opacity = '0';
                if (checkSpan && isSuccess !== undefined) {
                    checkSpan.className = isSuccess ? 'check-matched' : 'check-not-matched';
                    checkSpan.textContent = isSuccess ? 'Соответствует' : 'Не соответствует';
                }
                break;
            case 'Ошибка':
                statusSpan.className = 'status-error';
                tableRow.className = 'error';
                spinner.style.opacity = '0';
                if (checkSpan) {
                    checkSpan.className = 'check-not-matched';
                    checkSpan.textContent = 'Ошибка проверки';
                }
                break;
        }

        statusSpan.textContent = status;
    }

    function showModal(info) {
        const modalBody = document.getElementById('modal-body');

        let html = `
            <div class="modal-section">
                <h4>Общий вердикт: ${info.verdict ? '✅ Соответствует' : '❌ Не соответствует'}</h4>
                <p><strong>Категория:</strong> ${info.category}</p>
            </div>

            <div class="modal-section">
                <h4>Пищевая ценность на 100г:</h4>
                <table class="nutrition-table">
                    <tr><th>Белки</th><td>${info.g_per_100g.proteins}g</td></tr>
                    <tr><th>Жиры</th><td>${info.g_per_100g.fats}g</td></tr>
                    <tr><th>Углеводы</th><td>${info.g_per_100g.carbohydrates}g</td></tr>
                </table>
            </div>

            <div class="modal-section">
                <h4>Процент от суточной нормы:</h4>
                <table class="nutrition-table">
                    <tr><th>Белки</th><td>${info.percent_of_daily_norm.proteins}%</td></tr>
                    <tr><th>Жиры</th><td>${info.percent_of_daily_norm.fats}%</td></tr>
                    <tr><th>Углеводы</th><td>${info.percent_of_daily_norm.carbohydrates}%</td></tr>
                </table>
            </div>

            <div class="modal-section">
                <h4>Требования ВОЗ:</h4>
                <table class="requirements-table">
        `;

        info.requirements.forEach(req => {
            html += `
                <tr class="${req.verdict ? 'requirement-met' : 'requirement-not-met'}">
                    <td>${req.verdict ? '✅' : '❌'}</td>
                    <td>${req.criterion}</td>
                </tr>
            `;
        });

        html += `
                </table>
            </div>
        `;

        modalBody.innerHTML = html;
        modal.style.display = 'block';
    }

    async function checkTaskStatus(taskId, tableRow) {
        try {
            const response = await fetch(`/task-status/${taskId}`);
            const data = await response.json();

            if (data.status === 'SUCCESS') {
                clearInterval(taskCheckIntervals.get(taskId));
                taskCheckIntervals.delete(taskId);

                tableRow.dataset.info = data.result;
                updateTableRowStatus(tableRow, 'Готово', true);

                const info = JSON.parse(data.result);
                const checkSpan = tableRow.querySelector('td:last-child span');
                if (info.verdict) {
                    checkSpan.className = 'check-matched';
                    checkSpan.textContent = 'Соответствует';
                } else {
                    checkSpan.className = 'check-not-matched';
                    checkSpan.textContent = 'Не соответствует';
                }
            } else if (data.status === 'FAILURE') {
                clearInterval(taskCheckIntervals.get(taskId));
                taskCheckIntervals.delete(taskId);

                updateTableRowStatus(tableRow, 'Ошибка');
                const checkSpan = tableRow.querySelector('td:last-child span');
                checkSpan.className = 'check-not-matched';
                checkSpan.textContent = data.error || 'Ошибка обработки';
            }

        } catch (error) {
            console.error('Error checking task status:', error);
        }
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
                if (data.status === 'completed') {
                    item.tableRow.dataset.info = data.text;
                    updateTableRowStatus(item.tableRow, 'Готово', true);

                    const info = JSON.parse(data.text);
                    const checkSpan = item.tableRow.querySelector('td:last-child span');
                    if (info.verdict) {
                        checkSpan.className = 'check-matched';
                        checkSpan.textContent = 'Соответствует';
                    } else {
                        checkSpan.className = 'check-not-matched';
                        checkSpan.textContent = 'Не соответствует';
                    }
                } else if (data.status === 'processing') {
                    const taskId = data.task_id;
                    const intervalId = setInterval(() => {
                        checkTaskStatus(taskId, item.tableRow);
                    }, 1000);

                    taskCheckIntervals.set(taskId, intervalId);
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
            console.log(error);
        }

        setTimeout(() => processQueue(), 100);
    }
});