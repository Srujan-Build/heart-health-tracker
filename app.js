/**
 * Heart Health Tracker - Progressive Web App
 * College Community Project - Plain HTML, CSS, JavaScript
 * For awareness only. Not a doctor.
 */

'use strict';

// ============================================================================
// 1. CONSTANTS & STORAGE KEYS
// ============================================================================
const STORAGE_KEYS = {
  PROFILE: 'hht_profile',
  READINGS: 'hht_readings',
  MEDICINES: 'hht_medicines',
  CHECKUPS: 'hht_checkups',
  ACTIVE_TRACKING: 'hht_active_tracking',
  THEME: 'hht_theme'
};

const AHA_GUIDELINE_SOURCE = '2017 AHA/ACC Guideline for High Blood Pressure';

// Default user profile
const DEFAULT_PROFILE = {
  nickname: 'Friend',
  ageGroup: 'under30',
  dietPref: 'veg',
  stepGoal: 8000,
  conditions: {
    highBp: false,
    diabetes: false,
    cholesterol: false,
    overweight: false,
    kidney: false,
    heart: false
  },
  familyHistory: false,
  contactName: '',
  contactPhone: ''
};

// Default check-ups
const DEFAULT_CHECKUPS = [
  { id: 'bp_weekly', name: 'Weekly Blood Pressure Check', intervalDays: 7, lastDone: null },
  { id: 'doc_visit', name: 'Doctor Routine Visit', intervalDays: 90, lastDone: null },
  { id: 'sugar_check', name: 'Fasting Blood Sugar Test', intervalDays: 30, lastDone: null },
  { id: 'lipid_check', name: 'Lipid Profile (Cholesterol)', intervalDays: 180, lastDone: null }
];

// Default sample medicines
const DEFAULT_MEDICINES = [
  {
    id: 'med_default_1',
    name: 'Multivitamin / BP Support',
    dose: '1 tablet after breakfast',
    times: { morning: true, afternoon: false, night: false },
    logs: {}
  }
];

// ============================================================================
// 2. STATE MANAGEMENT & STORAGE HELPERS
// ============================================================================
class StorageManager {
  static get(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage:`, e);
      return defaultValue;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Error writing ${key} to localStorage:`, e);
      return false;
    }
  }

  static clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      localStorage.removeItem(STORAGE_KEYS.READINGS);
      localStorage.removeItem(STORAGE_KEYS.MEDICINES);
      localStorage.removeItem(STORAGE_KEYS.CHECKUPS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TRACKING);
      return true;
    } catch (e) {
      console.error('Error clearing data:', e);
      return false;
    }
  }
}

// Global App State
const AppState = {
  profile: StorageManager.get(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE),
  readings: StorageManager.get(STORAGE_KEYS.READINGS, []),
  medicines: StorageManager.get(STORAGE_KEYS.MEDICINES, DEFAULT_MEDICINES),
  checkups: StorageManager.get(STORAGE_KEYS.CHECKUPS, DEFAULT_CHECKUPS),
  activeTracking: StorageManager.get(STORAGE_KEYS.ACTIVE_TRACKING, {
    todaySteps: 0,
    activeMinutes: 0,
    lastDate: new Date().toDateString()
  }),
  isStepTracking: false,
  wakeLock: null,
  stepTrackerInterval: null
};

// Reset daily active tracking if day changed
(function resetDailyTrackingIfNewDay() {
  const todayStr = new Date().toDateString();
  if (AppState.activeTracking.lastDate !== todayStr) {
    AppState.activeTracking.todaySteps = 0;
    AppState.activeTracking.activeMinutes = 0;
    AppState.activeTracking.lastDate = todayStr;
    StorageManager.set(STORAGE_KEYS.ACTIVE_TRACKING, AppState.activeTracking);
  }
})();

// ============================================================================
// 3. CLINICAL & EVALUATION RULES ENGINE
// ============================================================================

/**
 * Categorize Blood Pressure based on 2017 AHA/ACC Guidelines:
 * - Normal: Systolic < 120 AND Diastolic < 80
 * - Elevated: Systolic 120-129 AND Diastolic < 80
 * - High Stage 1: Systolic 130-139 OR Diastolic 80-89
 * - High Stage 2: Systolic >= 140 OR Diastolic >= 90
 * - Hypertensive Crisis: Systolic > 180 OR Diastolic > 120
 */
function classifyBloodPressure(systolic, diastolic) {
  const sys = Number(systolic);
  const dia = Number(diastolic);

  if (isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) {
    return { category: 'UNKNOWN', label: 'No Reading', badgeClass: 'badge-normal', level: 0 };
  }

  // Hypertensive Crisis
  if (sys > 180 || dia > 120) {
    return {
      category: 'CRISIS',
      label: 'Crisis (Emergency)',
      badgeClass: 'badge-crisis',
      level: 4,
      source: AHA_GUIDELINE_SOURCE
    };
  }

  // Stage 2
  if (sys >= 140 || dia >= 90) {
    return {
      category: 'STAGE_2',
      label: 'High (Stage 2)',
      badgeClass: 'badge-stage2',
      level: 3,
      source: AHA_GUIDELINE_SOURCE
    };
  }

  // Stage 1
  if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) {
    return {
      category: 'STAGE_1',
      label: 'High (Stage 1)',
      badgeClass: 'badge-stage1',
      level: 2,
      source: AHA_GUIDELINE_SOURCE
    };
  }

  // Elevated
  if (sys >= 120 && sys <= 129 && dia < 80) {
    return {
      category: 'ELEVATED',
      label: 'Elevated',
      badgeClass: 'badge-elevated',
      level: 1,
      source: AHA_GUIDELINE_SOURCE
    };
  }

  // Normal
  if (sys < 120 && dia < 80) {
    return {
      category: 'NORMAL',
      label: 'Normal',
      badgeClass: 'badge-normal',
      level: 0,
      source: AHA_GUIDELINE_SOURCE
    };
  }

  return {
    category: 'ELEVATED',
    label: 'Elevated',
    badgeClass: 'badge-elevated',
    level: 1,
    source: AHA_GUIDELINE_SOURCE
  };
}

/**
 * Lifestyle Points Calculator:
 * 1 point each:
 * - exercise under 30 minutes
 * - sleep under 6 hours
 * - oily food
 * - extra salt
 * - tobacco
 * - stress 4 or 5
 * - family history
 * 
 * Score Risk:
 * - High risk if 5 or more points OR BP stage 1 or higher (level >= 2)
 * - Moderate if 3 to 4 points OR Elevated BP (level == 1)
 * - Otherwise low
 */
function calculateLifestyleRisk(entry, bpLevel = 0, familyHistory = false) {
  let points = 0;
  const reasons = [];

  if (entry.exercise !== undefined && entry.exercise !== null && Number(entry.exercise) < 30) {
    points += 1;
    reasons.push('Exercise under 30 mins');
  }
  if (entry.sleep !== undefined && entry.sleep !== null && Number(entry.sleep) < 6) {
    points += 1;
    reasons.push('Sleep under 6 hours');
  }
  if (entry.oilyFood) {
    points += 1;
    reasons.push('Oily / fried food consumed');
  }
  if (entry.extraSalt) {
    points += 1;
    reasons.push('Extra salt added');
  }
  if (entry.tobacco) {
    points += 1;
    reasons.push('Tobacco used');
  }
  if (entry.stress && Number(entry.stress) >= 4) {
    points += 1;
    reasons.push(`High stress level (${entry.stress}/5)`);
  }
  if (familyHistory) {
    points += 1;
    reasons.push('Family history of early heart disease');
  }

  let riskLevel = 'LOW';
  let title = 'Low Lifestyle Risk';
  let badgeClass = 'low';
  let icon = '🟢';

  if (points >= 5 || bpLevel >= 2) {
    riskLevel = 'HIGH';
    title = 'High Lifestyle Risk';
    badgeClass = 'high';
    icon = '🔴';
  } else if (points >= 3 || bpLevel === 1) {
    riskLevel = 'MODERATE';
    title = 'Moderate Lifestyle Risk';
    badgeClass = 'moderate';
    icon = '🟡';
  }

  return { points, riskLevel, title, badgeClass, icon, reasons };
}

/**
 * Emergency Detector Rules Engine:
 * - Critical symptoms:
 *   chest pain or pressure, pain spreading to arm, jaw or back, breathlessness at rest,
 *   fainting, cold sweat with nausea, face drooping / arm weakness / slurred speech,
 *   sudden severe headache.
 * - Emergency rules:
 *   1. ANY critical symptom => EMERGENCY
 *   2. BP in crisis range (>180 sys or >120 dia) TOGETHER WITH ANY symptom => EMERGENCY
 *   3. BP in crisis range ALONE => URGENT (see a doctor today)
 *   4. Racing heartbeat ALONE => URGENT
 *   5. Dizziness ALONE => URGENT
 *   6. Resting pulse > 120 or < 45 => URGENT
 *   7. Stage 2 BP => "see a doctor soon"
 *   8. Otherwise => OK ("No emergency warning signs found. This does not rule out a problem.")
 */
function evaluateEmergencyRules(symptoms = {}, vitals = {}) {
  const {
    chestPain = false,
    radiatingPain = false,
    breathlessRest = false,
    fainting = false,
    coldSweat = false,
    strokeSigns = false,
    severeHeadache = false,
    racingHeart = false,
    dizziness = false
  } = symptoms;

  const sys = Number(vitals.systolic) || 0;
  const dia = Number(vitals.diastolic) || 0;
  const pulse = Number(vitals.pulse) || 0;

  const isCrisisBP = (sys > 180 || dia > 120);
  const isStage2BP = (sys >= 140 || dia >= 90);

  const hasCriticalSymptom = (
    chestPain ||
    radiatingPain ||
    breathlessRest ||
    fainting ||
    coldSweat ||
    strokeSigns ||
    severeHeadache
  );

  const hasAnySymptom = (
    hasCriticalSymptom ||
    racingHeart ||
    dizziness
  );

  // 1. Any critical symptom => EMERGENCY
  if (hasCriticalSymptom) {
    return {
      status: 'EMERGENCY',
      title: '🚨 CRITICAL MEDICAL EMERGENCY',
      message: 'Life-threatening cardiac or stroke warning signs detected! Contact emergency services (108 or 112) or reach a hospital casualty immediately.',
      badgeClass: 'emergency',
      openSOS: true
    };
  }

  // 2. BP in crisis range TOGETHER with any symptom => EMERGENCY
  if (isCrisisBP && hasAnySymptom) {
    return {
      status: 'EMERGENCY',
      title: '🚨 CRISIS BP WITH SYMPTOMS (EMERGENCY)',
      message: 'Blood pressure in crisis range (>180/120) with active symptoms! Seek emergency medical care immediately.',
      badgeClass: 'emergency',
      openSOS: true
    };
  }

  // 3. BP in crisis range ALONE => URGENT (see a doctor today)
  if (isCrisisBP) {
    return {
      status: 'URGENT',
      title: '⚠️ Hypertensive Crisis Range (Urgent)',
      message: 'Blood pressure is over 180 systolic or 120 diastolic. Sit quietly for 5 minutes and re-check. See a doctor today.',
      badgeClass: 'urgent',
      openSOS: false
    };
  }

  // 4. Racing heartbeat alone => URGENT
  if (racingHeart) {
    return {
      status: 'URGENT',
      title: '⚠️ Racing Heartbeat / Palpitations',
      message: 'Unusual rapid or irregular heartbeat. Rest quietly and see a doctor today for an ECG evaluation.',
      badgeClass: 'urgent',
      openSOS: false
    };
  }

  // 5. Dizziness alone => URGENT
  if (dizziness) {
    return {
      status: 'URGENT',
      title: '⚠️ Persistent Dizziness',
      message: 'Persistent dizziness or lightheadedness can signal a cardiovascular or pressure shift. Sit down safely and see a doctor today.',
      badgeClass: 'urgent',
      openSOS: false
    };
  }

  // 6. Pulse > 120 or < 45 => URGENT
  if (pulse > 120 || (pulse > 0 && pulse < 45)) {
    return {
      status: 'URGENT',
      title: '⚠️ Abnormal Resting Heart Rate',
      message: `Resting pulse of ${pulse} bpm is outside the safe range (45-120 bpm). Please see a doctor today.`,
      badgeClass: 'urgent',
      openSOS: false
    };
  }

  // 7. Stage 2 BP => see a doctor soon
  if (isStage2BP) {
    return {
      status: 'SEE_DOCTOR_SOON',
      title: '🩺 High Blood Pressure (Stage 2)',
      message: 'Blood pressure is in Stage 2 range (≥140 systolic or ≥90 diastolic). Please see a doctor soon for evaluation.',
      badgeClass: 'urgent',
      openSOS: false
    };
  }

  // 8. Otherwise => OK
  return {
    status: 'OK',
    title: '✅ No Emergency Warning Signs Found',
    message: 'No emergency warning signs found. This does not rule out a problem. If you feel unwell or concerned, always consult a healthcare provider.',
    badgeClass: 'info',
    openSOS: false
  };
}

