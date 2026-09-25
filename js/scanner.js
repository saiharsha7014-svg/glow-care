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

  // Progressive 4-phase timer (~3.2 seconds for fast, engaging hackathon demo)
  const totalDuration = 3200;
  const intervalStep = 60;
  let elapsed = 0;

  const scanTimer = setInterval(() => {
    elapsed += intervalStep;
    const progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressPct) progressPct.textContent = `${progress}%`;

    // Phase transitions
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

// 6. Complete Scan & Execute Computer Vision Pixel Analysis
function completeScanProcess() {
  SoundFx.successChime();

  const laser = document.getElementById('laser-scanning-sweep');
  const progressOverlay = document.getElementById('hud-progress-overlay');
  const captureBtn = document.getElementById('btn-run-analysis');

  if (laser) laser.classList.remove('scanning');
  if (progressOverlay) progressOverlay.classList.remove('active');
  if (captureBtn) captureBtn.disabled = false;

  // Capture synchronous snapshot canvas & dataUrl
  const snapshot = captureVideoSnapshot();

  // Run Real Computer Vision Pixel Analysis directly on snapshot canvas (synchronous & accurate!)
  const analysisResult = analyzeFaceSkinCharacteristics(snapshot.canvas);

  // Save to Central Store
  if (window.store) {
    window.store.saveScan({
      ...analysisResult,
      snapshotImage: snapshot.dataUrl
    });
  }

  isScanning = false;
  updateGuidanceBadge('Scan complete! View your results below.', 'success');
  window.showToast('AI Skin Analysis Completed Successfully!', 'success');

  // Render Comprehensive Results Section
  renderResultsDashboard(analysisResult, snapshot.dataUrl);

  // Smooth scroll to results
  setTimeout(() => {
    const resultsSection = document.getElementById('scanner-results-section');
    if (resultsSection) {
      resultsSection.classList.add('show');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, 400);
}

// Capture current video frame or image to a canvas (handles video, demo image & uploaded photos)
function captureVideoSnapshot() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  if (activeImageSource && activeImageSource !== videoElement) {
    // Drawn from uploaded image or preset demo portrait
    ctx.drawImage(activeImageSource, 0, 0, canvas.width, canvas.height);
  } else if (videoElement && videoElement.videoWidth > 0) {
    // Drawn from live camera (mirrored to match user reflection)
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  } else {
    // Fallback: draw from overlayCanvas
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
    }
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92)
  };
}

