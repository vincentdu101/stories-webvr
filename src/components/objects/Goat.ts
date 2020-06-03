import * as THREE from "three";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { Vector3, Scene, Group } from "three";

export default class Goat {

    private gltf: GLTF;
    private mixer: THREE.AnimationMixer;
    private action: THREE.AnimationAction;

    constructor(gltf: GLTF) {
        this.gltf = gltf;
        this.mixer = new THREE.AnimationMixer(this.gltf.scene);
        this.action = this.mixer.clipAction(this.gltf.animations[0]);
        this.play();
    }

    play(): void {
        this.action.play();
    }

    playAnimationFromTime(time: number) {
        this.action.time = time;
        this.action.play();
    }

    getScene(): Group {
        return this.gltf.scene;
    }

    updateMixer(delta: number) {
        if (this.mixer) {
            this.mixer.update(delta);
        }
    }

}