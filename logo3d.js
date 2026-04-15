/**
 * logo3d.js — Återanvändbar 3D-logga för pitchar
 *
 * Inkludera i pitch-HTML med:
 *   <script type="module" src="../../template/logo3d.js"></script>
 *
 * Placera i HTML där loggan ska vara:
 *   <div class="logo-3d"
 *        data-svg="./brand.svg"
 *        data-color="#1a1a1a"
 *        data-rotate-speed="0.5"
 *        data-bevel-depth="22">
 *   </div>
 *
 * Fallback (visas om WebGL saknas):
 *   <div class="logo-3d" data-svg="..." data-fallback="./brand-logo.png">
 *
 * Attribut:
 *   data-svg            — sökväg till SVG (obligatorisk)
 *   data-color          — brand-färg hex, default #1a1a1a
 *   data-bevel-depth    — extrusionsdjup, default 22
 *   data-rotate-speed   — rotationshastighet, default 0.5 (0 = ingen rotation)
 *   data-fallback       — fallback-bild om WebGL inte stöds
 *   data-bg             — bakgrundsfärg, default "transparent"
 */

import * as THREE from 'three';
import { SVGLoader }       from 'three/addons/loaders/SVGLoader.js';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function hexToThreeColor(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

function darken(hex, factor = 0.15) {
  const c = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((c >> 16) & 0xff) - Math.round(255 * factor));
  const g = Math.max(0, ((c >> 8) & 0xff)  - Math.round(255 * factor));
  const b = Math.max(0, (c & 0xff)          - Math.round(255 * factor));
  return (r << 16) | (g << 8) | b;
}

function initLogo3D(container) {
  const svgPath     = container.dataset.svg;
  const colorHex    = container.dataset.color || '#1a1a1a';
  const depth       = parseFloat(container.dataset.bevelDepth  || '22');
  const rotateSpeed = parseFloat(container.dataset.rotateSpeed || '0.5');
  const fallback    = container.dataset.fallback || null;
  const bgColor     = container.dataset.bg || 'transparent';

  // WebGL check
  try {
    const test = document.createElement('canvas');
    if (!test.getContext('webgl2') && !test.getContext('webgl')) throw new Error();
  } catch {
    if (fallback) {
      container.innerHTML = `<img src="${fallback}" style="width:100%;height:100%;object-fit:contain;">`;
    }
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

  // Scene
  const scene = new THREE.Scene();
  if (!transparent) scene.background = new THREE.Color(bgColor);

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 5000);
  camera.position.set(0, 0, 900);

  // Env
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Controls — user interaction only, no autoRotate (we do custom rotation)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = false;
  controls.enableZoom = false;

  // Custom rotation state — slow at front (0°), fast at back (180°)
  let rotAngle = 0;
  const rotActive = rotateSpeed > 0;

  // Ljus
  scene.add(new THREE.AmbientLight(0xfff8f0, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 5);
  key.position.set(300, 400, 600);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffeedd, 2);
  fill.position.set(-400, -100, 300);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 2.5);
  rim.position.set(0, 100, -700);
  scene.add(rim);
  const top = new THREE.DirectionalLight(0xffffff, 2);
  top.position.set(0, 700, 100);
  scene.add(top);

  // Material med brand-färg
  const frontMat = new THREE.MeshStandardMaterial({
    color: hexToThreeColor(colorHex),
    metalness: 0.2,
    roughness: 0.28,
  });
  const bevelMat = new THREE.MeshStandardMaterial({
    color: darken(colorHex, 0.08),
    metalness: 0.38,
    roughness: 0.1,
  });

  // SVG → 3D
  new SVGLoader().load(svgPath, (data) => {
    const group = new THREE.Group();

    for (const path of data.paths) {
      for (const shape of SVGLoader.createShapes(path)) {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness: 3.5,
          bevelSize: 2,
          bevelOffset: 0,
          bevelSegments: 8,
        });
        group.add(new THREE.Mesh(geo, [frontMat, bevelMat]));
      }
    }

    group.scale.set(1, -1, 1);

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.set(-center.x, -center.y, -center.z);

    const size = box.getSize(new THREE.Vector3());
    // Calculate visible area at camera distance
    const vFOV = camera.fov * Math.PI / 180;
    const visH = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const visW = visH * camera.aspect;
    // Account for rotation: max projected width = diagonal of XZ footprint
    const maxRotW = Math.sqrt(size.x * size.x + depth * depth);
    const maxRotH = size.y; // height doesn't change on Y rotation
    // Scale to fit both width and height with margin
    const sW = (visW * 0.6) / maxRotW;
    const sH = (visH * 0.6) / maxRotH;
    const s = Math.min(sW, sH);
    group.scale.set(s, -s, s);

    const box2 = new THREE.Box3().setFromObject(group);
    group.position.sub(box2.getCenter(new THREE.Vector3()));

    scene.add(group);
  });

  // Animate with variable rotation speed
  let logoGroup = null;
  const origOnLoad = scene.add.bind(scene);

  // Animate
  (function loop() {
    requestAnimationFrame(loop);
    controls.update();

    // Variable-speed rotation: slow at front (0°), fast at back (180°)
    if (rotActive && scene.children.length > 0) {
      const group = scene.children[scene.children.length - 1];
      if (group && group.isGroup) {
        // sin²(θ/2) = 0 at front, 1 at back
        const halfAngle = (rotAngle % (Math.PI * 2)) / 2;
        const backFactor = Math.sin(halfAngle);
        const speedFactor = backFactor * backFactor; // 0→1→0

        // minSpeed at front, ~4x at back
        const minSpeed = rotateSpeed * 0.004;
        const maxSpeed = rotateSpeed * 0.018;
        const speed = minSpeed + (maxSpeed - minSpeed) * speedFactor;

        rotAngle += speed;
        group.rotation.y = rotAngle;
      }
    }

    renderer.render(scene, camera);
  })();

  // Resize
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);
}

// Initialisera alla .logo-3d-element på sidan
document.querySelectorAll('.logo-3d').forEach(initLogo3D);
