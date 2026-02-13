interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition;

export type SpeechCommand = "OPEN_CAMERA" | "CAPTURE_IMAGE" | "RETAKE_IMAGE" | "REPLAY_SUMMARY" | "STOP_SPEAKING" | "UNKNOWN";

const OPEN_CAMERA_KEYWORDS = [
    "open camera", "open the camera", "open my camera",
    "start camera", "start the camera", "start my camera",
    "launch camera", "camera open", "camera on", "turn on camera",
    "open camara", "open kamera", "upon camera", "open can",
    "open cama", "open come", "open calm",
];

const CAPTURE_KEYWORDS = [
    "capture", "capture image", "capture photo", "capture it",
    "take photo", "take a photo", "take picture", "take a picture",
    "click photo", "click picture", "click it",
    "snap", "snap it", "snap photo", "shoot", "shoot it",
    "photograph", "take it", "take the photo",
    "catcher", "chapter", "rapture", "cap sure", "cap char",
    "captured", "capturing",
];

const RETAKE_KEYWORDS = [
    "retake", "retake it", "retake image", "retake photo",
    "re-take", "re take",
    "retail", "we take", "ree take", "rita", "retik", "retech",
    "rick take", "reta", "detake", "retakes",
    "take again", "try again", "new photo", "new picture",
    "another photo", "another picture", "once more",
    "take another", "redo", "start over", "do again", "do over",
    "again please", "one more time",
];

const REPLAY_KEYWORDS = [
    "replay", "replay it", "replay summary",
    "re-play", "re play",
    "we play", "ree play", "reapply", "relay", "repay",
    "replays", "display", "free play",
    "repeat", "repeat it", "repeat summary", "repeat that",
    "read again", "read it again", "read that again",
    "say again", "say it again", "say that again",
    "tell again", "tell me again", "play again",
    "hear again", "hear it again", "listen again",
    "what did it say", "what was that", "summarize again",
    "read summary", "summary again",
];

const STOP_KEYWORDS = [
    "stop", "stop it", "stop speaking", "stop talking",
    "stop please", "please stop",
    "quiet", "be quiet", "shut up",
    "silence", "enough", "that's enough",
    "hush", "mute", "pause", "cancel",
    "shush", "okay stop",
];

function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[m][n];
}
function matchesAny(transcript: string, keywords: string[]): boolean {
    const transcriptWords = transcript.split(/\s+/);

    for (const kw of keywords) {
        const isMultiWord = kw.includes(" ");

        if (isMultiWord) {
            if (transcript.includes(kw)) return true;
        } else {
            for (const word of transcriptWords) {
                if (word === kw) return true;
                if (kw.length >= 5 && word.length >= 4 && levenshtein(word, kw) <= 1) {
                    return true;
                }
            }
        }
    }

    return false;
}

class SpeechService {
    private recognition: any;
    private synthesis: SpeechSynthesis;
    private isListening: boolean = false;
    private isSpeaking: boolean = false;
    private onCommand: (command: SpeechCommand) => void;

