class MagnifyAI {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.magnifier = document.getElementById('magnifier');
        this.magnifiedImage = document.getElementById('magnifiedImage');
        this.zoomLevel = 1;
        this.flashOn = false;
        
        this.init();
    }

    async init() {
        await this.setupCamera();
        this.setupControls();
        this.setupGestures();
    }

    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            this.video.srcObject = stream;
            
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            });
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Camera access denied. Please enable camera permissions.');
        }
    }

    setupControls() {
        document.getElementById('magnifyBtn').addEventListener('click', () => {
            this.captureAndMagnify();
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

    setupGestures() {
        let touchStartX = 0;
        let touchStartY = 0;

        this.video.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        this.video.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = touchX - touchStartX;
            const deltaY = touchY - touchStartY;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                this.zoomLevel = Math.max(1, Math.min(10, this.zoomLevel + deltaX * 0.01));
                document.getElementById('zoomLevel').textContent = `${this.zoomLevel.toFixed(1)}x`;
            }
        });
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

