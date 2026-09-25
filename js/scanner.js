/**
 * Glow Care - Live AI Face Skin Scanner Engine
 * Real-time Camera Feed, Dual-Engine Face Detection (BlazeFace + Chromatic Tracker),
 * Alignment Guidance, Multi-Phase Scanning, Real Computer Vision Pixel Analysis,
 * Zone-by-Zone Diagnostics, Interactive Hotspots, and Skincare Recommendations.
 */

let videoElement = null;
let overlayCanvas = null;
let overlayCtx = null;
let cameraStream = null;
let animationFrameId = null;
let isScanning = false;
let isCameraActive = false;
let activeImageSource = null; // Can be videoElement, or HTMLImageElement for demo/upload
let blazefaceModel = null;
let faceDetected = false;
let lastFaceBox = null;
let faceCentered = false;
let faceDistanceStatus = 'ok'; // 'closer', 'back', 'ok'
let scanProgress = 0;

const SCAN_PHASES = [
  'Phase 1/4: Facial Landmark & Oval Alignment Calibration',
  'Phase 2/4: T-Zone Sebum & Epidermal Hydration Spectrometry',
  'Phase 3/4: Micro-Texture, Capillary Redness & Pore Depth Inspection',
  'Phase 4/4: Melanin Distribution, Blemish & Under-Eye Tone Mapping'
];

document.addEventListener('DOMContentLoaded', () => {
  videoElement = document.getElementById('camera-video');
  overlayCanvas = document.getElementById('overlay-canvas');
  if (overlayCanvas) {
    overlayCtx = overlayCanvas.getContext('2d');
  }

  // Pre-load BlazeFace AI model in background if CDN is accessible
  initBlazeFaceModel();

  // Bind Buttons
  const startScanBtn = document.getElementById('btn-start-camera');
  const captureScanBtn = document.getElementById('btn-run-analysis');
  const stopCameraBtn = document.getElementById('btn-stop-camera');
  const demoUploadInput = document.getElementById('file-upload-selfie');
  const demoPresetBtn = document.getElementById('btn-load-demo-selfie');
  const scanAgainBtn = document.getElementById('btn-scan-again');

  if (startScanBtn) startScanBtn.addEventListener('click', startLiveCamera);
  if (captureScanBtn) captureScanBtn.addEventListener('click', startScanSequence);
  if (stopCameraBtn) stopCameraBtn.addEventListener('click', stopLiveCamera);
  if (scanAgainBtn) scanAgainBtn.addEventListener('click', resetScannerForNewScan);

  if (demoPresetBtn) {
    demoPresetBtn.addEventListener('click', loadPresetDemoSelfie);
  }

  if (demoUploadInput) {
    demoUploadInput.addEventListener('change', handleUploadedSelfie);
  }

  // Check URL parameters for autostart
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('autostart') === '1' || urlParams.get('start') === 'true') {
    setTimeout(() => {
      startLiveCamera();
    }, 400);
  }

  // Initialize active AI engine indicator
  updateEngineIndicator();

  // Check if a previous scan exists in store and display it
  checkAndDisplayPreviousScan();
});

// Load BlazeFace Model from CDN asynchronously
async function initBlazeFaceModel() {
  try {
    if (window.blazeface) {
      blazefaceModel = await window.blazeface.load();
      console.log('Glow Care: BlazeFace AI Face Detection Model loaded successfully.');
    }
  } catch (err) {
    console.warn('Glow Care: BlazeFace CDN unavailable or offline. Fast Chromatic Face Vision active.');
  }
}

// 1. Request Camera & Start Video Feed
async function startLiveCamera() {
  const standbyScreen = document.getElementById('camera-standby-screen');
  const hudLayer = document.getElementById('hud-layer');
  const captureBtn = document.getElementById('btn-run-analysis');
  const stopBtn = document.getElementById('btn-stop-camera');
  const startBtn = document.getElementById('btn-start-camera');

  try {
    updateGuidanceBadge('Requesting camera permission...', 'warning');

    const constraints = {
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    };

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = cameraStream;
    activeImageSource = videoElement;

    // Wait until video metadata is loaded before starting loop
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });

    isCameraActive = true;
    standbyScreen.style.display = 'none';
    hudLayer.classList.add('active');

    if (startBtn) startBtn.style.display = 'none';
    if (captureBtn) {
      captureBtn.style.display = 'inline-flex';
      captureBtn.disabled = false; // Always allow user to scan once camera is on
    }
    if (stopBtn) stopBtn.style.display = 'inline-flex';

    resizeOverlayCanvas();
    window.addEventListener('resize', resizeOverlayCanvas);

    updateGuidanceBadge('Center your face inside the oval', 'warning');
    SoundFx.playBeep(520, 0.1);

    // Start Real-time Detection Loop
    startDetectionLoop();

  } catch (err) {
    console.error('Camera access error:', err);
    updateGuidanceBadge('Camera blocked. Try Demo Selfie below.', 'warning');
    window.showToast('Camera permission denied or camera not found. Loading Demo Selfie so you can test the scanner!', 'warning');
    loadPresetDemoSelfie();
  }
}

function stopLiveCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  isCameraActive = false;
  activeImageSource = null;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  const standbyScreen = document.getElementById('camera-standby-screen');
  const hudLayer = document.getElementById('hud-layer');
  const captureBtn = document.getElementById('btn-run-analysis');
  const stopBtn = document.getElementById('btn-stop-camera');
  const startBtn = document.getElementById('btn-start-camera');

  if (standbyScreen) standbyScreen.style.display = 'flex';
  if (hudLayer) hudLayer.classList.remove('active');
  if (startBtn) startBtn.style.display = 'inline-flex';
  if (captureBtn) captureBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';

  if (overlayCtx && overlayCanvas) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }
}

function resizeOverlayCanvas() {
  if (!videoElement || !overlayCanvas) return;
  overlayCanvas.width = videoElement.clientWidth || 640;
  overlayCanvas.height = videoElement.clientHeight || 480;
}

// 2. Real-time Face Detection & Guidance Loop
async function startDetectionLoop() {
  if (!isCameraActive || activeImageSource !== videoElement) return;

  try {
    let face = null;

    // Method A: BlazeFace AI Model
    if (blazefaceModel && videoElement.readyState >= 2) {
      const predictions = await blazefaceModel.estimateFaces(videoElement, false);
      if (predictions && predictions.length > 0) {
        const p = predictions[0];
        const start = p.topLeft;
        const end = p.bottomRight;
        const width = end[0] - start[0];
        const height = end[1] - start[1];
        face = {
          x: start[0],
          y: start[1],
          width: width,
          height: height,
          landmarks: p.landmarks || []
        };
      }
    }

    // Method B: Fail-Safe Built-in Chromatic Skin Tone Tracker
    if (!face && videoElement.readyState >= 2) {
      face = detectFaceViaSkinTone(videoElement);
    }

    handleFaceGuidance(face);
    renderHUDOverlay(face);

  } catch (err) {
    // Continue loop smoothly
  }

  if (isCameraActive && !isScanning && activeImageSource === videoElement) {
    animationFrameId = requestAnimationFrame(startDetectionLoop);
  }
}

