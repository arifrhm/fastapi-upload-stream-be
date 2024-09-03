document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("fileInput");
    const selectFileButton = document.getElementById("selectFileButton");
    const fileUploadList = document.getElementById("fileUploadList");

    selectFileButton.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (event) => {
        const files = event.target.files;
        Array.from(files).forEach(file => {
            addFileToUploadList(file);
        });
    });

    function addFileToUploadList(file) {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";

        const filename = document.createElement("div");
        filename.className = "filename";
        filename.textContent = file.name;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "x";
        deleteButton.onclick = () => deleteFileItem(fileItem);

        const pausePlayButton = document.createElement("button");
        pausePlayButton.className = "pause-play-button";
        pausePlayButton.textContent = "Pause";
        pausePlayButton.id = `${file.name}-pausePlayButton`;
        pausePlayButton.onclick = () => togglePausePlay(file.name);

        const cancelStopButton = document.createElement("button");
        cancelStopButton.className = "cancel-stop-button";
        cancelStopButton.textContent = "Cancel";
        cancelStopButton.id = `${file.name}-cancelStopButton`;
        cancelStopButton.onclick = () => cancelUpload(file.name);

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "button-container";
        buttonContainer.appendChild(pausePlayButton);
        buttonContainer.appendChild(cancelStopButton);

        const progressContainer = document.createElement("div");
        progressContainer.className = "progress-container";

        const progressBarWrapper = document.createElement("div");
        progressBarWrapper.className = "progress-bar-wrapper";

        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        progressBar.id = `${file.name}-progressBar`;

        progressBarWrapper.appendChild(progressBar);
        progressContainer.appendChild(progressBarWrapper);

        const uploadStatus = document.createElement("span");
        uploadStatus.className = "upload-status";
        uploadStatus.id = `${file.name}-uploadStatus`;

        fileItem.appendChild(filename);
        fileItem.appendChild(deleteButton);
        fileItem.appendChild(buttonContainer);
        fileItem.appendChild(progressContainer);
        fileItem.appendChild(uploadStatus);

        fileUploadList.appendChild(fileItem);

        startUpload(file, fileItem);
    }

    const uploadControllers = {};
    const uploadPauseFlags = {};

    async function startUpload(file, fileItem) {
        const chunkSize = 1024 * 1024; // 1MB per chunk
        const totalChunks = Math.ceil(file.size / chunkSize);
        let currentChunk = 0;

        const fileName = file.name;
        uploadControllers[fileName] = new AbortController();
        uploadPauseFlags[fileName] = false;

        const fileStatusResponse = await fetch(`/upload-status/?filename=${fileName}`);
        const fileStatus = await fileStatusResponse.json();
        currentChunk = Math.floor(fileStatus.uploaded_bytes / chunkSize);

        if (fileStatus.uploaded_bytes >= file.size) {
            // If file is already fully uploaded
            document.getElementById(`${fileName}-progressBar`).style.width = "100%";
            document.getElementById(`${fileName}-uploadStatus`).textContent = "Upload complete!";
            fileItem.classList.remove("uploading"); // Hide buttons
            return;
        } else {
            fileItem.classList.add("uploading"); // Show buttons
        }

        for (let chunkIndex = currentChunk; chunkIndex < totalChunks; chunkIndex++) {
            if (uploadControllers[fileName].signal.aborted) break;

            while (uploadPauseFlags[fileName]) {
                await new Promise(resolve => setTimeout(resolve, 100)); // Wait while paused
            }

            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);

            try {
                const response = await fetch("/upload-octet/", {
                    method: "POST",
                    headers: {
                        "x-file-name": fileName,
                        "x-file-offset": start,
                        "Content-Type": "application/octet-stream"
                    },
                    body: chunk,
                    signal: uploadControllers[fileName].signal
                });

                if (!response.ok) {
                    document.getElementById(`${fileName}-uploadStatus`).textContent = "Upload failed.";
                    break;
                }

                const data = await response.json();
                const percentComplete = ((chunkIndex * chunkSize + chunk.size) / file.size) * 100;
                document.getElementById(`${fileName}-progressBar`).style.width = percentComplete + "%";
                document.getElementById(`${fileName}-uploadStatus`).textContent = `Uploading: ${Math.round(percentComplete)}%`;

                if (chunkIndex === totalChunks - 1) {
                    document.getElementById(`${fileName}-uploadStatus`).textContent = "Upload complete!";
                    fileItem.classList.remove("uploading"); // Hide buttons
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    document.getElementById(`${fileName}-uploadStatus`).textContent = "Upload canceled.";
                } else {
                    document.getElementById(`${fileName}-uploadStatus`).textContent = "Upload failed.";
                }
                fileItem.classList.remove("uploading"); // Hide buttons
                break;
            }
        }
    }

    function togglePausePlay(fileName) {
        if (uploadPauseFlags[fileName]) {
            uploadPauseFlags[fileName] = false;
            document.querySelector(`#${fileName}-pausePlayButton`).textContent = "Pause";
        } else {
            uploadPauseFlags[fileName] = true;
            document.querySelector(`#${fileName}-pausePlayButton`).textContent = "Play";
        }
    }

    function cancelUpload(fileName) {
        if (uploadControllers[fileName]) {
            uploadControllers[fileName].abort();
            delete uploadControllers[fileName];
            document.getElementById(`${fileName}-uploadStatus`).textContent = "Upload canceled.";
            document.querySelector(`.file-item.uploading`).classList.remove("uploading"); // Hide buttons
        }
    }

    function deleteFileItem(fileItem) {
        fileItem.remove();
    }
});
