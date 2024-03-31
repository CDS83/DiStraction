/**
 * Created by Christophe on 20/11/2014.
 */

/*global BABYLON */
/*global CANNON */
/*global $ */

/*global FPSMeter */

/*global Ground */
/*global Car */
/*global Chekpoints */

//
//
//

var skybox = function (scene) {
    "use strict";
    
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 1000.0, scene),
        skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("skybox/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;
};

function PhysicsWorld() {
    "use strict";

    // world
    this.world = new CANNON.World();
    this.world.solver.iterations = 10;
    this.world.gravity.set(0, 0, -9.82);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    //this.world.defaultContactMaterial.contactEquationStiffness = 1e6;
    //this.world.defaultContactMaterial.contactEquationRegularizationTime = 1;
    //this.world.solver.iterations = 10;

    this.worldstep = 2;
    this.timeStep = 1.0 / 60.0; // seconds

    // Collision filter groups - must be powers of 2!
    this.GROUP1 = 1; // ground and landscape elements
    this.GROUP2 = 2; // car body

    // materials
    this.groundMaterial = new CANNON.Material("groundMaterial");
    this.carBodyMaterial = new CANNON.Material("carBodyMaterial");
    this.bodyGroundContactMaterial = new CANNON.ContactMaterial(this.groundMaterial, this.carBodyMaterial, {
        friction: 0.01,
        restitution: 0
    });

    this.world.addContactMaterial(this.bodyGroundContactMaterial);
}

function Demo() {
    "use strict";

    if (BABYLON.Engine.isSupported()) {
        // Get the canvas element
        this.canvas = document.getElementById("renderCanvas");
        this.message = document.getElementById("message");

        // Load the BABYLON 3D engine
        this.engine = new BABYLON.Engine(this.canvas, true);

        this.initUI();

        // Now, call the createScene function
        this.createScene();
    }
}

//
//  Loading
//

Demo.prototype.loadingMessage = function (msg) {
    "use strict";
    
    $("#loading #message").text(msg);
};

Demo.prototype.toggleLoadingMessage = function () {
    "use strict";
    
    $("#loading").toggle();
    $("#title").css('color', '#000000');
    $("#subtitle").css('color', '#000000');
};

//
//  GUI
//

Demo.prototype.initUI = function () {
    "use strict";

    //
    // menus
    //

    var demo = this;
    $("#start_btn").click(function () {
        //alert( "Handler for .click() called." );

        $("#title_bar").toggle();
        //$("#bottom_bar").toggle();

        $("#tdb_back").toggle();
        $("#tdb").toggle();

        // checkpoints ?
        if (demo.checkpoints.isEnabled()) {
            demo.checkpointsStatusUpdate();
            demo.initTimer();
            demo.initFailed();
        }

        demo.activateCamera(demo.followCamera);

        //demo.activateCamera( demo.createTestCamera() );
        demo.ds3.setPosition(new CANNON.Vec3(-19, -14, 60));
        demo.ds3.update();
        demo.registerMoves();
    });

    $('#options input').iCheck({
        handle: 'checkbox',
        checkboxClass: 'icheckbox_flat-blue'
            /*,
                    increaseArea: '20%'*/
    });
    $('#options input[name="shadows"]').iCheck('check');
    $('#options input[name="antialias"]').iCheck('uncheck');

    $('#options input[name="shadows"]').on('ifChecked', function (event) {
        demo.enableShadows();
    });
    $('#options input[name="shadows"]').on('ifUnchecked', function (event) {
        demo.disableShadows();
    });

    $('#options input[name="antialias"]').on('ifChecked', function (event) {
        demo.enablePostProcessPipeline();
    });
    $('#options input[name="antialias"]').on('ifUnchecked', function (event) {
        demo.disablePostProcessPipeline();
    });

    $('#game_options input').iCheck({
        handle: 'radio',
        radioClass: 'iradio_flat-blue' /*, increaseArea: '20%'*/
    });
    $('#game_options input[value="checkpoints"]').on('ifChecked', function (event) {
        demo.checkpoints.enableSprites();
        $("#tdb #tdb_checkpoints").toggle();
    });
    $('#game_options input[value="free_ride"]').on('ifChecked', function (event) {
        demo.checkpoints.disableSprites();
        $("#tdb #tdb_checkpoints").toggle();
    });
};

