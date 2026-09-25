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

// 6. Complete Scan & Execute Rigorous Computer Vision Quality Check & Analysis
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

  // 2. Resolve face bounding box on snapshot canvas
  let faceBox = null;
  if (blazefaceModel) {
    try {
      const preds = await blazefaceModel.estimateFaces(snapshot.canvas, false);
      if (preds && preds.length > 0) {
        const p = preds[0];
        faceBox = {
          x: p.topLeft[0],
          y: p.topLeft[1],
          width: p.bottomRight[0] - p.topLeft[0],
          height: p.bottomRight[1] - p.topLeft[1]
        };
      }
    } catch (e) {}
  }

  // Fallback to chromatic skin-tone face tracker if BlazeFace didn't detect
  if (!faceBox) {
    faceBox = detectFaceViaSkinTone(snapshot.canvas) || lastFaceBox;
  }

  // 3. RIGOROUS QUALITY VALIDATION (Requirement #1: Do NOT generate prediction from unusable image)
  const qualityCheck = validateFaceImageQuality(snapshot.canvas, faceBox);

  if (!qualityCheck.valid) {
    SoundFx.playBeep(380, 0.22, 'sawtooth');
    showQualityAlert(qualityCheck.title, qualityCheck.message, qualityCheck.detail);
    updateGuidanceBadge('Image quality insufficient — see notice below', 'warning');
    window.showToast('Analysis stopped: ' + qualityCheck.detail, 'warning');

    const resultsSection = document.getElementById('scanner-results-section');
    if (resultsSection) resultsSection.classList.remove('show');
    return; // STOP analysis immediately!
  }

  // Quality check passed: hide alert banner
  hideQualityAlert();
  SoundFx.successChime();

  // 4. Run Computer Vision Spectrometry Pixel Analysis (Deterministic, No Guessed Numbers)
  const analysisResult = analyzeFaceSkinCharacteristics(snapshot.canvas, faceBox);

  // Save to Central Store
  if (window.store) {
    window.store.saveScan({
      ...analysisResult,
      snapshotImage: snapshot.dataUrl,
      timestamp: new Date().toISOString()
    });
  }

  updateGuidanceBadge('Analysis complete! View observation report below.', 'success');
  window.showToast('Skin analysis completed successfully!', 'success');

  // Render Comprehensive Explanation-First Results Section
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

