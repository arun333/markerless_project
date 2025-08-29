import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

const ARScene = () => {
  const containerRef = useRef();
  const [selectedModel, setSelectedModel] = useState('shark.glb');

  useEffect(() => {
    let scene, camera, renderer, controller;
    let reticle;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let selectListenerAttached = false;

    let modelGroup = null;
    let mixer = null;
    let modelPlaced = false;
    const clock = new THREE.Clock();

    // Rotation
    let isTouching = false;
    let previousTouchX = 0;
    let previousTouchY = 0;

    // Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    document.body.appendChild(
      ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
    );

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Reticle
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    controller = renderer.xr.getController(0);
    scene.add(controller);

    const loader = new GLTFLoader();

    const placeModel = (matrix) => {
      loader.load(`models/${selectedModel}`, (gltf) => {
        if (modelGroup) {
          scene.remove(modelGroup);
          modelGroup = null;
        }

        const model = gltf.scene;
        modelGroup = new THREE.Group();
        modelGroup.add(model);
        modelGroup.scale.set(0.15, 0.15, 0.15);
        modelGroup.position.setFromMatrixPosition(matrix);
        modelGroup.userData.originalY = modelGroup.position.y;

        scene.add(modelGroup);

        // Setup animation
        mixer = new THREE.AnimationMixer(model);
        if (gltf.animations.length > 0) {
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.play();
          });
        }

        modelPlaced = true;
        reticle.visible = false;
      });
    };

    // Animation loop
    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const session = renderer.xr.getSession();

        if (!selectListenerAttached) {
          controller.addEventListener('select', () => {
            if (reticle.visible && !modelPlaced) {
              placeModel(reticle.matrix);
            }
          });
          selectListenerAttached = true;
        }

        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
            });
          });

          session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            modelPlaced = false;
            selectListenerAttached = false;
            if (modelGroup) {
              scene.remove(modelGroup);
              modelGroup = null;
            }
          });

          hitTestSourceRequested = true;
        }

        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(renderer.xr.getReferenceSpace());
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }

        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);

        // Dolphin floating effect
        if (modelGroup && selectedModel === 'whale.glb') {
          const t = clock.getElapsedTime();
          modelGroup.position.y = modelGroup.userData.originalY + Math.sin(t * 2) * 0.05;
        }

        renderer.render(scene, camera);
      }
    });

    // Touch rotation
    const onTouchStart = (e) => {
      if (modelPlaced && e.touches.length === 1) {
        isTouching = true;
        previousTouchX = e.touches[0].clientX;
        previousTouchY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (!isTouching || !modelGroup || e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - previousTouchX;
      const deltaY = e.touches[0].clientY - previousTouchY;
      previousTouchX = e.touches[0].clientX;
      previousTouchY = e.touches[0].clientY;

      const speed = 0.005;
      modelGroup.rotation.y += deltaX * speed;
      modelGroup.rotation.x += deltaY * speed;

      modelGroup.rotation.x = THREE.MathUtils.clamp(modelGroup.rotation.x, -Math.PI / 2, Math.PI / 2);
    };

    const onTouchEnd = () => {
      isTouching = false;
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [selectedModel]);

  return (
    <div>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 999 }}>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          <option value="shark.glb">Shark</option>
          <option value="whale.glb">Dolphin</option>
        </select>
      </div>
      <div ref={containerRef} />
    </div>
  );
};

export default ARScene;