// ============================================================================
// 4. BLUETOOTH & SENSOR DATA PARSER
// ============================================================================

/**
 * IEEE-11073 16-bit SFLOAT decoder:
 * Little-endian 16-bit integer:
 * - 4-bit signed exponent (high 4 bits)
 * - 12-bit signed mantissa (low 12 bits)
 */
function parseSFLOAT(dataView, offset) {
  const raw = dataView.getUint16(offset, true); // little-endian
  let mantissa = raw & 0x0FFF;
  if (mantissa >= 0x0800) {
    mantissa = mantissa - 0x1000;
  }
  let exponent = raw >> 12;
  if (exponent >= 0x08) {
    exponent = exponent - 0x10;
  }
  return mantissa * Math.pow(10, exponent);
}

/**
 * Parse Blood Pressure Measurement characteristic (UUID 0x2A35)
 * Test vector: [0x04, 0x78, 0x00, 0x50, 0x00, 0x5D, 0x00, 0x48, 0x00]
 * Output: 120/80 with pulse 72.
 */
function parseBloodPressureMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  const isKpa = (flags & 0x01) !== 0;
  const hasTimestamp = (flags & 0x02) !== 0;
  const hasPulseRate = (flags & 0x04) !== 0;

  // Systolic, Diastolic, MAP (SFLOAT, 2 bytes each)
  let systolic = parseSFLOAT(dataView, 1);
  let diastolic = parseSFLOAT(dataView, 3);
  let map = parseSFLOAT(dataView, 5);

  // Convert kPa to mmHg if needed (1 kPa = 7.50062 mmHg)
  if (isKpa) {
    systolic = Math.round(systolic * 7.50062);
    diastolic = Math.round(diastolic * 7.50062);
    map = Math.round(map * 7.50062);
  } else {
    systolic = Math.round(systolic);
    diastolic = Math.round(diastolic);
    map = Math.round(map);
  }

  let offset = 7;
  if (hasTimestamp) {
    offset += 7; // 7 bytes for timestamp (year, month, day, hours, minutes, seconds)
  }

  let pulseRate = null;
  if (hasPulseRate && dataView.byteLength >= offset + 2) {
    pulseRate = Math.round(parseSFLOAT(dataView, offset));
  }

  return {
    systolic,
    diastolic,
    meanArterialPressure: map,
    pulseRate,
    unit: 'mmHg',
    flags
  };
}

/**
 * Parse Heart Rate Measurement characteristic (UUID 0x2A37)
 */
function parseHeartRateMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  const is16Bit = (flags & 0x01) !== 0;
  const pulse = is16Bit ? dataView.getUint16(1, true) : dataView.getUint8(1);
  return { pulse };
}

// ============================================================================
// 5. STEP COUNTER & DEVICE MOTION DETECTOR
// ============================================================================
class StepDetector {
  constructor(onStepCallback) {
    this.onStepCallback = onStepCallback;
    this.isTracking = false;
    this.gravity = 9.81;
    this.lastStepTime = 0;
    this.minStepIntervalMs = 300; // 300 ms minimum gap
    this.threshold = 1.9; // acceleration threshold in m/s²
    this.aboveThreshold = false;

    // Active minutes tracker: 70+ steps in 60s
    this.recentMinuteSteps = 0;
    this.minuteTimer = null;

    this.motionHandler = this.handleMotion.bind(this);
  }

  async start() {
    if (this.isTracking) return true;

    // Check for iOS 13+ permission
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response !== 'granted') {
          throw new Error('Device motion permission denied');
        }
      } catch (err) {
        console.warn('Motion permission request:', err);
        return false;
      }
    }

    if (!window.DeviceMotionEvent) {
      return false;
    }

    // Request screen wake lock if available
    try {
      if ('wakeLock' in navigator && !AppState.wakeLock) {
        AppState.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }

    window.addEventListener('devicemotion', this.motionHandler, false);
    this.isTracking = true;

    // Minute interval to evaluate active minutes
    this.recentMinuteSteps = 0;
    this.minuteTimer = setInterval(() => {
      if (this.recentMinuteSteps >= 70) {
        AppState.activeTracking.activeMinutes += 1;
        StorageManager.set(STORAGE_KEYS.ACTIVE_TRACKING, AppState.activeTracking);
        UI.renderTodayScreen();
      }
      this.recentMinuteSteps = 0;
    }, 60000);

    return true;
  }

  stop() {
    if (!this.isTracking) return;
    window.removeEventListener('devicemotion', this.motionHandler, false);
    this.isTracking = false;

    if (this.minuteTimer) {
      clearInterval(this.minuteTimer);
      this.minuteTimer = null;
    }

    if (AppState.wakeLock) {
      try {
        AppState.wakeLock.release();
      } catch (e) {}
      AppState.wakeLock = null;
    }
  }

  handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const x = acc.x;
    const y = acc.y;
    const z = acc.z;

    const magnitude = Math.sqrt(x * x + y * y + z * z);

    // Simple low pass filter to separate gravity from motion
    const alpha = 0.85;
    this.gravity = alpha * this.gravity + (1 - alpha) * magnitude;
    const userAcc = Math.abs(magnitude - this.gravity);

    const now = Date.now();

    if (userAcc > this.threshold) {
      if (!this.aboveThreshold && (now - this.lastStepTime > this.minStepIntervalMs)) {
        this.aboveThreshold = true;
        this.lastStepTime = now;
        this.recentMinuteSteps += 1;
        if (this.onStepCallback) {
          this.onStepCallback(1);
        }
      }
    } else {
      this.aboveThreshold = false;
    }
  }
}

const stepDetectorInstance = new StepDetector((deltaSteps) => {
  AppState.activeTracking.todaySteps += deltaSteps;
  UI.updateLiveStepDisplay();
});

// Periodic save for active tracking every 5 seconds
setInterval(() => {
  if (AppState.isStepTracking) {
    StorageManager.set(STORAGE_KEYS.ACTIVE_TRACKING, AppState.activeTracking);
  }
}, 5000);