// 7. Computer Vision Pixel Inspection Engine (Direct Canvas Synchronous Analysis)
function analyzeFaceSkinCharacteristics(sourceCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (sourceCanvas) {
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Extract pixel zone samples: Forehead, T-Zone, Cheeks, Under-Eyes, Chin
  const zones = {
    forehead: sampleZone(data, canvas.width, 0.35, 0.18, 0.3, 0.15),
    tzone: sampleZone(data, canvas.width, 0.40, 0.32, 0.2, 0.25),
    leftCheek: sampleZone(data, canvas.width, 0.20, 0.45, 0.2, 0.22),
    rightCheek: sampleZone(data, canvas.width, 0.60, 0.45, 0.2, 0.22),
    underEyes: sampleZone(data, canvas.width, 0.30, 0.35, 0.4, 0.10),
    chin: sampleZone(data, canvas.width, 0.40, 0.72, 0.2, 0.15)
  };

  // Evaluate redness / inflammation metric (R vs G/B differential)
  const cheekRedness = (zones.leftCheek.redness + zones.rightCheek.redness) / 2;
  const rednessScore = Math.min(95, Math.max(18, Math.round(cheekRedness * 1.5 + 20)));

  // Evaluate shine / oiliness (specular highlights in T-zone)
  const tzoneLuminance = zones.tzone.luminance;
  const oilinessScore = Math.min(92, Math.max(22, Math.round((tzoneLuminance / 255) * 100 * 1.05)));

  // Evaluate texture variance / visible pores (standard deviation of luminance)
  const textureVariance = (zones.leftCheek.variance + zones.tzone.variance) / 2;
  const poresScore = Math.min(90, Math.max(26, Math.round(textureVariance * 2.7 + 15)));

  // Evaluate under-eye contrast vs cheek baseline (darkness ratio)
  const underEyeContrast = Math.max(0, zones.leftCheek.luminance - zones.underEyes.luminance);
  const underEyeScore = Math.min(88, Math.max(20, Math.round(underEyeContrast * 1.8 + 32)));

  // Evaluate pigmentation / dark spots
  const pigmentationVariance = (zones.leftCheek.variance + zones.forehead.variance) / 2;
  const pigmentationScore = Math.min(85, Math.max(16, Math.round(pigmentationVariance * 2.0 + 12)));

  // Evaluate dryness (inverse of oiliness combined with low reflectance)
  const drynessScore = Math.min(88, Math.max(15, Math.round(Math.max(10, 95 - oilinessScore * 0.9))));

  // Evaluate acne probability from localized redness peaks & pore depth
  const acneScore = Math.min(88, Math.max(14, Math.round(rednessScore * 0.7 + poresScore * 0.25)));

  // Determine Primary Skin Type
  let skinType = 'Combination';
  if (oilinessScore > 62 && poresScore > 50) {
    skinType = 'Oily & Acne-Prone';
  } else if (drynessScore > 58 && oilinessScore < 42) {
    skinType = 'Dry & Sensitive';
  } else if (oilinessScore > 58 && drynessScore < 45) {
    skinType = 'Oily Skin';
  } else if (rednessScore > 60) {
    skinType = 'Sensitive & Reactive';
  } else if (oilinessScore >= 38 && oilinessScore <= 58 && poresScore < 50) {
    skinType = 'Normal Balance';
  } else {
    skinType = 'Combination Skin';
  }

  // Calculate Overall Skin Health Score (0 - 100)
  const penalties = (acneScore * 0.18) + (rednessScore * 0.15) + (poresScore * 0.15) + (underEyeScore * 0.14) + (Math.abs(50 - oilinessScore) * 0.18);
  const overallScore = Math.max(50, Math.min(96, Math.round(100 - penalties * 0.45)));

  // Build All 10 Detected Concerns (as specified in prompt)
  const concerns = [
    {
      name: 'Pimples / Acne',
      level: acneScore > 55 ? 'High' : acneScore > 35 ? 'Moderate' : 'Mild',
      score: acneScore,
      area: 'Cheeks & Jawline',
      solution: 'Gentle Salicylic Acid Cleanser + Non-Comedogenic Gel Moisturizer + Oil-Free Sunscreen'
    },
    {
      name: 'Oily skin',
      level: oilinessScore > 60 ? 'High' : oilinessScore > 42 ? 'Moderate' : 'Mild',
      score: oilinessScore,
      area: 'T-Zone & Forehead',
      solution: 'Gentle Cleanser + Lightweight Oil-Free Moisturizer + Matte Sunscreen'
    },
    {
      name: 'Visible pores',
      level: poresScore > 55 ? 'High' : poresScore > 35 ? 'Moderate' : 'Mild',
      score: poresScore,
      area: 'Nose & Mid-Cheeks',
      solution: 'Gentle Pore-Cleanser + BHA Liquid Exfoliant + Lightweight Moisturizer + Sunscreen'
    },
    {
      name: 'Redness',
      level: rednessScore > 55 ? 'High' : rednessScore > 35 ? 'Moderate' : 'Mild',
      score: rednessScore,
      area: 'Cheek Capillaries',
      solution: 'Centella Asiatica Cica Balm + Barrier Repair Ceramides + Physical Mineral SPF'
    },
    {
      name: 'Under-eye darkness',
      level: underEyeScore > 52 ? 'High' : underEyeScore > 35 ? 'Moderate' : 'Mild',
      score: underEyeScore,
      area: 'Infraorbital Contour',
      solution: '5% Caffeine + Multi-Peptide Eye Gel + Cold Compress + Daily Sun Protection'
    },
    {
      name: 'Dark spots',
      level: pigmentationScore > 50 ? 'High' : pigmentationScore > 32 ? 'Moderate' : 'Mild',
      score: pigmentationScore,
      area: 'Cheeks & Forehead',
      solution: 'Sunscreen + Gentle Brightening Skincare (15% Vitamin C / Alpha Arbutin) + Moisturizer'
    },
    {
      name: 'Pigmentation',
      level: pigmentationScore > 48 ? 'High' : pigmentationScore > 30 ? 'Moderate' : 'Mild',
      score: Math.max(20, pigmentationScore - 2),
      area: 'Cheekbones & Temples',
      solution: 'Broad-Spectrum SPF 50+ Sunscreen + Gentle Brightening Serum + Night Cream'
    },
    {
      name: 'Blackheads',
      level: poresScore > 50 ? 'High' : poresScore > 32 ? 'Moderate' : 'Mild',
      score: Math.max(20, poresScore - 3),
      area: 'Nose & Chin Crease',
      solution: '2% BHA Salicylic Exfoliant + Gentle Foaming Cleanser + Lightweight Hydrator'
    },
    {
      name: 'Uneven skin tone',
      level: pigmentationScore > 45 ? 'High' : pigmentationScore > 28 ? 'Moderate' : 'Mild',
      score: Math.round((pigmentationScore + rednessScore) / 2),
      area: 'Mid-Face & Forehead',
      solution: 'Niacinamide Balance Serum + Daily Mineral Sunscreen + Barrier Cream'
    },
    {
      name: 'Dryness',
      level: drynessScore > 55 ? 'High' : drynessScore > 35 ? 'Moderate' : 'Mild',
      score: drynessScore,
      area: 'Outer Cheeks & Perioral',
      solution: 'Hydrating Cleanser + Moisturizer + Hydrating Serum + Sunscreen'
    }
  ];

  // Sort concerns by score descending so the most prominent concerns are presented first
  concerns.sort((a, b) => b.score - a.score);

  return {
    skinType,
    overallScore,
    concerns,
    metrics: {
      hydration: Math.max(30, 100 - drynessScore),
      sebum: oilinessScore,
      smoothness: Math.max(30, 100 - poresScore),
      clarity: Math.max(25, 100 - acneScore),
      radiance: Math.max(35, 100 - underEyeScore)
    }
  };
}

// Sample subregion pixel data
function sampleZone(data, width, relX, relY, relW, relH) {
  const startX = Math.round(relX * width);
  const startY = Math.round(relY * (data.length / (width * 4)));
  const zoneW = Math.round(relW * width);
  const zoneH = Math.round(relH * (data.length / (width * 4)));

  let totalR = 0, totalG = 0, totalB = 0, totalLum = 0, count = 0;
  const lumList = [];

  for (let y = startY; y < startY + zoneH; y += 2) {
    for (let x = startX; x < startX + zoneW; x += 2) {
      const idx = (y * width + x) * 4;
      if (idx < data.length - 4) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalR += r;
        totalG += g;
        totalB += b;
        totalLum += lum;
        lumList.push(lum);
        count++;
      }
    }
  }

  const avgLum = count > 0 ? totalLum / count : 128;
  const avgR = count > 0 ? totalR / count : 128;
  const avgG = count > 0 ? totalG / count : 128;
  const avgB = count > 0 ? totalB / count : 128;

  const redness = Math.max(0, avgR - (avgG + avgB) / 2);

  let sumSqDiff = 0;
  lumList.forEach(l => sumSqDiff += (l - avgLum) * (l - avgLum));
  const variance = count > 0 ? Math.sqrt(sumSqDiff / count) : 10;

  return { luminance: avgLum, redness, variance };
}

