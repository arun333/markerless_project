// src/ARScene.js
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

const ARScene = () => {
  const containerRef = useRef();

  useEffect(() => {
    let scene, camera, renderer, controller;
    let reticle;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let modelLoaded = null;

    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    document.body.appendChild(
      ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
    );

    // Light
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

    // Controller setup
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      if (reticle.visible && modelLoaded) {
        const model = modelLoaded.clone();
        model.position.setFromMatrixPosition(reticle.matrix);
        pos.y += 0.05;

        scene.add(model);
        console.log('📍 Model placed at', model.position);
      }
    });
    scene.add(controller);

    // Load model
    const loader = new GLTFLoader();
    loader.load(
      process.env.PUBLIC_URL + '/models/fish.glb',
      (gltf) => {
        modelLoaded = gltf.scene;
        modelLoaded.scale.set(2, 2, 2); // Scale model as needed
        console.log('✅ Model loaded successfully');
      },
      (xhr) => {
        console.log(`📦 Loading model: ${(xhr.loaded / xhr.total) * 100}%`);
      },
      (error) => {
        console.error('⛔ Error loading model:', error);
      }
    );

    // Animation loop
    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
              console.log('✅ Hit test source ready');
            });
          });

          session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
          });

          hitTestSourceRequested = true;
        }

        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(referenceSpace);
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
      }
      renderer.render(scene, camera);
    });

    // Cleanup
    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default ARScene;
