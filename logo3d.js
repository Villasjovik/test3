/**
 * logo3d.js — 3D-logga med variabel rotation + guldgnistor
 *
 * <div class="logo-3d"
 *      data-svg="./brand.svg"
 *      data-color="#f2ede4"
 *      data-rotate-speed="0.5"
 *      data-bevel-depth="22"
 *      data-sparks="true">
 * </div>
 *
 * Kräver importmap med three + three/addons i <head>.
 */

import * as THREE from 'three';
import { SVGLoader }       from 'three/addons/loaders/SVGLoader.js';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function hexToInt(hex) { return parseInt(hex.replace('#', ''), 16); }

function darken(hex, f = 0.12) {
  const c = hexToInt(hex);
  const r = Math.max(0, ((c >> 16) & 0xff) - Math.round(255 * f));
  const g = Math.max(0, ((c >> 8) & 0xff)  - Math.round(255 * f));
  const b = Math.max(0, (c & 0xff)          - Math.round(255 * f));
  return (r << 16) | (g << 8) | b;
}

/* ── GOLD SPARK SYSTEM ───────────────────────────── */
function createSparkSystem(scene) {
  const COUNT = 40;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(COUNT * 3);
  const alphas    = new Float32Array(COUNT);
  const speeds    = new Float32Array(COUNT);
  const lifetimes = new Float32Array(COUNT);
  const ages      = new Float32Array(COUNT);
  const drifts    = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    alphas[i] = 0;
    ages[i] = 999; // start dead
    lifetimes[i] = 0;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {},
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 3.0 * (300.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(0.83, 0.66, 0.29, vAlpha * glow);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let emitTimer = 0;

  return function update(dt, logoBox) {
    if (!logoBox) return;
    const cx = logoBox.x, cy = logoBox.y, cz = logoBox.z;
    const hw = logoBox.w * 0.5, hh = logoBox.h * 0.5;

    emitTimer += dt;

    // Emit a burst of 3-5 sparks every ~2s
    if (emitTimer > 1.8 + Math.random() * 1.5) {
      emitTimer = 0;
      const burst = 3 + Math.floor(Math.random() * 3);
      let emitted = 0;
      for (let i = 0; i < COUNT && emitted < burst; i++) {
        if (ages[i] >= lifetimes[i]) {
          // Spawn at random position around logo
          positions[i * 3]     = cx + (Math.random() - 0.5) * hw * 2;
          positions[i * 3 + 1] = cy + (Math.random() - 0.5) * hh * 2;
          positions[i * 3 + 2] = cz + (Math.random() - 0.5) * 30;
          drifts[i * 3]     = (Math.random() - 0.5) * 0.4;
          drifts[i * 3 + 1] = 0.2 + Math.random() * 0.5; // float up
          drifts[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
          lifetimes[i] = 1.0 + Math.random() * 1.5;
          ages[i] = 0;
          emitted++;
        }
      }
    }

    // Update all particles
    for (let i = 0; i < COUNT; i++) {
      if (ages[i] < lifetimes[i]) {
        ages[i] += dt;
        const t = ages[i] / lifetimes[i]; // 0→1
        // Fade in fast, fade out slow
        alphas[i] = t < 0.15 ? t / 0.15 : 1.0 - Math.pow((t - 0.15) / 0.85, 2);
        alphas[i] *= 0.6; // keep subtle
        positions[i * 3]     += drifts[i * 3] * dt;
        positions[i * 3 + 1] += drifts[i * 3 + 1] * dt;
        positions[i * 3 + 2] += drifts[i * 3 + 2] * dt;
      } else {
        alphas[i] = 0;
      }
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  };
}

/* ── MAIN INIT ───────────────────────────────────── */
function initLogo3D(container) {
  const svgPath     = container.dataset.svg;
  const colorHex    = container.dataset.color || '#1a1a1a';
  const depth       = parseFloat(container.dataset.bevelDepth  || '22');
  const rotateSpeed = parseFloat(container.dataset.rotateSpeed || '0.5');
  const fallback    = container.dataset.fallback || null;
  const bgColor     = container.dataset.bg || 'transparent';
  const sparks      = container.dataset.sparks !== 'false';

  // WebGL check
  try {
    const t = document.createElement('canvas');
    if (!t.getContext('webgl2') && !t.getContext('webgl')) throw new Error();
  } catch {
    if (fallback) container.innerHTML = `<img src="${fallback}" style="width:100%;height:100%;object-fit:contain;">`;
    return;
  }

  const W = container.clientWidth  || 800;
  const H = container.clientHeight || 400;

  // Renderer
  const transparent = bgColor === 'transparent';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  if (transparent) renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Scene + camera
  const scene = new THREE.Scene();
  if (!transparent) scene.background = new THREE.Color(bgColor);
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 5000);
  camera.position.set(0, 0, 900);

  // Env
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Controls — user can drag, no autoRotate (custom)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = false;
  controls.enableZoom = false;

  // Lights
  scene.add(new THREE.AmbientLight(0xfff8f0, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 5);
  key.position.set(300, 400, 600); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffeedd, 2);
  fill.position.set(-400, -100, 300); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 2.5);
  rim.position.set(0, 100, -700); scene.add(rim);
  const topL = new THREE.DirectionalLight(0xffffff, 2);
  topL.position.set(0, 700, 100); scene.add(topL);

  // Materials
  const frontMat = new THREE.MeshStandardMaterial({
    color: hexToInt(colorHex), metalness: 0.2, roughness: 0.28
  });
  const bevelMat = new THREE.MeshStandardMaterial({
    color: darken(colorHex, 0.08), metalness: 0.38, roughness: 0.1
  });

  // Spark system
  const updateSparks = sparks ? createSparkSystem(scene) : null;
  let logoWorldBox = null;

  // Rotation state
  let rotAngle = 0;
  const rotActive = rotateSpeed > 0;

  // Load SVG
  new SVGLoader().load(svgPath, (data) => {
    const group = new THREE.Group();

    for (const path of data.paths) {
      for (const shape of SVGLoader.createShapes(path)) {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness: 3,
          bevelSize: 1.8,
          bevelOffset: 0,
          bevelSegments: 6,
        });
        group.add(new THREE.Mesh(geo, [frontMat, bevelMat]));
      }
    }

    group.scale.set(1, -1, 1);

    // Get bounds
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.set(-center.x, -center.y, -center.z);
    const size = box.getSize(new THREE.Vector3());

    // Calculate visible area
    const vFOV = camera.fov * Math.PI / 180;
    const visH = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const visW = visH * camera.aspect;

    // Scale to fit with generous margin for rotation
    // At 45° the projected width ≈ w*cos45 + d*sin45 ≈ 0.71*w + 0.71*d
    const maxRotW = size.x * 0.71 + depth * 0.71 + size.x * 0.3; // extra margin
    const maxRotH = size.y * 1.1; // 10% vertical margin
    const sW = (visW * 0.85) / maxRotW;
    const sH = (visH * 0.85) / maxRotH;
    const s = Math.min(sW, sH);
    group.scale.set(s, -s, s);

    // Re-center
    const box2 = new THREE.Box3().setFromObject(group);
    const c2 = box2.getCenter(new THREE.Vector3());
    group.position.sub(c2);

    // Store world-space box for spark positioning
    const sz2 = box2.getSize(new THREE.Vector3());
    logoWorldBox = { x: 0, y: 0, z: 0, w: sz2.x, h: sz2.y };

    scene.add(group);
  });

  // Clock
  const clock = new THREE.Clock();

  // Animate
  (function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta();
    controls.update();

    // Variable-speed rotation
    if (rotActive && scene.children.length > 0) {
      const group = scene.children[scene.children.length - 1];
      if (group && group.isGroup) {
        const halfAngle = (rotAngle % (Math.PI * 2)) / 2;
        const bf = Math.sin(halfAngle);
        const sf = bf * bf;
        const minSpd = rotateSpeed * 0.003;
        const maxSpd = rotateSpeed * 0.016;
        rotAngle += minSpd + (maxSpd - minSpd) * sf;
        group.rotation.y = rotAngle;
      }
    }

    // Sparks
    if (updateSparks) updateSparks(dt, logoWorldBox);

    renderer.render(scene, camera);
  })();

  // Resize
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);
}

document.querySelectorAll('.logo-3d').forEach(initLogo3D);