Demo.prototype.displayDirection = function (dir) {
    "use strict";
    
    if (dir === 1) {
        $("#direction").text("");
    } else {
        $("#direction").text("R");
    }
};

Demo.prototype.updateTdB = function () {
    "use strict";

    $("#speed span").text(Math.round(this.ds3.getSpeed()));

    //$("#steering").text( this.ds3.getLenk());
};

Demo.prototype.checkpointsStatusUpdate = function () {
    "use strict";
    
    $("#tdb #tdb_checkpoints #remaining span").text(this.checkpoints.getNbCheckPoints());
};

Demo.prototype.failedStatusUpdate = function () {
    "use strict";
    
    this.failed += 1;
    $("#tdb #tdb_checkpoints #failed span").text(this.failed);
};

Demo.prototype.initFailed = function () {
    "use strict";
    
    this.failed = 0;
};

Demo.prototype.initTimer = function () {
    "use strict";
    
    this.timer = Date.now();
};

Demo.prototype.updateTimer = function () {
    "use strict";

    if (this.checkpoints.getNbCheckPoints() > 0) {
        var delta = Date.now() - this.timer,
            delta_m = Math.floor(delta / 60000),
            delta_s = Math.floor((delta - delta_m * 60000) / 1000),
            delta_ds = Math.floor((delta - delta_m * 60000 - delta_s * 1000) / 10),

            z1 = "",
            z2 = "",
            z3 = "";
        
        if (delta_m < 10) { z1 = "0"; }
        if (delta_s < 10) { z2 = "0"; }
        if (delta_ds < 10) { z3 = "0"; }

        $("#tdb #tdb_checkpoints #timer span").text(z1 + delta_m + ":" + z2 + delta_s + ":" + z3 + delta_ds);
    }
};

//  -----------------------------------------
//  3D scene
//  -----------------------------------------

//  loading scene

Demo.prototype.createScene = function () {
    "use strict";

    //  CANNON - physics
    this.physicsWorld = new PhysicsWorld();

    //  BABYLON - 3d
    this.scene = new BABYLON.Scene(this.engine); // Now create a basic Babylon Scene object
    this.scene.clearColor = new BABYLON.Color3(0.8, 0.8, 0.8);

    this.createLights();
    this.createShadowGenerator(this.shadowLight);
    skybox(this.scene);
    this.loadGround();
};

Demo.prototype.loadGround = function () {
    "use strict";

    var sf = 50.0; /* 50 */

    this.ground = new Ground(this.scene, this.physicsWorld.world,
        "./paris/", "paris_heightmap.babylon",
        "Ground",
        6 * sf, /* 300 */
        this.physicsWorld.groundMaterial, {
            groundTexture: "./paris/plan.png",
            //waterLevel: -1.5 + 50,
            groundCollisionFilterGroup: this.physicsWorld.GROUP1,
            groundCollisionFilterMask: this.physicsWorld.GROUP2,
            scaleFactor: sf, /* 50 */
            buildingBaseHeight: sf, /* 50 */
            solidBuildingsPath: "./paris/",
            solidBuildingsName: "paris_solid_buildings.babylon",
            buildingsPath: "./paris/",
            buildingsName: "paris_3D_buildings.babylon",
            treesPath: "./paris/",
            treesName: "paris_trees.babylon",
            particlesPath: "./paris/",
            particlesName: "paris_particles.babylon",
            buildingCelShading: true,
            outlineShaderDeltaHeight: 0.15 * (sf / 50.0),
            shadowGenerator: this.shadowGenerator,
            msgCallback: this.loadingMessage.bind(this),
            onLoadFinished: this.loadCar.bind(this)
        });
    this.ground.load();
};

