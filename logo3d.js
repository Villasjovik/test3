/**
 * logo3d.js — 3D logo with centered pivot, variable rotation + gold sparks
 */
import * as THREE from 'three';
import { SVGLoader }       from 'three/addons/loaders/SVGLoader.js';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function hexToInt(hex) { return parseInt(hex.replace('#', ''), 16); }
function darken(hex, f = 0.12) {
  const c = hexToInt(hex);
  return (Math.max(0,((c>>16)&0xff)-Math.round(255*f))<<16) |
         (Math.max(0,((c>>8)&0xff)-Math.round(255*f))<<8) |
          Math.max(0,(c&0xff)-Math.round(255*f));
}
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

/* ── GOLD SPARK SYSTEM ──────────────────────── */
function createSparkSystem(scene) {
  const N = 50;
  const pos = new Float32Array(N * 3);
  const alp = new Float32Array(N);
  const lt  = new Float32Array(N); // lifetime
  const age = new Float32Array(N);
  const drx = new Float32Array(N);
  const dry = new Float32Array(N);
  const drz = new Float32Array(N);
  for (let i = 0; i < N; i++) { alp[i] = 0; age[i] = 999; }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alp, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float alpha;
      varying float vA;
      void main() {
        vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 3.5 * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float g = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(0.83, 0.66, 0.29, vA * g * 0.7);
      }`
  });

  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  let timer = 0;

  return function(dt, bx) {
    if (!bx) return;
    timer += dt;
    if (timer > 1.6 + Math.random() * 2.0) {
      timer = 0;
      let n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < N && n > 0; i++) {
        if (age[i] >= lt[i]) {
          pos[i*3]   = (Math.random()-.5)*bx.w*1.2;
          pos[i*3+1] = (Math.random()-.5)*bx.h*1.2;
          pos[i*3+2] = (Math.random()-.5)*30;
          drx[i] = (Math.random()-.5)*0.4;
          dry[i] = 0.15 + Math.random()*0.45;
          drz[i] = (Math.random()-.5)*0.3;
          lt[i] = 1.2 + Math.random()*1.5;
          age[i] = 0; n--;
        }
      }
    }
    for (let i = 0; i < N; i++) {
      if (age[i] < lt[i]) {
        age[i] += dt;
        const t = age[i]/lt[i];
        alp[i] = (t < 0.12 ? t/0.12 : 1 - Math.pow((t-.12)/.88, 2)) * 0.55;
        pos[i*3] += drx[i]*dt; pos[i*3+1] += dry[i]*dt; pos[i*3+2] += drz[i]*dt;
      } else { alp[i] = 0; }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  };
}

/* ── DYNAMIC CURVE EFFECTS ──────────────────── */
function createCurveEffects(baseSpeed) {
  let elapsed = 0;
  let nextEvent = 2.5 + Math.random() * 2.0;
  let eventActive = false;
  let eventStart = 0;
  let eventDuration = 0;
  let eventType = 0; // 0=speed burst, 1=gentle nod, 2=pause+resume

  // Output state
  const state = { speedMul: 1.0, tiltX: 0, tiltZ: 0 };

  return function(dt) {
    elapsed += dt;

    if (!eventActive && elapsed >= nextEvent) {
      eventActive = true;
      eventStart = elapsed;
      eventType = Math.floor(Math.random() * 3);
      eventDuration = eventType === 0 ? 1.2 : eventType === 1 ? 1.8 : 2.0;
      nextEvent = elapsed + eventDuration + 2.5 + Math.random() * 2.5;
    }

    if (eventActive) {
      const t = (elapsed - eventStart) / eventDuration;
      if (t >= 1.0) {
        eventActive = false;
        state.speedMul = 1.0;
        state.tiltX = 0;
        state.tiltZ = 0;
      } else {
        const e = easeInOutCubic(t);
        const bell = Math.sin(t * Math.PI); // 0→1→0

        if (eventType === 0) {
          // Speed burst — accelerate then decelerate
          state.speedMul = 1.0 + bell * 3.5;
          state.tiltX = 0;
          state.tiltZ = 0;
        } else if (eventType === 1) {
          // Gentle tilt/nod — slight X rotation
          state.speedMul = 1.0;
          state.tiltX = Math.sin(t * Math.PI * 2) * 0.08; // subtle nod
          state.tiltZ = Math.sin(t * Math.PI) * 0.03;
        } else {
          // Pause + smooth resume
          // First half: decelerate to near-stop. Second half: accelerate back.
          if (t < 0.4) {
            state.speedMul = lerp(1.0, 0.05, easeInOutCubic(t / 0.4));
          } else {
            state.speedMul = lerp(0.05, 1.0, easeInOutCubic((t - 0.4) / 0.6));
          }
          state.tiltX = 0;
          state.tiltZ = 0;
        }
      }
    } else {
      state.speedMul = 1.0;
      state.tiltX = 0;
      state.tiltZ = 0;
    }

    return state;
  };
}

/* ── MAIN ───────────────────────────────────── */
function initLogo3D(container) {
  const svgPath     = container.dataset.svg;
  const colorHex    = container.dataset.color || '#1a1a1a';
  const depth       = parseFloat(container.dataset.bevelDepth  || '22');
  const rotateSpeed = parseFloat(container.dataset.rotateSpeed || '0.5');
  const fallback    = container.dataset.fallback || null;
  const bgColor     = container.dataset.bg || 'transparent';
  const hasSparks   = container.dataset.sparks !== 'false';

  try {
    const c = document.createElement('canvas');
    if (!c.getContext('webgl2') && !c.getContext('webgl')) throw 0;
  } catch { if (fallback) container.innerHTML = `<img src="${fallback}" style="width:100%;height:100%;object-fit:contain;">`; return; }

  const W = container.clientWidth || 800;
  const H = container.clientHeight || 400;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: bgColor === 'transparent' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  if (bgColor === 'transparent') renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (bgColor !== 'transparent') scene.background = new THREE.Color(bgColor);
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 5000);
  camera.position.set(0, 0, 900);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = false;
  controls.enableZoom = false;

  // Lights
  scene.add(new THREE.AmbientLight(0xfff8f0, 1.5));
  [
    [300, 400, 600, 0xffffff, 5],
    [-400, -100, 300, 0xffeedd, 2],
    [0, 100, -700, 0xffffff, 2.5],
    [0, 700, 100, 0xffffff, 2],
  ].forEach(([x,y,z,c,i]) => { const l = new THREE.DirectionalLight(c,i); l.position.set(x,y,z); scene.add(l); });

  const frontMat = new THREE.MeshStandardMaterial({ color: hexToInt(colorHex), metalness: 0.2, roughness: 0.28 });
  const bevelMat = new THREE.MeshStandardMaterial({ color: darken(colorHex, 0.08), metalness: 0.38, roughness: 0.1 });

  const updateSparks = hasSparks ? createSparkSystem(scene) : null;
  const updateCurve  = createCurveEffects(rotateSpeed);
  let logoBox = null;
  let rotAngle = 0;
  const rotActive = rotateSpeed > 0;

  // PIVOT GROUP — rotation always around center
  const pivot = new THREE.Group();
  scene.add(pivot);

  new SVGLoader().load(svgPath, (data) => {
    const logo = new THREE.Group();

    for (const path of data.paths) {
      for (const shape of SVGLoader.createShapes(path)) {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness: 3,
          bevelSize: 1.8,
          bevelSegments: 6,
        });
        logo.add(new THREE.Mesh(geo, [frontMat, bevelMat]));
      }
    }

    // Flip Y for SVG coords
    logo.scale.set(1, -1, 1);

    // CENTER: compute bounds, offset all children so center = (0,0,0)
    const box = new THREE.Box3().setFromObject(logo);
    const center = box.getCenter(new THREE.Vector3());
    logo.children.forEach(child => {
      child.position.x -= center.x;
      child.position.y -= center.y;
      child.position.z -= center.z;
    });

    // Recompute bounds after centering
    const box2 = new THREE.Box3().setFromObject(logo);
    const size = box2.getSize(new THREE.Vector3());

    // Scale to fit viewport with rotation margin
    const vFOV = camera.fov * Math.PI / 180;
    const visH = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const visW = visH * camera.aspect;

    // Max projected size at any rotation angle (generous)
    const maxW = Math.sqrt(size.x * size.x + depth * depth) * 1.15;
    const maxH = size.y * 1.15;
    const s = Math.min((visW * 0.82) / maxW, (visH * 0.82) / maxH);

    logo.scale.set(s, -s, s); // -s for Y flip

    // Store box for sparks
    const finalBox = new THREE.Box3().setFromObject(logo);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    logoBox = { w: finalSize.x, h: finalSize.y };

    // Verify centering after scale
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    logo.position.sub(finalCenter);

    pivot.add(logo);
  });

  const clock = new THREE.Clock();

  (function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05); // clamp
    controls.update();

    if (rotActive && pivot.children.length > 0) {
      // Base variable speed: slow at front, fast at back
      const halfAngle = (rotAngle % (Math.PI * 2)) / 2;
      const bf = Math.sin(halfAngle);
      const baseMul = 1.0 + bf * bf * 3.0; // 1x front → 4x back

      // Dynamic curve effects
      const curve = updateCurve(dt);

      const speed = rotateSpeed * 0.004 * baseMul * curve.speedMul;
      rotAngle += speed;
      pivot.rotation.y = rotAngle;
      pivot.rotation.x = curve.tiltX;
      pivot.rotation.z = curve.tiltZ;
    }

    if (updateSparks) updateSparks(dt, logoBox);
    renderer.render(scene, camera);
  })();

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);
}

document.querySelectorAll('.logo-3d').forEach(initLogo3D);