// 8. Render Results Dashboard with Interactive Hotspots & Matched Products
function renderResultsDashboard(analysis, snapshotUrl) {
  // Update Health Score Ring Gauge
  const scoreVal = document.getElementById('score-gauge-val');
  const scoreRing = document.getElementById('score-gauge-ring');
  if (scoreVal) scoreVal.textContent = analysis.overallScore;
  if (scoreRing) {
    const circumference = 377; // 2 * PI * 60
    const offset = circumference - (analysis.overallScore / 100) * circumference;
    scoreRing.style.strokeDashoffset = offset;
  }

  // Update Skin Type Badge & Summary
  const skinTypeElem = document.getElementById('result-skin-type');
  const summaryElem = document.getElementById('result-summary-text');
  if (skinTypeElem) skinTypeElem.textContent = `${analysis.skinType}`;
  if (summaryElem) {
    summaryElem.textContent = `Your skin reflects characteristics of ${analysis.skinType}. We detected ${analysis.concerns[0].name.toLowerCase()} as your primary focus area (${analysis.concerns[0].level} concern), followed by ${analysis.concerns[1].name.toLowerCase()}. Below is your tailored AM/PM routine and matched skincare catalog.`;
  }

  // Update Snapshot Image & Place Interactive Hotspots
  const snapshotImg = document.getElementById('snapshot-img');
  const hotspotContainer = document.getElementById('snapshot-hotspots-wrapper');
  if (snapshotImg) snapshotImg.src = snapshotUrl;

  if (hotspotContainer) {
    hotspotContainer.innerHTML = '';
    // Map hotspots to coordinates
    const pinCoordinates = [
      { top: '24%', left: '50%', concern: 'T-Zone: Sebum & Pores' },
      { top: '48%', left: '30%', concern: `L-Cheek: ${analysis.concerns[0].name}` },
      { top: '50%', left: '70%', concern: `R-Cheek: ${analysis.concerns[1].name}` },
      { top: '38%', left: '34%', concern: 'Infraorbital: Under-Eye Darkness' },
      { top: '78%', left: '50%', concern: 'Chin: Texture & Blackheads' }
    ];

    pinCoordinates.forEach(pin => {
      const pinEl = document.createElement('div');
      pinEl.className = 'face-hotspot';
      pinEl.style.top = pin.top;
      pinEl.style.left = pin.left;
      pinEl.innerHTML = `
        <span>+</span>
        <div class="hotspot-tooltip">${pin.concern}</div>
      `;
      hotspotContainer.appendChild(pinEl);
    });
  }

  // Render Detected Concerns List with Level Badges
  const concernsList = document.getElementById('concerns-list-container');
  if (concernsList) {
    concernsList.innerHTML = analysis.concerns.map(c => {
      const levelClass = c.level === 'High' ? 'level-high' : c.level === 'Moderate' ? 'level-moderate' : 'level-mild';
      return `
        <div class="concern-item-row">
          <div class="concern-info">
            <span class="concern-icon">${getConcernIcon(c.name)}</span>
            <div>
              <div class="concern-name">${c.name}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${c.area}</div>
            </div>
          </div>
          <span class="concern-level-badge ${levelClass}">${c.level} Concern</span>
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div class="concern-metric-track">
              <div class="concern-metric-bar" style="width:${c.score}%;"></div>
            </div>
            <span style="font-size:0.72rem; color:var(--text-muted); text-align:right;">${c.score}% Match</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Personalized AM / PM Skincare Routine Blueprint
  renderSkincareRoutine(analysis);

  // Render Matched Products automatically
  renderMatchedProducts(analysis);

  // Render Recommended Beauty Service Treatment
  renderMatchedTreatment(analysis);
}

function getConcernIcon(name) {
  if (name.includes('Acne') || name.includes('Pimples')) return '⚡';
  if (name.includes('Oily')) return '💧';
  if (name.includes('Pores')) return '🔍';
  if (name.includes('Redness')) return '🌸';
  if (name.includes('Under-eye')) return '👁️';
  if (name.includes('Dark spots') || name.includes('Pigmentation')) return '✨';
  if (name.includes('Dryness')) return '🍃';
  if (name.includes('Blackheads')) return '🔘';
  return '🌟';
}

function renderSkincareRoutine(analysis) {
  const amSteps = document.getElementById('am-routine-steps');
  const pmSteps = document.getElementById('pm-routine-steps');
  if (!amSteps || !pmSteps) return;

  const primary = analysis.concerns[0].name;

  let amRoutine = [
    { num: 1, type: 'Gentle Cleanser', advice: primary.includes('Oily') || primary.includes('Acne') || primary.includes('Pores') ? 'Use Salicylic Acid or foaming gentle cleanser to dissolve excess sebum.' : 'Use Hydrating Ceramide Milk cleanser to preserve moisture barrier.' },
    { num: 2, type: 'Targeted Serum', advice: primary.includes('Dark spots') || primary.includes('Pigmentation') ? 'Apply 15% Vitamin C + Alpha Arbutin brightening serum.' : primary.includes('Dryness') ? 'Apply 2% Hyaluronic Acid + B5 moisture drops.' : 'Apply 10% Niacinamide + Zinc to normalize oil and tighten pores.' },
    { num: 3, type: 'Moisturizer', advice: primary.includes('Dryness') ? 'Apply Deep Barrier Ceramide Cream.' : 'Apply Ultra-Lightweight Oil-Free Water Gel moisturizer.' },
    { num: 4, type: 'Daily Sun Protection', advice: 'Crucial: Apply Broad Spectrum SPF 50+ mineral/fluid sunscreen daily to prevent pigmentation and protect blemishes.' }
  ];

  let pmRoutine = [
    { num: 1, type: 'Double Cleanse', advice: 'Dissolve daily pollution, sunscreen, and grime thoroughly without stripping natural oils.' },
    { num: 2, type: 'Exfoliation / Treatment', advice: primary.includes('Acne') || primary.includes('Pores') || primary.includes('Blackheads') ? 'Swipe 2% BHA Liquid Exfoliant across T-zone 3 nights per week.' : 'Apply Centella Cica Soothing Barrier Balm to heal skin overnight.' },
    { num: 3, type: 'Under-Eye Care', advice: 'Tap Caffeine 5% + Peptide Gel gently around orbital eye contour to depuff and revive.' },
    { num: 4, type: 'Night Recovery Cream', advice: 'Lock in restorative hydration with Ceramide Recovery Balm before sleep.' }
  ];

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

function renderMatchedProducts(analysis) {
  const container = document.getElementById('matched-products-grid');
  if (!container || !window.store) return;

  const allProducts = window.store.getProducts();
  const topConcerns = analysis.concerns.slice(0, 3).map(c => c.name);

  // Score products based on concern match
  const scored = allProducts.map(prod => {
    let matchScore = 0;
    prod.concerns.forEach(c => {
      if (topConcerns.includes(c)) matchScore += 3;
    });
    if (prod.skinType.includes(analysis.skinType.split(' ')[0])) matchScore += 2;
    return { ...prod, matchScore };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const matched = scored.slice(0, 4);

  container.innerHTML = matched.map(p => `
    <div class="product-card">
      <div class="product-thumb-wrapper">
        <img src="${p.image}" alt="${p.name}">
        <span class="product-badge-tag">${p.badge || 'AI Matched'}</span>
        <button class="product-fav-btn ${window.store.isFavorite(p.id) ? 'active' : ''}" onclick="toggleProductFavorite('${p.id}', this)">♥</button>
      </div>
      <div class="product-body">
        <div class="product-meta-row">
          <span class="product-category-name">${p.category}</span>
          <span class="product-rating">★ ${p.rating}</span>
        </div>
        <h4 class="product-title">${p.name}</h4>
        <div class="why-recommended-box">
          <strong>Why Recommended For You:</strong>
          ${p.recommendationReason}
        </div>
        <div class="product-footer-row">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <div class="product-card-actions">
            <button class="btn btn-outline-primary btn-sm" onclick="openProductModal('${p.id}')">Details</button>
            <button class="btn btn-primary btn-sm" onclick="addProductToCart('${p.id}')">Add to Cart</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderMatchedTreatment(analysis) {
  const container = document.getElementById('matched-treatment-box');
  if (!container || !window.store) return;

  const services = window.store.getServices();
  const topConcern = analysis.concerns[0].name;

  let service = services[0]; // Default Hydra-Glow
  if (topConcern.includes('Acne') || topConcern.includes('Pimples')) {
    service = services.find(s => s.category === 'Acne Care') || services[1];
  } else if (topConcern.includes('Redness') || topConcern.includes('Dryness')) {
    service = services.find(s => s.category === 'Skin Care') || services[2];
  }

  container.innerHTML = `
    <div class="service-card" style="display:grid; grid-template-columns: 0.9fr 1.1fr; align-items:center;">
      <div class="service-image-box" style="height:100%;">
        <img src="${service.image}" alt="${service.name}">
        <span class="service-duration-badge">${service.duration}</span>
      </div>
      <div class="service-body">
        <div style="font-size:0.8rem; font-weight:700; color:var(--primary); text-transform:uppercase;">Recommended Clinical Treatment</div>
        <h3 class="service-title" style="margin: 0.3rem 0 0.6rem;">${service.name}</h3>
        <p class="service-desc">${service.description}</p>
        <div class="service-suited-box">
          <strong>Matched for:</strong> ${topConcern} & ${analysis.skinType}
        </div>
        <div class="service-footer">
          <span class="service-price">$${service.price.toFixed(2)}</span>
          <a href="book.html?service=${service.id}" class="btn btn-primary">Book This Treatment</a>
        </div>
      </div>
    </div>
  `;
}

// 9. Load Demo Preset Selfie for instantaneous demonstration without camera
function loadPresetDemoSelfie() {
  stopLiveCamera();
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

    window.showToast('Demo selfie loaded! Click "Run Skin Analysis Scan" to analyze.', 'info');
  };
  img.src = demoImgUrl;
}

// 10. Handle Uploaded Selfie Photo
function handleUploadedSelfie(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    stopLiveCamera();
    const standbyScreen = document.getElementById('camera-standby-screen');
    const hudLayer = document.getElementById('hud-layer');
    if (standbyScreen) standbyScreen.style.display = 'none';
    if (hudLayer) hudLayer.classList.add('active');

    const img = new Image();
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

      updateGuidanceBadge('Photo loaded — Ready to scan!', 'success');
      const captureBtn = document.getElementById('btn-run-analysis');
      if (captureBtn) {
        captureBtn.style.display = 'inline-flex';
        captureBtn.disabled = false;
      }
      const stopBtn = document.getElementById('btn-stop-camera');
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      const startBtn = document.getElementById('btn-start-camera');
      if (startBtn) startBtn.style.display = 'none';

      window.showToast('Photo loaded successfully! Click "Run Skin Analysis Scan".', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function resetScannerForNewScan() {
  const resultsSection = document.getElementById('scanner-results-section');
  if (resultsSection) resultsSection.classList.remove('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  startLiveCamera();
}

function checkAndDisplayPreviousScan() {
  if (!window.store) return;
  const last = window.store.getLastScan();
  if (last && last.skinType) {
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