Demo.prototype.loadCar = function () {
    "use strict";

    this.ds3 = new Car(this.scene, this.physicsWorld.world,
        "./ds3/caisse/", "DS3_caisse.babylon",
        /*"./resources/ds3/body/babylon/", "body.babylon",*/
        "./ds3/roue/", "DS3_roue.babylon",
        this.physicsWorld.carBodyMaterial, this.physicsWorld.wheelMaterial,
        new CANNON.Vec3(1.31, 0.76, -0.6), // CANNON raycast vehicle local axis system
        new CANNON.Vec3(1.31, -0.7, -0.6),
        new CANNON.Vec3(-1.13, 0.76, -0.6),
        new CANNON.Vec3(-1.13, -0.7, -0.6), {
            scaleFactor: 0.001,
            invertX: true,
            bodyMass: 2000,
            bodyCollisionFilterGroup: this.physicsWorld.GROUP2,
            bodyCollisionFilterMask: this.physicsWorld.GROUP1,
            shadowGenerator: this.shadowGenerator,
            msgCallback: this.loadingMessage.bind(this),
            onLoadSuccess: this.loadCheckpoints.bind(this)
        });

    this.ds3.load();
};

Demo.prototype.loadCheckpoints = function () {
    "use strict";

    this.checkpoints = new Chekpoints(this.scene, this.ds3.getCarMainMesh(), this.ground,
        "./paris/", "paris_poi.babylon",
        "./pics/poi.png", 9, 512, {
            msgCallback: this.loadingMessage.bind(this),
            chekpointsCallback: this.checkpointsStatusUpdate.bind(this),
            onLoadFinished: this.start.bind(this) // = this.start() with correct "this" when it will be called back
        });

    this.checkpoints.load();
};

//  post process pipelines

Demo.prototype.createPostProcessPipeline = function () {
    "use strict";

    var standardPipeline = new BABYLON.PostProcessRenderPipeline(this.engine, "standardPipeline"),
        engine = this.engine,
        fxaaEffect = new BABYLON.PostProcessRenderEffect(this.engine, "fxaa",
            function () {
                return new BABYLON.FxaaPostProcess("antialias", 2.0, null, BABYLON.Texture.TRILINEAR_SAMPLINGMODE, engine, true);
            });

    /*var blackAndWhiteEffect = new BABYLON.PostProcessRenderEffect(engine, "blackAndWhiteEffect",
        function() {
            return new BABYLON.BlackAndWhitePostProcess("bw", 1.0, null, null, engine, true)
        });
    standardPipeline.addEffect(blackAndWhiteEffect);*/

    standardPipeline.addEffect(fxaaEffect);

    this.scene.postProcessRenderPipelineManager.addPipeline(standardPipeline);

    /*this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("standardPipeline", this.arcCamera);
    this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("standardPipeline", this.followCamera);*/
};

Demo.prototype.disablePostProcessPipeline = function () {
    "use strict";
    
    this.scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline("standardPipeline", this.arcCamera);
    this.scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline("standardPipeline", this.followCamera);
};

Demo.prototype.enablePostProcessPipeline = function () {
    "use strict";
    
    this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("standardPipeline", this.arcCamera);
    this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("standardPipeline", this.followCamera);
};

//  lights & shadows

Demo.prototype.createLights = function () {
    "use strict";
    
    var dirLight, lightSphere, light;

    // directional light
    dirLight = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(0.2, -1, -0.6), this.scene);
    //var dirLight = new BABYLON.SpotLight("dir01", new BABYLON.Vector3(-450, 800, 150), new BABYLON.Vector3(0, -1, -.2), 2., 0., this.scene);
    //dirLight.position = new BABYLON.Vector3(-1.125, 2.00, 0.375);
    dirLight.position = new BABYLON.Vector3(-200, 1000, 600);
    dirLight.diffuse = new BABYLON.Color3(1, 1, 1);
    dirLight.specular = new BABYLON.Color3(1, 1, 1);
    dirLight.intensity = 0.7;
    //dirLight.setEnabled(true);

    lightSphere = BABYLON.Mesh.CreateSphere("sphere", 10, 20, this.scene);
    lightSphere.position = dirLight.position;
    lightSphere.position.scaleInPlace(0.5);
    lightSphere.material = new BABYLON.StandardMaterial("light", this.scene);
    lightSphere.material.emissiveColor = new BABYLON.Color3(1, 1, 0);

    // ambient light
    light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, -1, 0), this.scene);
    light.diffuse = new BABYLON.Color3(1, 1, 1);
    light.specular = new BABYLON.Color3(0.5, 0.5, 0.4);
    light.groundColor = new BABYLON.Color3(1, 1, 1);
    light.intensity = 0.8;
    //light.setEnabled(true);

    // spot
    /*var spotLight = new BABYLON.SpotLight("Spot0", new BABYLON.Vector3(0, 800, 0), new BABYLON.Vector3(0, -1, -.2), 1.1, 2, this.scene);
    spotLight.diffuse = new BABYLON.Color3(1, 0, 0);
    spotLight.specular = new BABYLON.Color3(1, 1, 1);
    spotLight.intensity = .7;*/

    this.shadowLight = dirLight;
};