// Chromatic Fast Skin-Tone Tracker (Built-in fail-safe computer vision)
function detectFaceViaSkinTone(video) {
  const cw = 160;
  const ch = 120;
  if (!window._offCanvas) {
    window._offCanvas = document.createElement('canvas');
    window._offCanvas.width = cw;
    window._offCanvas.height = ch;
    window._offCtx = window._offCanvas.getContext('2d', { willReadFrequently: true });
  }

  const offCtx = window._offCtx;
  offCtx.drawImage(video, 0, 0, cw, ch);
  const imgData = offCtx.getImageData(0, 0, cw, ch);
  const data = imgData.data;

  let minX = cw, maxX = 0, minY = ch, maxY = 0, skinPixels = 0;

  for (let y = 0; y < ch; y += 3) {
    for (let x = 0; x < cw; x += 3) {
      const idx = (y * cw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const sum = r + g + b;
      if (sum > 0) {
        const nr = r / sum;
        const ng = g / sum;
        if (nr > 0.35 && nr < 0.55 && ng > 0.28 && ng < 0.40 && (r - g) > 12) {
          skinPixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (skinPixels > 100) {
    const scaleX = (video.clientWidth || 640) / cw;
    const scaleY = (video.clientHeight || 480) / ch;
    return {
      x: minX * scaleX,
      y: minY * scaleY,
      width: Math.max(130, (maxX - minX) * scaleX),
      height: Math.max(150, (maxY - minY) * scaleY),
      landmarks: []
    };
  }

  return null;
}

// 3. User Guidance Logic ("Face detected", "Keep centered", "Move closer", "Move back")
function handleFaceGuidance(face) {
  const hudTarget = document.querySelector('.hud-face-target');
  const captureBtn = document.getElementById('btn-run-analysis');

  if (!face) {
    faceDetected = false;
    updateGuidanceBadge('Position your face in front of the camera', 'warning');
    if (hudTarget) hudTarget.className = 'hud-face-target';
    return;
  }

  faceDetected = true;
  lastFaceBox = face;

  const canvasW = overlayCanvas.width || 640;
  const canvasH = overlayCanvas.height || 480;

  const faceCenterX = face.x + face.width / 2;
  const faceCenterY = face.y + face.height / 2;
  const frameCenterX = canvasW / 2;
  const frameCenterY = canvasH / 2;

  const offsetX = Math.abs(faceCenterX - frameCenterX);
  const offsetY = Math.abs(faceCenterY - frameCenterY);
  const faceSizeRatio = face.width / canvasW;

  if (offsetX > canvasW * 0.25 || offsetY > canvasH * 0.28) {
    faceCentered = false;
    faceDistanceStatus = 'uncentered';
    updateGuidanceBadge('Keep your face centered in the oval', 'warning');
    if (hudTarget) hudTarget.className = 'hud-face-target warning';
  } else if (faceSizeRatio < 0.22) {
    faceDistanceStatus = 'closer';
    updateGuidanceBadge('Move closer to the camera', 'warning');
    if (hudTarget) hudTarget.className = 'hud-face-target warning';
  } else if (faceSizeRatio > 0.75) {
    faceDistanceStatus = 'back';
    updateGuidanceBadge('Move back slightly', 'warning');
    if (hudTarget) hudTarget.className = 'hud-face-target warning';
  } else {
    faceCentered = true;
    faceDistanceStatus = 'ok';
    updateGuidanceBadge('Face detected — Ready to scan!', 'success');
    if (hudTarget) hudTarget.className = 'hud-face-target detected';
  }

  if (captureBtn) captureBtn.disabled = false;
}

function updateGuidanceBadge(text, state = 'success') {
  const badge = document.getElementById('hud-guidance-text');
  const indicator = document.querySelector('.hud-status-indicator');
  if (badge) badge.textContent = text;
  if (indicator) {
    indicator.style.background = state === 'success' ? '#52B788' : '#F4A261';
    indicator.style.boxShadow = state === 'success' ? '0 0 10px #52B788' : '0 0 10px #F4A261';
  }
}

// 4. Draw HUD overlay markers on Canvas
function renderHUDOverlay(face) {
  if (!overlayCtx || !overlayCanvas) return;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!face) return;

  const { x, y, width, height } = face;

  // Draw face bounding box corners with radiant rose/emerald glow
  overlayCtx.save();
  overlayCtx.strokeStyle = faceCentered && faceDistanceStatus === 'ok' ? '#52B788' : 'rgba(226, 123, 115, 0.7)';
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([6, 6]);
  overlayCtx.strokeRect(x, y, width, height);

  // Draw landmark tracking points if available
  if (face.landmarks && face.landmarks.length > 0) {
    overlayCtx.fillStyle = '#52B788';
    face.landmarks.forEach(pt => {
      overlayCtx.beginPath();
      overlayCtx.arc(pt[0], pt[1], 4, 0, Math.PI * 2);
      overlayCtx.fill();
    });
  } else {
    // Draw zone target points (Forehead, Left Cheek, Right Cheek, Nose, Chin, Under-Eyes)
    const points = [
      { x: x + width * 0.5, y: y + height * 0.22, label: 'Forehead' },
      { x: x + width * 0.28, y: y + height * 0.52, label: 'L-Cheek' },
      { x: x + width * 0.72, y: y + height * 0.52, label: 'R-Cheek' },
      { x: x + width * 0.5, y: y + height * 0.48, label: 'T-Zone' },
      { x: x + width * 0.5, y: y + height * 0.82, label: 'Chin' },
      { x: x + width * 0.32, y: y + height * 0.38, label: 'L-Eye' },
      { x: x + width * 0.68, y: y + height * 0.38, label: 'R-Eye' }
    ];

    points.forEach(pt => {
      overlayCtx.beginPath();
      overlayCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      overlayCtx.fillStyle = '#E27B73';
      overlayCtx.fill();

      overlayCtx.beginPath();
      overlayCtx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      overlayCtx.strokeStyle = 'rgba(226, 123, 115, 0.4)';
      overlayCtx.stroke();
    });
  }

  overlayCtx.restore();
}

// 5. Trigger Scanning Sequence & Multi-phase Progress
async function startScanSequence() {
  if (isScanning) return;
  isScanning = true;

  // Clear previous quality alerts and reset previous results
  hideQualityAlert();
  const resultsSection = document.getElementById('scanner-results-section');
  if (resultsSection) resultsSection.classList.remove('show');

  const laser = document.getElementById('laser-scanning-sweep');
  const progressOverlay = document.getElementById('hud-progress-overlay');
  const progressBar = document.getElementById('scan-progress-bar');
  const progressPct = document.getElementById('scan-phase-pct');
  const phaseName = document.getElementById('scan-phase-name');
  const captureBtn = document.getElementById('btn-run-analysis');

  if (captureBtn) captureBtn.disabled = true;
  if (laser) laser.classList.add('scanning');
  if (progressOverlay) progressOverlay.classList.add('active');

  SoundFx.scanChime();
  updateGuidanceBadge('Scanning skin in progress... Hold still!', 'success');

  // Progressive 4-phase timer (~2.8 seconds)
  const totalDuration = 2800;
  const intervalStep = 70;
  let elapsed = 0;

  const scanTimer = setInterval(() => {
    elapsed += intervalStep;
    const progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressPct) progressPct.textContent = `${progress}%`;

    const currentPhase = Math.min(3, Math.floor(progress / 25));
    if (phaseName && SCAN_PHASES[currentPhase]) {
      phaseName.textContent = SCAN_PHASES[currentPhase];
    }

    if (progress % 20 === 0 && progress < 100) {
      SoundFx.playBeep(700 + progress * 4, 0.05);
    }

    if (progress >= 100) {
      clearInterval(scanTimer);
      completeScanProcess();
    }
  }, intervalStep);
}

// 6. Complete Scan & Execute Strict Step 1 & Step 2 Validation Pipeline
async function completeScanProcess() {
  const laser = document.getElementById('laser-scanning-sweep');
  const progressOverlay = document.getElementById('hud-progress-overlay');
  const captureBtn = document.getElementById('btn-run-analysis');

  if (laser) laser.classList.remove('scanning');
  if (progressOverlay) progressOverlay.classList.remove('active');
  if (captureBtn) captureBtn.disabled = false;
  isScanning = false;

  // 1. Capture snapshot canvas
  const snapshot = captureVideoSnapshot();

  // Check if optional Google Gemini Vision Engine is selected
  const activeEngine = localStorage.getItem('glowcare_ai_engine') || 'builtin';
  const geminiApiKey = localStorage.getItem('glowcare_gemini_api_key') || '';

  if (activeEngine === 'gemini' && geminiApiKey) {
    try {
      updateGuidanceBadge('Consulting Gemini Vision AI...', 'warning');
      const geminiText = await callGeminiVisionAnalysis(snapshot.canvas);

      // Check Step 1 Failure response from Gemini
      if (geminiText.includes("This image does not contain a valid human face")) {
        SoundFx.playBeep(380, 0.22, 'sawtooth');
        showValidationAlert(1, "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.", "Gemini Vision verified that no valid human face is present in this image.");
        updateGuidanceBadge('Step 1 Failed: Non-human image', 'warning');
        window.showToast("This image does not contain a valid human face.", "warning");

        const resultsSection = document.getElementById('scanner-results-section');
        if (resultsSection) resultsSection.classList.remove('show');
        return;
      }

      // Check Step 2 Failure response from Gemini
      if (geminiText.includes("I can detect a human face, but the image quality is not sufficient")) {
        SoundFx.playBeep(380, 0.22, 'sawtooth');
        showValidationAlert(2, "I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo.", "Gemini Vision determined that the lighting, sharpness, or visibility is inadequate for reliable skin analysis.");
        updateGuidanceBadge('Step 2 Failed: Image quality insufficient', 'warning');
        window.showToast("Image quality is not sufficient for skin analysis.", "warning");

        const resultsSection = document.getElementById('scanner-results-section');
        if (resultsSection) resultsSection.classList.remove('show');
        return;
      }

      // If passed, parse Gemini response and render
      hideValidationAlert();
      SoundFx.successChime();

      const parsedGemini = parseGeminiSkinReport(geminiText, snapshot.canvas);
      if (window.store) {
        window.store.saveScan({
          ...parsedGemini,
          snapshotImage: snapshot.dataUrl,
          timestamp: new Date().toISOString()
        });
      }

      updateGuidanceBadge('Human face detected ✓ Skin Analysis complete', 'success');
      window.showToast('Skin analysis completed successfully!', 'success');
      renderResultsDashboard(parsedGemini, snapshot.dataUrl);

      setTimeout(() => {
        const resultsSection = document.getElementById('scanner-results-section');
        if (resultsSection) {
          resultsSection.classList.add('show');
          resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 350);
      return;

    } catch (gErr) {
      console.warn("Gemini Vision failed, falling back to built-in Computer Vision:", gErr);
      window.showToast("Gemini Vision request: " + gErr.message + ". Running built-in Computer Vision.", "warning");
    }
  }

  // 2. BUILT-IN DUAL-STEP VALIDATION (Strict Step 1 & Step 2 Enforcement)
  const validation = await runTwoStepFaceValidation(snapshot.canvas);

  if (!validation.valid) {
    SoundFx.playBeep(380, 0.22, 'sawtooth');
    showValidationAlert(validation.step, validation.message, validation.detail);
    
    if (validation.step === 1) {
      updateGuidanceBadge('Step 1 Failed: Non-human image', 'warning');
      window.showToast('Human validation failed: Stop workflow immediately.', 'warning');
    } else {
      updateGuidanceBadge('Step 2 Failed: Image quality insufficient', 'warning');
      window.showToast('Image quality check failed: Stop before skin analysis.', 'warning');
    }

    const resultsSection = document.getElementById('scanner-results-section');
    if (resultsSection) resultsSection.classList.remove('show');
    return; // STOP THE ENTIRE WORKFLOW IMMEDIATELY! NO SKIN ANALYSIS!
  }

  // Validation passed: hide alert banner
  hideValidationAlert();
  SoundFx.successChime();

  // 3. Step 3 — Perform Visual Facial-Skin Characteristics Analysis
  const analysisResult = analyzeFaceSkinCharacteristics(snapshot.canvas, validation.faceBox);

  // Save to Central Store
  if (window.store) {
    window.store.saveScan({
      ...analysisResult,
      snapshotImage: snapshot.dataUrl,
      timestamp: new Date().toISOString()
    });
  }

  updateGuidanceBadge('Human face detected ✓ Analysis complete!', 'success');
  window.showToast('Human face detected ✓ Skin analysis complete.', 'success');

  // Render Official Report & Full Results Dashboard
  renderResultsDashboard(analysisResult, snapshot.dataUrl);

  // Smooth scroll to results
  setTimeout(() => {
    const resultsSection = document.getElementById('scanner-results-section');
    if (resultsSection) {
      resultsSection.classList.add('show');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, 350);
}

// Show / Hide Quality Alert Notice Banner with Prompt-Compliant Format
function showValidationAlert(step, message, detail) {
  const banner = document.getElementById('quality-alert-banner');
  const iconEl = document.getElementById('quality-alert-icon');
  const badgeEl = document.getElementById('quality-alert-step-badge');
  const titleEl = document.getElementById('quality-alert-title');
  const msgEl = document.getElementById('quality-alert-message');
  const detailEl = document.getElementById('quality-alert-details');

  if (banner) {
    banner.classList.remove('step-human-fail', 'step-quality-fail');
    if (step === 1) {
      banner.classList.add('step-human-fail');
      if (iconEl) iconEl.textContent = '🚫';
      if (badgeEl) badgeEl.textContent = 'Step 1 — Human Detection: Failed';
      if (titleEl) titleEl.textContent = 'Non-Human Image Detected';
    } else {
      banner.classList.add('step-quality-fail');
      if (iconEl) iconEl.textContent = '⚠️';
      if (badgeEl) badgeEl.textContent = 'Step 2 — Face Quality Check: Insufficient';
      if (titleEl) titleEl.textContent = 'Image Quality Notice';
    }

    if (msgEl) msgEl.textContent = message;
    if (detailEl) detailEl.textContent = detail || '';

    banner.style.display = 'flex';
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function hideValidationAlert() {
  const banner = document.getElementById('quality-alert-banner');
  if (banner) banner.style.display = 'none';
}

// Legacy alias to maintain backward compatibility
function showQualityAlert(title, message, detail) {
  showValidationAlert(2, message, detail);
}
function hideQualityAlert() {
  hideValidationAlert();
}

// =========================================================================
// STEP 1 — HUMAN DETECTION ENGINE
// Analyzes the uploaded image first and determines whether it contains
// a real human face.
// If the image does NOT contain a clearly visible real human face, DO NOT
// perform any skin analysis.
// Rejects: objects, animals, plants, scenery, food, products, screenshots,
// drawings, cartoons, anime characters, illustrations, mannequins, statues,
// AI-generated non-human faces, and other non-human images.
//
// Prompt Mandated Response:
// "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis."
// =========================================================================
async function validateHumanFacePresence(canvas) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "No image frame could be captured for face analysis."
    };
  }

  // 1. Run BlazeFace Neural Face Detector
  let preds = [];
  if (blazefaceModel) {
    try {
      preds = await blazefaceModel.estimateFaces(canvas, false);
    } catch (err) {
      console.warn("BlazeFace detection error:", err);
    }
  }

  // Strict Rule: If no face detected by BlazeFace -> Reject!
  // (NEVER fallback to raw chromatic skin tone detector for objects/animals!)
  if (!preds || preds.length === 0) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "No human face could be identified. Objects, animals, plants, scenery, food, products, and non-human images cannot be analyzed."
    };
  }

  const p = preds[0];
  const conf = Array.isArray(p.probability) ? p.probability[0] : (p.probability || 1.0);
  if (conf < 0.78) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Face confidence score is below human face verification threshold."
    };
  }

  const fx1 = p.topLeft[0];
  const fy1 = p.topLeft[1];
  const fx2 = p.bottomRight[0];
  const fy2 = p.bottomRight[1];
  const fw = fx2 - fx1;
  const fh = fy2 - fy1;

  if (fw <= 25 || fh <= 25) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Detected feature scale is too small to constitute a valid human face."
    };
  }

  // 2. Validate Facial Anatomical Proportions & Geometry
  const landmarks = p.landmarks;
  if (!landmarks || landmarks.length < 4) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Facial anatomical landmarks (eyes, nose, mouth) could not be resolved."
    };
  }

  const rightEye = landmarks[0];
  const leftEye = landmarks[1];
  const nose = landmarks[2];
  const mouth = landmarks[3];

  const eyeDx = leftEye[0] - rightEye[0];
  const eyeDy = leftEye[1] - rightEye[1];
  const eyeDistance = Math.hypot(eyeDx, eyeDy);

  // Proportion of eye distance to face width
  const eyeRatio = eyeDistance / fw;
  if (eyeRatio < 0.18 || eyeRatio > 0.62) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Facial landmark proportions do not match real human biological anatomy."
    };
  }

  // Tilt orientation check
  const angleDeg = Math.abs(Math.atan2(eyeDy, eyeDx) * (180 / Math.PI));
  if (angleDeg > 45) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Orientation is tilted or inverted; valid front-facing human face required."
    };
  }

  // Vertical sequence: Eyes must be above nose, nose above mouth
  const eyeAvgY = (rightEye[1] + leftEye[1]) / 2;
  if (nose[1] <= eyeAvgY || mouth[1] <= nose[1]) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Vertical landmark configuration does not match human facial structure."
    };
  }

  // 3. Pixel-Level Biological vs Cartoon / Drawing / Anime / Statue / Mannequin Discrimination
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const startX = Math.max(0, Math.round(fx1));
  const startY = Math.max(0, Math.round(fy1));
  const boxW = Math.min(canvas.width - startX, Math.round(fw));
  const boxH = Math.min(canvas.height - startY, Math.round(fh));

  if (boxW < 20 || boxH < 20) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Face bounding coordinates outside valid frame limits."
    };
  }

  const faceImgData = ctx.getImageData(startX, startY, boxW, boxH);
  const data = faceImgData.data;

  let skinPixelCount = 0;
  let totalSampleCount = 0;
  let grayPixelCount = 0;
  let lineArtCount = 0;
  const colorBuckets = new Set();

  for (let y = 2; y < boxH - 2; y += 3) {
    for (let x = 2; x < boxW - 2; x += 3) {
      const idx = (y * boxW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      totalSampleCount++;

      // Color quantization check (for flat anime / cartoon cel-shading)
      const qr = Math.floor(r / 16);
      const qg = Math.floor(g / 16);
      const qb = Math.floor(b / 16);
      colorBuckets.add(`${qr}-${qg}-${qb}`);

      // Monochrome / statue check (marble, stone, plaster, bronze)
      if (Math.abs(r - g) < 5 && Math.abs(g - b) < 5) {
        grayPixelCount++;
      }

      // Check for sharp dark line art strokes typical of drawings/cartoons
      const idxR = (y * boxW + (x + 1)) * 4;
      const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
      if (Math.abs(lum - lumR) > 85 && lum < 55) {
        lineArtCount++;
      }

      // Biological human skin chromatic gamut test (Melanin-Hemoglobin gamut)
      const sum = r + g + b;
      if (sum > 0) {
        const nr = r / sum;
        const ng = g / sum;
        if (nr >= 0.33 && nr <= 0.62 && ng >= 0.25 && ng <= 0.42 && r > g && g >= b * 0.70) {
          skinPixelCount++;
        }
      }
    }
  }

  const skinRatio = totalSampleCount > 0 ? (skinPixelCount / totalSampleCount) : 0;
  const grayRatio = totalSampleCount > 0 ? (grayPixelCount / totalSampleCount) : 0;
  const lineArtRatio = totalSampleCount > 0 ? (lineArtCount / totalSampleCount) : 0;
  const colorDiversity = colorBuckets.size;

  // A. Statue / Plaster / Stone Check
  if (grayRatio > 0.60) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Monochrome surface detected; characteristic of statues, sculptures, mannequins, or drawings."
    };
  }

  // B. Biological human skin tone ratio check
  if (skinRatio < 0.20) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Natural human skin chromatic tones not detected. Non-human images, objects, or illustrations cannot be analyzed."
    };
  }

  // C. Cartoon / Anime / Flat Digital Drawing Check
  if (colorDiversity < 15 && totalSampleCount > 180) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Flat cel-shading detected; characteristic of cartoons, anime characters, or digital illustrations."
    };
  }

  if (lineArtRatio > 0.12 && skinRatio < 0.38) {
    return {
      pass: false,
      step: 1,
      message: "This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis.",
      detail: "Illustration outlines detected; characteristic of drawings or animated artwork."
    };
  }

  // Real human face verified!
  return {
    pass: true,
    faceBox: {
      x: fx1,
      y: fy1,
      width: fw,
      height: fh
    },
    landmarks: landmarks,
    confidence: conf
  };
}

