import { pipeline } from '@xenova/transformers';

class MagnifyAI {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.magnifier = document.getElementById('magnifier');
        this.magnifiedImage = document.getElementById('magnifiedImage');
        this.zoomLevel = 1;
        this.flashOn = false;
        this.detector = null;
        this.detections = [];
        this.isDetecting = false;
        this.detectionCanvas = document.createElement('canvas');
        this.detectionCtx = this.detectionCanvas.getContext('2d');
        
        this.init();
    }

    async init() {
        await this.setupCamera();
        await this.loadModel();
        this.setupControls();
        this.setupGestures();
        this.startDetection();
    }

    async loadModel() {
        try {
            console.log('Loading Hugging Face Transformers.js model...');
            document.querySelector('#loadingOverlay p').textContent = 'Loading AI Model...';
            document.getElementById('loadingOverlay').classList.remove('hidden');

            this.detector = await pipeline('object-detection', 'Xenova/yolos-tiny', {
                quantized: true, // Use a quantized model for better performance
                progress_callback: (data) => {
                    if (data.status === 'progress') {
                         const progress = (data.progress || 0).toFixed(2);
                         document.querySelector('#loadingOverlay p').textContent = `Loading Model: ${progress}%`;
                    }
                },
            });
            console.log('Object detection model loaded');
        } catch (error) {
            console.error('Error loading model:', error);
            alert('Failed to load AI model. Object detection will not be available.');
        } finally {
            document.getElementById('loadingOverlay').classList.add('hidden');
            document.querySelector('#loadingOverlay p').textContent = 'Analyzing with AI...';
        }
    }

    startDetection() {
        const detect = async () => {
            if (!this.detector || this.isDetecting || document.hidden) {
                requestAnimationFrame(detect);
                return;
            }

            this.isDetecting = true;
            try {
                const predictions = await this.detector(this.video, {
                    threshold: 0.5,
                    percentage: true,
                });
                
                this.detections = predictions.map(({ score, label, box }) => ({
                    score,
                    class: label,
                    bbox: [box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin],
                }));

                this.drawDetections();
            } catch (error) {
                console.error('Detection error:', error);
            } finally {
                this.isDetecting = false;
            }
            requestAnimationFrame(detect);
        };
        
        detect();
    }

    drawDetections() {
        this.updateOverlay();
    }

    updateOverlay() {
        // Create or update the detection overlay
        let overlay = document.getElementById('detectionOverlay');
        if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.id = 'detectionOverlay';
            document.querySelector('.app-container').appendChild(overlay);
        }
        
        const container = document.querySelector('.app-container');
        const containerRect = container.getBoundingClientRect();
        
        overlay.width = containerRect.width;
        overlay.height = containerRect.height;
        
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        
        // Match video aspect ratio to avoid distortion
        const videoAspectRatio = this.video.videoWidth / this.video.videoHeight;
        const overlayAspectRatio = overlay.width / overlay.height;
        let scaleX, scaleY, offsetX = 0, offsetY = 0;

        if (overlayAspectRatio > videoAspectRatio) { // Letterboxed (black bars on sides)
            scaleY = overlay.height;
            scaleX = scaleY * videoAspectRatio;
            offsetX = (overlay.width - scaleX) / 2;
        } else { // Pillarboxed (black bars on top/bottom)
            scaleX = overlay.width;
            scaleY = scaleX / videoAspectRatio;
            offsetY = (overlay.height - scaleY) / 2;
        }

        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.font = '14px Arial';
        
        this.detections.forEach(detection => {
            const [x, y, width, height] = detection.bbox;
            
            const scaledX = x * scaleX + offsetX;
            const scaledY = y * scaleY + offsetY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;
            
            // Draw box
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
            
            // Draw label with background
            const label = `${detection.class} ${Math.round(detection.score * 100)}%`;
            const textMetrics = ctx.measureText(label);
            const textWidth = textMetrics.width + 10;
            const textHeight = 20;
            
            ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
            ctx.fillRect(scaledX, scaledY - textHeight > 0 ? scaledY - textHeight : scaledY, textWidth, textHeight);
            
            ctx.fillStyle = '#000';
            ctx.fillText(label, scaledX + 5, scaledY - textHeight > 0 ? scaledY - 5 : scaledY + 15);
        });
    }

    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 640 }, // Reduced for better performance
                    height: { ideal: 480 }
                }
            });
            this.video.srcObject = stream;
            
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.detectionCanvas.width = this.video.videoWidth;
                this.detectionCanvas.height = this.video.videoHeight;
            });
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Camera access denied. Please enable camera permissions.');
        }
    }

    setupControls() {
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomLevelDisplay = document.getElementById('zoomLevel');
        
        zoomSlider.addEventListener('input', (e) => {
            this.zoomLevel = parseFloat(e.target.value);
            zoomLevelDisplay.textContent = `${this.zoomLevel.toFixed(1)}x`;
            this.applyZoom();
        });

        document.getElementById('aiBtn').addEventListener('click', () => {
            this.analyzeWithAI();
        });

        document.getElementById('flashBtn').addEventListener('click', () => {
            this.toggleFlash();
        });

        document.getElementById('closeMagnifier').addEventListener('click', () => {
            this.magnifier.classList.add('hidden');
        });
    }

    applyZoom() {
        this.video.style.transform = `scale(${this.zoomLevel})`;
    }

    setupGestures() {
        // Remove the old gesture controls since we have the slider now
        // Keep the zoom level display updated
    }

    captureAndMagnify() {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        this.ctx.drawImage(this.video, 0, 0);
        
        const imageData = this.canvas.toDataURL('image/jpeg', 0.9);
        this.magnifiedImage.src = imageData;
        
        this.magnifier.classList.remove('hidden');
    }

    async analyzeWithAI() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.classList.remove('hidden');

        try {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0);
            
            const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
            
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful AI assistant that describes what you see in images. Provide a concise, helpful description in 2-3 sentences."
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Describe what you see in this image. Focus on the main objects, their characteristics, and any notable details."
                            },
                            {
                                type: "image_url",
                                image_url: { url: imageData }
                            }
                        ]
                    }
                ]
            });

            const description = completion.content;
            
            // Use browser's built-in TTS
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(description);
                utterance.rate = 1;
                utterance.pitch = 1;
                utterance.volume = 1;
                
                // Wait for voices to be loaded
                if (speechSynthesis.getVoices().length === 0) {
                    await new Promise(resolve => {
                        speechSynthesis.onvoiceschanged = resolve;
                    });
                }
                
                const voices = speechSynthesis.getVoices();
                const preferredVoice = voices.find(voice => 
                    voice.lang.startsWith('en') && voice.name.includes('Google')
                ) || voices[0];
                
                utterance.voice = preferredVoice;
                speechSynthesis.speak(utterance);
            } else {
                alert('Text-to-speech not supported in this browser');
            }

        } catch (error) {
            console.error('AI analysis error:', error);
            alert('Error analyzing image. Please try again.');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    toggleFlash() {
        this.flashOn = !this.flashOn;
        const track = this.video.srcObject?.getVideoTracks()[0];
        
        if (track) {
            track.applyConstraints({
                advanced: [{ torch: this.flashOn }]
            }).catch(() => {
                console.warn('Flash not supported on this device');
            });
        }
        
        document.getElementById('flashBtn').style.opacity = this.flashOn ? '1' : '0.7';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MagnifyAI();
});

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        const app = new MagnifyAI();
    }, 500);
});