import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import SpeechService, { SpeechCommand } from './speechService';
const API_URL = "https://vfht3x3v-8000.inc1.devtunnels.ms/process-image";
//http://localhost:8000
type AppState = "WELCOME" | "INITIAL" | "CAMERA" | "PROCESSING" | "RESULT" | "ERROR";

function App() {
    const [state, setState] = useState<AppState>("WELCOME");
    const [summary, setSummary] = useState<string>("");
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [listening, setListening] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const speechRef = useRef<SpeechService | null>(null);

    const stateRef = useRef<AppState>(state);
    const summaryRef = useRef<string>(summary);
    const videoStreamRef = useRef<MediaStream | null>(videoStream);

    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { summaryRef.current = summary; }, [summary]);
    useEffect(() => { videoStreamRef.current = videoStream; }, [videoStream]);

    const startCameraRef = useRef<() => void>(() => { });
    const captureImageRef = useRef<() => void>(() => { });

    const INACTIVITY_TIMEOUT = 20_000;
    const lastInteractionRef = useRef<number>(Date.now());
    const inactivityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const resetInactivityTimer = useCallback(() => {
        lastInteractionRef.current = Date.now();
    }, []);

    const getScreenGuidance = useCallback((): string | null => {
        const s = stateRef.current;
        if (s === "INITIAL") {
            return (
                "Say open camera, to start the camera. " +
                "Or tap the start camera button on screen."
            );
        }
        if (s === "CAMERA") {
            return (
                "Camera is open. " +
                "Say capture, to take a photo. " +
                "You can also tap the screen to capture."
            );
        }
        if (s === "RESULT" || s === "ERROR") {
            return (
                "Say retake, to take a new photo. " +
                "Say replay, to hear the summary again. " +
                "Say stop, to stop me from speaking."
            );
        }
        return null;
    }, []);

    const startCamera = useCallback(async () => {
        try {
            if (videoStreamRef.current) {
                videoStreamRef.current.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });

            setVideoStream(stream);
            setState("CAMERA");
            speechRef.current?.speak(
                "Camera is now open. " +
                "Say capture, to take a photo. " +
                "You can also tap the screen to capture."
            );

        } catch (err) {
            console.error("Camera error:", err);
            setState("ERROR");
            setSummary("Could not access camera. Please allow permissions.");
            speechRef.current?.speak("Could not access camera. Please allow permissions.");
        }
    }, []);

    const captureImage = useCallback(async () => {
        if (!videoRef.current || !videoStreamRef.current) return;

        speechRef.current?.speak("Capturing...");
        setState("PROCESSING");

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0);

        const currentStream = videoStreamRef.current;
        currentStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);

        canvas.toBlob(async (blob) => {
            if (blob) {
                await uploadImage(blob);
            } else {
                setState("ERROR");
                setSummary("Failed to capture image.");
                speechRef.current?.speak("Failed to capture image.");
            }
        }, "image/jpeg", 0.85);
    }, []);

    useEffect(() => { startCameraRef.current = startCamera; }, [startCamera]);
    useEffect(() => { captureImageRef.current = captureImage; }, [captureImage]);

    const handleVoiceCommand = useCallback((command: SpeechCommand) => {
        console.log("Voice Command received:", command, "| Current state:", stateRef.current);
        resetInactivityTimer();

        switch (command) {
            case "OPEN_CAMERA":
                startCameraRef.current();
                break;
            case "CAPTURE_IMAGE":
                if (stateRef.current === "CAMERA") {
                    captureImageRef.current();
                } else {
                    speechRef.current?.speak("Camera is not open. Say open camera first.");
                }
                break;
            case "RETAKE_IMAGE":
                startCameraRef.current();
                break;
            case "REPLAY_SUMMARY":
                if (stateRef.current === "RESULT" && summaryRef.current) {
                    speechRef.current?.speak(summaryRef.current);
                } else {
                    speechRef.current?.speak("No summary to replay.");
                }
                break;
            case "STOP_SPEAKING":
                speechRef.current?.cancelSpeech();
                break;
            default:
                break;
        }
    }, [resetInactivityTimer]);


    useEffect(() => {
        speechRef.current = new SpeechService(handleVoiceCommand);

        return () => {
            speechRef.current?.stopListening();
            if (videoStreamRef.current) {
                videoStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [handleVoiceCommand]);

    useEffect(() => {
        inactivityTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - lastInteractionRef.current;
            if (elapsed >= INACTIVITY_TIMEOUT) {
                if (speechRef.current?.busy) return;

                const guidance = getScreenGuidance();
                if (guidance) {
                    console.log("⏱️ Inactivity — auto-repeating guidance for:", stateRef.current);
                    speechRef.current?.speak(guidance);

                    lastInteractionRef.current = Date.now();
                }
            }
        }, 1000);

        return () => {
            if (inactivityTimerRef.current) {
                clearInterval(inactivityTimerRef.current);
            }
        };
    }, [getScreenGuidance]);

    useEffect(() => {
        resetInactivityTimer();
    }, [state, resetInactivityTimer]);

    const handleFirstInteraction = useCallback(() => {
        if (stateRef.current !== "WELCOME") return;
        setState("INITIAL");
        setListening(true);
        resetInactivityTimer();

        speechRef.current?.speakThenListen(
            "Welcome to Vision Assistant. " +
            "Say open camera, to start the camera. " +
            "Or tap the start camera button on screen."
        );
    }, [resetInactivityTimer]);

    useEffect(() => {
        if (state === "CAMERA" && videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [state, videoStream]);

    const uploadImage = async (imageBlob: Blob) => {
        speechRef.current?.speak("Extracting details. Please wait.");

        const formData = new FormData();
        formData.append("file", imageBlob, "capture.jpg");

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Server error");
            }

            const data = await response.json();
            handleBackendResponse(data);

        } catch (err) {
            console.error("Upload error:", err);
            setState("ERROR");
            setSummary("Error connecting to server. Please try again.");
            speechRef.current?.speak("Error connecting to server. Please check your connection.");
        }
    };

    const handleBackendResponse = (data: { range_status: string, summary: string, image_base64?: string }) => {
        setState("RESULT");
        setSummary(data.summary);
        if (data.image_base64) {
            setCapturedImage(data.image_base64);
        }
        const fullAnnouncement =
            data.summary + ". " +
            "Here are your voice commands. " +
            "Say retake, to take a new photo. " +
            "Say replay, to hear this summary again. " +
            "Say stop, to stop me from speaking.";
        speechRef.current?.speak(fullAnnouncement);
    };

    const handleUploadFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                setState("PROCESSING");
                speechRef.current?.speak("Processing uploaded image.");
                await uploadImage(target.files[0]);
            }
        };
        input.click();
    };

    const handleAppClick = useCallback(() => {
        resetInactivityTimer();
        if (state === "CAMERA") {
            captureImage();
        }
    }, [state, captureImage, resetInactivityTimer]);

    return (
        <div className="app-container" onClick={handleAppClick}>

            <header className="app-header">
                <h1>Vision Assistant</h1>
                {state !== "WELCOME" && (
                    <div className={`mic-indicator ${listening ? 'active' : ''}`}>
                        <span className="mic-icon">🎤</span>
                        <span className="mic-label">{listening ? 'Listening...' : 'Mic Off'}</span>
                    </div>
                )}
            </header>

            {state === "WELCOME" && (
                <div className="screen welcome-screen" onClick={handleFirstInteraction}>
                    <div className="welcome-icon">👆</div>
                    <h2 className="welcome-title">Tap Anywhere to Begin</h2>
                    <p className="welcome-subtitle">
                        This activates voice commands and audio guidance
                    </p>
                </div>
            )}

            {state === "INITIAL" && (
                <div className="screen initial-screen">
                    <button className="large-btn" onClick={() => startCamera()}>
                        START CAMERA
                    </button>
                    <button className="large-btn secondary" onClick={handleUploadFile}>
                        UPLOAD IMAGE
                    </button>
                    <div className="instructions">
                        <p>Voice Commands:</p>
                        <ul>
                            <li>"Open Camera" — opens the camera</li>
                            <li>"Capture" / "Take Photo" — captures image</li>
                            <li>"Retake" — takes a new photo</li>
                            <li>"Replay" / "Repeat" — re-reads summary</li>
                            <li>"Stop" — stops speaking</li>
                        </ul>
                    </div>
                </div>
            )}

            {state === "CAMERA" && (
                <div className="screen camera-screen">
                    <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
                    <div className="overlay-text">Tap anywhere or say "Capture"</div>
                </div>
            )}

            {state === "PROCESSING" && (
                <div className="screen processing-screen">
                    <div className="spinner"></div>
                    <h2>Processing...</h2>
                </div>
            )}

            {(state === "RESULT" || state === "ERROR") && (
                <div className="screen result-screen">

                    {capturedImage && (
                        <div className="image-preview-container">
                            <img src={capturedImage} alt="Captured Product" className="image-preview" />
                        </div>
                    )}

                    <div className="summary-box">
                        {summary}
                    </div>

                    <div className="actions">
                        <button className="large-btn secondary" onClick={() => startCamera()}>
                            RETAKE
                        </button>
                        <button className="large-btn secondary" onClick={() => speechRef.current?.speak(summary)}>
                            REPLAY
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

export default App;