// =========================================================================
// STEP 2 — FACE QUALITY CHECK ENGINE
// If a real human face is detected, check whether the face is sufficiently
// visible for analysis.
// The face should ideally be:
// - Clearly visible
// - Well lit
// - Not heavily blurred
// - Not substantially covered by masks, hands, hair, or other objects
// - Large enough in the image to inspect facial skin
//
// Prompt Mandated Response:
// "I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo."
// =========================================================================
function validateFaceQuality(canvas, faceBox, landmarks) {
  const cw = canvas.width;
  const ch = canvas.height;

  // 1. Face size check
  const faceArea = faceBox.width * faceBox.height;
  const canvasArea = cw * ch;
  const areaRatio = faceArea / canvasArea;

  if (faceBox.width < cw * 0.16 || faceBox.height < ch * 0.16 || areaRatio < 0.030 || faceBox.width < 70) {
    return {
      pass: false,
      step: 2,
      message: "I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo.",
      detail: "Face is too far away or small in the frame to inspect skin texture and pore characteristics."
    };
  }

  // 2. Pixel data extraction for luminance, sharpness, and occlusion
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const fx = Math.max(0, Math.round(faceBox.x));
  const fy = Math.max(0, Math.round(faceBox.y));
  const fw = Math.min(cw - fx, Math.round(faceBox.width));
  const fh = Math.min(ch - fy, Math.round(faceBox.height));

  const faceImgData = ctx.getImageData(fx, fy, fw, fh);
  const data = faceImgData.data;

  let totalLum = 0;
  let gradientSum = 0;
  let sampleCount = 0;
  let skinPixels = 0;
  const gradList = [];

  for (let y = 0; y < fh - 2; y += 3) {
    for (let x = 0; x < fw - 2; x += 3) {
      const idx = (y * fw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLum += lum;

      const sum = r + g + b;
      if (sum > 0) {
        const nr = r / sum;
        const ng = g / sum;
        if (nr >= 0.33 && nr <= 0.60 && ng >= 0.25 && ng <= 0.42 && r > g) {
          skinPixels++;
        }
      }

      // Edge sharpness via neighbor differences
      const idxR = (y * fw + (x + 1)) * 4;
      const idxD = ((y + 1) * fw + x) * 4;
      const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
      const lumD = 0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2];
      const grad = Math.abs(lum - lumR) + Math.abs(lum - lumD);
      gradientSum += grad;
      gradList.push(grad);
      sampleCount++;
    }
  }

  const avgLum = sampleCount > 0 ? totalLum / sampleCount : 128;
  const avgGrad = sampleCount > 0 ? gradientSum / sampleCount : 0;

  // Sharpness variance
  let gradVarSum = 0;
  gradList.forEach(g => { gradVarSum += (g - avgGrad) ** 2; });
  const gradStdDev = sampleCount > 0 ? Math.sqrt(gradVarSum / sampleCount) : 0;

  // Lighting check: Too dark (< 40)
  if (avgLum < 40) {
    return {
      pass: false,
      step: 2,
      message: "I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo.",
      detail: `Average face brightness is critically low (${Math.round(avgLum)}/255). Facial skin details cannot be inspected in low light.`
    };
  }

  // Lighting check: Overexposed (> 236)
  if (avgLum > 236) {
    return {
      pass: false,
      step: 2,
      message: "I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo.",
      detail: `Face brightness is washed out by direct flash or harsh glare (${Math.round(avgLum)}/255).`
    };
  }

  // Blurriness check
  if (gradStdDev < 3.4 && avgGrad < 3.8) {
    return {
      pass: false,
      step: 2,
      message: "I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo.",
      detail: "Micro-texture and edge contrast are heavily blurred or out of focus."
    };
  }

  // Occlusion check (Masks, sunglasses, hair, hands covering face)
  const skinRatio = sampleCount > 0 ? skinPixels / sampleCount : 0;
  if (skinRatio < 0.26) {
    return {
      pass: false,
      step: 2,
      message: "I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo.",
      detail: "Face is substantially covered by a mask, hands, hair, or other objects."
    };
  }

  return { pass: true };
}

// Master Two-Step Validation Function
async function runTwoStepFaceValidation(canvas) {
  // Step 1: Human Detection
  const step1 = await validateHumanFacePresence(canvas);
  if (!step1.pass) {
    return {
      valid: false,
      step: 1,
      icon: '🚫',
      badgeText: 'Step 1 — Human Detection: Failed',
      title: 'Valid Human Face Required',
      message: step1.message,
      detail: step1.detail
    };
  }

  // Step 2: Face Quality Check
  const step2 = validateFaceQuality(canvas, step1.faceBox, step1.landmarks);
  if (!step2.pass) {
    return {
      valid: false,
      step: 2,
      icon: '⚠️',
      badgeText: 'Step 2 — Face Quality Check: Insufficient',
      title: 'Image Quality Insufficient',
      message: step2.message,
      detail: step2.detail
    };
  }

  return {
    valid: true,
    faceBox: step1.faceBox,
    landmarks: step1.landmarks
  };
}

// Optional Google Gemini Vision API Client
async function callGeminiVisionAnalysis(canvas) {
  const apiKey = localStorage.getItem('glowcare_gemini_api_key') || '';
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  const promptText = `Analyze the uploaded image first and determine whether it contains a real human face.

If the image does NOT contain a clearly visible real human face, DO NOT perform any skin analysis.
This includes objects, animals, plants, scenery, food, products, screenshots, drawings, cartoons, anime characters, illustrations, mannequins, statues, AI-generated non-human faces, and other non-human images.

If the image is not suitable for human-face analysis, respond only:
"This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis."

Step 2 — Face Quality Check
If a real human face is detected, check whether the face is sufficiently visible for analysis.
The face should ideally be:
Clearly visible
Well lit
Not heavily blurred
Not substantially covered by masks, hands, hair, or other objects
Large enough in the image to inspect facial skin

If the face cannot be analyzed reliably, do NOT guess. Respond:
"I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo."

Important Rules:
NEVER analyze a non-human image.
NEVER assume an object, animal, cartoon, statue, or illustration is a human face.
Do not diagnose diseases or medical conditions from an image.
Do not claim certainty about a person's health based on their appearance.
If something is not clearly visible, say that it cannot be reliably assessed.
Do not invent measurements or details that cannot be determined from the image.
Keep the analysis focused on visible facial-skin characteristics.
Human validation MUST happen before skin analysis.
If human validation fails, stop the entire workflow immediately.
If a human face is detected but the image quality is inadequate, stop before skin analysis.

Response Format:
If NOT human:
"This image does not contain a valid human face. Please upload a clear photo of a real human face for skin analysis."

If human but image quality is insufficient:
"I can detect a human face, but the image quality is not sufficient for reliable skin analysis. Please upload a clearer, well-lit face photo."

If human and suitable for analysis:

Human face detected ✓

Skin Analysis:

Skin characteristics:
[Description]

Hydration:
[Assessment]

Oiliness:
[Assessment]

Pores:
[Assessment]

Acne/blemishes:
[Assessment]

Redness:
[Assessment]

Pigmentation:
[Assessment]

Skin tone:
[Assessment]

Texture/fine lines:
[Assessment]

Overall visible condition:
[Assessment]

Note: This is an image-based visual assessment, not a medical diagnosis. Results can vary depending on lighting, camera quality, makeup, and image resolution.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API request failed (${response.status})`);
  }

  const resJson = await response.json();
  const textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return textOutput;
}

