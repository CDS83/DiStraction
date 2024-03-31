/**
 * Created by Christophe on 24/11/2014.
 */

// -----------------------

/*jslint nomen: true*/

/*global BABYLON */
/*global CANNON */

// -----------------------

function toEulerAngles(quat) {
	"use strict";
	
	var result, qx, qy, qz, qw, sqx, sqy, sqz, yaw, pitch, roll,
		gimbaLockTest;
	
	result = BABYLON.Vector3.Zero();

	qx = quat.x;
	qy = quat.y;
	qz = quat.z;
	qw = quat.w;

	sqx = qx * qx;
	sqy = qy * qy;
	sqz = qz * qz;

	yaw = Math.atan2(2.0 * (qy * qw - qx * qz), 1.0 - 2.0 * (sqy + sqz));
	pitch = Math.asin(2.0 * (qx * qy + qz * qw));
	roll = Math.atan2(2.0 * (qx * qw - qy * qz), 1.0 - 2.0 * (sqx + sqz));

	gimbaLockTest = qx * qy + qz * qw;
	if (gimbaLockTest > 0.499) {
		yaw = 2.0 * Math.atan2(qx, qw);
		roll = 0;
	} else if (gimbaLockTest < -0.499) {
		yaw = -2.0 * Math.atan2(qx, qw);
		roll = 0;
	}

	result.x = pitch;
	result.y = yaw;
	result.z = roll;

	return result;
}

// -----------------------

var minmaxBox = function (meshes) {
	"use strict";

	var minVector = null,
		maxVector = null,
		i,
		mesh,
		boundingBox,
		rotationMatrix,
		bbMin,
		bbMax;

	// we start at i=1 cause meshes[0] does not contain any geometry
	for (i = 1; i < meshes.length; i += 1) {
		mesh = meshes[i];

		boundingBox = mesh.getBoundingInfo().boundingBox;

		// RotationYawPitchRoll means RotationYrotationXrotationZ
		rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(mesh.rotation.y, mesh.rotation.x, mesh.rotation.z);

		bbMin = BABYLON.Vector3.TransformCoordinates(boundingBox.minimumWorld, rotationMatrix);
		bbMax = BABYLON.Vector3.TransformCoordinates(boundingBox.maximumWorld, rotationMatrix);

		/*console.log(bbMin);
		console.log(bbMax);*/

		/*var tempQuaternion = new BABYLON.Quaternion();
		BABYLON.Quaternion.RotationYawPitchRollToRef(mesh.rotation.y, mesh.rotation.x, mesh.rotation.z, tempQuaternion);
		console.log(mesh.rotation.y+ " "+ mesh.rotation.x+" "+ mesh.rotation.z);
		console.log(tempQuaternion);*/


		if (!minVector) {
			minVector = bbMin;
			maxVector = bbMax;
		} else {
			minVector.MinimizeInPlace(bbMin);
			maxVector.MaximizeInPlace(bbMax);
		}
	}
	return [minVector, maxVector];
};

// -----------------------

