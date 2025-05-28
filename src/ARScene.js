import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

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

    // Add AR button
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // Lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Reticle
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0f0 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Controller
    controller = renderer.xr.getController(0);
    scene.add(controller);

    // Animation loop
    renderer.setAnimationLoop((timestamp, frame) => {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!selectListenerAttached && session) {
          controller.addEventListener('select', () => {
            if (reticle.visible) {
              // ✅ Place cube on reticle
              const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
              const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
              const cube = new THREE.Mesh(geometry, material);
              cube.position.setFromMatrixPosition(reticle.matrix);
              cube.userData.isClickable = true;
              scene.add(cube);
            }
          });

          // ✅ Handle interaction (tap existing cube)
          session.addEventListener('select', () => {
            const raycaster = new THREE.Raycaster();
            const tempMatrix = new THREE.Matrix4();

            tempMatrix.identity().extractRotation(controller.matrixWorld);
            raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

            const intersects = raycaster.intersectObjects(scene.children, true);
            if (intersects.length > 0) {
              const hitObject = intersects[0].object;
              if (hitObject.userData.isClickable) {
                hitObject.material.color.setHex(Math.random() * 0xffffff);
                hitObject.rotation.y += Math.PI / 4;
              }
            }
          });

          selectListenerAttached = true;
        }

        // Setup hit-test
        if (!hitTestSourceRequested) {
          session.requestReferenceSpace('viewer').then((refSpace) => {
            session.requestHitTestSource({ space: refSpace }).then((source) => {
              hitTestSource = source;
            });
          });

          session.addEventListener('end', () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            selectListenerAttached = false;
          });

          hitTestSourceRequested = true;
        }

        // Update reticle position
        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length) {
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

  return <div ref={containerRef} />;
};

export default ARScene;