// Parse Gemini structured text output into Glow Care dashboard format
function parseGeminiSkinReport(geminiText, canvas) {
  const getField = (label) => {
    const regex = new RegExp(`${label}:?\\s*([^\\n]+(?:\\n(?!\\w+:|Note:)[^\\n]+)*)`, 'i');
    const match = geminiText.match(regex);
    return match ? match[1].trim() : 'Visually assessed';
  };

  const skinCharacteristics = getField('Skin characteristics');
  const hydration = getField('Hydration');
  const oiliness = getField('Oiliness');
  const pores = getField('Pores');
  const acneBlemishes = getField('Acne/blemishes') || getField('Acne');
  const redness = getField('Redness');
  const pigmentation = getField('Pigmentation');
  const skinTone = getField('Skin tone');
  const textureFineLines = getField('Texture/fine lines') || getField('Texture');
  const overallCondition = getField('Overall visible condition') || getField('Overall');

  // Detect concerns for routine/products
  const concerns = [];
  if (/oily|shine|sebum/i.test(oiliness) && !/low|minimal|none|balanced/i.test(oiliness)) {
    concerns.push({
      id: 'oily',
      name: 'T-Zone Oiliness & Shine',
      severity: /significant|high|pronounced/i.test(oiliness) ? 'Significant' : 'Moderate',
      rank: 2,
      observation: oiliness,
      suggestedCare: 'Balance sebum with gentle clarifying cleansing and oil-free hydration.',
      productCategories: 'Gentle Cleanser • Niacinamide Serum • Lightweight Gel'
    });
  }
  if (/blemish|acne|breakout|papule/i.test(acneBlemishes) && !/none|clear|minimal/i.test(acneBlemishes)) {
    concerns.push({
      id: 'acne',
      name: 'Acne-Prone Areas / Blemishes',
      severity: /significant|active|multiple/i.test(acneBlemishes) ? 'Significant' : 'Moderate',
      rank: 3,
      observation: acneBlemishes,
      suggestedCare: 'Maintain clean skin with gentle BHA cleansing and non-comedogenic care.',
      productCategories: 'Salicylic Cleanser • Barrier Hydrator • Mineral Sunscreen'
    });
  }
  if (/dry|dehydrat|tight|rough/i.test(hydration) && !/well|adequate|good/i.test(hydration)) {
    concerns.push({
      id: 'dryness',
      name: 'Surface Dryness / Dehydration',
      severity: 'Moderate',
      rank: 2,
      observation: hydration,
      suggestedCare: 'Nourish moisture barrier with hyaluronic acid and ceramide cream.',
      productCategories: 'Ceramide Cleanser • Hyaluronic Acid • Deep Barrier Cream'
    });
  }

  let skinType = 'Combination Skin Profile';
  if (/oily/i.test(skinCharacteristics)) skinType = 'Oily Skin Profile';
  if (/dry/i.test(skinCharacteristics)) skinType = 'Dry Skin Profile';
  if (/sensitive|reactive/i.test(skinCharacteristics)) skinType = 'Sensitive Skin Profile';

  return {
    skinType,
    overallSummary: overallCondition,
    concerns,
    skinCharacteristics,
    hydration,
    oiliness,
    pores,
    acneBlemishes,
    redness,
    pigmentation,
    skinTone,
    textureFineLines,
    overallCondition,
    formattedReportText: geminiText,
    zoneCoordinates: {
      forehead: { top: '22%', left: '50%' },
      tzone: { top: '34%', left: '50%' },
      leftCheek: { top: '48%', left: '30%' },
      rightCheek: { top: '50%', left: '70%' },
      underEyes: { top: '38%', left: '34%' },
      chin: { top: '78%', left: '50%' }
    }
  };
}

// 8. Capture current video frame or image to a canvas
function captureVideoSnapshot() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  if (activeImageSource && activeImageSource !== videoElement) {
    ctx.drawImage(activeImageSource, 0, 0, canvas.width, canvas.height);
  } else if (videoElement && videoElement.videoWidth > 0) {
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  } else {
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
    }
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92)
  };
}