function Car(scene, world, bodyMeshPath, bodyMeshName, wheelMeshPath, wheelMeshName,
	bodyMaterial, wheelMaterial,
	wheel_rl_position, wheel_rr_position, wheel_fl_position, wheel_fr_position, options) {
	"use strict";

	options = options || {};

	this.scene = scene;
	this.world = world;

	this.bodyMeshPath = bodyMeshPath;
	this.bodyMeshName = bodyMeshName;

	this.wheelMeshPath = wheelMeshPath;
	this.wheelMeshName = wheelMeshName;

	this.bodyMaterial = bodyMaterial;
	this.wheelMaterial = wheelMaterial;

	this.wheel_rl_position = wheel_rl_position;
	this.wheel_rr_position = wheel_rr_position;
	this.wheel_fl_position = wheel_fl_position;
	this.wheel_fr_position = wheel_fr_position;

	// fields

	this.wheelsOptions = {
		directionLocal: new CANNON.Vec3(0, 0, -1),
		suspensionStiffness: 30,
		suspensionRestLength: 0.1,
		frictionSlip: 5,
		dampingRelaxation: 2.3,
		dampingCompression: 4.4,
		maxSuspensionForce: 100000,
		rollInfluence: 0.01,
		axleLocal: new CANNON.Vec3(0, 1, 0),
		chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
		maxSuspensionTravel: 0.3,
		customSlidingRotationalSpeed: -30,
		useCustomSlidingRotationalSpeed: true
	};

	this.lenk = 0;
	this.dyn = 0;
	this.direction = 1;

	// options

	this.scaleFactor = typeof (options.scaleFactor) === 'number' ? options.scaleFactor : 1;
	var invertX = typeof (options.invertX) === 'boolean' ? options.invertX : false;

	if (invertX) {
		this.scale = new BABYLON.Vector3(-this.scaleFactor, this.scaleFactor, this.scaleFactor);
	} else {
		this.scale = new BABYLON.Vector3(this.scaleFactor, this.scaleFactor, this.scaleFactor);
	}

	this.shadowGenerator = typeof (options.shadowGenerator) === 'object' ? options.shadowGenerator : null;

	this.bodyMass = typeof (options.bodyMass) === 'number' ? options.bodyMass : 0;

	this.firstPos = typeof (options.firstPos) === 'CANNON.Vec3' ? options.firstPos : new CANNON.Vec3(0, 0, 0);

	this.bodyCollisionFilterGroup = typeof (options.bodyCollisionFilterGroup) === 'number' ? options.bodyCollisionFilterGroup : 0;
	this.bodyCollisionFilterMask = typeof (options.bodyCollisionFilterMask) === 'number' ? options.bodyCollisionFilterMask : 0;

	this.msgCallback = typeof (options.msgCallback) === 'function' ? options.msgCallback : null;
	this.onLoadSuccess = typeof (options.onLoadSuccess) === 'function' ? options.onLoadSuccess : null;

	// private functions

	Car.prototype._babylon_addBody = function (meshes) {
		
		var rvCorrectionQuat, r, j;

		// meshes[0] has no geometry
		this.b_bodyRoot = meshes[0];
		this.b_bodyRoot.name = this.bodyMeshName;

		// re-orient body to match cannon "raycast vehicle" orientation
		rvCorrectionQuat = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), Math.PI / 2);

		//var r = rvCorrectionQuat.toEulerAngles();
		r = toEulerAngles(rvCorrectionQuat); // use 1.14 code

		for (j = 1; j < meshes.length; j += 1) {
			meshes[j].rotationQuaternion = rvCorrectionQuat;
			meshes[j].rotation = new BABYLON.Vector3(r.x, r.y, r.z); // Euler
		}

		// scaling
		this.b_bodyRoot.scaling = this.scale;

		// shadows
		if (this.shadowGenerator !== null) {
			for (j = 1; j < meshes.length; j += 1) {
				this.shadowGenerator.getShadowMap().renderList.push(meshes[j]);
			}
		}

		//meshes[1].showBoundingBox = true;
		this.approxBox = meshes[1]; // TODO pas propre
	};

	//

	Car.prototype._cannon_addBody = function (vectors) {
		
		var halfextents, chassisShape;
		
		halfextents = vectors[0].negate().add(vectors[1]);
		halfextents.scaleInPlace(0.5);
		halfextents.x = Math.abs(halfextents.x);
		halfextents.y = Math.abs(halfextents.y);
		halfextents.z = Math.abs(halfextents.z);

		// scaling
		halfextents.scaleInPlace(this.scaleFactor); // alert(halfextents.x + " " + halfextents.y + " " + halfextents.z);

		// create rigid body
		// cannon.js and babylon-1.14.0.js have different axis system => invert y and z coordinates
		chassisShape = new CANNON.Box(new CANNON.Vec3(halfextents.x, halfextents.z, halfextents.y));
		this.c_bodyRoot = new CANNON.Body({
			mass: this.bodyMass, // Kg
			material: this.bodyMaterial
		});
		this.c_bodyRoot.addShape(chassisShape);

		if (this.bodyCollisionFilterGroup !== 0) {
			this.c_bodyRoot.collisionFilterGroup = this.bodyCollisionFilterGroup;
			this.c_bodyRoot.collisionFilterMask = this.bodyCollisionFilterMask;
		}

		// set position
		this.c_bodyRoot.position.set(this.firstPos.x, this.firstPos.y, this.firstPos.z);

		// update world
		this.world.add(this.c_bodyRoot);

		// Create the vehicle
		this.vehicle = new CANNON.RaycastVehicle({
			chassisBody: this.c_bodyRoot
		});
	};

	//

	Car.prototype._loadWheels = function () {

		var car = this;
		BABYLON.SceneLoader.ImportMesh("", this.wheelMeshPath, this.wheelMeshName, this.scene, function (meshes) {

			// Babylon
			car._babylon_addWheels(meshes);

			// Cannon
			car._cannon_addWheels(minmaxBox(meshes));
		});
	};

	//

	Car.prototype._babylon_addWheels = function (meshes) {

		var wheelBody_rl, wheelBody_rr, wheelBody_fl, wheelBody_fr, rvCorrectionQuat, mesh, j;
		
		// rear left wheel
		wheelBody_rl = meshes[0];
		wheelBody_rl.scaling = this.scale;
		if (this.shadowGenerator !== null) {
			for (j = 1; j < meshes.length; j += 1) {
				this.shadowGenerator.getShadowMap().renderList.push(meshes[j]);
			}
		}

		// re-orient body to match cannon "raycast vehicle" orientation
		rvCorrectionQuat = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), Math.PI / 2);
		for (j = 1; j < meshes.length; j += 1) {
			meshes[j].rotationQuaternion = rvCorrectionQuat;
		}

		// rear right wheel
		wheelBody_rr = new BABYLON.Mesh("", this.scene);
		for (j = 1; j < meshes.length; j += 1) {
			mesh = meshes[j].createInstance("");
			mesh.parent = wheelBody_rr;

			if (this.shadowGenerator !== null) {
				this.shadowGenerator.getShadowMap().renderList.push(mesh);
			}
		}
		wheelBody_rr.scaling = this.scale;


		// front left wheel
		wheelBody_fl = new BABYLON.Mesh("", this.scene);
		for (j = 1; j < meshes.length; j += 1) {
			mesh = meshes[j].createInstance("");
			mesh.parent = wheelBody_fl;

			if (this.shadowGenerator !== null) {
				this.shadowGenerator.getShadowMap().renderList.push(mesh);
			}
		}
		wheelBody_fl.scaling = this.scale;

		// front right wheel
		wheelBody_fr = new BABYLON.Mesh("", this.scene);
		for (j = 1; j < meshes.length; j += 1) {
			mesh = meshes[j].createInstance("");
			mesh.parent = wheelBody_fr;

			if (this.shadowGenerator !== null) {
				this.shadowGenerator.getShadowMap().renderList.push(mesh);
			}
		}
		wheelBody_fr.scaling = this.scale;

		this.b_wheels = [];
		this.b_wheels.push(wheelBody_fr);
		this.b_wheels.push(wheelBody_fl);
		this.b_wheels.push(wheelBody_rr);
		this.b_wheels.push(wheelBody_rl);
	};

	//

	Car.prototype._cannon_addWheels = function (vectors) {

		var radius = Math.abs(vectors[0].y - vectors[1].y) / 2.0 * this.scaleFactor;
		//var height = Math.abs(vectors[0].x - vectors[1].x) / 2. * this.scaleFactor;

		this.wheelsOptions.radius = radius;

		this.wheelsOptions.chassisConnectionPointLocal.set(this.wheel_fr_position.x, this.wheel_fr_position.y,
			this.wheel_fr_position.z);
		this.vehicle.addWheel(this.wheelsOptions);

		this.wheelsOptions.chassisConnectionPointLocal.set(this.wheel_fl_position.x, this.wheel_fl_position.y,
			this.wheel_fl_position.z);
		this.vehicle.addWheel(this.wheelsOptions);

		this.wheelsOptions.chassisConnectionPointLocal.set(this.wheel_rr_position.x, this.wheel_rr_position.y,
			this.wheel_rr_position.z);
		this.vehicle.addWheel(this.wheelsOptions);

		this.wheelsOptions.chassisConnectionPointLocal.set(this.wheel_rl_position.x, this.wheel_rl_position.y,
			this.wheel_rl_position.z);
		this.vehicle.addWheel(this.wheelsOptions);

		//
		this.vehicle.addToWorld(this.world);

		// finish
		if (this.onLoadSuccess !== null) {
			this.onLoadSuccess();
		}
	};
}