// ============================================================================
// 6. SVG CHART RENDERING (PURE SVG, NO LIBRARIES)
// ============================================================================
const ChartRenderer = {
  /**
   * Render Blood Pressure Line Chart
   * Includes reference dashed lines at 130 mmHg and 80 mmHg
   */
  renderBpChart(readings) {
    const svg = document.getElementById('bp-svg-chart');
    if (!svg) return;

    if (!readings || readings.length === 0) {
      svg.innerHTML = `
        <text x="230" y="110" text-anchor="middle" fill="var(--text-muted)" font-size="14">
          No blood pressure readings to display. Log a reading to view chart.
        </text>
      `;
      return;
    }

    // Sort chronologically and take last 10
    const sorted = [...readings]
      .filter(r => r.systolic && r.diastolic)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-10);

    if (sorted.length === 0) {
      svg.innerHTML = `
        <text x="230" y="110" text-anchor="middle" fill="var(--text-muted)" font-size="14">
          No blood pressure readings to display.
        </text>
      `;
      return;
    }

    const width = 460;
    const height = 220;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };

    const minSys = 50;
    const maxSys = 200;

    const getY = (val) => {
      const clamped = Math.max(minSys, Math.min(maxSys, val));
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - ((clamped - minSys) / (maxSys - minSys)) * chartHeight;
    };

    const getX = (idx) => {
      const chartWidth = width - padding.left - padding.right;
      if (sorted.length === 1) return padding.left + chartWidth / 2;
      return padding.left + (idx / (sorted.length - 1)) * chartWidth;
    };

    let svgContent = '';

    // Background Grid and Y-axis marks
    const yTicks = [60, 80, 100, 120, 140, 160, 180];
    yTicks.forEach(tick => {
      const y = getY(tick);
      svgContent += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${tick}</text>
      `;
    });

    // Reference Line 130 mmHg (Systolic threshold - Dashed Red)
    const y130 = getY(130);
    svgContent += `
      <line x1="${padding.left}" y1="${y130}" x2="${width - padding.right}" y2="${y130}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.85" />
      <text x="${width - padding.right + 4}" y="${y130 + 3}" fill="#dc2626" font-size="9" font-weight="bold">130</text>
    `;

    // Reference Line 80 mmHg (Diastolic threshold - Dashed Blue)
    const y80 = getY(80);
    svgContent += `
      <line x1="${padding.left}" y1="${y80}" x2="${width - padding.right}" y2="${y80}" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.85" />
      <text x="${width - padding.right + 4}" y="${y80 + 3}" fill="#2563eb" font-size="9" font-weight="bold">80</text>
    `;

    // Build points for Systolic (Teal) and Diastolic (Blue)
    const sysPoints = sorted.map((r, i) => `${getX(i)},${getY(r.systolic)}`).join(' ');
    const diaPoints = sorted.map((r, i) => `${getX(i)},${getY(r.diastolic)}`).join(' ');

    // Polylines
    svgContent += `
      <polyline points="${sysPoints}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <polyline points="${diaPoints}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    `;

    // Data points & X-axis labels
    sorted.forEach((r, i) => {
      const cx = getX(i);
      const cySys = getY(r.systolic);
      const cyDia = getY(r.diastolic);
      const dateLabel = new Date(r.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });

      // Systolic Dot (circle)
      svgContent += `
        <circle cx="${cx}" cy="${cySys}" r="5" fill="var(--primary)" stroke="#ffffff" stroke-width="2">
          <title>${dateLabel}: Systolic ${r.systolic} mmHg</title>
        </circle>
      `;

      // Diastolic Dot (square/circle)
      svgContent += `
        <circle cx="${cx}" cy="${cyDia}" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="1.5">
          <title>${dateLabel}: Diastolic ${r.diastolic} mmHg</title>
        </circle>
      `;

      // X-axis label
      svgContent += `
        <text x="${cx}" y="${height - 12}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${dateLabel}</text>
      `;
    });

    svg.innerHTML = svgContent;
  },

  /**
   * Render Steps Bar Chart with Goal Line
   */
  renderStepsChart(readings, goal = 8000) {
    const svg = document.getElementById('steps-svg-chart');
    if (!svg) return;

    const sorted = [...readings]
      .filter(r => r.steps !== undefined && r.steps !== null && r.steps > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7);

    // If today has steps from active tracking, append/replace today
    const todayStr = new Date().toDateString();
    const hasTodayInReadings = sorted.some(r => new Date(r.date).toDateString() === todayStr);
    if (!hasTodayInReadings && AppState.activeTracking.todaySteps > 0) {
      sorted.push({
        date: new Date().toISOString(),
        steps: AppState.activeTracking.todaySteps
      });
    }

    if (sorted.length === 0) {
      svg.innerHTML = `
        <text x="230" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="14">
          No steps recorded yet. Start walking or log steps!
        </text>
      `;
      return;
    }

    const width = 460;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 30, left: 45 };

    const maxSteps = Math.max(goal * 1.2, ...sorted.map(r => Number(r.steps) || 0));
    const getY = (val) => {
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - (val / maxSteps) * chartHeight;
    };

    let svgContent = '';

    // Goal line
    const yGoal = getY(goal);
    svgContent += `
      <line x1="${padding.left}" y1="${yGoal}" x2="${width - padding.right}" y2="${yGoal}" stroke="var(--primary)" stroke-width="1.5" stroke-dasharray="4,4" />
      <text x="${width - padding.right + 2}" y="${yGoal + 3}" fill="var(--primary)" font-size="9" font-weight="bold">Goal</text>
    `;

    const barWidth = 26;
    const chartWidth = width - padding.left - padding.right;
    const gap = chartWidth / sorted.length;

    sorted.forEach((r, idx) => {
      const x = padding.left + idx * gap + (gap - barWidth) / 2;
      const y = getY(r.steps);
      const barHeight = (height - padding.bottom) - y;
      const isGoalMet = r.steps >= goal;
      const barColor = isGoalMet ? 'var(--primary)' : 'var(--teal-500)';
      const dateLabel = new Date(r.date).toLocaleDateString(undefined, { weekday: 'narrow', day: 'numeric' });

      svgContent += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${barColor}" opacity="0.9">
          <title>${dateLabel}: ${r.steps.toLocaleString()} steps</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" fill="var(--text-primary)" font-size="9" font-weight="bold">${r.steps >= 1000 ? (r.steps/1000).toFixed(1) + 'k' : r.steps}</text>
        <text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${dateLabel}</text>
      `;
    });

    svg.innerHTML = svgContent;
  },

  /**
   * Render Exercise & Sleep Dual Bar Chart
   */
  renderExerciseSleepChart(readings) {
    const svg = document.getElementById('exercise-sleep-svg-chart');
    if (!svg) return;

    const sorted = [...readings]
      .filter(r => (r.exercise !== undefined && r.exercise > 0) || (r.sleep !== undefined && r.sleep > 0))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-6);

    if (sorted.length === 0) {
      svg.innerHTML = `
        <text x="230" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="14">
          No exercise or sleep records to chart yet.
        </text>
      `;
      return;
    }

    const width = 460;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 30, left: 45 };

    const chartHeight = height - padding.top - padding.bottom;
    const maxVal = 60; // scale max 60 mins exercise (sleep scaled * 6)

    const getY = (val) => height - padding.bottom - (Math.min(val, maxVal) / maxVal) * chartHeight;

    let svgContent = `
      <line x1="${padding.left}" y1="${getY(30)}" x2="${width - padding.right}" y2="${getY(30)}" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${padding.left - 6}" y="${getY(30) + 3}" fill="#10b981" font-size="9" text-anchor="end">30m ex</text>
    `;

    const chartWidth = width - padding.left - padding.right;
    const gap = chartWidth / sorted.length;
    const barWidth = 14;

    sorted.forEach((r, idx) => {
      const baseX = padding.left + idx * gap + (gap - barWidth * 2 - 4) / 2;
      const exMins = Number(r.exercise) || 0;
      const sleepHours = Number(r.sleep) || 0;
      const sleepEquiv = sleepHours * 6; // scale 8h sleep -> 48 units

      const yEx = getY(exMins);
      const hEx = (height - padding.bottom) - yEx;

      const ySleep = getY(sleepEquiv);
      const hSleep = (height - padding.bottom) - ySleep;

      const dateLabel = new Date(r.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });

      // Exercise bar (Emerald)
      svgContent += `
        <rect x="${baseX}" y="${yEx}" width="${barWidth}" height="${hEx}" rx="3" fill="#059669">
          <title>Exercise: ${exMins} mins</title>
        </rect>
      `;

      // Sleep bar (Indigo)
      svgContent += `
        <rect x="${baseX + barWidth + 3}" y="${ySleep}" width="${barWidth}" height="${hSleep}" rx="3" fill="#6366f1">
          <title>Sleep: ${sleepHours} hours</title>
        </rect>
        <text x="${baseX + barWidth}" y="${height - 10}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${dateLabel}</text>
      `;
    });

    svg.innerHTML = svgContent;
  }
};

// ============================================================================
// 7. INDIAN DIET PLAN GENERATOR
// ============================================================================
const DietPlanGenerator = {
  build(profile, latestReading, pastReadings = []) {
    const bpClass = latestReading ? classifyBloodPressure(latestReading.systolic, latestReading.diastolic) : { category: 'NORMAL' };

    // Count past 7 days habits
    const last7Days = pastReadings.slice(-7);
    const oilyCount = last7Days.filter(r => r.oilyFood).length;
    const saltCount = last7Days.filter(r => r.extraSalt).length;
    const tobaccoCount = last7Days.filter(r => r.tobacco).length;

    const isKidney = profile.conditions.kidney;
    const isDiabetes = profile.conditions.diabetes;
    const isHighBp = profile.conditions.highBp || bpClass.level >= 2;
    const isCholesterol = profile.conditions.cholesterol;
    const isOverweight = profile.conditions.overweight;
    const pref = profile.dietPref;

    // Daily 4 Targets
    const targets = [
      {
        icon: '🧂',
        title: 'Salt Limit Under 5 Grams',
        desc: 'Strictly under 1 level teaspoon total salt per day across all curries, dals, and snacks. Avoid table salt, papads, pickles, and packaged namkeen.'
      },
      {
        icon: '🥦',
        title: '5 Portions of Vegetables & Fruits',
        desc: 'Eat 3 cups of seasonal cooked vegetables (lauki, turai, bhindi, palak, methi) and 2 whole seasonal fruits (guava, papaya, apple, pear).'
      },
      {
        icon: '🌾',
        title: 'Whole Traditional Grains',
        desc: 'Replace refined maida and polished white rice with traditional Indian millets (Ragi, Jowar, Bajra) and coarse whole wheat atta.'
      },
      {
        icon: '🫒',
        title: 'Under 3-4 Teaspoons Cooking Oil Daily',
        desc: 'Limit cooking oil to under 15-20 ml daily. Prefer cold-pressed mustard, groundnut, or sunflower oil. Avoid repeated re-frying and trans fats.'
      }
    ];

    // Sample Day Meal Schedule
    let breakfast = '';
    let midMorning = '';
    let lunch = '';
    let evening = '';
    let dinner = '';

    if (pref === 'veg') {
      breakfast = 'Steamed vegetable oats idli / methi thepla with mint-coriander chutney, or vegetable dalia khichdi.';
      midMorning = isKidney ? 'Fresh apple or pear slices (Consult doctor for renal fruit allowance).' : 'Seasonal guava or papaya slices, or tender coconut water.';
      lunch = '2 multigrain / jowar rotis + 1 katori yellow moong dal + 1 big bowl of lauki/turai sabzi + cucumber raita.';
      evening = 'Roasted unsalted makhana or boiled sprouted moong chaat with lemon + green tea / warm ginger water.';
      dinner = 'Warm bottle-gourd vegetable soup + 1 light ragi or wheat roti with palak paneer (low-fat) or moong khichdi; finished 2 hours before sleep.';
    } else if (pref === 'veg-egg') {
      breakfast = '2 boiled egg whites + 1 whole wheat toast, or vegetable poha topped with boiled egg slices.';
      midMorning = isKidney ? 'Seasonal sliced apple.' : 'Fresh pomegranate or papaya bowl with flaxseeds.';
      lunch = 'Egg bhurji (2 whites, 1 yolk with onion & tomato) + 2 multigrain rotis + bowl of tadka-free dal + kachumber salad.';
      evening = 'Roasted chana (Bengal gram) + herbal spiced tea (no sugar).';
      dinner = 'Light vegetable stew or dalia with mixed greens + 1 whole wheat roti.';
    } else {
      // Non-veg
      breakfast = 'Steamed idlis or whole wheat roti with scrambled egg whites and chopped vegetables.';
      midMorning = isKidney ? 'Guava or apple.' : 'Fresh seasonal fruit bowl (papaya/citrus).';
      lunch = 'Grilled or mildly curried fish (rich in Omega-3 like Rohu/Hilsa) or skinless chicken breast + 1 cup brown rice + bowl of mixed vegetable sabzi.';
      evening = 'Sprout salad with cucumber and lemon juice + green tea.';
      dinner = 'Moong dal soup + 2 phulkas with lightly sautéed methi or tindora sabzi.';
    }

    // Dynamic Tailored Tips
    const tips = [];

    if (isKidney) {
      tips.push({
        isAlert: true,
        title: '⚠️ Strict Kidney Care Instruction',
        text: 'Because kidney disease is indicated, you MUST strictly follow your nephrologist’s prescribed fluid, potassium, and phosphorus restrictions. Do NOT consume high-potassium foods (such as coconut water, bananas, or citrus juices) without your doctor’s direct consent.'
      });
    }

    if (isHighBp || saltCount >= 3) {
      tips.push({
        isAlert: false,
        title: 'DASH Sodium Reduction Strategy',
        text: 'Avoid hidden sodium: eliminate store-bought ketchup, instant noodles, ajinomoto, baking soda, canned soups, and salty namkeens.'
      });
    }

    if (isDiabetes) {
      tips.push({
        isAlert: false,
        title: 'Low Glycemic Load & Fiber',
        text: 'Eliminate white sugar, jaggery, honey, sweets, and sweetened chai. Eat whole pulses and unpolished grains to prevent blood sugar spikes.'
      });
    }

    if (isCholesterol || oilyCount >= 3) {
      tips.push({
        isAlert: false,
        title: 'Lipid Heart Defense',
        text: 'Strictly limit vanaspati (dalda), commercial bakery goods (biscuits, patties), butter, and deep-fried samosas. Add a tablespoon of roasted flaxseeds daily for soluble fiber.'
      });
    }

    return { targets, breakfast, midMorning, lunch, evening, dinner, tips };
  }
};

