/**
 * Created by Christophe on 27/01/2015.
 */

/*jslint nomen: true*/

/*global BABYLON */

function Chekpoints(scene, carBox, ground, poiPath, poiMesh, spriteFile, nbSprites, spriteSize, options) {
	"use strict";

	options = options || {};

	this.scene = scene;
	this.carBox = carBox; // car box mesh
	this.ground = ground;

	this.poiPath = poiPath;
	this.poiMesh = poiMesh;
	this.spriteFile = spriteFile;
	this.nbSprites = nbSprites;
	this.spriteSize = spriteSize;

	// Options

	this.msgCallback = typeof (options.msgCallback) === 'function' ? options.msgCallback : null;
	this.chekpointsCallback = typeof (options.chekpointsCallback) === 'function' ? options.chekpointsCallback : null;
	this.onLoadFinished = typeof (options.onLoadFinished) === 'function' ? options.onLoadFinished : null;

	// other fields

    this.enabled = false;
	this.carBox.actionManager = null;

	// Private functions
}

Chekpoints.prototype.load = function () {
	"use strict";

	var spriteManagerCP, checkpoint, i, positions, sprite;

	if (this.msgCallback) {
		this.msgCallback("place checkpoints...");
	}

	this.spriteArray = [];
	this.nbCheckPoints = 0;

	// Create a sprite manager
	spriteManagerCP = new BABYLON.SpriteManager("POImanager", this.spriteFile, this.nbSprites, this.spriteSize, this.scene);

	checkpoint = this;
	BABYLON.SceneLoader.ImportMesh("", this.poiPath, this.poiMesh, this.scene, function (meshes) {

		for (i = 0; i < meshes.length; i += 1) {

			positions = meshes[i].getVerticesData(BABYLON.VertexBuffer.PositionKind);
			if (positions !== null) {

				// move the mesh to the right position (blender scene is "smaller" than BABYLON one)
				checkpoint.ground._moveAndScaleMesh(meshes[i]);

				sprite = new BABYLON.Sprite("poi", spriteManagerCP);
				sprite.size = 0;
				sprite.position = meshes[i].position;

				checkpoint.spriteArray.push([meshes[i], sprite]);
				checkpoint.nbCheckPoints += 1;
			}
		}

		checkpoint.onLoadFinished();
	});
};

Chekpoints.prototype.isEnabled = function () {
	"use strict";
	return this.enabled;
};

Chekpoints.prototype.enableSprites = function () {
	"use strict";

	var i, mesh, sprite, checkpoint, action, catchCheckpointFunc;

	if (this.carBox.actionManager !== null) {
		this.carBox.actionManager.dispose();
	}
	this.carBox.actionManager = new BABYLON.ActionManager(this.scene);

    catchCheckpointFunc = function () {
        var mesh = this.triggerOptions.parameter;
        if (checkpoint.spriteArray[mesh.index][1].size > 0) {
            checkpoint.spriteArray[mesh.index][1].size = 0;
            checkpoint.nbCheckPoints -= 1;
            checkpoint.chekpointsCallback();
        }
        //console.log(mesh.index);
    };
    
	this.nbCheckPoints = 0;
	for (i = 0; i < this.spriteArray.length; i += 1) {

		mesh = this.spriteArray[i][0];
		sprite = this.spriteArray[i][1];

		mesh.index = i;
		sprite.size = 10;

		checkpoint = this;
		action = new BABYLON.ExecuteCodeAction(
			{
				trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
				parameter: mesh
			},
			catchCheckpointFunc
		);

		this.carBox.actionManager.registerAction(action);
		checkpoint.nbCheckPoints += 1;
	}

	this.enabled = true;
};

Chekpoints.prototype.disableSprites = function () {
	"use strict";
	
	var i, sprite;

	if (this.carBox.actionManager !== null) {
		this.carBox.actionManager.dispose();
		this.carBox.actionManager = null;
	}

	for (i = 0; i < this.spriteArray.length; i += 1) {
		sprite = this.spriteArray[i][1];
		sprite.size = 0;
	}

	this.enabled = false;
	this.nbCheckPoints = 0;
};

Chekpoints.prototype.resetSprites = function () {
	"use strict";
	
	var index, other, pos;

	// Intersections in progress
	for (index = 0; index < this.carBox._intersectionsInProgress.length; index += 1) {
		other = this.carBox._intersectionsInProgress[index];
		pos = other._intersectionsInProgress.indexOf(this);
		other._intersectionsInProgress.splice(pos, 1);
	}
	this.carBox._intersectionsInProgress = [];

};

Chekpoints.prototype.getNbCheckPoints = function () {
	"use strict";
	return this.nbCheckPoints;
};
