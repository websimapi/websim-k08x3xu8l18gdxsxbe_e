class MagnifyAI {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.magnifier = document.getElementById('magnifier');
        this.magnifiedImage = document.getElementById('magnifiedImage');
        this.zoomLevel = 1;
        this.flashOn = false;
        this.model = null;
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
            // Load MediaPipe Object Detection model
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
            );
            
            this.objectDetector = await ObjectDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/ssd_mobilenet_v2/float16/1/object_detector.tflite",
                    delegate: "GPU"
                },
                runningMode: "IMAGE",
                scoreThreshold: 0.9, // 90% threshold
                maxResults: 10
            });
            
            console.log('MediaPipe Object Detection model loaded');
        } catch (error) {
            console.error('Error loading model:', error);
            // Fallback to COCO-SSD if MediaPipe fails
            try {
                this.model = await cocoSsd.load();
                console.log('COCO-SSD fallback loaded');
            } catch (fallbackError) {
                console.error('Both models failed to load:', fallbackError);
            }
        }
    }

    startDetection() {
        const detect = async () => {
            if (!this.objectDetector && !this.model) {
                requestAnimationFrame(detect);
                return;
            }

            if (!this.isDetecting) {
                this.isDetecting = true;
                try {
                    let predictions = [];
                    
                    if (this.objectDetector) {
                        // Use MediaPipe
                        const results = await this.objectDetector.detect(this.video);
                        predictions = results.detections.map(detection => ({
                            bbox: [
                                detection.boundingBox.originX,
                                detection.boundingBox.originY,
                                detection.boundingBox.width,
                                detection.boundingBox.height
                            ],
                            class: detection.categories[0].categoryName,
                            score: detection.categories[0].score
                        }));
                    } else {
                        // Fallback to COCO-SSD
                        const results = await this.model.detect(this.video);
                        predictions = results.filter(r => r.score >= 0.9);
                    }
                    
                    this.detections = predictions;
                    this.drawDetections();
                } catch (error) {
                    console.error('Detection error:', error);
                } finally {
                    this.isDetecting = false;
                }
            }
            requestAnimationFrame(detect);
        };
        
        detect();
    }

    drawDetections() {
        const canvas = this.detectionCanvas;
        const ctx = this.detectionCtx;
        
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        this.updateOverlay();
    }

    updateOverlay() {
        // Create or update the detection overlay
        let overlay = document.getElementById('detectionOverlay');
        if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.id = 'detectionOverlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '5';
            document.querySelector('.app-container').appendChild(overlay);
        }
        
        const container = document.querySelector('.app-container');
        const containerRect = container.getBoundingClientRect();
        
        overlay.width = containerRect.width;
        overlay.height = containerRect.height;
        
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        
        const scaleX = overlay.width / this.video.videoWidth;
        const scaleY = overlay.height / this.video.videoHeight;
        
        ctx.strokeStyle = '#00ff88';
        ctx.fillStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.font = '14px Arial';
        
        this.detections.forEach(detection => {
            if (detection.score < 0.9) return; // Skip if confidence < 90%
            
            const [x, y, width, height] = detection.bbox;
            
            const scaledX = overlay.width - ((x + width) * scaleX);
            const scaledY = y * scaleY;
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
            ctx.fillRect(scaledX, scaledY - textHeight, textWidth, textHeight);
            
            ctx.fillStyle = '#000';
            ctx.fillText(label, scaledX + 5, scaledY - 5);
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
        // Apply zoom using CSS transform
        this.video.style.transform = `scaleX(-1) scale(${this.zoomLevel})`;
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