// 9. Explanation-First Computer Vision Spectrometry Engine
// Pure deterministic analysis: uses actual face coordinates, inter-zone luminance differentials,
// specular highlights, and texture variance. NO random numbers, NO hardcoded percentages!
function analyzeFaceSkinCharacteristics(sourceCanvas, faceBox) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (sourceCanvas) {
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Scale face coordinates to 320x240 analysis canvas
  const scaleX = 320 / (sourceCanvas.width || 640);
  const scaleY = 240 / (sourceCanvas.height || 480);

  const fx = faceBox ? Math.max(0, faceBox.x * scaleX) : 50;
  const fy = faceBox ? Math.max(0, faceBox.y * scaleY) : 30;
  const fw = faceBox ? Math.min(320 - fx, faceBox.width * scaleX) : 220;
  const fh = faceBox ? Math.min(240 - fy, faceBox.height * scaleY) : 180;

  // Sample 6 key facial anatomical zones relative to actual face bounding box
  const zones = {
    forehead:   sampleRegion(data, 320, 240, fx + fw * 0.22, fy + fh * 0.10, fw * 0.56, fh * 0.18),
    tzone:      sampleRegion(data, 320, 240, fx + fw * 0.38, fy + fh * 0.28, fw * 0.24, fh * 0.28),
    leftCheek:  sampleRegion(data, 320, 240, fx + fw * 0.10, fy + fh * 0.44, fw * 0.26, fh * 0.26),
    rightCheek: sampleRegion(data, 320, 240, fx + fw * 0.64, fy + fh * 0.44, fw * 0.26, fh * 0.26),
    underEyes:  sampleRegion(data, 320, 240, fx + fw * 0.22, fy + fh * 0.35, fw * 0.56, fh * 0.11),
    chin:       sampleRegion(data, 320, 240, fx + fw * 0.35, fy + fh * 0.72, fw * 0.30, fh * 0.16)
  };

  // Face baseline luminance
  const faceLumBaseline = (
    zones.forehead.luminance * 0.20 +
    zones.tzone.luminance   * 0.15 +
    zones.leftCheek.luminance  * 0.20 +
    zones.rightCheek.luminance * 0.20 +
    zones.underEyes.luminance  * 0.10 +
    zones.chin.luminance       * 0.15
  );

  // 1. Oiliness Signal: T-Zone specular excess above face baseline & low micro-variance
  const tzoneExcess = zones.tzone.luminance - faceLumBaseline;
  const tzoneUniformity = Math.max(0, 18 - zones.tzone.variance);
  const oilinessSignal = Math.max(0, tzoneExcess) * 0.85 + tzoneUniformity * 0.55;

  // 2. Acne-Prone / Breakout Signal: Localized cheek/jaw redness peaks + micro-texture variance
  const cheekRedness = (zones.leftCheek.redness + zones.rightCheek.redness) / 2;
  const textureRoughness = (zones.leftCheek.variance + zones.rightCheek.variance + zones.chin.variance) / 3;
  const acneSignal = cheekRedness * 0.65 + textureRoughness * 0.95;

  // 3. Dryness / Dehydration Signal: Outer zone luminance deficit + elevated fine flakiness roughness
  const outerCheekLum = (zones.leftCheek.luminance + zones.rightCheek.luminance) / 2;
  const lumDeficit = Math.max(0, faceLumBaseline - outerCheekLum);
  const drynessSignal = lumDeficit * 0.75 + Math.max(0, textureRoughness - 10) * 1.1;

  // 4. Uneven Pigmentation Signal: Inter-zone luminance dispersion across 5 facial zones
  const zoneLums = [
    zones.forehead.luminance, zones.tzone.luminance,
    zones.leftCheek.luminance, zones.rightCheek.luminance, zones.chin.luminance
  ];
  const zoneMean = zoneLums.reduce((s, v) => s + v, 0) / zoneLums.length;
  const pigmentationSignal = Math.sqrt(zoneLums.reduce((s, v) => s + (v - zoneMean) ** 2, 0) / zoneLums.length);

  // 5. Redness / Sensitivity Signal: Cheek capillary red-channel differential
  const rednessSignal = cheekRedness;

  // 6. Under-Eye Darkness Signal: Contrast deficit below neutral forehead baseline
  const underEyeSignal = Math.max(0, zones.forehead.luminance - zones.underEyes.luminance);

  // 7. Visible Pores Signal: Nasal bridge and medial cheek micro-shadow variance
  const poreSignal = (zones.tzone.variance + zones.leftCheek.variance + zones.rightCheek.variance) / 3;

  // ─── EVALUATE ALL CONCERNS QUALITATIVELY (No invented percentages!) ───────
  const potentialConcerns = [];

  // Concern 1: Acne-Prone Areas / Breakouts
  if (acneSignal > 26) {
    potentialConcerns.push({
      id: 'acne',
      name: 'Acne-Prone Areas / Visible Breakouts',
      severity: 'Significant',
      rank: 3,
      observation: 'Visible features are consistent with active acne-prone skin, showing prominent localized red blemishes and raised texture bumps across the cheek and jawline areas.',
      suggestedCare: 'Use a gentle salicylic acid (BHA) cleanser, avoid picking or squeezing breakouts, use non-comedogenic water-gel moisturizers, and maintain daily broad-spectrum sun protection.',
      productCategories: 'Gentle Salicylic Cleanser • Lightweight Gel Moisturizer • Matte Sunscreen'
    });
  } else if (acneSignal > 16) {
    potentialConcerns.push({
      id: 'acne',
      name: 'Acne-Prone Areas / Breakouts',
      severity: 'Moderate',
      rank: 2,
      observation: 'Visible small breakouts and localized reddish texture irregularities observed on cheek and mid-face zones.',
      suggestedCare: 'Cleanse twice daily with a non-stripping cleanser, use non-comedogenic hydration, and apply lightweight broad-spectrum sunscreen.',
      productCategories: 'Gentle Cleanser • Non-Comedogenic Hydrator • Daily Mineral Sunscreen'
    });
  } else if (acneSignal > 9) {
    potentialConcerns.push({
      id: 'acne',
      name: 'Mild Blemishes / Breakout Tendency',
      severity: 'Mild',
      rank: 1,
      observation: 'A few isolated mild surface blemishes or minor localized texture irregularities observed in the facial zone.',
      suggestedCare: 'Maintain gentle daily cleansing, avoid pore-clogging heavy oils, and protect skin with non-comedogenic SPF.',
      productCategories: 'Clarifying Cleanser • Lightweight Barrier Gel'
    });
  }

  // Concern 2: Excess Oiliness / Sebum Shine
  if (oilinessSignal > 24) {
    potentialConcerns.push({
      id: 'oily',
      name: 'Excess T-Zone Oiliness & Shine',
      severity: 'Significant',
      rank: 3,
      observation: 'Pronounced specular sheen and notable light reflectance observed across the forehead, nose bridge, and center T-zone.',
      suggestedCare: 'Use a gentle foaming cleanser, incorporate niacinamide to normalize oil production, and select an oil-free mattifying moisturizer with matte SPF.',
      productCategories: 'Gentle Cleanser • Niacinamide Serum • Oil-Free Mattifying Hydrator • Matte Sunscreen'
    });
  } else if (oilinessSignal > 13) {
    potentialConcerns.push({
      id: 'oily',
      name: 'Moderate T-Zone Shine',
      severity: 'Moderate',
      rank: 2,
      observation: 'Moderate light reflectance and visible shine observed across the forehead and nasal bridge.',
      suggestedCare: 'Balance sebum with a gentle pH-balanced cleanser and lightweight oil-free moisturizer. Avoid harsh alcohol-based astringents.',
      productCategories: 'Balancing Cleanser • Lightweight Water Gel • Daily Sunscreen'
    });
  } else if (oilinessSignal > 6) {
    potentialConcerns.push({
      id: 'oily',
      name: 'Mild T-Zone Shine',
      severity: 'Mild',
      rank: 1,
      observation: 'Slight natural shine visible along the bridge of the nose and center forehead, consistent with normal-to-combination skin.',
      suggestedCare: 'Daily gentle cleansing and weightless hydration to maintain natural skin equilibrium.',
      productCategories: 'Lightweight Gel Moisturizer • Broad-Spectrum Sunscreen'
    });
  }

  // Concern 3: Visible / Enlarged Pores
  if (poreSignal > 23) {
    potentialConcerns.push({
      id: 'pores',
      name: 'Visibly Dilated / Open Pores',
      severity: 'Significant',
      rank: 3,
      observation: 'Noticeable micro-shadowing consistent with visibly enlarged pores observed around the nasal ridge and inner cheek regions.',
      suggestedCare: 'Use a 2% BHA liquid exfoliant to decongest pore linings, apply niacinamide to tighten pore appearance, and avoid heavy occlusive balms.',
      productCategories: 'BHA Liquid Exfoliant • 10% Niacinamide Serum • Non-Comedogenic Moisturizer'
    });
  } else if (poreSignal > 14) {
    potentialConcerns.push({
      id: 'pores',
      name: 'Visible Pores',
      severity: 'Moderate',
      rank: 2,
      observation: 'Moderate pore visibility observed across the center cheek and nasal area within typical textural limits.',
      suggestedCare: 'Keep pores clear with gentle regular cleansing, light BHA exfoliation 2–3 times a week, and daily sunscreen.',
      productCategories: 'Pore Cleanser • Niacinamide Balancing Serum'
    });
  }

  // Concern 4: Dryness / Dehydration
  if (drynessSignal > 24) {
    potentialConcerns.push({
      id: 'dryness',
      name: 'Skin Dryness & Moisture Barrier Tightness',
      severity: 'Significant',
      rank: 3,
      observation: 'Low surface light reflectance with visible fine roughness and signs of barrier tightness observed on the outer cheeks.',
      suggestedCare: 'Use a hydrating ceramide milk cleanser, apply hyaluronic acid to damp skin, and lock in moisture with a rich ceramide barrier cream.',
      productCategories: 'Ceramide Milk Cleanser • Hyaluronic Acid Serum • Deep Barrier Cream • Nourishing Sunscreen'
    });
  } else if (drynessSignal > 14) {
    potentialConcerns.push({
      id: 'dryness',
      name: 'Mild-to-Moderate Dryness',
      severity: 'Moderate',
      rank: 2,
      observation: 'Reduced moisture reflectance and mild surface tightness observed across outer facial zones.',
      suggestedCare: 'Avoid foaming sulfate cleansers, use barrier-supporting moisturizers, and drink sufficient water throughout the day.',
      productCategories: 'Hydrating Ceramide Cleanser • Barrier Support Cream'
    });
  }

  // Concern 5: Uneven Pigmentation / Dark Spots
  if (pigmentationSignal > 20) {
    potentialConcerns.push({
      id: 'pigmentation',
      name: 'Visible Hyperpigmentation & Uneven Tone',
      severity: 'Significant',
      rank: 3,
      observation: 'Distinct darker patches and noticeable variations in skin tone uniformity observed across the cheekbones and forehead.',
      suggestedCare: 'Daily broad-spectrum SPF 50+ sunscreen is essential to prevent UV-stimulated darkening. Consider gentle tone-evening ingredients such as 15% Vitamin C or Alpha Arbutin.',
      productCategories: '15% Vitamin C Serum • Broad-Spectrum SPF 50+ Sunscreen • Gentle Brightening Skincare'
    });
  } else if (pigmentationSignal > 12) {
    potentialConcerns.push({
      id: 'pigmentation',
      name: 'Uneven Skin Tone & Minor Spots',
      severity: 'Moderate',
      rank: 2,
      observation: 'Moderate variation in color uniformity and mild localized darker spots observed in the mid-face region.',
      suggestedCare: 'Consistent morning sunscreen protection combined with antioxidant serums to support an even, radiant complexion.',
      productCategories: 'Antioxidant Brightening Serum • Daily Mineral Sunscreen'
    });
  }

  // Concern 6: Surface Redness / Sensitivity
  if (rednessSignal > 26) {
    potentialConcerns.push({
      id: 'redness',
      name: 'Capillary Redness & Skin Sensitivity',
      severity: 'Significant',
      rank: 3,
      observation: 'Pronounced facial flushing and capillary pinkness visible across cheek contours. Visible features are consistent with reactive or sensitized skin.',
      suggestedCare: 'Use calming skincare featuring Centella Asiatica (Cica), ceramides, and panthenol. Avoid physical scrubs, strong fragrance, and harsh exfoliants.',
      productCategories: 'Centella Cica Soothing Balm • Ceramide Milk Cleanser • Mineral Physical Sunscreen'
    });
  } else if (rednessSignal > 15) {
    potentialConcerns.push({
      id: 'redness',
      name: 'Mild Facial Redness',
      severity: 'Moderate',
      rank: 2,
      observation: 'Moderate pink undertones and mild capillary flushing observed on cheek areas.',
      suggestedCare: 'Soothe the skin barrier with gentle, fragrance-free hydration and mineral sun protection.',
      productCategories: 'Soothing Barrier Cream • Gentle Hydrating Cleanser'
    });
  }

  // Concern 7: Under-Eye Darkness
  if (underEyeSignal > 30) {
    potentialConcerns.push({
      id: 'undereye',
      name: 'Noticeable Under-Eye Darkness',
      severity: 'Significant',
      rank: 3,
      observation: 'Pronounced dark shadowing and visible contrast in the infraorbital under-eye area.',
      suggestedCare: 'Apply a targeted 5% caffeine and multi-peptide eye gel morning and evening to support micro-circulation. Maintain adequate sleep and hydration.',
      productCategories: 'Caffeine 5% Under-Eye Awakening Gel • Daily Mineral Sunscreen'
    });
  } else if (underEyeSignal > 18) {
    potentialConcerns.push({
      id: 'undereye',
      name: 'Mild Under-Eye Shadows',
      severity: 'Moderate',
      rank: 2,
      observation: 'Mild dark circles or faint fatigue shadowing visible beneath the lower eyelid contour.',
      suggestedCare: 'Gently pat a hydrating caffeine eye concentrate around the orbital eye bone and apply daily sunscreen.',
      productCategories: 'Caffeine Multi-Peptide Eye Gel'
    });
  }

  // Sort detected concerns by severity rank (Significant > Moderate > Mild)
  potentialConcerns.sort((a, b) => b.rank - a.rank);

  // Take TOP 2-3 most relevant visible concerns (Requirement #2 & #5)
  const detectedConcerns = potentialConcerns.slice(0, 3);

  // Determine Primary Skin Type
  let skinType = 'Combination Skin';
  if (oilinessSignal > 18 && acneSignal > 16) {
    skinType = 'Oily & Acne-Prone Profile';
  } else if (drynessSignal > 16) {
    skinType = 'Dry & Sensitive Profile';
  } else if (oilinessSignal > 16) {
    skinType = 'Oily Skin Profile';
  } else if (rednessSignal > 18) {
    skinType = 'Sensitive & Reactive Profile';
  } else if (detectedConcerns.length === 0) {
    skinType = 'Normal Balanced Profile';
  } else {
    skinType = 'Combination Skin Profile';
  }

  // Build Plain-Language Overall Summary (Requirement #5)
  let overallSummary = "";
  if (detectedConcerns.length === 0) {
    overallSummary = "Visual computer vision analysis indicates healthy, well-balanced skin with no significant visible concerns detected. Skin texture appears smooth, tone distribution is even, and moisture reflectance is in a healthy equilibrium.";
  } else if (detectedConcerns.length === 1) {
    overallSummary = `Visual computer vision analysis indicates characteristics consistent with ${skinType}. The primary visible characteristic observed is ${detectedConcerns[0].name.toLowerCase()} (${detectedConcerns[0].severity.toLowerCase()} severity). Below are your detailed findings and personalized non-prescription skincare recommendations.`;
  } else {
    overallSummary = `Visual computer vision analysis indicates characteristics consistent with ${skinType}. The most noticeable visible feature is ${detectedConcerns[0].name.toLowerCase()} (${detectedConcerns[0].severity.toLowerCase()} severity), accompanied by ${detectedConcerns[1].name.toLowerCase()} (${detectedConcerns[1].severity.toLowerCase()} severity). Below are your detailed findings and personalized non-prescription skincare recommendations.`;
  }

  // Derive the 10 prompt-required fields adhering strictly to visual-only, non-diagnostic guidelines
  let skinCharacteristics = "";
  if (skinType.includes('Oily & Acne')) {
    skinCharacteristics = "Combination-to-oily profile characterized by active T-zone sheen, localized mid-face blemishes, and visible pore distribution.";
  } else if (skinType.includes('Dry')) {
    skinCharacteristics = "Dry-to-dehydrated profile characterized by reduced surface luster, fine micro-roughness, and visible barrier tightness across lateral cheeks.";
  } else if (skinType.includes('Oily')) {
    skinCharacteristics = "Oily profile displaying notable surface sebum reflection across forehead and nasal bridge with resilient epidermal thickness.";
  } else if (skinType.includes('Sensitive')) {
    skinCharacteristics = "Sensitized reactive profile showing visible capillary pinkness and fine epidermal sensitivity across cheek contours.";
  } else if (skinType.includes('Normal')) {
    skinCharacteristics = "Balanced normal profile displaying smooth micro-texture, uniform light reflectance, and balanced sebum distribution.";
  } else {
    skinCharacteristics = "Combination profile exhibiting localized T-zone sebum reflection with balanced moisture retention across lateral cheeks.";
  }

  let hydration = "";
  if (drynessSignal > 20) {
    hydration = "Mildly diminished epidermal luster and visible moisture deficit observed on lateral cheeks; barrier appears slightly tight.";
  } else if (drynessSignal > 12) {
    hydration = "Moderate surface hydration with slight dryness along outer cheek contours; central face remains adequately moisturized.";
  } else {
    hydration = "Well-hydrated with healthy epidermal luster and uniform moisture reflectance across all facial zones.";
  }

  let oiliness = "";
  if (oilinessSignal > 20) {
    oiliness = "Elevated sebum sheen visible across forehead, nasal bridge, and chin (T-zone); cheeks display lower reflectance.";
  } else if (oilinessSignal > 10) {
    oiliness = "Moderate localized shine along the center T-zone within normal physiological parameters; lateral cheeks appear matte.";
  } else {
    oiliness = "Low-to-balanced surface shine with uniform non-greasy finish across all inspected zones.";
  }

  let pores = "";
  if (poreSignal > 20) {
    pores = "Visibly dilated pores observed along nasal bridge and medial cheek areas; outer cheeks remain refined.";
  } else if (poreSignal > 12) {
    pores = "Moderate pore visibility concentrated in the mid-facial and paranasal zones; within normal textural limits.";
  } else {
    pores = "Minimally visible pores; surface micro-structure appears refined and smooth.";
  }

  let acneBlemishes = "";
  if (acneSignal > 22) {
    acneBlemishes = "Visible localized reddish blemishes and small surface papules observed on cheek and jawline contours; no severe inflammatory clusters assessed.";
  } else if (acneSignal > 12) {
    acneBlemishes = "A few isolated mild surface blemishes and localized minor texture irregularities visible on mid-face.";
  } else {
    acneBlemishes = "Clear complexion with no prominent active blemishes or pustules visibly detected.";
  }

  let redness = "";
  if (rednessSignal > 22) {
    redness = "Noticeable capillary pinkness and diffuse flushing visible across central cheek areas; consistent with reactive skin.";
  } else if (rednessSignal > 13) {
    redness = "Mild diffuse pink undertones observed across the cheek contours; minimal localized vascular dilation.";
  } else {
    redness = "Minimal baseline capillary pinkness; calm and even complexional tone with no noticeable flushing.";
  }

  let pigmentation = "";
  if (pigmentationSignal > 18) {
    pigmentation = "Visible minor tonal variations and localized faint pigment spots observed on upper cheekbones and forehead.";
  } else if (pigmentationSignal > 10) {
    pigmentation = "Moderate variation in tone uniformity across orbital and cheek zones; overall pigment distribution is stable.";
  } else {
    pigmentation = "Uniform melanin distribution with even complexional clarity and no prominent localized dark spots.";
  }

  let skinTone = "";
  if (faceLumBaseline > 180) {
    skinTone = "Fair complexional tone with balanced neutral undertones and high natural reflectance.";
  } else if (faceLumBaseline > 130) {
    skinTone = "Medium warm-neutral undertone with healthy visual complexional radiance.";
  } else {
    skinTone = "Rich deep-warm undertone with balanced melanin depth and healthy surface luster.";
  }

  let textureFineLines = "";
  if (textureRoughness > 18) {
    textureFineLines = "Slight micro-texture roughness and faint expression lines visible around peri-orbital eye contour.";
  } else if (textureRoughness > 12) {
    textureFineLines = "Generally smooth micro-texture with soft natural dynamic expression contours consistent with facial movement.";
  } else {
    textureFineLines = "Smooth, refined epidermal surface texture with minimal visible roughness or fine lines.";
  }

  let overallCondition = "";
  if (detectedConcerns.length === 0) {
    overallCondition = "Facial skin appears visually healthy and well-balanced. Primary care recommendations prioritize barrier preservation and broad-spectrum sun protection.";
  } else if (detectedConcerns.length === 1) {
    overallCondition = `Facial skin exhibits visible features consistent with ${detectedConcerns[0].name.toLowerCase()} (${detectedConcerns[0].severity.toLowerCase()} severity). Primary visible opportunities prioritize gentle targeted care and daily hydration.`;
  } else {
    overallCondition = `Facial skin shows visible features of ${detectedConcerns[0].name.toLowerCase()} and ${detectedConcerns[1].name.toLowerCase()}. Routine focus should center on non-stripping cleansing, sebum regulation, and consistent barrier hydration.`;
  }

  const formattedReportText = `Human face detected ✓

Skin Analysis:

Skin characteristics:
${skinCharacteristics}

Hydration:
${hydration}

Oiliness:
${oiliness}

Pores:
${pores}

Acne/blemishes:
${acneBlemishes}

Redness:
${redness}

Pigmentation:
${pigmentation}

Skin tone:
${skinTone}

Texture/fine lines:
${textureFineLines}

Overall visible condition:
${overallCondition}

Note: This is an image-based visual assessment, not a medical diagnosis. Results can vary depending on lighting, camera quality, makeup, and image resolution.`;

  return {
    skinType,
    overallSummary,
    concerns: detectedConcerns,
    skinCharacteristics,
    hydration,
    oiliness,
    pores,
    acneBlemishes,
    redness,
    pigmentation,
    skinTone,
    textureFineLines,
    overallCondition,
    formattedReportText,
    zoneCoordinates: {
      forehead: { top: '22%', left: '50%' },
      tzone: { top: '34%', left: '50%' },
      leftCheek: { top: '48%', left: '30%' },
      rightCheek: { top: '50%', left: '70%' },
      underEyes: { top: '38%', left: '34%' },
      chin: { top: '78%', left: '50%' }
    }
  };
}

