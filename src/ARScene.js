import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import './styles/ARScene.css';

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

    const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
    arButton.style.display = 'none'; // Hide it entirely
    document.body.appendChild(arButton); 
    window._arButton = arButton;

    setTimeout(() => {
    if (arButton && arButton.parentNode) {
      arButton.parentNode.removeChild(arButton);
    }
  }, 100);

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
            if(!modelPlaced)
            {
              reticle.visible = true;
              reticle.matrix.fromArray(pose.transform.matrix);

            }
            
          } else {
            reticle.visible = false;
          }
        }else{
          if(!modelPlaced)
            reticle.visible=false;
        }

        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);

        // Dolphin floating effect
        if (modelGroup && selectedModel === 'whale.glb') {
          const t = clock.getElapsedTime();
          const cameraObj = renderer.xr.getCamera();

          modelGroup.position.y = modelGroup.userData.originalY + Math.sin(t * 2) * 0.05;

           const dolphinPosition = modelGroup.position.clone();
          const cameraPosition = new THREE.Vector3();
          cameraObj.getWorldPosition(cameraPosition);

          // Get direction vector from dolphin to camera
          /*
                //this is a project to explore marine life in an Augmented Reality environment. Find a flat surface like table or floor and tap on the screen to place the selected model and hit the Start AR button.

                1) Press the Start AR button
                2) Find a plain surface and what did u see there? Green Ring
                3) Can you tap on the screen to place the model and after what kind of model do u see? 
                4) How long did it take to render the model? Is the model animated? Is thee model moving?
                
                5) Press X to go back to main  screen and select another model and ask what did u notice?

                User 1 Observation: User was trying to move the model and tryong to place more than one model.

          */
          const direction = cameraPosition.clone().sub(dolphinPosition).normalize();
          const moveSpeed = 0.005; // adjust for slower/faster approach

          // Update position
          modelGroup.position.add(direction.multiplyScalar(moveSpeed));
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
     <div className="ar-container">
    
    <div className="ui-overlay">
  <div className="title">🌊 Explore Marine Life in AR</div>

  <div className="model-label">Please select a model you want to view:</div>
  <select
    value={selectedModel}
    onChange={(e) => setSelectedModel(e.target.value)}
    className="dropdown"
  >
    <option value="shark.glb">Shark</option>
    <option value="whale.glb">Whale</option>
  </select>

  <div className="instruction">
    This project lets you explore marine life in Augmented Reality. Press START AR and find a flat surface like a table or floor, then tap one to place the model.
  </div>

      <button
      className="start-ar-button"
      onClick={() => {
        if (window._arButton) {
        window._arButton.click(); // triggers the real WebXR session start
      } else {
        console.error("AR button not initialized");
      }
      }}
    >
      Start AR
    </button>

      
  </div>

      {/* AR Canvas */}
      <div className="ar-scene" ref={containerRef}></div>
    </div>
  );
};

export default ARScene;
