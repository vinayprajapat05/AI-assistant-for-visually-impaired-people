
// speechService.ts

// Browser SpeechRecognition Type Declaration
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition;

export type SpeechCommand = "OPEN_CAMERA" | "RETAKE_IMAGE" | "REPLAY_SUMMARY" | "STOP_SPEAKING" | "UNKNOWN";

class SpeechService {
    private recognition: any;
    private synthesis: SpeechSynthesis;
    private isListening: boolean = false;

    constructor(onCommand: (command: SpeechCommand) => void) {
        this.synthesis = window.speechSynthesis;

        if (SpeechRecognitionAPI) {
            this.recognition = new SpeechRecognitionAPI();
            this.recognition.continuous = true;
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = false;

            this.recognition.onresult = (event: any) => {
                const lastResult = event.results[event.results.length - 1];
                const transcript = lastResult[0].transcript.trim().toLowerCase();
                console.log("Speech detected:", transcript);
                this.parseCommand(transcript, onCommand);
            };

            this.recognition.onend = () => {
                if (this.isListening) {
                    this.recognition.start(); // Auto-restart if it stops unexpectedly
                }
            };
        } else {
            console.warn("Speech Recognition API not supported in this browser.");
        }
    }

    startListening() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
                this.isListening = true;
            } catch (e) {
                console.error("Error starting recognition:", e);
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    speak(text: string) {
        this.cancelSpeech(); // Stop any previous speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1.0;
        this.synthesis.speak(utterance);
    }

    cancelSpeech() {
        this.synthesis.cancel();
    }

    private parseCommand(transcript: string, callback: (cmd: SpeechCommand) => void) {
        if (transcript.includes("open camera") || transcript.includes("start")) {
            callback("OPEN_CAMERA");
        } else if (transcript.includes("retake") || transcript.includes("take again")) {
            callback("RETAKE_IMAGE");
        } else if (transcript.includes("replay") || transcript.includes("repeat")) {
            callback("REPLAY_SUMMARY");
        } else if (transcript.includes("stop") || transcript.includes("quiet") || transcript.includes("shut up")) {
            callback("STOP_SPEAKING");
        } else {
            callback("UNKNOWN");
        }
    }
}

export default SpeechService;