// Sample rectangular subregion of image data for average luminance, redness differential, and variance
function sampleRegion(data, width, height, startX, startY, regionW, regionH) {
  const sx = Math.max(0, Math.min(width - 2, Math.round(startX)));
  const sy = Math.max(0, Math.min(height - 2, Math.round(startY)));
  const sw = Math.max(2, Math.min(width - sx, Math.round(regionW)));
  const sh = Math.max(2, Math.min(height - sy, Math.round(regionH)));

  let totalR = 0, totalG = 0, totalB = 0, totalLum = 0, count = 0;
  const lumList = [];

  for (let y = sy; y < sy + sh; y += 2) {
    for (let x = sx; x < sx + sw; x += 2) {
      const idx = (y * width + x) * 4;
      if (idx >= 0 && idx < data.length - 3) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalR   += r;
        totalG   += g;
        totalB   += b;
        totalLum += lum;
        lumList.push(lum);
        count++;
      }
    }
  }

  if (count === 0) return { luminance: 128, redness: 0, variance: 10 };

  const avgLum = totalLum / count;
  const avgR   = totalR / count;
  const avgG   = totalG / count;
  const avgB   = totalB / count;

  const redness = Math.max(0, avgR - (avgG + avgB) / 2);

  let sumSqDiff = 0;
  lumList.forEach(l => { sumSqDiff += (l - avgLum) ** 2; });
  const variance = Math.sqrt(sumSqDiff / count);

  return { luminance: avgLum, redness, variance };
}