Demo.prototype.createShadowGenerator = function (light) {
    "use strict";

    this.shadowGenerator = new BABYLON.ShadowGenerator(4096, light);

    this.shadowGenerator.useVarianceShadowMap = true;
    this.shadowGenerator.usePoissonSampling = true;

    this.shadowGenerator.setTransparencyShadow(true);

    // since 2.1:
    //this.shadowGenerator.useBlurVarianceShadowMap = true;
    this.shadowGenerator.bias = 0.00001;

    //this.shadowGenerator.setDarkness(.9);
    //this.shadowGenerator.setTransparencyShadow(true);
};

Demo.prototype.disableShadows = function () {
    "use strict";

    if (this.shadowGenerator !== null) {
        this.shadowRenderList = this.shadowGenerator.getShadowMap().renderList;
        this.shadowGenerator.getShadowMap().renderList = [];
    }
};

Demo.prototype.enableShadows = function () {
    "use strict";

    if (this.shadowRenderList !== null) {
        this.shadowGenerator.getShadowMap().renderList = this.shadowRenderList;
        this.scene.shadowsEnabled = true;
    }
};

// cameras

Demo.prototype.createTestCamera = function () {
    "use strict";
    
    var camera, scene, ground;
    
    // This creates and positions a free camera
    camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(5, 5, 55), this.scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    scene = this.scene;
    ground = this.ground;
    this.scene.registerBeforeRender(function () {
        if (scene.isReady()) {
            ground.updateShaders(scene.activeCamera.position);
        }
    });

    return camera;
};

Demo.prototype.createArcCamera = function () {
    "use strict";
    
    var camera, scene, ground;
    
    camera = new BABYLON.ArcRotateCamera("ArcRotateCamera", 0, 0, 0, new BABYLON.Vector3(0, 10, 0), this.scene);
    camera.setPosition(new BABYLON.Vector3(200, 150, 200));
    camera.lowerAlphaLimit = camera.upperAlphaLimit = 0;
    camera.lowerBetaLimit = 2;
    camera.upperBetaLimit = 1;
    camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;

    scene = this.scene;
    ground = this.ground;
    this.scene.registerBeforeRender(function () {
        if (scene.isReady()) {
            ground.updateShaders(scene.activeCamera.position);
            scene.activeCamera.alpha += 0.002;
        }
    });

    camera.viewport = new BABYLON.Viewport(0.0, 0.0, 1.0, 1.0);

    return camera;
};

Demo.prototype.activateCamera = function (camera) {
    "use strict";

    this.scene.activeCamera = camera;
    camera.attachControl(this.canvas, false);
};

Demo.prototype.registerMoves = function () {
    "use strict";

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);

    this.scene.registerBeforeRender(this.registerBeforeRender);
};

//
//  Demo management
//

Demo.prototype.resetCarPosition = function () {
    "use strict";
    
    this.ds3.setPosition(new CANNON.Vec3(-19, -14, 60));
    
    if (this.checkpoints.isEnabled()) {
        this.failedStatusUpdate();
    }
};

Demo.prototype.hideCar = function () {
    "use strict";
    
    this.ds3.setPosition(new CANNON.Vec3(0, 0, 0));
    this.ds3.update();
};

Demo.prototype.leaveGame = function () {
    "use strict";

    this.scene.unregisterBeforeRender(this.registerBeforeRender);
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);

    $("#title_bar").toggle();
    //$("#bottom_bar").toggle();

    $("#tdb_back").toggle();
    $("#tdb").toggle();

    this.activateCamera(this.arcCamera);

    //demo.activateCamera( demo.createTestCamera() );
    this.hideCar();

    if (this.checkpoints.isEnabled()) {
        this.checkpoints.resetSprites();
        this.checkpoints.enableSprites();
    }

};