// ============================================================================
// 8. USER INTERFACE CONTROLLER
// ============================================================================
const UI = {
  init() {
    this.bindEvents();
    this.applyTheme(StorageManager.get(STORAGE_KEYS.THEME, 'light'));
    this.renderAll();
    this.checkUrlParams();
    this.checkReminderAlerts();
  },

  bindEvents() {
    // Navigation Tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetScreen = tab.dataset.screen;
        UI.switchScreen(targetScreen);
      });
    });

    // Theme Toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        UI.applyTheme(next);
      });
    }

    // Self-Test & Viva Suite Modal
    const btnOpenTests = document.getElementById('btn-open-tests');
    const btnCloseTests = document.getElementById('btn-close-tests');
    const testModal = document.getElementById('test-suite-modal');
    const btnRunTests = document.getElementById('btn-run-all-tests');
    const btnCopyTests = document.getElementById('btn-copy-test-results');

    if (btnOpenTests && testModal) {
      btnOpenTests.addEventListener('click', () => testModal.classList.add('active'));
    }
    if (btnCloseTests && testModal) {
      btnCloseTests.addEventListener('click', () => testModal.classList.remove('active'));
    }
    if (btnRunTests) {
      btnRunTests.addEventListener('click', () => TestSuiteRunner.runAll());
    }
    if (btnCopyTests) {
      btnCopyTests.addEventListener('click', () => {
        const out = document.getElementById('test-suite-output');
        if (out) {
          navigator.clipboard.writeText(out.innerText);
          UI.showToast('Test results copied to clipboard!');
        }
      });
    }

    // Floating SOS button
    const btnSos = document.getElementById('btn-floating-sos');
    if (btnSos) {
      btnSos.addEventListener('click', () => UI.openSosModal());
    }

    // SOS Close
    const btnCloseSos = document.getElementById('btn-close-sos');
    if (btnCloseSos) {
      btnCloseSos.addEventListener('click', () => UI.closeSosModal());
    }

    // SOS Location Fetch
    const btnLocation = document.getElementById('btn-get-location');
    if (btnLocation) {
      btnLocation.addEventListener('click', () => UI.fetchSosLocation());
    }

    // Add Reading Form
    const formAddReading = document.getElementById('form-add-reading');
    if (formAddReading) {
      formAddReading.addEventListener('submit', (e) => {
        e.preventDefault();
        UI.handleAddReadingSubmit();
      });
    }

    // Stress Selector Buttons
    const stressBtns = document.querySelectorAll('.stress-btn');
    stressBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        stressBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const inputStress = document.getElementById('input-stress');
        if (inputStress) inputStress.value = btn.dataset.level;
      });
    });

    // Profile Form
    const formProfile = document.getElementById('form-profile');
    if (formProfile) {
      formProfile.addEventListener('submit', (e) => {
        e.preventDefault();
        UI.handleProfileSubmit();
      });
    }

    // Toggle Profile Edit
    const btnToggleProfile = document.getElementById('btn-toggle-profile-form');
    if (btnToggleProfile && formProfile) {
      btnToggleProfile.addEventListener('click', () => {
        const isHidden = formProfile.style.display === 'none';
        formProfile.style.display = isHidden ? 'block' : 'none';
        btnToggleProfile.textContent = isHidden ? 'Hide Form' : 'Edit Profile';
      });
    }

    // Step Tracker Start/Stop
    const btnToggleSteps = document.getElementById('btn-toggle-steps');
    if (btnToggleSteps) {
      btnToggleSteps.addEventListener('click', () => UI.toggleStepTracking());
    }

    // Bluetooth Connect Button
    const btnBt = document.getElementById('btn-connect-bluetooth');
    if (btnBt) {
      btnBt.addEventListener('click', () => UI.connectBluetoothDevice());
    }

    // Emergency Symptom Checker
    const btnEvalEmergency = document.getElementById('btn-eval-emergency');
    if (btnEvalEmergency) {
      btnEvalEmergency.addEventListener('click', () => UI.handleEmergencyCheck());
    }

    const btnCopyLatest = document.getElementById('btn-copy-latest-to-sym');
    if (btnCopyLatest) {
      btnCopyLatest.addEventListener('click', () => {
        const latest = AppState.readings[AppState.readings.length - 1];
        if (latest) {
          const sysIn = document.getElementById('sym-bp-systolic');
          const diaIn = document.getElementById('sym-bp-diastolic');
          const pulIn = document.getElementById('sym-pulse');
          if (sysIn) sysIn.value = latest.systolic;
          if (diaIn) diaIn.value = latest.diastolic;
          if (pulIn && latest.pulse) pulIn.value = latest.pulse;
          UI.showToast('Copied latest readings into symptom checker.');
        } else {
          UI.showToast('No logged readings available yet.');
        }
      });
    }

    // Notifications Enable & Test
    const btnEnableNotif = document.getElementById('btn-enable-notif');
    if (btnEnableNotif) {
      btnEnableNotif.addEventListener('click', () => UI.requestNotificationPermission());
    }

    const btnTestNotif = document.getElementById('btn-test-emergency-notif');
    if (btnTestNotif) {
      btnTestNotif.addEventListener('click', () => UI.sendEmergencyNotification());
    }

    // Medicine Reminders Add Toggle
    const btnToggleAddMed = document.getElementById('btn-toggle-add-med');
    const formAddMed = document.getElementById('form-add-med');
    if (btnToggleAddMed && formAddMed) {
      btnToggleAddMed.addEventListener('click', () => {
        formAddMed.style.display = formAddMed.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (formAddMed) {
      formAddMed.addEventListener('submit', (e) => {
        e.preventDefault();
        UI.handleAddMedicineSubmit();
      });
    }

    // Check-up Add Toggle
    const btnToggleAddCheckup = document.getElementById('btn-toggle-add-checkup');
    const formAddCheckup = document.getElementById('form-add-checkup');
    if (btnToggleAddCheckup && formAddCheckup) {
      btnToggleAddCheckup.addEventListener('click', () => {
        formAddCheckup.style.display = formAddCheckup.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (formAddCheckup) {
      formAddCheckup.addEventListener('submit', (e) => {
        e.preventDefault();
        UI.handleAddCheckupSubmit();
      });
    }

    // Export Data
    const btnExport = document.getElementById('btn-export-data');
    if (btnExport) {
      btnExport.addEventListener('click', () => UI.exportDataAsJson());
    }

    // Load Sample Data
    const btnLoadSample = document.getElementById('btn-load-sample');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => UI.loadSampleDataset());
    }

    // Delete All Data (Custom 2-step confirmation)
    const btnTriggerDelete = document.getElementById('btn-trigger-delete-data');
    if (btnTriggerDelete) {
      btnTriggerDelete.addEventListener('click', () => {
        UI.showCustomConfirm(
          '⚠️ Delete All Stored Data?',
          'This will permanently erase all your health logs, medicines, and profile from this device. Are you sure?',
          () => {
            StorageManager.clearAll();
            AppState.profile = { ...DEFAULT_PROFILE };
            AppState.readings = [];
            AppState.medicines = [];
            AppState.checkups = [...DEFAULT_CHECKUPS];
            AppState.activeTracking = { todaySteps: 0, activeMinutes: 0, lastDate: new Date().toDateString() };
            UI.renderAll();
            UI.showToast('All stored tracker data has been reset.');
          }
        );
      });
    }

    // Quick navigation from Today screen to Reminders
    const btnQuickReminders = document.getElementById('btn-quick-goto-reminders');
    if (btnQuickReminders) {
      btnQuickReminders.addEventListener('click', () => UI.switchScreen('screen-reminders'));
    }
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    StorageManager.set(STORAGE_KEYS.THEME, theme);
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.textContent = theme === 'dark' ? '☀️' : '🌓';
      themeBtn.title = theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    }
  },

  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');

    const activeTab = document.querySelector(`.nav-tab[data-screen="${screenId}"]`);
    if (activeTab) activeTab.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Re-render specific screen items when active
    if (screenId === 'screen-progress') {
      ChartRenderer.renderBpChart(AppState.readings);
      ChartRenderer.renderStepsChart(AppState.readings, AppState.profile.stepGoal);
      ChartRenderer.renderExerciseSleepChart(AppState.readings);
    } else if (screenId === 'screen-today') {
      this.renderTodayScreen();
    } else if (screenId === 'screen-diet') {
      this.renderDietScreen();
    } else if (screenId === 'screen-summary') {
      this.renderSummaryScreen();
    }
  },

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sos') === '1') {
      this.openSosModal();
    } else if (params.get('screen')) {
      const target = 'screen-' + params.get('screen');
      if (document.getElementById(target)) {
        this.switchScreen(target);
      }
    }
  },

  renderAll() {
    this.renderTodayScreen();
    this.renderReadingsTable();
    this.renderDietScreen();
    this.renderRemindersScreen();
    this.renderSummaryScreen();
    this.populateProfileForm();
    this.updateNotificationBadge();
  },

  renderTodayScreen() {
    const p = AppState.profile;
    const greetingTitle = document.getElementById('greeting-title');
    if (greetingTitle) {
      const hour = new Date().getHours();
      let salute = 'Namaste';
      if (hour < 12) salute = 'Good Morning';
      else if (hour < 17) salute = 'Good Afternoon';
      else salute = 'Good Evening';
      greetingTitle.textContent = `${salute}, ${p.nickname || 'Friend'}!`;
    }

    // Step progress
    const steps = AppState.activeTracking.todaySteps;
    const goal = p.stepGoal || 8000;
    const pct = Math.min(100, Math.round((steps / goal) * 100));

    const ringProgress = document.getElementById('step-ring-progress');
    const ringSteps = document.getElementById('today-steps-display');
    const ringGoal = document.getElementById('today-steps-goal-label');
    const stepPctBadge = document.getElementById('today-step-percent');
    const activeMins = document.getElementById('today-active-mins');
    const approxDist = document.getElementById('today-approx-dist');

    if (ringProgress) ringProgress.setAttribute('stroke-dasharray', `${pct}, 100`);
    if (ringSteps) ringSteps.textContent = steps.toLocaleString();
    if (ringGoal) ringGoal.textContent = `Goal: ${goal.toLocaleString()}`;
    if (stepPctBadge) stepPctBadge.textContent = `${pct}% Goal`;
    if (activeMins) activeMins.textContent = `${AppState.activeTracking.activeMinutes} min`;
    if (approxDist) {
      // 1 step approx 0.00075 km
      const km = (steps * 0.00075).toFixed(2);
      approxDist.textContent = `${km} km`;
    }

    // Latest BP
    const latest = AppState.readings[AppState.readings.length - 1];
    const latestVal = document.getElementById('latest-bp-value');
    const latestStatus = document.getElementById('latest-bp-status');
    const latestPulse = document.getElementById('latest-pulse-display');
    const latestMeta = document.getElementById('latest-bp-meta');

    let bpLevel = 0;
    if (latest && latest.systolic && latest.diastolic) {
      const classification = classifyBloodPressure(latest.systolic, latest.diastolic);
      bpLevel = classification.level;
      if (latestVal) latestVal.textContent = `${latest.systolic} / ${latest.diastolic}`;
      if (latestStatus) {
        latestStatus.textContent = classification.label;
        latestStatus.className = `badge ${classification.badgeClass}`;
      }
      if (latestPulse) {
        latestPulse.textContent = latest.pulse ? `Pulse: ${latest.pulse} bpm` : 'Pulse: --';
      }
      if (latestMeta) {
        const timeStr = new Date(latest.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(latest.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
        latestMeta.textContent = `Source: 2017 AHA Guideline • Logged ${dateStr} at ${timeStr} (${latest.tag || 'manual'})`;
      }
    } else {
      if (latestVal) latestVal.textContent = '-- / --';
      if (latestStatus) {
        latestStatus.textContent = 'No Data';
        latestStatus.className = 'badge badge-normal';
      }
      if (latestPulse) latestPulse.textContent = 'Pulse: --';
      if (latestMeta) latestMeta.textContent = 'Source: 2017 AHA Guideline • No readings logged yet';
    }

    // Lifestyle Risk Level
    const todayReading = latest || {};
    const risk = calculateLifestyleRisk(todayReading, bpLevel, p.familyHistory);
    const riskBox = document.getElementById('risk-meter-box');
    const riskIcon = document.getElementById('risk-box-icon');
    const riskTitle = document.getElementById('risk-box-title');
    const riskDesc = document.getElementById('risk-box-desc');

    if (riskBox) riskBox.className = `risk-meter-box ${risk.badgeClass}`;
    if (riskIcon) riskIcon.textContent = risk.icon;
    if (riskTitle) riskTitle.textContent = risk.title;
    if (riskDesc) {
      if (risk.reasons.length > 0) {
        riskDesc.textContent = `${risk.points} point(s): ${risk.reasons.slice(0, 3).join(', ')}`;
      } else {
        riskDesc.textContent = 'Healthy habits logged! 0 lifestyle risk points recorded today.';
      }
    }

    // Medicines on Today Screen
    this.renderTodayMedicinesList();

    // Checkups on Today Screen
    this.renderTodayCheckupsList();
  },

  updateLiveStepDisplay() {
    const steps = AppState.activeTracking.todaySteps;
    const goal = AppState.profile.stepGoal || 8000;
    const pct = Math.min(100, Math.round((steps / goal) * 100));

    const ringProgress = document.getElementById('step-ring-progress');
    const ringSteps = document.getElementById('today-steps-display');
    const stepPctBadge = document.getElementById('today-step-percent');
    const approxDist = document.getElementById('today-approx-dist');

    if (ringProgress) ringProgress.setAttribute('stroke-dasharray', `${pct}, 100`);
    if (ringSteps) ringSteps.textContent = steps.toLocaleString();
    if (stepPctBadge) stepPctBadge.textContent = `${pct}% Goal`;
    if (approxDist) {
      const km = (steps * 0.00075).toFixed(2);
      approxDist.textContent = `${km} km`;
    }
  },

  renderTodayMedicinesList() {
    const container = document.getElementById('today-medicines-list');
    if (!container) return;

    if (AppState.medicines.length === 0) {
      container.innerHTML = `
        <div class="text-muted" style="font-size: 0.85rem; padding: 6px 0;">
          No medicines configured. Add your prescribed routine in Reminders.
        </div>
      `;
      return;
    }

    const todayKey = new Date().toDateString();
    let html = '';

    AppState.medicines.forEach(med => {
      const isTaken = med.logs && med.logs[todayKey];
      const timesArr = [];
      if (med.times.morning) timesArr.push('Morning');
      if (med.times.afternoon) timesArr.push('Afternoon');
      if (med.times.night) timesArr.push('Night');

      html += `
        <div class="item-card">
          <div class="item-main">
            <div class="item-name">${this.escapeHtml(med.name)}</div>
            <div class="item-desc">${this.escapeHtml(med.dose)} • ${timesArr.join(', ')}</div>
          </div>
          <button class="btn btn-sm ${isTaken ? 'btn-taken' : 'btn-primary'}" onclick="UI.toggleMedicineTaken('${med.id}')">
            ${isTaken ? '✓ Taken' : 'Mark taken'}
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderTodayCheckupsList() {
    const container = document.getElementById('today-checkups-list');
    if (!container) return;

    let html = '';
    const now = new Date();

    AppState.checkups.forEach(chk => {
      let statusText = 'Due soon';
      let isOverdue = false;

      if (!chk.lastDone) {
        statusText = 'Needs check';
        isOverdue = true;
      } else {
        const lastDate = new Date(chk.lastDone);
        const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        const daysLeft = chk.intervalDays - daysSince;

        if (daysLeft < 0) {
          statusText = `${Math.abs(daysLeft)} days overdue`;
          isOverdue = true;
        } else if (daysLeft === 0) {
          statusText = 'Due today';
          isOverdue = true;
        } else {
          statusText = `Due in ${daysLeft} days`;
        }
      }

      html += `
        <div class="item-card">
          <div class="item-main">
            <div class="item-name">${this.escapeHtml(chk.name)}</div>
            <div class="item-desc ${isOverdue ? 'text-danger' : 'text-muted'}" style="${isOverdue ? 'color: var(--danger); font-weight: 600;' : ''}">
              ${statusText} (Every ${chk.intervalDays} days)
            </div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="UI.markCheckupDone('${chk.id}')">
            Done today
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderReadingsTable() {
    const tbody = document.getElementById('readings-table-body');
    const countLabel = document.getElementById('table-readings-count');
    if (!tbody) return;

    if (countLabel) countLabel.textContent = `${AppState.readings.length} records`;

    if (AppState.readings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">
            No readings logged yet. Add your first reading above!
          </td>
        </tr>
      `;
      return;
    }

    // Most recent first
    const sorted = [...AppState.readings].reverse();
    let html = '';

    sorted.forEach((r, index) => {
      const realIndex = AppState.readings.length - 1 - index;
      const dateStr = new Date(r.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const bpStr = (r.systolic && r.diastolic) ? `${r.systolic}/${r.diastolic}` : '--';
      const bpClass = (r.systolic && r.diastolic) ? classifyBloodPressure(r.systolic, r.diastolic).badgeClass : '';

      html += `
        <tr>
          <td>${dateStr}</td>
          <td><span class="badge ${bpClass}">${bpStr}</span></td>
          <td>${r.pulse ? r.pulse + ' bpm' : '--'}</td>
          <td>${r.steps ? r.steps.toLocaleString() : '--'}</td>
          <td>${r.exercise ? r.exercise + 'm' : '--'}</td>
          <td>${r.sleep ? r.sleep + 'h' : '--'}</td>
          <td>${r.stress ? r.stress + '/5' : '--'}</td>
          <td><span class="badge" style="background: var(--bg-card-subtle);">${r.tag || 'manual'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" style="min-height: 30px; padding: 2px 8px; font-size: 0.75rem;" onclick="UI.deleteReading(${realIndex})">
              Delete
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderDietScreen() {
    const container = document.getElementById('generated-diet-container');
    if (!container) return;

    const latest = AppState.readings[AppState.readings.length - 1];
    const plan = DietPlanGenerator.build(AppState.profile, latest, AppState.readings);

    let html = `
      <div class="card">
        <div class="card-header">
          <div class="card-title"><span>🎯</span> Daily Nutrition Targets</div>
        </div>
    `;

    plan.targets.forEach(t => {
      html += `
        <div class="diet-target-item">
          <div class="diet-target-icon">${t.icon}</div>
          <div>
            <div style="font-weight: 700; color: var(--text-primary);">${t.title}</div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">${t.desc}</div>
          </div>
        </div>
      `;
    });

    html += `
      </div>

      <!-- Sample Day Meals -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><span>🍽️</span> Heart-Healthy Sample Day</div>
          <span class="text-muted" style="font-size: 0.75rem;">${AppState.profile.dietPref.toUpperCase()}</span>
        </div>

        <div class="diet-meal-card">
          <div class="diet-meal-title"><span>🌅</span> Breakfast (8:00 AM)</div>
          <div class="diet-meal-content">${plan.breakfast}</div>
        </div>

        <div class="diet-meal-card">
          <div class="diet-meal-title"><span>🍏</span> Mid-Morning Snack (11:00 AM)</div>
          <div class="diet-meal-content">${plan.midMorning}</div>
        </div>

        <div class="diet-meal-card">
          <div class="diet-meal-title"><span>🍲</span> Lunch (1:30 PM)</div>
          <div class="diet-meal-content">${plan.lunch}</div>
        </div>

        <div class="diet-meal-card">
          <div class="diet-meal-title"><span>☕</span> Evening Snack (5:00 PM)</div>
          <div class="diet-meal-content">${plan.evening}</div>
        </div>

        <div class="diet-meal-card">
          <div class="diet-meal-title"><span>🌙</span> Light Dinner (7:30 PM - 8:00 PM)</div>
          <div class="diet-meal-content">${plan.dinner}</div>
        </div>
      </div>
    `;

    // Dynamic Condition Tips
    if (plan.tips.length > 0) {
      html += `
        <div class="card">
          <div class="card-header">
            <div class="card-title"><span>💡</span> Personalized Nutritional Guidance</div>
          </div>
      `;

      plan.tips.forEach(tip => {
        html += `
          <div class="alert-box ${tip.isAlert ? 'emergency' : 'info'}" style="margin-bottom: 8px;">
            <div>
              <div style="font-weight: 700;">${tip.title}</div>
              <div style="font-size: 0.84rem; margin-top: 2px;">${tip.text}</div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    // General guidance notice
    html += `
      <div class="card text-muted" style="font-size: 0.78rem; text-align: center; border-style: dashed;">
        <strong>Notice:</strong> This diet plan provides general community nutritional guidance based on traditional Indian whole-food practices and AHA recommendations. It is NOT personalized medical advice or a doctor’s prescription. Always follow your physician's clinical advice.
      </div>
    `;

    container.innerHTML = html;
  },

  renderRemindersScreen() {
    this.renderMedicinesManager();
    this.renderCheckupsManager();
  },

  renderMedicinesManager() {
    const container = document.getElementById('medicines-list-container');
    const adherenceDisplay = document.getElementById('med-adherence-pct');
    if (!container) return;

    if (AppState.medicines.length === 0) {
      container.innerHTML = `
        <div class="text-muted" style="font-size: 0.85rem; padding: 10px 0;">
          No medicines currently tracked. Tap "+ Add Medicine" to configure.
        </div>
      `;
      if (adherenceDisplay) adherenceDisplay.textContent = '100%';
      return;
    }

    // Compute 7-day adherence
    let totalDosesExpected = 0;
    let totalDosesTaken = 0;
    const now = new Date();

    AppState.medicines.forEach(med => {
      let dailyTimes = 0;
      if (med.times.morning) dailyTimes++;
      if (med.times.afternoon) dailyTimes++;
      if (med.times.night) dailyTimes++;

      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateKey = d.toDateString();

        totalDosesExpected += dailyTimes;
        if (med.logs && med.logs[dateKey]) {
          totalDosesTaken += dailyTimes;
        }
      }
    });

    const adherence = totalDosesExpected > 0
      ? Math.round((totalDosesTaken / totalDosesExpected) * 100)
      : 100;

    if (adherenceDisplay) adherenceDisplay.textContent = `${adherence}%`;

    let html = '';
    const todayKey = new Date().toDateString();

    AppState.medicines.forEach(med => {
      const isTaken = med.logs && med.logs[todayKey];
      const timesArr = [];
      if (med.times.morning) timesArr.push('Morning');
      if (med.times.afternoon) timesArr.push('Afternoon');
      if (med.times.night) timesArr.push('Night');

      html += `
        <div class="item-card">
          <div class="item-main">
            <div class="item-name">${this.escapeHtml(med.name)}</div>
            <div class="item-desc">${this.escapeHtml(med.dose)} • ${timesArr.join(', ')}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm ${isTaken ? 'btn-taken' : 'btn-primary'}" onclick="UI.toggleMedicineTaken('${med.id}')">
              ${isTaken ? '✓ Taken' : 'Mark taken'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="UI.deleteMedicine('${med.id}')" title="Delete">
              ✕
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderCheckupsManager() {
    const container = document.getElementById('checkups-list-container');
    if (!container) return;

    let html = '';
    const now = new Date();

    AppState.checkups.forEach(chk => {
      let nextDueStr = 'Immediate';
      if (chk.lastDone) {
        const last = new Date(chk.lastDone);
        const next = new Date(last.getTime() + chk.intervalDays * 24 * 60 * 60 * 1000);
        nextDueStr = next.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      }

      html += `
        <div class="item-card">
          <div class="item-main">
            <div class="item-name">${this.escapeHtml(chk.name)}</div>
            <div class="item-desc">Repeat every ${chk.intervalDays} days • Next due: <strong>${nextDueStr}</strong></div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-secondary" onclick="UI.markCheckupDone('${chk.id}')">
              Done today
            </button>
            <button class="btn btn-sm btn-secondary" onclick="UI.deleteCheckup('${chk.id}')" title="Delete">
              ✕
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderSummaryScreen() {
    const readings = AppState.readings;
    const totalReadings = readings.length;

    const totalReadingsEl = document.getElementById('summary-total-readings');
    const avgBpEl = document.getElementById('summary-avg-bp');
    const avgStepsEl = document.getElementById('summary-avg-steps');
    const goalDaysEl = document.getElementById('summary-goal-days');
    const riskDaysEl = document.getElementById('summary-risk-days');
    const medAdherenceEl = document.getElementById('summary-med-adherence');

    if (totalReadingsEl) totalReadingsEl.textContent = totalReadings;

    if (totalReadings > 0) {
      const validBp = readings.filter(r => r.systolic && r.diastolic);
      if (validBp.length > 0) {
        const avgSys = Math.round(validBp.reduce((acc, r) => acc + Number(r.systolic), 0) / validBp.length);
        const avgDia = Math.round(validBp.reduce((acc, r) => acc + Number(r.diastolic), 0) / validBp.length);
        if (avgBpEl) avgBpEl.textContent = `${avgSys} / ${avgDia}`;
      } else {
        if (avgBpEl) avgBpEl.textContent = '-- / --';
      }

      const validSteps = readings.filter(r => r.steps && Number(r.steps) > 0);
      if (validSteps.length > 0) {
        const avgSteps = Math.round(validSteps.reduce((acc, r) => acc + Number(r.steps), 0) / validSteps.length);
        if (avgStepsEl) avgStepsEl.textContent = avgSteps.toLocaleString();
      } else {
        if (avgStepsEl) avgStepsEl.textContent = '0';
      }

      const goal = AppState.profile.stepGoal || 8000;
      const metDays = readings.filter(r => Number(r.steps) >= goal).length;
      if (goalDaysEl) goalDaysEl.textContent = `${metDays} days`;

      // High-risk days count
      const highRiskCount = readings.filter(r => {
        const bpClass = (r.systolic && r.diastolic) ? classifyBloodPressure(r.systolic, r.diastolic) : { level: 0 };
        const risk = calculateLifestyleRisk(r, bpClass.level, AppState.profile.familyHistory);
        return risk.riskLevel === 'HIGH';
      }).length;
      if (riskDaysEl) riskDaysEl.textContent = `${highRiskCount} days`;
    } else {
      if (avgBpEl) avgBpEl.textContent = '-- / --';
      if (avgStepsEl) avgStepsEl.textContent = '0';
      if (goalDaysEl) goalDaysEl.textContent = '0 days';
      if (riskDaysEl) riskDaysEl.textContent = '0';
    }

    const currentAdh = document.getElementById('med-adherence-pct');
    if (medAdherenceEl && currentAdh) {
      medAdherenceEl.textContent = currentAdh.textContent;
    }
  },

  populateProfileForm() {
    const p = AppState.profile;
    const nickIn = document.getElementById('profile-nickname');
    const ageIn = document.getElementById('profile-age-group');
    const dietIn = document.getElementById('profile-diet-pref');
    const goalIn = document.getElementById('profile-step-goal');
    const cNameIn = document.getElementById('profile-contact-name');
    const cPhoneIn = document.getElementById('profile-contact-phone');

    if (nickIn) nickIn.value = p.nickname || '';
    if (ageIn) ageIn.value = p.ageGroup || 'under30';
    if (dietIn) dietIn.value = p.dietPref || 'veg';
    if (goalIn) goalIn.value = p.stepGoal || 8000;
    if (cNameIn) cNameIn.value = p.contactName || '';
    if (cPhoneIn) cPhoneIn.value = p.contactPhone || '';

    // Checkboxes
    const condBp = document.getElementById('cond-high-bp');
    const condDiab = document.getElementById('cond-diabetes');
    const condChol = document.getElementById('cond-cholesterol');
    const condOver = document.getElementById('cond-overweight');
    const condKid = document.getElementById('cond-kidney');
    const condHeart = document.getElementById('cond-heart');
    const condFam = document.getElementById('cond-family-history');

    if (condBp) condBp.checked = !!p.conditions.highBp;
    if (condDiab) condDiab.checked = !!p.conditions.diabetes;
    if (condChol) condChol.checked = !!p.conditions.cholesterol;
    if (condOver) condOver.checked = !!p.conditions.overweight;
    if (condKid) condKid.checked = !!p.conditions.kidney;
    if (condHeart) condHeart.checked = !!p.conditions.heart;
    if (condFam) condFam.checked = !!p.familyHistory;
  },

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================
  handleAddReadingSubmit() {
    const sysIn = document.getElementById('input-systolic');
    const diaIn = document.getElementById('input-diastolic');
    const pulseIn = document.getElementById('input-pulse');
    const stepsIn = document.getElementById('input-steps');
    const exIn = document.getElementById('input-exercise');
    const sleepIn = document.getElementById('input-sleep');
    const stressIn = document.getElementById('input-stress');

    const checkOily = document.getElementById('check-oily');
    const checkSalt = document.getElementById('check-salt');
    const checkTobacco = document.getElementById('check-tobacco');

    const warnChest = document.getElementById('check-warn-chest');
    const warnBreathless = document.getElementById('check-warn-breathless');
    const warnFainting = document.getElementById('check-warn-fainting');
    const warnStroke = document.getElementById('check-warn-stroke');

    const warningBox = document.getElementById('bp-validation-warning');

    const sys = Number(sysIn.value);
    const dia = Number(diaIn.value);

    // Validation: Top number must be larger than bottom
    if (sys <= dia) {
      if (warningBox) {
        warningBox.style.display = 'block';
        warningBox.innerHTML = '⚠️ <strong>Validation Error:</strong> Top number (Systolic) must be strictly larger than bottom number (Diastolic). Please check your numbers.';
      }
      return;
    }

    if (sys < 50 || sys > 280 || dia < 30 || dia > 180) {
      if (warningBox) {
        warningBox.style.display = 'block';
        warningBox.innerHTML = '⚠️ <strong>Physiological range notice:</strong> Please check that your blood pressure numbers are typed correctly.';
      }
      return;
    }

    if (warningBox) warningBox.style.display = 'none';

    // Build reading entry
    const entry = {
      date: new Date().toISOString(),
      systolic: sys,
      diastolic: dia,
      pulse: pulseIn.value ? Number(pulseIn.value) : null,
      steps: stepsIn.value ? Number(stepsIn.value) : (AppState.activeTracking.todaySteps || null),
      exercise: exIn.value ? Number(exIn.value) : null,
      sleep: sleepIn.value ? Number(sleepIn.value) : null,
      stress: stressIn.value ? Number(stressIn.value) : 3,
      oilyFood: checkOily ? checkOily.checked : false,
      extraSalt: checkSalt ? checkSalt.checked : false,
      tobacco: checkTobacco ? checkTobacco.checked : false,
      tag: 'manual'
    };

    AppState.readings.push(entry);
    StorageManager.set(STORAGE_KEYS.READINGS, AppState.readings);

    // Check emergency rules immediately
    const symptoms = {
      chestPain: warnChest ? warnChest.checked : false,
      breathlessRest: warnBreathless ? warnBreathless.checked : false,
      fainting: warnFainting ? warnFainting.checked : false,
      strokeSigns: warnStroke ? warnStroke.checked : false
    };

    const evalResult = evaluateEmergencyRules(symptoms, { systolic: sys, diastolic: dia, pulse: entry.pulse });

    // Reset Form
    document.getElementById('form-add-reading').reset();
    document.getElementById('input-stress').value = '3';
    document.querySelectorAll('.stress-btn').forEach(b => b.classList.remove('selected'));
    const defStressBtn = document.querySelector('.stress-btn[data-level="3"]');
    if (defStressBtn) defStressBtn.classList.add('selected');

    this.renderAll();

    if (evalResult.status === 'EMERGENCY') {
      this.openSosModal(evalResult.message);
    } else if (evalResult.status === 'URGENT') {
      this.showToast('Reading saved! Notice: BP is in urgent range. Please see a doctor today.');
      this.switchScreen('screen-today');
    } else {
      this.showToast('Today’s reading saved successfully!');
      this.switchScreen('screen-today');
    }
  },

  handleProfileSubmit() {
    const nickIn = document.getElementById('profile-nickname');
    const ageIn = document.getElementById('profile-age-group');
    const dietIn = document.getElementById('profile-diet-pref');
    const goalIn = document.getElementById('profile-step-goal');
    const cNameIn = document.getElementById('profile-contact-name');
    const cPhoneIn = document.getElementById('profile-contact-phone');

    AppState.profile.nickname = nickIn ? nickIn.value.trim() : 'Friend';
    AppState.profile.ageGroup = ageIn ? ageIn.value : 'under30';
    AppState.profile.dietPref = dietIn ? dietIn.value : 'veg';
    AppState.profile.stepGoal = goalIn ? Number(goalIn.value) || 8000 : 8000;
    AppState.profile.contactName = cNameIn ? cNameIn.value.trim() : '';
    AppState.profile.contactPhone = cPhoneIn ? cPhoneIn.value.trim() : '';

    AppState.profile.conditions.highBp = !!document.getElementById('cond-high-bp')?.checked;
    AppState.profile.conditions.diabetes = !!document.getElementById('cond-diabetes')?.checked;
    AppState.profile.conditions.cholesterol = !!document.getElementById('cond-cholesterol')?.checked;
    AppState.profile.conditions.overweight = !!document.getElementById('cond-overweight')?.checked;
    AppState.profile.conditions.kidney = !!document.getElementById('cond-kidney')?.checked;
    AppState.profile.conditions.heart = !!document.getElementById('cond-heart')?.checked;
    AppState.profile.familyHistory = !!document.getElementById('cond-family-history')?.checked;

    StorageManager.set(STORAGE_KEYS.PROFILE, AppState.profile);

    this.renderAll();
    this.showToast('Profile & Diet Plan updated!');
  },

  handleEmergencyCheck() {
    const symptoms = {
      chestPain: !!document.getElementById('sym-chest-pain')?.checked,
      radiatingPain: !!document.getElementById('sym-radiating-pain')?.checked,
      breathlessRest: !!document.getElementById('sym-breathless-rest')?.checked,
      fainting: !!document.getElementById('sym-fainting')?.checked,
      coldSweat: !!document.getElementById('sym-cold-sweat')?.checked,
      strokeSigns: !!document.getElementById('sym-stroke-fast')?.checked,
      severeHeadache: !!document.getElementById('sym-severe-headache')?.checked,
      racingHeart: !!document.getElementById('sym-racing-heart')?.checked,
      dizziness: !!document.getElementById('sym-dizziness')?.checked
    };

    const sysIn = document.getElementById('sym-bp-systolic');
    const diaIn = document.getElementById('sym-bp-diastolic');
    const pulIn = document.getElementById('sym-pulse');

    const vitals = {
      systolic: sysIn ? sysIn.value : null,
      diastolic: diaIn ? diaIn.value : null,
      pulse: pulIn ? pulIn.value : null
    };

    const result = evaluateEmergencyRules(symptoms, vitals);
    const resultBox = document.getElementById('emergency-result-box');

    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div class="alert-box ${result.badgeClass}">
          <div>
            <div style="font-size: 1.1rem; font-weight: 800;">${result.title}</div>
            <div style="font-size: 0.92rem; margin-top: 6px; line-height: 1.4;">${result.message}</div>
          </div>
        </div>
      `;
    }

    if (result.openSOS) {
      this.openSosModal(result.message);
    }
  },

  toggleMedicineTaken(medId) {
    const med = AppState.medicines.find(m => m.id === medId);
    if (!med) return;

    const todayKey = new Date().toDateString();
    med.logs = med.logs || {};
    med.logs[todayKey] = !med.logs[todayKey];

    StorageManager.set(STORAGE_KEYS.MEDICINES, AppState.medicines);
    this.renderTodayMedicinesList();
    this.renderMedicinesManager();
  },

  handleAddMedicineSubmit() {
    const nameIn = document.getElementById('med-name');
    const doseIn = document.getElementById('med-dose');
    const mMorning = document.getElementById('med-time-morning');
    const mAfternoon = document.getElementById('med-time-afternoon');
    const mNight = document.getElementById('med-time-night');

    if (!nameIn || !nameIn.value.trim()) return;

    const newMed = {
      id: 'med_' + Date.now(),
      name: nameIn.value.trim(),
      dose: doseIn ? doseIn.value.trim() : '',
      times: {
        morning: !!mMorning?.checked,
        afternoon: !!mAfternoon?.checked,
        night: !!mNight?.checked
      },
      logs: {}
    };

    AppState.medicines.push(newMed);
    StorageManager.set(STORAGE_KEYS.MEDICINES, AppState.medicines);

    document.getElementById('form-add-med').reset();
    document.getElementById('form-add-med').style.display = 'none';
    this.renderMedicinesManager();
    this.renderTodayMedicinesList();
    this.showToast('Medicine added!');
  },

  deleteMedicine(medId) {
    AppState.medicines = AppState.medicines.filter(m => m.id !== medId);
    StorageManager.set(STORAGE_KEYS.MEDICINES, AppState.medicines);
    this.renderMedicinesManager();
    this.renderTodayMedicinesList();
  },

  markCheckupDone(chkId) {
    const chk = AppState.checkups.find(c => c.id === chkId);
    if (!chk) return;

    chk.lastDone = new Date().toISOString();
    StorageManager.set(STORAGE_KEYS.CHECKUPS, AppState.checkups);
    this.renderTodayCheckupsList();
    this.renderCheckupsManager();
    this.showToast(`${chk.name} marked as completed today!`);
  },

  handleAddCheckupSubmit() {
    const nameIn = document.getElementById('checkup-name');
    const intervalIn = document.getElementById('checkup-interval');

    if (!nameIn || !nameIn.value.trim()) return;

    const newChk = {
      id: 'chk_' + Date.now(),
      name: nameIn.value.trim(),
      intervalDays: Number(intervalIn.value) || 30,
      lastDone: null
    };

    AppState.checkups.push(newChk);
    StorageManager.set(STORAGE_KEYS.CHECKUPS, AppState.checkups);

    document.getElementById('form-add-checkup').reset();
    document.getElementById('form-add-checkup').style.display = 'none';
    this.renderCheckupsManager();
    this.renderTodayCheckupsList();
    this.showToast('Check-up appointment added!');
  },

  deleteCheckup(chkId) {
    AppState.checkups = AppState.checkups.filter(c => c.id !== chkId);
    StorageManager.set(STORAGE_KEYS.CHECKUPS, AppState.checkups);
    this.renderCheckupsManager();
    this.renderTodayCheckupsList();
  },

  deleteReading(index) {
    if (index >= 0 && index < AppState.readings.length) {
      AppState.readings.splice(index, 1);
      StorageManager.set(STORAGE_KEYS.READINGS, AppState.readings);
      this.renderAll();
      this.showToast('Reading removed.');
    }
  },

  // ==========================================================================
  // AUTOMATIC SENSOR TRACKING (STEPS & BLUETOOTH)
  // ==========================================================================
  async toggleStepTracking() {
    const btn = document.getElementById('btn-toggle-steps');
    const label = document.getElementById('label-step-tracker');
    const status = document.getElementById('auto-tracking-status');

    if (AppState.isStepTracking) {
      stepDetectorInstance.stop();
      AppState.isStepTracking = false;
      if (label) label.textContent = 'Start counting';
      if (btn) btn.classList.remove('btn-primary');
      if (btn) btn.classList.add('btn-secondary');
      if (status) status.textContent = 'Step counter paused. Steps are approximate.';
      this.showToast('Step tracker paused.');
    } else {
      const started = await stepDetectorInstance.start();
      if (started) {
        AppState.isStepTracking = true;
        if (label) label.textContent = 'Stop counting';
        if (btn) btn.classList.remove('btn-secondary');
        if (btn) btn.classList.add('btn-primary');
        if (status) status.textContent = '🟢 Live counter active! Keep your phone in your pocket.';
        this.showToast('Step counting started!');
      } else {
        if (status) status.textContent = 'Motion sensor access unavailable or permission denied on this browser.';
        this.showToast('Device motion sensors not available on this browser.');
      }
    }
  },

  async connectBluetoothDevice() {
    const status = document.getElementById('auto-tracking-status');
    if (!navigator.bluetooth) {
      if (status) status.textContent = 'Web Bluetooth is not supported on this browser (use Chrome or Edge on Android/Desktop).';
      this.showToast('Web Bluetooth API is not supported on this browser.');
      return;
    }

    try {
      if (status) status.textContent = 'Searching for Bluetooth Blood Pressure / Heart Rate device...';
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['blood_pressure'] },
          { services: ['heart_rate'] }
        ],
        optionalServices: ['battery_service']
      });

      if (!device || !device.gatt) return;

      const server = await device.gatt.connect();
      if (status) status.textContent = `Connected to ${device.name || 'Device'}! Reading data...`;

      // Try Blood Pressure Service
      try {
        const bpService = await server.getPrimaryService('blood_pressure');
        const bpChar = await bpService.getCharacteristic('blood_pressure_measurement');
        await bpChar.startNotifications();
        bpChar.addEventListener('characteristicvaluechanged', (event) => {
          const reading = parseBloodPressureMeasurement(event.target.value);
          UI.saveAutoReading(reading.systolic, reading.diastolic, reading.pulseRate);
        });
        if (status) status.textContent = '🟢 Blood Pressure notifications active!';
      } catch (bpErr) {
        // Try Heart Rate Service
        try {
          const hrService = await server.getPrimaryService('heart_rate');
          const hrChar = await hrService.getCharacteristic('heart_rate_measurement');
          await hrChar.startNotifications();
          hrChar.addEventListener('characteristicvaluechanged', (event) => {
            const hr = parseHeartRateMeasurement(event.target.value);
            const latest = AppState.readings[AppState.readings.length - 1];
            if (latest) {
              latest.pulse = hr.pulse;
              StorageManager.set(STORAGE_KEYS.READINGS, AppState.readings);
              UI.renderAll();
            }
          });
          if (status) status.textContent = '🟢 Live Heart Rate connected!';
        } catch (hrErr) {
          if (status) status.textContent = 'Connected, but no standard BP or Heart Rate characteristic found.';
        }
      }
    } catch (err) {
      console.warn('Bluetooth pairing error:', err);
      if (status) status.textContent = 'Bluetooth pairing cancelled or timed out.';
    }
  },

  saveAutoReading(systolic, diastolic, pulse) {
    if (!systolic || !diastolic || systolic <= diastolic) return;

    const entry = {
      date: new Date().toISOString(),
      systolic,
      diastolic,
      pulse: pulse || null,
      steps: AppState.activeTracking.todaySteps || null,
      exercise: null,
      sleep: null,
      stress: 3,
      oilyFood: false,
      extraSalt: false,
      tobacco: false,
      tag: 'auto'
    };

    AppState.readings.push(entry);
    StorageManager.set(STORAGE_KEYS.READINGS, AppState.readings);
    this.renderAll();

    // Check emergency rules
    const evalResult = evaluateEmergencyRules({}, { systolic, diastolic, pulse });
    if (evalResult.status === 'EMERGENCY') {
      this.openSosModal(`Bluetooth Reading: Crisis BP (${systolic}/${diastolic}) detected!`);
    } else {
      this.showToast(`Auto-synced BP reading: ${systolic}/${diastolic} mmHg`);
    }
  },

  // ==========================================================================
  // EMERGENCY SOS MODAL CONTROLLER
  // ==========================================================================
  openSosModal(warningMessage = null) {
    const modal = document.getElementById('sos-modal');
    const warningBanner = document.getElementById('sos-dynamic-warning');
    const contactBtn = document.getElementById('sos-call-contact');
    const contactLabel = document.getElementById('sos-contact-label');
    const noContactMsg = document.getElementById('sos-no-contact-msg');

    if (!modal) return;

    if (warningMessage && warningBanner) {
      warningBanner.textContent = `⚠️ ${warningMessage}`;
      warningBanner.style.display = 'block';
    } else if (warningBanner) {
      warningBanner.style.display = 'none';
    }

    const p = AppState.profile;
    if (p.contactPhone && p.contactPhone.trim()) {
      if (contactBtn) {
        contactBtn.href = `tel:${p.contactPhone.trim()}`;
        contactBtn.style.display = 'flex';
      }
      if (contactLabel) {
        contactLabel.textContent = `Call ${p.contactName || 'My Contact'} (${p.contactPhone})`;
      }
      if (noContactMsg) noContactMsg.style.display = 'none';
    } else {
      if (contactBtn) contactBtn.style.display = 'none';
      if (noContactMsg) noContactMsg.style.display = 'block';
    }

    modal.classList.add('active');
  },

  closeSosModal() {
    const modal = document.getElementById('sos-modal');
    if (modal) modal.classList.remove('active');
  },

  fetchSosLocation() {
    const locText = document.getElementById('sos-location-text');
    const smsWrapper = document.getElementById('sos-sms-action-wrapper');
    const smsLink = document.getElementById('sos-sms-link');

    if (!navigator.geolocation) {
      if (locText) locText.textContent = 'Geolocation is not supported by your browser.';
      return;
    }

    if (locText) locText.textContent = 'Fetching current GPS coordinates...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        const accuracy = Math.round(pos.coords.accuracy);
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

        if (locText) {
          locText.innerHTML = `
            <div>📍 <strong>Location:</strong> ${lat}, ${lng} (±${accuracy}m)</div>
            <div style="margin-top: 4px;"><a href="${mapsUrl}" target="_blank" rel="noopener" style="color: var(--primary);">Open in Google Maps</a></div>
          `;
        }

        const phone = AppState.profile.contactPhone || '';
        const bodyText = encodeURIComponent(`EMERGENCY! I need immediate help. My current GPS location: ${mapsUrl}`);

        if (smsLink) {
          smsLink.href = phone ? `sms:${phone}?body=${bodyText}` : `sms:?body=${bodyText}`;
        }
        if (smsWrapper) smsWrapper.style.display = 'block';
      },
      (err) => {
        if (locText) locText.textContent = `Location unavailable (${err.message}).`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  },

  // ==========================================================================
  // NOTIFICATIONS & BACKGROUND ALERTS
  // ==========================================================================
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      this.showToast('Notifications are not supported by this browser.');
      this.updateNotificationBadge('unsupported');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      this.updateNotificationBadge(permission);
      if (permission === 'granted') {
        this.showToast('Notifications turned on successfully!');
      } else if (permission === 'denied') {
        this.showToast('Notification permission was declined.');
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
    }
  },

  updateNotificationBadge(status) {
    const badge = document.getElementById('notif-status-badge');
    if (!badge) return;

    const perm = status || (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    if (perm === 'granted') {
      badge.textContent = 'Active';
      badge.className = 'badge badge-normal';
    } else if (perm === 'denied') {
      badge.textContent = 'Blocked';
      badge.className = 'badge badge-crisis';
    } else {
      badge.textContent = 'Disabled';
      badge.className = 'badge badge-elevated';
    }
  },

  sendEmergencyNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      this.showToast('Please tap "Turn on notifications" first.');
      return;
    }

    const title = 'Heart Health Tracker: Emergency';
    const options = {
      body: 'Emergency alert test. Tap to open the SOS call screen immediately.',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'emergency-sos',
      renotify: true,
      actions: [
        { action: 'call_contact', title: 'Call Contact' },
        { action: 'call_108', title: 'Call 108' }
      ]
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, options);
      });
    } else {
      new Notification(title, options);
    }

    this.showToast('Test notification dispatched!');
  },

  checkReminderAlerts() {
    const container = document.getElementById('inapp-alert-container');
    if (!container) return;

    const todayKey = new Date().toDateString();
    const untakenMeds = AppState.medicines.filter(m => !m.logs || !m.logs[todayKey]);

    const overdueCheckups = AppState.checkups.filter(chk => {
      if (!chk.lastDone) return true;
      const daysSince = Math.floor((new Date() - new Date(chk.lastDone)) / (1000 * 60 * 60 * 24));
      return daysSince >= chk.intervalDays;
    });

    if (untakenMeds.length > 0 || overdueCheckups.length > 0) {
      let alertsHtml = '';
      if (untakenMeds.length > 0) {
        alertsHtml += `
          <div class="alert-box urgent" style="margin-bottom: 8px;">
            <span>💊</span>
            <div><strong>Medicine Reminder:</strong> You have ${untakenMeds.length} medicine(s) due today.</div>
          </div>
        `;
      }
      if (overdueCheckups.length > 0) {
        alertsHtml += `
          <div class="alert-box urgent" style="margin-bottom: 8px;">
            <span>🗓️</span>
            <div><strong>Check-up Due:</strong> ${overdueCheckups.map(c => c.name).join(', ')} is due for a check.</div>
          </div>
        `;
      }
      container.innerHTML = alertsHtml;
    } else {
      container.innerHTML = '';
    }
  },

  // ==========================================================================
  // DATA EXPORT & SAMPLE DATASET
  // ==========================================================================
  exportDataAsJson() {
    const data = {
      profile: AppState.profile,
      readings: AppState.readings,
      medicines: AppState.medicines,
      checkups: AppState.checkups,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heart_health_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Data exported successfully.');
  },

  loadSampleDataset() {
    const now = new Date();
    const sampleReadings = [
      {
        date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        systolic: 124,
        diastolic: 78,
        pulse: 74,
        steps: 7200,
        exercise: 35,
        sleep: 7.5,
        stress: 2,
        oilyFood: false,
        extraSalt: false,
        tobacco: false,
        tag: 'manual'
      },
      {
        date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        systolic: 132,
        diastolic: 84,
        pulse: 76,
        steps: 6400,
        exercise: 20,
        sleep: 6.0,
        stress: 4,
        oilyFood: true,
        extraSalt: false,
        tobacco: false,
        tag: 'manual'
      },
      {
        date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        systolic: 128,
        diastolic: 80,
        pulse: 72,
        steps: 8500,
        exercise: 45,
        sleep: 8.0,
        stress: 2,
        oilyFood: false,
        extraSalt: false,
        tobacco: false,
        tag: 'manual'
      },
      {
        date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        systolic: 138,
        diastolic: 86,
        pulse: 80,
        steps: 5100,
        exercise: 15,
        sleep: 5.5,
        stress: 5,
        oilyFood: true,
        extraSalt: true,
        tobacco: false,
        tag: 'manual'
      },
      {
        date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        systolic: 122,
        diastolic: 76,
        pulse: 70,
        steps: 9200,
        exercise: 40,
        sleep: 7.5,
        stress: 1,
        oilyFood: false,
        extraSalt: false,
        tobacco: false,
        tag: 'manual'
      },
      {
        date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        systolic: 120,
        diastolic: 80,
        pulse: 72,
        steps: 8100,
        exercise: 35,
        sleep: 7.0,
        stress: 2,
        oilyFood: false,
        extraSalt: false,
        tobacco: false,
        tag: 'auto'
      }
    ];

    AppState.readings = sampleReadings;
    StorageManager.set(STORAGE_KEYS.READINGS, AppState.readings);

    // Profile contact sample
    AppState.profile.nickname = 'Rahul';
    AppState.profile.contactName = 'Papa';
    AppState.profile.contactPhone = '9876543210';
    AppState.profile.conditions.highBp = true;
    AppState.profile.stepGoal = 8000;
    StorageManager.set(STORAGE_KEYS.PROFILE, AppState.profile);

    this.renderAll();
    this.showToast('Sample community dataset loaded!');
  },

  // ==========================================================================
  // CUSTOM TWO-STEP CONFIRMATION (NO NATIVE ALERT / CONFIRM)
  // ==========================================================================
  showCustomConfirm(title, message, onConfirmCallback) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnProceed = document.getElementById('btn-confirm-proceed');

    if (!modal) return;

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    const cleanup = () => {
      modal.classList.remove('active');
      btnCancel.removeEventListener('click', onCancel);
      btnProceed.removeEventListener('click', onProceed);
    };

    const onCancel = () => cleanup();
    const onProceed = () => {
      cleanup();
      if (onConfirmCallback) onConfirmCallback();
    };

    btnCancel.addEventListener('click', onCancel);
    btnProceed.addEventListener('click', onProceed);

    modal.classList.add('active');
  },

  showToast(msg) {
    const existing = document.getElementById('hht-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'hht-toast';
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      bottom: calc(84px + var(--safe-bottom));
      left: 50%;
      transform: translateX(-50%);
      background-color: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: var(--radius-full);
      font-size: 0.88rem;
      font-weight: 600;
      z-index: 1050;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 90%;
      text-align: center;
      animation: fadeIn 0.2s ease-in;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast) toast.remove();
    }, 3200);
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }
};

// ============================================================================
// 9. AUTOMATED TEST SUITE (FOR COLLEGE VIVA & VERIFICATION)
// ============================================================================
const TestSuiteRunner = {
  runAll() {
    const output = document.getElementById('test-suite-output');
    if (!output) return;

    const results = [];
    let passCount = 0;
    let totalCount = 0;

    const assert = (description, condition) => {
      totalCount++;
      if (condition) {
        passCount++;
        results.push(`[PASS] ${description}`);
      } else {
        results.push(`[FAIL] ${description}`);
      }
    };

    results.push('=== HEART HEALTH TRACKER TEST SUITE ===\n');

    // TEST 1: Bluetooth IEEE-11073 SFLOAT Packet Parser
    // Vector: [0x04, 0x78, 0x00, 0x50, 0x00, 0x5D, 0x00, 0x48, 0x00]
    // Expected: Systolic: 120, Diastolic: 80, Pulse: 72
    const testBytes = new Uint8Array([0x04, 0x78, 0x00, 0x50, 0x00, 0x5D, 0x00, 0x48, 0x00]);
    const dv = new DataView(testBytes.buffer);
    const parsedBt = parseBloodPressureMeasurement(dv);

    assert(
      `Bluetooth Parser: Systolic == 120 (got ${parsedBt.systolic})`,
      parsedBt.systolic === 120
    );
    assert(
      `Bluetooth Parser: Diastolic == 80 (got ${parsedBt.diastolic})`,
      parsedBt.diastolic === 80
    );
    assert(
      `Bluetooth Parser: Pulse Rate == 72 (got ${parsedBt.pulseRate})`,
      parsedBt.pulseRate === 72
    );

    // TEST 2: Emergency Rules Test Cases (Exact Prompt Specifications)
    // Case 2A: Chest pain only gives EMERGENCY
    const case2A = evaluateEmergencyRules({ chestPain: true }, {});
    assert(
      `Rule 1: Chest pain only gives EMERGENCY (got ${case2A.status})`,
      case2A.status === 'EMERGENCY'
    );

    // Case 2B: BP 185/125 with no symptoms gives URGENT
    const case2B = evaluateEmergencyRules({}, { systolic: 185, diastolic: 125 });
    assert(
      `Rule 2: BP 185/125 with no symptoms gives URGENT (got ${case2B.status})`,
      case2B.status === 'URGENT'
    );

    // Case 2C: BP 185/125 with dizziness gives EMERGENCY
    const case2C = evaluateEmergencyRules({ dizziness: true }, { systolic: 185, diastolic: 125 });
    assert(
      `Rule 3: BP 185/125 with dizziness gives EMERGENCY (got ${case2C.status})`,
      case2C.status === 'EMERGENCY'
    );

    // Case 2D: BP 118/76 with no symptoms gives OK
    const case2D = evaluateEmergencyRules({}, { systolic: 118, diastolic: 76 });
    assert(
      `Rule 4: BP 118/76 with no symptoms gives OK (got ${case2D.status})`,
      case2D.status === 'OK' && case2D.message.includes('No emergency warning signs found')
    );

    // TEST 3: 2017 AHA Blood Pressure Categorization
    assert('AHA Normal: 115/75 => NORMAL', classifyBloodPressure(115, 75).category === 'NORMAL');
    assert('AHA Elevated: 125/75 => ELEVATED', classifyBloodPressure(125, 75).category === 'ELEVATED');
    assert('AHA Stage 1: 135/85 => STAGE_1', classifyBloodPressure(135, 85).category === 'STAGE_1');
    assert('AHA Stage 2: 145/92 => STAGE_2', classifyBloodPressure(145, 92).category === 'STAGE_2');
    assert('AHA Crisis: 190/110 => CRISIS', classifyBloodPressure(190, 110).category === 'CRISIS');

    // TEST 4: Lifestyle Risk Points
    const highRiskHabits = {
      exercise: 15, // 1 point (<30)
      sleep: 5,     // 1 point (<6)
      oilyFood: true, // 1 point
      extraSalt: true, // 1 point
      tobacco: true,   // 1 point (total 5 => HIGH)
      stress: 2
    };
    const riskEval = calculateLifestyleRisk(highRiskHabits, 0, false);
    assert(`Lifestyle Risk: 5 habits => HIGH risk (got ${riskEval.riskLevel}, ${riskEval.points} pts)`, riskEval.riskLevel === 'HIGH' && riskEval.points === 5);

    // Summary
    results.push(`\nTest Execution Completed: ${passCount} / ${totalCount} Passed.`);
    if (passCount === totalCount) {
      results.push('All verification checks PASSED successfully! 100% Viva Ready.');
    }

    output.textContent = results.join('\n');
  }
};

// ============================================================================
// 10. SERVICE WORKER REGISTRATION
// ============================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('Heart Health PWA ServiceWorker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('ServiceWorker registration failed:', err);
      });
  });
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