//
//  Public
//

Car.prototype.load = function () {
	"use strict";

	if (this.msgCallback) {
		this.msgCallback("make DS3...");
	}

	var car = this;
	BABYLON.SceneLoader.ImportMesh("", this.bodyMeshPath, this.bodyMeshName, this.scene, function (meshes) {

		// Babylon
		car._babylon_addBody(meshes);

		// Cannon
		var vectors = minmaxBox(meshes); // global bounding box
		car._cannon_addBody(vectors);

		// load wheels
		car._loadWheels();
	});
};

Car.prototype.update = function () {
	"use strict";
	
	var multiquat, cylinderCorrectionQuat, t, r;

	// Multiplying Quat f with q - cannon-quats x,z,y,w
	multiquat = function (f, rev, q) {
		return new BABYLON.Quaternion(-f.w * rev * q.x + f.x * -q.w + f.z * q.y - f.y * q.z, -f.w * rev * q.z + f.z * -q.w + f.y * q.x - f.x * q.y, -f.w * rev * q.y + f.y * -q.w + f.x * q.z - f.z * q.x, -f.w * rev * -q.w - f.x * q.x - f.z * q.z - f.y * q.y);
	};

	cylinderCorrectionQuat = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 0, 1), Math.PI);

	// update babylon / physics engine
	t = this.vehicle.chassisBody;
	this.b_bodyRoot.position = new BABYLON.Vector3(t.position.x, t.position.z, t.position.y - 0.02); // TODO 0.02
	this.b_bodyRoot.rotationQuaternion = multiquat(t.quaternion, 1, new BABYLON.Quaternion(0, 0, 0, -1));

	this.vehicle.updateWheelTransform(0);
	t = this.vehicle.getWheelTransformWorld(0);
	this.b_wheels[0].position = new BABYLON.Vector3(t.position.x, t.position.z, t.position.y);
	this.b_wheels[0].rotationQuaternion = multiquat(t.quaternion, 1, new BABYLON.Quaternion(0, 0, 0, -1));

	this.vehicle.updateWheelTransform(1);
	t = this.vehicle.getWheelTransformWorld(1);
	this.b_wheels[1].position = new BABYLON.Vector3(t.position.x, t.position.z, t.position.y);
	this.b_wheels[1].rotationQuaternion = multiquat(t.quaternion, 1, cylinderCorrectionQuat);

	this.vehicle.updateWheelTransform(2);
	t = this.vehicle.getWheelTransformWorld(2);
	this.b_wheels[2].position = new BABYLON.Vector3(t.position.x, t.position.z, t.position.y);
	this.b_wheels[2].rotationQuaternion = multiquat(t.quaternion, 1, new BABYLON.Quaternion(0, 0, 0, -1));

	this.vehicle.updateWheelTransform(3);
	t = this.vehicle.getWheelTransformWorld(3);
	this.b_wheels[3].position = new BABYLON.Vector3(t.position.x, t.position.z, t.position.y);
	this.b_wheels[3].rotationQuaternion = multiquat(t.quaternion, 1, cylinderCorrectionQuat);

	// Follow camera is based on rotation (not quaternion rotation like physics)
	// so we update also rotation (useless if no follow camera is used)
	//var r = this.b_bodyRoot.rotationQuaternion.toEulerAngles();
	r = toEulerAngles(this.b_bodyRoot.rotationQuaternion);
	this.b_bodyRoot.rotation = new BABYLON.Vector3(r.x, r.y, r.z); // Euler

	//console.log(this.getSpeed());
};

