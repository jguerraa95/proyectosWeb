import { CONFIG } from "./src/config/config.js";

const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

class GeneradorFotograma {
    constructor() {
        this.videoInput = document.getElementById('videoInput');
        this.fileNameDisplay = document.getElementById('file-name');
        this.dropZone = document.getElementById('drop-zone');
        this.loadingIndicator = document.getElementById('loading');
        this.downloadContainer = document.getElementById('download-container');
        this.generateFrames = document.getElementById('procesar-video');
        this.formulario = document.getElementById('video-form');
        this.validFiles = [];
        this.isProcessing = false;
        
        this.initializeEventListeners();
    }

    validateVideoFiles(files) {
        return Array.from(files).filter(file => {
            if (!file.type.startsWith('video/')) {
                return false;
            }
            if (files.length > CONFIG.MAX_FILES) {
                alert(`Maximo 3 archivos de video permitidos`);
                return false;
            }
            if (file.size > CONFIG.MAX_FILE_SIZE) {
                alert(`El archivo ${file.name} excede el tamaño máximo permitido`);
                return false;
            }
            return true;
        });
    }

    updateFileNames(files) {
        if (files.length > 0) {
            const fileList = files.map(file => {
                const size = (file.size / (1024 * 1024)).toFixed(2);
                return `<div class="file-item">
                    <span>${file.name}</span>
                    <span class="file-size">${size} MB</span>
                </div>`;
            }).join('');

            this.fileNameDisplay.innerHTML = fileList;
            document.getElementById('fotogramas').style.display = 'block';
            document.getElementById('procesar-video').style.display = 'block';
        } else {
            this.fileNameDisplay.innerHTML = 'O arrastra y suelta tus videos aquí';
            document.getElementById('fotogramas').style.display = 'none';
            document.getElementById('procesar-video').style.display = 'none';
        }
    }

    async processVideo(file, fps) {
        const videoName = `input-${Date.now()}.${file.name.split('.').pop()}`;
        try {
            await ffmpeg.FS('writeFile', videoName, await fetchFile(file));
            await ffmpeg.run('-i', videoName, '-vf', `fps=${fps}`, `frame-${videoName}-%d.png`);
            
            const frames = ffmpeg.FS('readdir', '/').filter(f => f.startsWith(`frame-${videoName}`));
            return frames.map(frame => ({
                name: frame,
                data: ffmpeg.FS('readFile', frame)
            }));
        } finally {
            this.cleanupFFmpegFiles(videoName);
        }
    }

    cleanupFFmpegFiles(videoName) {
        try {
            const files = ffmpeg.FS('readdir', '/');
            files.forEach(file => {
                if (file.includes(videoName)) {
                    ffmpeg.FS('unlink', file);
                }
            });
        } catch (error) {
            console.warn('Error en limpieza:', error);
        }
    }

    initializeEventListeners() {
        const preventDefault = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        this.videoInput.addEventListener('change', (e) => {
            this.validFiles = this.validateVideoFiles(e.target.files);
            this.updateFileNames(this.validFiles);
        });

        this.dropZone.addEventListener('dragenter', preventDefault);
        this.dropZone.addEventListener('dragover', (e) => {
            preventDefault(e);
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            preventDefault(e);
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            preventDefault(e);
            this.dropZone.classList.remove('dragover');
            this.validFiles = this.validateVideoFiles(e.dataTransfer.files);
            this.updateFileNames(this.validFiles);
        });

        this.formulario.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.isProcessing) return;
        
            const fpsElement = document.querySelector('input[name="CantidadFotogramas"]:checked');
            if (!fpsElement) {
                alert('Por favor, selecciona una cantidad de fotogramas.');
                return;
            }
        
            const fps = parseInt(fpsElement.value, 10);
        
            this.isProcessing = true;
            this.loadingIndicator.style.display = 'block';
        
            try {
                if (!ffmpeg.isLoaded()) await ffmpeg.load();
        
                const zip = new JSZip();
        
                for (const file of this.validFiles) {
                    const frames = await this.processVideo(file, fps);
                    frames.forEach(({ name, data }) => zip.file(name, data));
                }
        
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                this.setupDownload(zipBlob);
        
                this.loadingIndicator.style.display = 'none';
                this.downloadContainer.style.display = 'block';
            } catch (error) {
                console.error('Error:', error);
                alert(`Error: ${error.message || 'Error durante el procesamiento'}`);
            } finally {
                this.isProcessing = false;
            }
        });
    }

    setupDownload(blob) {
        const url = URL.createObjectURL(blob);
        const downloadButton = document.getElementById('download-button');
        downloadButton.onclick = () => {
            const link = document.createElement('a');
            link.href = url;
            link.download = `fotogramas-${Date.now()}.zip`;
            link.click();
            URL.revokeObjectURL(url);
        };
    }
}

const generadorFotograma = new GeneradorFotograma();