Demo.prototype.start = function () {
    "use strict";
    
    var keys, demo, ds3, scene, physicsWorld, ground, meter, engine, renderLoop;

    /*this.ds3.setPosition( new CANNON.Vec3( -19, -14, 60 ) );
     this.ds3.update();
     this.registerMoves();
     this.ds3.setFollowCamera();*/

    //
    // handlers
    //

    // event keys
    keys = {
        left: 0,
        right: 0,
        forward: 0,
        back: 0,
        changeDir: 0
    };

    demo = this;
    this.keydownHandler = function (event) {
        if (event.keyCode === 37) { keys.left = 1; }
        if (event.keyCode === 38) { keys.forward = 1; }
        if (event.keyCode === 39) { keys.right = 1; }
        if (event.keyCode === 40) { keys.back = 1; }
        if (event.keyCode === 16) { keys.changeDir = 1; }

        if (event.keyCode === 27) { demo.leaveGame(); }

        if (event.keyCode === 32 && demo.ds3.getSpeed() < 2.0) {
            demo.resetCarPosition();
        }

        //console.log(event.keyCode);
    };
    this.keyupHandler = function (event) {
        if (event.keyCode === 37) { keys.left = 0; }
        if (event.keyCode === 38) { keys.forward = 0; }
        if (event.keyCode === 39) { keys.right = 0; }
        if (event.keyCode === 40) { keys.back = 0; }
        //if (event.keyCode == 69) keys.changeDir = 0;
    };

    // update physics and 3D
    ds3 = this.ds3;
    scene = this.scene;
    physicsWorld = this.physicsWorld;
    ground = this.ground;
    this.registerBeforeRender = function () {

        if (scene.isReady()) {
            ds3.moves(keys.forward, keys.back, keys.left, keys.right, keys.changeDir);

            if (keys.changeDir === 1) {
                demo.displayDirection(ds3.getDirection());
                keys.changeDir = 0;
            }

            //for(var i =0; i <= 10; i++) {
            physicsWorld.world.step(physicsWorld.timeStep);
            //}

            if (ds3.getAltitude() < -3 + 50) {
                demo.resetCarPosition();
            }

            ground.updateShaders(scene.activeCamera.position);

            ds3.update();
            demo.updateTdB();

            if (demo.checkpoints.isEnabled()) {
                demo.updateTimer();
            }
        }
    };

    //
    // start demo
    //
    
    this.createPostProcessPipeline();

    meter = new FPSMeter({
        graph: 1,
        decimals: 0, // Number of decimals in FPS number. 1 = 59.9, 2 = 59.
        // Meter position
        position: 'absolute', // Meter position.
        zIndex: 10, // Meter Z index.
        right: '5px', // Meter left offset.
        top: 'auto', // Meter top offset.
        left: 'auto', // Meter right offset.
        bottom: '5px', // Meter bottom offset.
        margin: '0 0 0 0' // Meter margin. Helps with centering the counter when left: 50%;
    });

    // Watch for browser/canvas resize events
    engine = this.engine;
    window.addEventListener("resize", function () {
        engine.resize();
    });

    // Register a render loop to repeatedly render the scene
    renderLoop = function () {
        meter.tickStart();

        engine.beginFrame();
        scene.render();
        engine.endFrame();

        meter.tick();

        // Register new frame
        BABYLON.Tools.QueueNewFrame(renderLoop);
    };

    //this.scene.debugLayer.show();

    BABYLON.Tools.QueueNewFrame(renderLoop);
    
    //
    // cameras
    //
    this.arcCamera = this.createArcCamera();
    this.followCamera = this.ds3.createFollowCamera();
    //this.arcCamera = this.createTestCamera();
    
    this.activateCamera(this.arcCamera);

    //
    //  GUI
    //

    this.toggleLoadingMessage();
    $("#menus").toggle();

    /*var e = new BABYLON.Vector3(0, Math.PI, 0);
    //var e = new BABYLON.Vector3(0.1, 0.1, 0.1);
    var q = BABYLON.Quaternion.RotationYawPitchRoll(e.y, e.x, e.z);*/

    /*console.log(e);
    console.log(q.toEulerAngles());
    console.log(toEulerAngles(q));*/
};
