import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import gsap from 'gsap';

const ARScene = () => {
  const containerRef = useRef();

  useEffect(() => {
    let scene, camera, renderer, controller;
    let reticle;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let selectListenerAttached = false;

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

    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!selectListenerAttached && session) {
          controller.addEventListener('select', () => {
            if (reticle.visible) {
                loader.load('public/models/fish.glb', (gltf) => {
                const model = gltf.scene;
                model.position.setFromMatrixPosition(reticle.matrix);
                model.scale.set(0.5, 0.5, 0.5);
                scene.add(model);

                console.log("✅ Model placed at", model.position);
                reticle.visible = false;

                // Animate model jump toward camera
                const cameraDir = new THREE.Vector3();
                camera.getWorldDirection(cameraDir);
                cameraDir.multiplyScalar(0.5); // how far forward to jump

                const jumpTarget = {
                  x: model.position.x + cameraDir.x,
                  y: model.position.y + 0.3, // jump height
                  z: model.position.z + cameraDir.z,
                };

                gsap.to(model.position, {
                  ...jumpTarget,
                  duration: 1.5,
                  ease: 'power2.out',
                  yoyo: true,
                  repeat: 1,
                  onComplete: () => {
                    console.log('🎯 Jump animation complete');
                  },
                });

                gsap.to(model.rotation, {
                  y: model.rotation.y + Math.PI * 2,
                  duration: 1.5,
                  ease: 'power2.inOut',
                });
              });
            }
          });

          selectListenerAttached = true;
        }

        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
              console.log("✅ Hit test source ready");
            });
          });

          session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            selectListenerAttached = false;
          });

          hitTestSourceRequested = true;
        }

        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(renderer.xr.getReferenceSpace());
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
      }

      renderer.render(scene, camera);
    });

    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} />;
};

export default ARScene;
