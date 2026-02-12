
// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import SpeechService, { SpeechCommand } from './speechService';

// Backend URL
const API_URL = "http://localhost:8000/process-image";

type AppState = "INITIAL" | "CAMERA" | "PROCESSING" | "RESULT" | "ERROR";

function App() {
    const [state, setState] = useState<AppState>("INITIAL");
    const [summary, setSummary] = useState<string>("");
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const speechRef = useRef<SpeechService | null>(null);

    // Initialize Speech Service
    useEffect(() => {
        speechRef.current = new SpeechService(handleVoiceCommand);
        speechRef.current.startListening();

        // Initial announcement
        setTimeout(() => {
            speechRef.current?.speak("Welcome. Tap the start button or say Open Camera.");
        }, 1000);

        return () => {
            speechRef.current?.stopListening();
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Handle Voice Commands
    const handleVoiceCommand = (command: SpeechCommand) => {
        console.log("Voice Command received:", command);

        switch (command) {
            case "OPEN_CAMERA":
                startCamera();
                break;
            case "RETAKE_IMAGE":
                startCamera();
                break;
            case "REPLAY_SUMMARY":
                if (state === "RESULT" && summary) {
                    speechRef.current?.speak(summary);
                } else {
                    speechRef.current?.speak("No summary to replay.");
                }
                break;
            case "STOP_SPEAKING":
                speechRef.current?.cancelSpeech();
                break;
            default:
                // Optional: Feedback for unknown command?
                break;
        }
    };

    // 1. Start Camera
    const startCamera = async () => {
        try {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" } // Prefer back camera on mobile
            });

            setVideoStream(stream);
            setState("CAMERA");
            speechRef.current?.speak("Camera open. Tap anywhere to capture.");

        } catch (err) {
            console.error("Camera error:", err);
            setState("ERROR");
            setSummary("Could not access camera. Please allow permissions.");
            speechRef.current?.speak("Could not access camera. Please allow permissions.");
        }
    };

    // Attach stream to video element when in CAMERA mode
    useEffect(() => {
        if (state === "CAMERA" && videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [state, videoStream]);

    // 2. Capture Image
    const captureImage = async () => {
        if (!videoRef.current || !videoStream) return;

        // Feedback
        speechRef.current?.speak("Capturing...");
        setState("PROCESSING");

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0);

        // Stop camera stream to save battery/resources
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);

        // Convert to Blob
        canvas.toBlob(async (blob) => {
            if (blob) {
                await uploadImage(blob);
            } else {
                setState("ERROR");
                setSummary("Failed to capture image.");
                speechRef.current?.speak("Failed to capture image.");
            }
        }, "image/jpeg", 0.85);
    };

    // 3. Upload to Backend
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

    // 4. Handle Response
    const handleBackendResponse = (data: { range_status: string, summary: string, image_base64?: string }) => {
        // We always go to RESULT now, range_status "too_far" is effectively deprecated by backend 
        // but kept for backward compatibility if needed. 
        setState("RESULT");
        setSummary(data.summary);
        if (data.image_base64) {
            setCapturedImage(data.image_base64);
        }
        speechRef.current?.speak(data.summary);
    };

    // Renders
    return (
        <div className="app-container" onClick={state === "CAMERA" ? captureImage : undefined}>

            {/* HEADER for all screens */}
            <header className="app-header">
                <h1>Vision Assistant</h1>
            </header>

            {/* INITIAL SCREEN */}
            {state === "INITIAL" && (
                <div className="screen initial-screen">
                    <button className="large-btn" onClick={() => startCamera()}>
                        START CAMERA
                    </button>
                    <div className="instructions">
                        <p>Voice Commands:</p>
                        <ul>
                            <li>"Open Camera"</li>
                            <li>"Retake Image"</li>
                            <li>"Replay Summary"</li>
                            <li>"Stop Speaking"</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* CAMERA SCREEN */}
            {state === "CAMERA" && (
                <div className="screen camera-screen">
                    <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
                    <div className="overlay-text">Tap anywhere to capture</div>
                </div>
            )}

            {/* PROCESSING SCREEN */}
            {state === "PROCESSING" && (
                <div className="screen processing-screen">
                    <div className="spinner"></div>
                    <h2>Processing...</h2>
                </div>
            )}

            {/* RESULT / ERROR SCREEN */}
            {(state === "RESULT" || state === "ERROR") && (
                <div className="screen result-screen">

                    {/* Display captured image if available */}
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