// Use CANNON axis
Car.prototype.setPosition = function (pos) {
	"use strict";
	
	this.vehicle.chassisBody.position.set(pos.x, pos.y, pos.z);
	this.vehicle.chassisBody.quaternion.set(0, 0, 0, 1);
	this.vehicle.chassisBody.angularVelocity.set(0, 0, 0);
	this.vehicle.chassisBody.velocity.set(0, 0, 0);
};

Car.prototype.steering = function (maxSteerVal) {
	"use strict";
	
	this.vehicle.setSteeringValue(maxSteerVal, 0);
	this.vehicle.setSteeringValue(maxSteerVal, 1);
};

Car.prototype.brake = function (brakeForce) {
	"use strict";

	this.vehicle.applyEngineForce(0, 0);
	this.vehicle.applyEngineForce(0, 1);

	this.vehicle.setBrake(brakeForce, 0);
	this.vehicle.setBrake(brakeForce, 1);
	this.vehicle.setBrake(brakeForce, 2);
	this.vehicle.setBrake(brakeForce, 3);
};

Car.prototype.accelerate = function (maxForce) {
	"use strict";
	
	this.vehicle.setBrake(0, 0);
	this.vehicle.setBrake(0, 1);
	this.vehicle.setBrake(0, 2);
	this.vehicle.setBrake(0, 3);

	this.vehicle.applyEngineForce(maxForce, 0);
	this.vehicle.applyEngineForce(maxForce, 1);
};