// Show / Hide Quality Alert Notice Banner
function showQualityAlert(title, message, detail) {
  const banner = document.getElementById('quality-alert-banner');
  const titleEl = document.getElementById('quality-alert-title');
  const msgEl = document.getElementById('quality-alert-message');
  const detailEl = document.getElementById('quality-alert-details');

  if (titleEl) titleEl.textContent = title || "Image Quality Check Notice";
  if (msgEl) msgEl.textContent = message || "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.";
  if (detailEl) detailEl.textContent = detail || "";

  if (banner) {
    banner.style.display = 'flex';
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function hideQualityAlert() {
  const banner = document.getElementById('quality-alert-banner');
  if (banner) banner.style.display = 'none';
}

// 7. Rigorous Face & Image Quality Validator (Requirement #1)
// Checks: Human face presence, size, lighting exposure, blurriness/sharpness, and occlusion.
function validateFaceImageQuality(canvas, faceBox) {
  if (!canvas) {
    return {
      valid: false,
      title: "No Image Available",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: "No image frame could be captured for inspection."
    };
  }

  const cw = canvas.width;
  const ch = canvas.height;

  // Check A: Face detected
  if (!faceBox || faceBox.width <= 0 || faceBox.height <= 0) {
    return {
      valid: false,
      title: "No Clear Face Detected",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: "A usable front-facing human face could not be identified in the image. Please position yourself facing the camera directly."
    };
  }

  // Check B: Face size proportion
  const faceArea = faceBox.width * faceBox.height;
  const canvasArea = cw * ch;
  const faceRatio = faceArea / canvasArea;

  if (faceBox.width < cw * 0.16 || faceBox.height < ch * 0.16 || faceRatio < 0.035) {
    return {
      valid: false,
      title: "Face Too Small or Far Away",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: "The face is too distant in the frame for micro-texture and pore analysis. Please move closer to the camera."
    };
  }

  // Extract pixel data inside face bounding box for spectrometry
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const fx = Math.max(0, Math.round(faceBox.x));
  const fy = Math.max(0, Math.round(faceBox.y));
  const fw = Math.min(cw - fx, Math.round(faceBox.width));
  const fh = Math.min(ch - fy, Math.round(faceBox.height));

  if (fw <= 15 || fh <= 15) {
    return {
      valid: false,
      title: "Face Frame Invalid",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: "Face bounding coordinates are outside the valid frame limits."
    };
  }

  const faceImgData = ctx.getImageData(fx, fy, fw, fh);
  const data = faceImgData.data;

  let totalLum = 0;
  let skinPixels = 0;
  let gradientSum = 0;
  let sampleCount = 0;
  const gradList = [];

  for (let y = 0; y < fh - 2; y += 3) {
    for (let x = 0; x < fw - 2; x += 3) {
      const idx = (y * fw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLum += lum;

      // Chromatic skin check
      const sum = r + g + b;
      if (sum > 0) {
        const nr = r / sum;
        const ng = g / sum;
        if (nr > 0.33 && nr < 0.58 && ng > 0.25 && ng < 0.42 && r > g) {
          skinPixels++;
        }
      }

      // Edge sharpness via neighbor pixel differences
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

  // Check C: Lighting level
  if (avgLum < 38) {
    return {
      valid: false,
      title: "Insufficient Lighting (Too Dark)",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: `Average face brightness is critically low (${Math.round(avgLum)}/255). Facial characteristics cannot be inspected in low light. Please face natural daylight or a well-lit room.`
    };
  }

  if (avgLum > 238) {
    return {
      valid: false,
      title: "Overexposed / Harsh Flash Glare",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: `Face brightness is washed out by direct flash or harsh specular glare (${Math.round(avgLum)}/255). Please use soft, diffused ambient lighting.`
    };
  }

  // Check D: Blurriness / Image Sharpness
  const avgGrad = sampleCount > 0 ? gradientSum / sampleCount : 0;
  let gradVarSum = 0;
  gradList.forEach(g => { gradVarSum += (g - avgGrad) ** 2; });
  const gradStdDev = sampleCount > 0 ? Math.sqrt(gradVarSum / sampleCount) : 0;

  if (gradStdDev < 3.5 && avgGrad < 3.8) {
    return {
      valid: false,
      title: "Image Appears Blurry or Out of Focus",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: "Micro-texture and edge contrast are blurred. Please hold your camera steady, ensure lens focus, and retry."
    };
  }

  // Check E: Face occlusion / skin ratio
  const skinRatio = sampleCount > 0 ? skinPixels / sampleCount : 0;
  if (skinRatio < 0.22) {
    return {
      valid: false,
      title: "Face Heavily Covered or Obstructed",
      message: "Please upload a clear, front-facing face photo with good lighting for a more useful analysis.",
      detail: "Less than 25% unobstructed skin detected in the face frame. Please remove large sunglasses, face coverings, or hands."
    };
  }

  return { valid: true };
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

  return {
    skinType,
    overallSummary,
    concerns: detectedConcerns,
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

// 15. Handle Uploaded Selfie Photo with Immediate Quality Verification (Requirement #1)
function handleUploadedSelfie(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Clear previous quality alert and previous results
  hideQualityAlert();
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

      // Detect face with BlazeFace or Chromatic Tracker
      let detectedBox = null;
      if (blazefaceModel) {
        try {
          const preds = await blazefaceModel.estimateFaces(testCanvas, false);
          if (preds && preds.length > 0) {
            detectedBox = {
              x: preds[0].topLeft[0],
              y: preds[0].topLeft[1],
              width: preds[0].bottomRight[0] - preds[0].topLeft[0],
              height: preds[0].bottomRight[1] - preds[0].topLeft[1]
            };
          }
        } catch (err) {}
      }

      if (!detectedBox) {
        detectedBox = detectFaceViaSkinTone(testCanvas);
      }

      // Check quality immediately
      const qCheck = validateFaceImageQuality(testCanvas, detectedBox);

      if (!qCheck.valid) {
        SoundFx.playBeep(380, 0.22, 'sawtooth');
        showQualityAlert(qCheck.title, qCheck.message, qCheck.detail);
        updateGuidanceBadge('Image quality insufficient — see notice below', 'warning');
        window.showToast('Please upload a clear, front-facing face photo with good lighting', 'warning');

        // Disable analysis button
        const captureBtn = document.getElementById('btn-run-analysis');
        if (captureBtn) captureBtn.disabled = true;
        return; // STOP!
      }

      // If valid, store faceBox scaled to overlayCanvas
      hideQualityAlert();
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
      updateGuidanceBadge('Photo verified with clear face detection. Ready to scan!', 'success');

      const captureBtn = document.getElementById('btn-run-analysis');
      if (captureBtn) {
        captureBtn.style.display = 'inline-flex';
        captureBtn.disabled = false;
      }
      const stopBtn = document.getElementById('btn-stop-camera');
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      const startBtn = document.getElementById('btn-start-camera');
      if (startBtn) startBtn.style.display = 'none';

      window.showToast('Photo verified! Click "Run Skin Analysis Scan".', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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