    constructor(onCommand: (command: SpeechCommand) => void) {
        this.synthesis = window.speechSynthesis;
        this.onCommand = onCommand;

        if (SpeechRecognitionAPI) {
            this.recognition = new SpeechRecognitionAPI();
            this.recognition.continuous = true;
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 5;

            this.recognition.onresult = (event: any) => {
                const lastResult = event.results[event.results.length - 1];
                if (!lastResult.isFinal) return;

                const transcripts: string[] = [];
                for (let i = 0; i < lastResult.length; i++) {
                    transcripts.push(lastResult[i].transcript.trim().toLowerCase());
                }

                console.log("🎙️ Speech detected:", transcripts.map((t, i) =>
                    `[${i}] "${t}" (${(lastResult[i]?.confidence * 100).toFixed(1)}%)`
                ).join(" | "));

                this.parseCommandFromAlternatives(transcripts, this.onCommand);
            };

            this.recognition.onerror = (event: any) => {
                console.warn("Speech recognition error:", event.error);
                if (event.error === 'no-speech' || event.error === 'aborted') {
                    return;
                }
                if (event.error === 'not-allowed') {
                    console.error("❌ Microphone permission denied. Voice commands disabled.");
                }
            };

            this.recognition.onend = () => {
                if (this.isListening && !this.isSpeaking) {
                    setTimeout(() => {
                        try {
                            this.recognition.start();
                        } catch (e) {
                            console.error("Error restarting recognition:", e);
                        }
                    }, 300);
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
                console.log("🎙️ Speech recognition started.");
            } catch (e) {
                console.error("Error starting recognition:", e);
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.isListening = false;
            try { this.recognition.stop(); } catch (_) { /* ignore */ }
            console.log("🎙️ Speech recognition stopped.");
        }
    }

    speakThenListen(text: string) {
        this.cancelSpeech();
        this.isSpeaking = true;

        if (this.recognition) {
            try { this.recognition.stop(); } catch (_) { /* ignore */ }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            console.log("✅ Welcome speech finished. Starting recognition...");
            this.isSpeaking = false;
            this.isListening = true;
            if (this.recognition) {
                setTimeout(() => {
                    try {
                        this.recognition.start();
                        console.log("🎙️ Speech recognition started after welcome.");
                    } catch (e) {
                        console.error("Error starting recognition after speech:", e);
                    }
                }, 500);
            }
        };

        utterance.onerror = () => {
            console.warn("TTS error — starting recognition anyway.");
            this.isSpeaking = false;
            this.isListening = true;
            if (this.recognition) {
                setTimeout(() => {
                    try { this.recognition.start(); } catch (_) { /* ignore */ }
                }, 500);
            }
        };

        this.synthesis.speak(utterance);
    }

    speak(text: string) {
        this.cancelSpeech();

        
        this.isSpeaking = true;
        if (this.recognition && this.isListening) {
            try { this.recognition.stop(); } catch (_) { /* ignore */ }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.isListening && this.recognition) {
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.error("Error resuming recognition after TTS:", e);
                    }
                }, 500);
            }
        };

        utterance.onerror = () => {
            this.isSpeaking = false;
            if (this.isListening && this.recognition) {
                setTimeout(() => {
                    try { this.recognition.start(); } catch (_) { /* ignore */ }
                }, 500);
            }
        };

        this.synthesis.speak(utterance);
    }

    cancelSpeech() {
        this.synthesis.cancel();
        this.isSpeaking = false;
    }

    get busy(): boolean {
        return this.isSpeaking || this.synthesis.speaking;
    }

    
    private parseCommandFromAlternatives(transcripts: string[], callback: (cmd: SpeechCommand) => void) {
        for (const t of transcripts) {
            if (matchesAny(t, OPEN_CAMERA_KEYWORDS)) {
                console.log("✅ Matched: OPEN_CAMERA from:", t);
                callback("OPEN_CAMERA"); return;
            }
        }
        for (const t of transcripts) {
            if (matchesAny(t, CAPTURE_KEYWORDS)) {
                console.log("✅ Matched: CAPTURE_IMAGE from:", t);
                callback("CAPTURE_IMAGE"); return;
            }
        }
        for (const t of transcripts) {
            if (matchesAny(t, RETAKE_KEYWORDS)) {
                console.log("✅ Matched: RETAKE_IMAGE from:", t);
                callback("RETAKE_IMAGE"); return;
            }
        }
        for (const t of transcripts) {
            if (matchesAny(t, REPLAY_KEYWORDS)) {
                console.log("✅ Matched: REPLAY_SUMMARY from:", t);
                callback("REPLAY_SUMMARY"); return;
            }
        }
        for (const t of transcripts) {
            if (matchesAny(t, STOP_KEYWORDS)) {
                console.log("✅ Matched: STOP_SPEAKING from:", t);
                callback("STOP_SPEAKING"); return;
            }
        }

        console.log("❌ No command matched. Transcripts:", transcripts.join(" | "));
        callback("UNKNOWN");
    }
}

export default SpeechService;