Car.prototype.moves = function (forward, back, left, right, changeDir) {
	"use strict";

	// steering
	if (right === 1 && this.lenk >= -0.5) {
		this.lenk -= 0.010;
		this.steering(this.lenk);
	}

	if (left === 1 && this.lenk <= 0.5) {
		this.lenk += 0.010;
		this.steering(this.lenk);
	}

	if (left === 0 && right === 0) {
		if (this.lenk < 0) {
			this.lenk += 0.010;
			this.steering(this.lenk);
		} else if (this.lenk > 0) {
			this.lenk -= 0.010;
			this.steering(this.lenk);
		}
		if (Math.abs(this.lenk) < 0.010) {
			this.lenk = 0;
			this.steering(this.lenk);
		}
	}

	// accelerate
	if (forward === 1 && this.direction === 1) {

		if (this.getSpeed() < 50) {
			this.dyn = 8000;
		} else { if (this.getSpeed() < 100) {
			this.dyn = 7000;
		} else { if (this.getSpeed() < 150) {
			this.dyn = 6000;
		} else { if (this.getSpeed() < 230) {
			this.dyn = 4000; // speed limit = 230 Km/h
		} else {
			this.dyn = 0;
		} } } }
		this.accelerate(this.dyn);
		
	} else if (forward === 1 && this.direction === -1) {
		
		if (this.getSpeed() < 50) {
			this.dyn = -2000;
		} else {
			this.dyn = 0;
		}
		this.accelerate(this.dyn);
		
	} else {
		this.accelerate(0);
	}

	if (changeDir === 1 && this.getSpeed() < 5) {
		this.direction *= -1;
	}

	if (back === 1) {
		this.dyn = 0;
		var brake = 50;
		/*if(this.getSpeed() < 50) brake = 150;
		else if(this.getSpeed() < 100) brake = 120;
		else if(this.getSpeed() < 150) brake = 80;*/
		this.brake(brake);
	}
};

Car.prototype.createFollowCamera = function () {
	"use strict";

	// FollowCamera >> Follow a mesh through your scene
	// Parameters : name, position, scene
	var camera = new BABYLON.FollowCamera("FollowCam", new BABYLON.Vector3(0, 15, -45), this.scene);
	camera.target = this.b_bodyRoot; // target any mesh or object with a "position" Vector3

	camera.radius = 8; // how far from the object to follow
	camera.heightOffset = 2; // how high above the object to place the camera
	camera.rotationOffset = 90; // the viewing angle
	camera.cameraAcceleration = 0.05; // how fast to move
	camera.maxCameraSpeed = 20; // speed limit

	return camera;
};

Car.prototype.getSpeed = function () {
	"use strict";
	return this.c_bodyRoot.velocity.norm() * 3.6;
};

Car.prototype.getLenk = function () {
	"use strict";
	return this.lenk;
};

Car.prototype.getDirection = function () {
	"use strict";
	return this.direction;
};

Car.prototype.getAltitude = function () {
	"use strict";
	return this.c_bodyRoot.position.z;
};

Car.prototype.getCarMainMesh = function () {
	"use strict";
	return this.approxBox;
};