// 10. Render Explanation-First Results Dashboard (Requirement #3, #5, #7, #10)
function renderResultsDashboard(analysis, snapshotUrl) {
  // Populate Prompt-Mandated Official Skin Analysis Report Card
  const reportContainer = document.getElementById('official-skin-report-container');
  if (reportContainer) {
    reportContainer.style.display = 'block';
  }
  const setField = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || 'Not assessed';
  };
  setField('report-val-characteristics', analysis.skinCharacteristics);
  setField('report-val-hydration', analysis.hydration);
  setField('report-val-oiliness', analysis.oiliness);
  setField('report-val-pores', analysis.pores);
  setField('report-val-acne', analysis.acneBlemishes);
  setField('report-val-redness', analysis.redness);
  setField('report-val-pigmentation', analysis.pigmentation);
  setField('report-val-skintone', analysis.skinTone);
  setField('report-val-texture', analysis.textureFineLines);
  setField('report-val-overall', analysis.overallCondition);

  // Cache formatted report text globally for copy button
  window._currentOfficialReportText = analysis.formattedReportText;

  // Update Qualitative Status Badge & Skin Type
  const statusBadge = document.getElementById('result-status-badge');
  const skinTypeElem = document.getElementById('result-skin-type');
  const summaryElem = document.getElementById('result-summary-text');

  if (statusBadge) statusBadge.textContent = "Analysis Complete";
  if (skinTypeElem) skinTypeElem.textContent = analysis.skinType;
  if (summaryElem) summaryElem.textContent = analysis.overallSummary;

  // Update Snapshot Image & Hotspot Pins
  const snapshotImg = document.getElementById('snapshot-img');
  const hotspotContainer = document.getElementById('snapshot-hotspots-wrapper');
  if (snapshotImg) snapshotImg.src = snapshotUrl;

  if (hotspotContainer) {
    hotspotContainer.innerHTML = '';
    // Only place hotspot pins for actively detected concerns
    if (analysis.concerns && analysis.concerns.length > 0) {
      const pinMap = {
        'acne': { top: '50%', left: '30%', label: 'Cheek Blemishes' },
        'oily': { top: '24%', left: '50%', label: 'T-Zone Sebum Shine' },
        'pores': { top: '44%', left: '50%', label: 'Nasal Pores' },
        'dryness': { top: '56%', left: '72%', label: 'Outer Cheek Dryness' },
        'pigmentation': { top: '30%', left: '68%', label: 'Cheek Pigmentation' },
        'redness': { top: '48%', left: '70%', label: 'Cheek Redness' },
        'undereye': { top: '38%', left: '34%', label: 'Under-Eye Contour' }
      };

      analysis.concerns.forEach(c => {
        const pinData = pinMap[c.id] || { top: '50%', left: '50%', label: c.name };
        const pinEl = document.createElement('div');
        pinEl.className = 'face-hotspot';
        pinEl.style.top = pinData.top;
        pinEl.style.left = pinData.left;
        pinEl.innerHTML = `
          <span>•</span>
          <div class="hotspot-tooltip">${pinData.label} (${c.severity})</div>
        `;
        hotspotContainer.appendChild(pinEl);
      });
    }
  }

  // Render Explanation-First Main Skin Concerns (Requirement #3 & #5)
  const concernsList = document.getElementById('concerns-list-container');
  if (concernsList) {
    if (analysis.concerns.length === 0) {
      // Clean No-Concern Detected Card
      concernsList.innerHTML = `
        <div class="concern-card-detailed">
          <div class="concern-header-row">
            <div class="concern-title-group">
              <span class="concern-icon">✨</span>
              <span class="concern-title-text">No Significant Visible Concern Detected</span>
            </div>
            <span class="severity-pill severity-not-detected">Not Detected</span>
          </div>
          <div class="observation-box">
            <strong>What the AI Observed:</strong> The facial skin displays uniform light reflectance, smooth micro-texture, and balanced sebum levels without noticeable blemish clusters or redness.
          </div>
          <div class="care-box">
            <strong>What You Can Do:</strong> Maintain your healthy skin barrier with gentle daily cleansing, light non-comedogenic moisture, and daily broad-spectrum sun protection.
          </div>
          <div class="categories-line">
            Appropriate Maintenance: Gentle Cleanser • Light Hydrator • Broad-Spectrum Sunscreen
          </div>
        </div>
      `;
    } else {
      // Structured Explanation Cards for each detected concern (NO NUMERICAL SCORES!)
      concernsList.innerHTML = analysis.concerns.map(c => {
        const severityClass = c.severity === 'Significant' ? 'severity-significant' : c.severity === 'Moderate' ? 'severity-moderate' : 'severity-mild';
        return `
          <div class="concern-card-detailed">
            <div class="concern-header-row">
              <div class="concern-title-group">
                <span class="concern-icon">${getConcernIcon(c.name)}</span>
                <span class="concern-title-text">${c.name}</span>
              </div>
              <span class="severity-pill ${severityClass}">${c.severity} Severity</span>
            </div>
            <div class="observation-box">
              <strong>What the AI Observed:</strong> ${c.observation}
            </div>
            <div class="care-box">
              <strong>What You Can Do:</strong> ${c.suggestedCare}
            </div>
            <div class="categories-line">
              Targeted Skincare Categories: ${c.productCategories}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Tailored AM / PM Skincare Blueprint
  renderSkincareRoutine(analysis);

  // Render Targeted Product Recommendations (3–5 products max, prices in ₹ INR)
  renderMatchedProducts(analysis);

  // Render Recommended Clinical Treatment (price in ₹ INR)
  renderMatchedTreatment(analysis);
}

function getConcernIcon(name) {
  if (name.includes('Acne') || name.includes('Blemish') || name.includes('Breakout')) return '⚡';
  if (name.includes('Oil') || name.includes('Shine')) return '💧';
  if (name.includes('Pore')) return '🔍';
  if (name.includes('Redness') || name.includes('Sensitivity')) return '🌸';
  if (name.includes('Under-Eye') || name.includes('Eye')) return '👁️';
  if (name.includes('Pigmentation') || name.includes('Spots')) return '✨';
  if (name.includes('Dryness') || name.includes('Tightness')) return '🍃';
  return '🌟';
}

// 11. Skincare Routine Blueprint Generator
function renderSkincareRoutine(analysis) {
  const amSteps = document.getElementById('am-routine-steps');
  const pmSteps = document.getElementById('pm-routine-steps');
  if (!amSteps || !pmSteps) return;

  const topConcern = analysis.concerns.length > 0 ? analysis.concerns[0].id : 'balanced';

  let amRoutine = [];
  let pmRoutine = [];

  if (topConcern === 'acne' || topConcern === 'oily' || topConcern === 'pores') {
    amRoutine = [
      { num: 1, type: 'Gentle Cleanser', advice: 'Wash with a pH-balanced clarifying cleanser to sweep away overnight sebum without stripping the skin barrier.' },
      { num: 2, type: 'Targeted Serum', advice: 'Apply 10% Niacinamide + Zinc to normalize sebum production and tighten the appearance of enlarged pores.' },
      { num: 3, type: 'Oil-Free Moisturizer', advice: 'Smooth a lightweight water-gel hydrator to lock in hydration with zero greasy residue.' },
      { num: 4, type: 'Matte Sunscreen SPF 45+', advice: 'Crucial: Apply broad-spectrum matte fluid sunscreen daily to protect active blemishes from UV-induced dark spots.' }
    ];
    pmRoutine = [
      { num: 1, type: 'Double Cleanse', advice: 'Thoroughly remove daytime sunscreen, sweat, and pollution using a gentle non-comedogenic cleanser.' },
      { num: 2, type: 'Exfoliant / Treatment', advice: 'Apply a leave-on 2% BHA Salicylic Acid liquid 2–3 evenings per week to decongest pores and smooth texture.' },
      { num: 3, type: 'Hydrating Gel', advice: 'Replenish moisture with lightweight hyaluronic acid or soothing barrier gel before sleep.' }
    ];
  } else if (topConcern === 'dryness' || topConcern === 'redness') {
    amRoutine = [
      { num: 1, type: 'Hydrating Ceramide Cleanser', advice: 'Wash with a gentle ceramide milk cleanser that preserves delicate natural skin lipids.' },
      { num: 2, type: 'Hydration Serum', advice: 'Pat multi-molecular Hyaluronic Acid onto damp skin to flood parched epidermal layers with deep moisture.' },
      { num: 3, type: 'Deep Barrier Cream', advice: 'Apply a ceramide and squalane barrier cream to calm redness and seal moisture into the skin.' },
      { num: 4, type: 'Mineral Sunscreen SPF 50+', advice: 'Shield sensitized skin with non-irritating 100% zinc oxide physical mineral sunscreen.' }
    ];
    pmRoutine = [
      { num: 1, type: 'Gentle Cleansing Milk', advice: 'Melt away daily residue gently with a soothing non-foaming cleansing lotion.' },
      { num: 2, type: 'Calming Rescue Balm', advice: 'Warm Centella Cica barrier balm between fingertips and press into sensitive cheek areas to heal overnight.' },
      { num: 3, type: 'Night Recovery Cream', advice: 'Lock in restorative hydration with a rich ceramide cream before sleep.' }
    ];
  } else if (topConcern === 'pigmentation') {
    amRoutine = [
      { num: 1, type: 'Gentle Foaming Cleanser', advice: 'Cleanse with lukewarm water and a mild non-drying gel cleanser.' },
      { num: 2, type: '15% Vitamin C + Alpha Arbutin', advice: 'Apply 3 drops of antioxidant brightening serum to suppress tyrosinase and fade darker patches.' },
      { num: 3, type: 'Lightweight Hydrator', advice: 'Smooth a non-greasy moisturizer across face and neck.' },
      { num: 4, type: 'Broad-Spectrum SPF 50+', advice: 'Mandatory: Broad-spectrum SPF 50+ is essential every single morning to prevent UV-stimulated melanin clusters.' }
    ];
    pmRoutine = [
      { num: 1, type: 'Thorough Cleanse', advice: 'Dissolve all traces of daytime sunscreen and environmental pollutants.' },
      { num: 2, type: 'Tone Evening Treatment', advice: 'Apply Niacinamide or gentle exfoliating serum 3 nights per week to encourage surface cell renewal.' },
      { num: 3, type: 'Restorative Night Moisturizer', advice: 'Support skin barrier renewal with a nourishing ceramide cream.' }
    ];
  } else {
    // Normal / Balanced profile
    amRoutine = [
      { num: 1, type: 'Gentle Daily Cleanser', advice: 'Wash with a mild pH-balanced cleanser to refresh skin for the day.' },
      { num: 2, type: 'Hydrating Drops', advice: 'Apply a few drops of hyaluronic acid or antioxidant serum for all-day radiance.' },
      { num: 3, type: 'Balanced Moisturizer', advice: 'Apply a balanced lotion to maintain optimal moisture barrier equilibrium.' },
      { num: 4, type: 'Broad-Spectrum SPF 50+', advice: 'Daily sun protection to prevent photo-aging and preserve healthy skin tone.' }
    ];
    pmRoutine = [
      { num: 1, type: 'Evening Cleanse', advice: 'Wash away daytime impurities with a gentle non-stripping cleanser.' },
      { num: 2, type: 'Nourishing Night Cream', advice: 'Support nocturnal barrier recovery with ceramides and peptides.' }
    ];
  }

  amSteps.innerHTML = amRoutine.map(s => `
    <div class="routine-step-item">
      <div class="step-num-pill">${s.num}</div>
      <div class="step-content">
        <div class="type">${s.type}</div>
        <div class="advice">${s.advice}</div>
      </div>
    </div>
  `).join('');

  pmSteps.innerHTML = pmRoutine.map(s => `
    <div class="routine-step-item">
      <div class="step-num-pill">${s.num}</div>
      <div class="step-content">
        <div class="type">${s.type}</div>
        <div class="advice">${s.advice}</div>
      </div>
    </div>
  `).join('');
}

// 12. Targeted Product Recommendation Engine (Requirement #6, #7, #8, #9, #10)
// Recommends strictly 3–5 matched products. All prices in Indian Rupees (₹ INR).
// Includes clear why-relevant reason, usage directions, and safety precautions.
function renderMatchedProducts(analysis) {
  const container = document.getElementById('matched-products-grid');
  if (!container || !window.store) return;

  const allProducts = window.store.getProducts();
  const topConcernId = analysis.concerns.length > 0 ? analysis.concerns[0].id : 'balanced';

  // Specific 3–5 product mapping based strictly on the detected concern
  let matchedIds = [];
  let whyMap = {};

  if (topConcernId === 'acne') {
    matchedIds = ['prod-1', 'prod-9', 'prod-3', 'prod-6'];
    whyMap['prod-1'] = "Suitable for your detected concern because it contains 2% Salicylic Acid (BHA) to gently unclog pores and calm visible breakouts without stripping skin.";
    whyMap['prod-9'] = "Recommended for your concern because oil-soluble BHA dissolves deep follicular plugs and visibly reduces blemishes.";
    whyMap['prod-3'] = "Suitable because this oil-free, non-comedogenic water gel hydrates without suffocating pores or triggering breakouts.";
    whyMap['prod-6'] = "Essential protection: Fluid matte SPF shields post-breakout blemishes from UV-induced dark marks with zero greasy sheen.";
  } else if (topConcernId === 'oily' || topConcernId === 'pores') {
    matchedIds = ['prod-1', 'prod-7', 'prod-3', 'prod-6'];
    whyMap['prod-1'] = "Suitable for your detected concern because it deeply purifies excess surface sebum from the T-zone while maintaining skin balance.";
    whyMap['prod-7'] = "Recommended because 10% Niacinamide + Zinc is clinically recognized to normalize sebum production and tighten dilated pores.";
    whyMap['prod-3'] = "Suitable because its ultra-light cooling formula delivers hydration with a shine-free matte finish.";
    whyMap['prod-6'] = "Suitable because silica micro-sponges absorb surface oil throughout the day while offering broad-spectrum SPF 45 protection.";
  } else if (topConcernId === 'dryness') {
    matchedIds = ['prod-2', 'prod-10', 'prod-4', 'prod-5'];
    whyMap['prod-2'] = "Suitable for your detected concern because 3 bio-identical ceramides gently cleanse without stripping natural moisture.";
    whyMap['prod-10'] = "Recommended because multi-molecular hyaluronic acid delivers deep, multi-depth hydration to alleviate tightness.";
    whyMap['prod-4'] = "Suitable because rich squalane and centella rebuild compromised lipid barriers overnight.";
    whyMap['prod-5'] = "Suitable because mineral zinc oxide shields dry, sensitive skin without causing stinging or irritation.";
  } else if (topConcernId === 'pigmentation') {
    matchedIds = ['prod-8', 'prod-5', 'prod-7', 'prod-2'];
    whyMap['prod-8'] = "Suitable for your detected concern because 15% L-Ascorbic Acid + Alpha Arbutin directly targets melanin clusters and fades darker spots.";
    whyMap['prod-5'] = "Critical: Broad-spectrum mineral SPF 50+ prevents UV rays from triggering further hyperpigmentation.";
    whyMap['prod-7'] = "Recommended because Niacinamide prevents melanin transfer to surface skin cells and promotes even skin tone.";
    whyMap['prod-2'] = "Suitable because a gentle ceramide cleanser supports overall skin barrier health while brightening.";
  } else if (topConcernId === 'redness') {
    matchedIds = ['prod-12', 'prod-2', 'prod-5', 'prod-4'];
    whyMap['prod-12'] = "Suitable for your detected concern because 70% pure Centella Cica rapidly cools flare-ups and diminishes capillary redness.";
    whyMap['prod-2'] = "Recommended because a nourishing milky ceramide emulsion soothes tight, easily irritated skin barriers.";
    whyMap['prod-5'] = "Suitable because non-nano zinc oxide naturally calms surface irritation while offering broad-spectrum SPF 50+ protection.";
    whyMap['prod-4'] = "Suitable because barrier-repair lipids and panthenol accelerate overnight recovery of sensitized skin.";
  } else if (topConcernId === 'undereye') {
    matchedIds = ['prod-11', 'prod-8', 'prod-5', 'prod-3'];
    whyMap['prod-11'] = "Suitable for your detected concern because 5% green tea caffeine and matrixyl peptides stimulate micro-circulation to revive dark circles.";
    whyMap['prod-8'] = "Recommended because antioxidant Vitamin C gently brightens and evens out delicate orbital skin tone.";
    whyMap['prod-5'] = "Suitable because mineral sunscreen protects fragile under-eye tissue from UV-induced pigment accumulation.";
    whyMap['prod-3'] = "Suitable because lightweight water gel delivers oil-free hydration to the surrounding eye area.";
  } else {
    // Normal / Balanced
    matchedIds = ['prod-2', 'prod-3', 'prod-5'];
    whyMap['prod-2'] = "Suitable for your skin profile to provide daily non-stripping ceramide cleansing.";
    whyMap['prod-3'] = "Recommended to maintain optimal moisture balance with a lightweight, dewy finish.";
    whyMap['prod-5'] = "Essential daily protection to guard your balanced complexion against UV-induced premature aging.";
  }

  // Filter products by matched IDs and preserve mapping order
  const matched = matchedIds
    .map(id => allProducts.find(p => p.id === id))
    .filter(Boolean);

  container.innerHTML = matched.map(p => `
    <div class="product-card">
      <div class="product-thumb-wrapper">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <span class="product-badge-tag">${p.badge || 'Recommended'}</span>
      </div>
      <div class="product-body">
        <div class="product-meta-row">
          <span class="product-category-name">${p.category}</span>
          <span class="product-rating">★ ${p.rating}</span>
        </div>
        <h4 class="product-title" style="margin-bottom:0.4rem;">${p.name}</h4>
        
        <!-- Explanation-First Why Relevant Box -->
        <div class="why-suitable-badge">
          <strong>Why Relevant for You:</strong><br>
          ${whyMap[p.id] || p.recommendationReason}
        </div>

        <!-- How to Use Guidance -->
        <div class="product-usage-note">
          <strong>How to Use:</strong> ${p.usage}
        </div>

        <!-- Important Precaution & Safety Notice (Requirement #7 & #11) -->
        <span class="product-precaution-tag">
          ⚠️ Important: Patch test before first use. Discontinue if irritation occurs. Cosmetic skincare product; not intended to treat or cure medical conditions.
        </span>

        <div class="product-footer-row">
          <span class="product-price">${window.formatCurrency(p.price)}</span>
          <div class="product-card-actions">
            <button class="btn btn-outline-primary btn-sm" onclick="openProductModal('${p.id}')">Details</button>
            <button class="btn btn-primary btn-sm" onclick="addProductToCart('${p.id}')">Add to Cart</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// 13. Recommended Salon / Clinical Treatment (Price in ₹ INR)
function renderMatchedTreatment(analysis) {
  const container = document.getElementById('matched-treatment-box');
  if (!container || !window.store) return;

  const services = window.store.getServices();
  const topConcernId = analysis.concerns.length > 0 ? analysis.concerns[0].id : 'balanced';

  let service = services[0]; // Default Hydra-Glow
  if (topConcernId === 'acne') {
    service = services.find(s => s.category === 'Acne Care') || services[1];
  } else if (topConcernId === 'redness' || topConcernId === 'dryness') {
    service = services.find(s => s.category === 'Skin Care') || services[2];
  }

  container.innerHTML = `
    <div class="service-card" style="display:grid; grid-template-columns: 0.9fr 1.1fr; align-items:center;">
      <div class="service-image-box" style="height:100%;">
        <img src="${service.image}" alt="${service.name}" loading="lazy">
        <span class="service-duration-badge">${service.duration}</span>
      </div>
      <div class="service-body">
        <div style="font-size:0.8rem; font-weight:700; color:var(--primary); text-transform:uppercase;">Recommended Clinical Treatment</div>
        <h3 class="service-title" style="margin: 0.3rem 0 0.6rem;">${service.name}</h3>
        <p class="service-desc">${service.description}</p>
        <div class="service-suited-box">
          <strong>Suited for:</strong> ${analysis.skinType}
        </div>
        <div class="service-footer">
          <span class="service-price">${window.formatCurrency(service.price)}</span>
          <a href="book.html?service=${service.id}" class="btn btn-primary">Book This Treatment</a>
        </div>
      </div>
    </div>
  `;
}

// 14. Load Demo Preset Selfie
function loadPresetDemoSelfie() {
  stopLiveCamera();
  hideQualityAlert();

  const standbyScreen = document.getElementById('camera-standby-screen');
  const hudLayer = document.getElementById('hud-layer');
  if (standbyScreen) standbyScreen.style.display = 'none';
  if (hudLayer) hudLayer.classList.add('active');

  const demoImgUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=640&q=80';
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    activeImageSource = img;
    isCameraActive = true;
    faceDetected = true;
    faceCentered = true;
    faceDistanceStatus = 'ok';

    resizeOverlayCanvas();
    overlayCtx.drawImage(img, 0, 0, overlayCanvas.width, overlayCanvas.height);
    renderHUDOverlay({
      x: overlayCanvas.width * 0.25,
      y: overlayCanvas.height * 0.18,
      width: overlayCanvas.width * 0.5,
      height: overlayCanvas.height * 0.65,
      landmarks: []
    });

    lastFaceBox = {
      x: overlayCanvas.width * 0.25,
      y: overlayCanvas.height * 0.18,
      width: overlayCanvas.width * 0.5,
      height: overlayCanvas.height * 0.65
    };

    updateGuidanceBadge('Demo face loaded — Ready to scan!', 'success');
    const captureBtn = document.getElementById('btn-run-analysis');
    if (captureBtn) {
      captureBtn.style.display = 'inline-flex';
      captureBtn.disabled = false;
    }
    const stopBtn = document.getElementById('btn-stop-camera');
    if (stopBtn) stopBtn.style.display = 'inline-flex';
    const startBtn = document.getElementById('btn-start-camera');
    if (startBtn) startBtn.style.display = 'none';

    window.showToast('Demo selfie loaded! Click "Run Skin Analysis Scan" to inspect.', 'info');
  };
  img.src = demoImgUrl;
}

// 15. Handle Uploaded Selfie Photo with Immediate Strict Step 1 & Step 2 Enforcement
function handleUploadedSelfie(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Clear previous quality alert and previous results
  hideValidationAlert();
  const resultsSection = document.getElementById('scanner-results-section');
  if (resultsSection) resultsSection.classList.remove('show');

  const reader = new FileReader();
  reader.onload = (e) => {
    stopLiveCamera();
    const standbyScreen = document.getElementById('camera-standby-screen');
    const hudLayer = document.getElementById('hud-layer');
    if (standbyScreen) standbyScreen.style.display = 'none';
    if (hudLayer) hudLayer.classList.add('active');

    const img = new Image();
    img.onload = async () => {
      activeImageSource = img;
      isCameraActive = true;

      resizeOverlayCanvas();
      overlayCtx.drawImage(img, 0, 0, overlayCanvas.width, overlayCanvas.height);

      // Create a temporary canvas for immediate face detection & quality validation
      const testCanvas = document.createElement('canvas');
      testCanvas.width = img.naturalWidth || 640;
      testCanvas.height = img.naturalHeight || 480;
      const tCtx = testCanvas.getContext('2d');
      tCtx.drawImage(img, 0, 0, testCanvas.width, testCanvas.height);

      // Perform strict prompt-mandated Step 1 & Step 2 validation immediately
      updateGuidanceBadge('Analyzing image for real human face...', 'warning');
      const validation = await runTwoStepFaceValidation(testCanvas);

      if (!validation.valid) {
        SoundFx.playBeep(380, 0.22, 'sawtooth');
        showValidationAlert(validation.step, validation.message, validation.detail);

        if (validation.step === 1) {
          updateGuidanceBadge('Step 1 Failed: Non-human image', 'warning');
          window.showToast('This image does not contain a valid human face.', 'warning');
        } else {
          updateGuidanceBadge('Step 2 Failed: Image quality insufficient', 'warning');
          window.showToast('Face detected, but image quality is insufficient.', 'warning');
        }

        // Disable analysis button — STOP THE ENTIRE WORKFLOW IMMEDIATELY!
        const captureBtn = document.getElementById('btn-run-analysis');
        if (captureBtn) captureBtn.disabled = true;
        return; // STOP!
      }

      // Quality and human check passed!
      hideValidationAlert();
      const detectedBox = validation.faceBox;
      const sX = overlayCanvas.width / testCanvas.width;
      const sY = overlayCanvas.height / testCanvas.height;

      lastFaceBox = {
        x: detectedBox.x * sX,
        y: detectedBox.y * sY,
        width: detectedBox.width * sX,
        height: detectedBox.height * sY
      };

      faceDetected = true;
      faceCentered = true;
      faceDistanceStatus = 'ok';

      renderHUDOverlay(lastFaceBox);
      updateGuidanceBadge('Human face detected ✓ Ready to scan!', 'success');

      const captureBtn = document.getElementById('btn-run-analysis');
      if (captureBtn) {
        captureBtn.style.display = 'inline-flex';
        captureBtn.disabled = false;
      }
      const stopBtn = document.getElementById('btn-stop-camera');
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      const startBtn = document.getElementById('btn-start-camera');
      if (startBtn) startBtn.style.display = 'none';

      window.showToast('Human face verified ✓ Click "Run Skin Analysis Scan".', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Clipboard Copy Helpers
window.copyReportToClipboard = function() {
  const text = window._currentOfficialReportText;
  if (!text) {
    window.showToast('No scan report available to copy.', 'warning');
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      window.showToast('Official Skin Analysis Report copied to clipboard!', 'success');
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
};

window.copyAlertMessage = function() {
  const el = document.getElementById('quality-alert-message');
  const text = el ? el.textContent.trim() : '';
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      window.showToast('Notice message copied to clipboard!', 'info');
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
};

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    window.showToast('Text copied to clipboard!', 'success');
  } catch (err) {
    window.showToast('Unable to copy text automatically.', 'warning');
  }
  document.body.removeChild(textArea);
}

// AI Engine Settings Modal Management
window.openAiEngineModal = function() {
  const modal = document.getElementById('ai-engine-modal');
  const storedEngine = localStorage.getItem('glowcare_ai_engine') || 'builtin';
  const storedKey = localStorage.getItem('glowcare_gemini_api_key') || '';

  const radios = document.getElementsByName('ai-engine-choice');
  radios.forEach(r => {
    r.checked = (r.value === storedEngine);
  });

  const keyInput = document.getElementById('input-gemini-key');
  if (keyInput) keyInput.value = storedKey;

  const keyContainer = document.getElementById('gemini-key-container');
  if (keyContainer) {
    keyContainer.style.display = storedEngine === 'gemini' ? 'block' : 'none';
  }

  if (modal) modal.style.display = 'flex';
};

window.closeAiEngineModal = function() {
  const modal = document.getElementById('ai-engine-modal');
  if (modal) modal.style.display = 'none';
};

window.handleEngineRadioChange = function(val) {
  const keyContainer = document.getElementById('gemini-key-container');
  if (keyContainer) {
    keyContainer.style.display = val === 'gemini' ? 'block' : 'none';
  }
};

window.saveAiEngineSettings = function() {
  const radios = document.getElementsByName('ai-engine-choice');
  let chosen = 'builtin';
  radios.forEach(r => {
    if (r.checked) chosen = r.value;
  });

  const keyInput = document.getElementById('input-gemini-key');
  const keyVal = keyInput ? keyInput.value.trim() : '';

  if (chosen === 'gemini' && !keyVal) {
    window.showToast('Please enter your Google Gemini API Key or select Built-in Engine.', 'warning');
    return;
  }

  localStorage.setItem('glowcare_ai_engine', chosen);
  if (keyVal) {
    localStorage.setItem('glowcare_gemini_api_key', keyVal);
  }

  closeAiEngineModal();
  updateEngineIndicator();
  window.showToast(`AI Vision Engine set to: ${chosen === 'gemini' ? 'Google Gemini' : 'Built-in Computer Vision'}`, 'success');
};

function updateEngineIndicator() {
  const label = document.getElementById('current-engine-label');
  const choice = localStorage.getItem('glowcare_ai_engine') || 'builtin';
  if (label) {
    label.textContent = choice === 'gemini' ? 'Gemini AI' : 'CV Engine';
  }
}

function resetScannerForNewScan() {
  hideQualityAlert();
  const resultsSection = document.getElementById('scanner-results-section');
  if (resultsSection) resultsSection.classList.remove('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  startLiveCamera();
}

function checkAndDisplayPreviousScan() {
  if (!window.store) return;
  const last = window.store.getLastScan();
  if (last && last.skinType && last.concerns) {
    const resultsSection = document.getElementById('scanner-results-section');
    if (resultsSection) {
      renderResultsDashboard(last, last.snapshotImage || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=640&q=80');
      resultsSection.classList.add('show');
    }
  }
}

// Global Product actions
window.addProductToCart = function(id) {
  if (window.store) {
    window.store.addToCart(id, 1);
    window.showToast('Product added to your cart!', 'success');
  }
};

window.toggleProductFavorite = function(id, btn) {
  if (window.store) {
    const isFav = window.store.toggleFavorite(id);
    btn.classList.toggle('active', isFav);
    window.showToast(isFav ? 'Added to favorites!' : 'Removed from favorites', 'info');
  }
};
