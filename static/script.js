document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const processingList = document.getElementById('processing-list');
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
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (!file.type.match('image.*')) {
                continue;
            }

            const listItem = createListItem(file.name);
            uploadQueue.push({
                file: file,
                listItem: listItem
            });

            processingList.appendChild(listItem);
        }

        if (!isProcessing) {
            processQueue();
        }
    }

    function createListItem(filename) {
        const li = document.createElement('li');
        li.className = 'processing-item';
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'file-name';
        fileNameSpan.textContent = filename;
        
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status';
        statusSpan.textContent = 'В очереди';
        
        const checkSpan = document.createElement('span');
        checkSpan.className = 'check-status';
        checkSpan.textContent = 'Не соответствует';
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        
        li.appendChild(spinner);
        li.appendChild(fileNameSpan);
        li.appendChild(document.createTextNode(' - '));
        li.appendChild(statusSpan);
        li.appendChild(document.createTextNode(' | '));
        li.appendChild(checkSpan);
        
        return li;
    }

    function updateListItemStatus(listItem, status, isSuccess = false) {
        const statusSpan = listItem.querySelector('.status');
        statusSpan.textContent = status;
        
        if (status === 'Обрабатывается...') {
            listItem.classList.add('processing');
            listItem.classList.remove('success', 'error');
        } else if (status === 'Готово') {
            listItem.classList.remove('processing', 'error');
            listItem.classList.add('success');
        } else if (status === 'Ошибка') {
            listItem.classList.remove('processing', 'success');
            listItem.classList.add('error');
        }
    }

    async function processQueue() {
        if (uploadQueue.length === 0) {
            isProcessing = false;
            return;
        }

        isProcessing = true;
        const item = uploadQueue.shift();
        
        updateListItemStatus(item.listItem, 'Обрабатывается...');
        
        try {
            const formData = new FormData();
            formData.append('file', item.file);

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            console.log(data.info);
            const info = JSON.parse(data.info); // тут молимся чтобы было без ```json
            
            if (data.success) {
                updateListItemStatus(item.listItem, 'Готово', true);
                
                const checkStatusSpan = item.listItem.querySelector('.check-status');
                checkStatusSpan.textContent = info.verdict ? 'Соответствует' : 'Не соответствует';
                
            } else {
                updateListItemStatus(item.listItem, 'Ошибка');
                const checkStatusSpan = item.listItem.querySelector('.check-status');
                checkStatusSpan.textContent = data.error || 'Ошибка загрузки';
            }
            
        } catch (error) {
            updateListItemStatus(item.listItem, 'Ошибка');
            const checkStatusSpan = item.listItem.querySelector('.check-status');
            checkStatusSpan.textContent = 'Ошибка сети';
        }
        
        setTimeout(() => processQueue(), 100);
    }
});