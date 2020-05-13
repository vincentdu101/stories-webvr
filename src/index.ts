import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton";
import { VertexColors } from "three";

let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let vertex = new THREE.Vector3();
let color = new THREE.Color();

init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.y = 10;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xffffff );
    scene.fog = new THREE.Fog( 0xffffff, 0, 750 );

    let light = new THREE.HemisphereLight( 0xeeeeff, 0x777788, 0.75 );
    light.position.set( 0.5, 1, 0.75 );
    scene.add( light );

    let blocker = document.getElementById( 'blocker' );
    let instructions = document.getElementById( 'instructions' );

    // floor

    let floorGeometry = new THREE.PlaneBufferGeometry( 2000, 2000, 100, 100 );
    floorGeometry.rotateX( - Math.PI / 2 );

    // vertex displacement

    let position = <THREE.BufferAttribute> floorGeometry.attributes.position;

    for ( let i = 0, l = position.count; i < l; i ++ ) {

        vertex.fromBufferAttribute( position, i );

        vertex.x += Math.random() * 20 - 10;
        vertex.y += Math.random() * 2;
        vertex.z += Math.random() * 20 - 10;

        position.setXYZ( i, vertex.x, vertex.y, vertex.z );

    }

    floorGeometry = <THREE.PlaneBufferGeometry> floorGeometry.toNonIndexed(); // ensure each face has unique vertices

    position = <THREE.BufferAttribute> floorGeometry.attributes.position;
    let colors = [];

    for ( let i = 0, l = position.count; i < l; i ++ ) {

        color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75 );
        colors.push( color.r, color.g, color.b );

    }

    floorGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

    let floorMaterial = new THREE.MeshBasicMaterial( { vertexColors: true } );

    let floor = new THREE.Mesh( floorGeometry, floorMaterial );
    scene.add( floor );

    // objects

    // let boxGeometry = new THREE.BoxBufferGeometry( 20, 20, 20 );
    // boxGeometry = boxGeometry.toNonIndexed(); // ensure each face has unique vertices

    // position = boxGeometry.attributes.position;
    // colors = [];

    // for ( let i = 0, l = position.count; i < l; i ++ ) {

    //     color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75 );
    //     colors.push( color.r, color.g, color.b );

    // }

    // boxGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

    // for ( let i = 0; i < 500; i ++ ) {

    //     let boxMaterial = new THREE.MeshPhongMaterial( { specular: 0xffffff, flatShading: true, vertexColors: true } );
    //     boxMaterial.color.setHSL( Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75 );

    //     let box = new THREE.Mesh( boxGeometry, boxMaterial );
    //     box.position.x = Math.floor( Math.random() * 20 - 10 ) * 20;
    //     box.position.y = Math.floor( Math.random() * 20 ) * 20 + 10;
    //     box.position.z = Math.floor( Math.random() * 20 - 10 ) * 20;

    //     scene.add( box );
    //     objects.push( box );

    // }

    //

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.xr.enabled = true;
    document.body.appendChild( renderer.domElement );
    document.body.appendChild(VRButton.createButton(renderer));

    //

    window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

    requestAnimationFrame( animate );

    // if ( controls.isLocked === true ) {

        // raycaster.ray.origin.copy( controls.getObject().position );
        // raycaster.ray.origin.y -= 10;

        // let intersections = raycaster.intersectObjects( objects );

        // let onObject = intersections.length > 0;

        let time = performance.now();
        let delta = ( time - prevTime ) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number( moveForward ) - Number( moveBackward );
        direction.x = Number( moveRight ) - Number( moveLeft );
        direction.normalize(); // this ensures consistent movements in all directions

        if ( moveForward || moveBackward ) velocity.z -= direction.z * 400.0 * delta;
        if ( moveLeft || moveRight ) velocity.x -= direction.x * 400.0 * delta;

        // if ( onObject === true ) {

        //     velocity.y = Math.max( 0, velocity.y );
        //     canJump = true;

        // }

        // controls.moveRight( - velocity.x * delta );
        // controls.moveForward( - velocity.z * delta );

        // controls.getObject().position.y += ( velocity.y * delta ); // new behavior

        // if ( controls.getObject().position.y < 10 ) {

        //     velocity.y = 0;
        //     controls.getObject().position.y = 10;

        //     canJump = true;

        // }

        prevTime = time;

    // }

    renderer.render( scene, camera );

}