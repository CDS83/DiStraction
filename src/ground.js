/**
 * Created by Christophe on 14/12/2014.
 */

/*jslint nomen: true*/
/*jslint vars: true*/
/*jslint plusplus: true*/
/*jslint continue: true*/

/*global BABYLON */
/*global CANNON */
/*global console */

/*global Tree */

function Ground(scene, world, groundPath, groundMesh, groundMeshName, width, groundMaterial, options) {
    "use strict";

    options = options || {};

    this.scene = scene;
    this.world = world;
    this.groundPath = groundPath;
    this.groundMesh = groundMesh;
    this.groundMeshName = groundMeshName;
    this.groundMaterial = groundMaterial;

    this.width = width;
    this.depth = this.width; // width and depth should be equal cause CANNON supports only squares as height fields

    // Options

    this.groundTexture = typeof (options.groundTexture) === 'string' ? options.groundTexture : null;

    this.waterLevel = typeof (options.waterLevel) === 'number' ? options.waterLevel : null;

    this.groundCollisionFilterGroup = typeof (options.groundCollisionFilterGroup) === 'number' ? options.groundCollisionFilterGroup : 0;
    this.groundCollisionFilterMask = typeof (options.groundCollisionFilterMask) === 'number' ? options.groundCollisionFilterMask : 0;

    this.scaleFactor = typeof (options.scaleFactor) === 'number' ? options.scaleFactor : 1;
    this.buildingsScale = new BABYLON.Vector3(this.scaleFactor, this.scaleFactor, this.scaleFactor);

    this.buildingBaseHeight = typeof (options.buildingBaseHeight) === 'number' ? options.buildingBaseHeight : 0;

    this.outlineShaderDeltaHeight = // a small value to raise buildings and trees so that black outline below them can be seen
        typeof (options.outlineShaderDeltaHeight) === 'number' ? options.outlineShaderDeltaHeight : 0;

    this.solidBuildingsPath = typeof (options.solidBuildingsPath) === 'string' ? options.solidBuildingsPath : null;
    this.solidBuildingsName = typeof (options.solidBuildingsPath) === 'string' ? options.solidBuildingsName : null;

    this.buildingsPath = typeof (options.buildingsPath) === 'string' ? options.buildingsPath : null;
    this.buildingsName = typeof (options.buildingsName) === 'string' ? options.buildingsName : null;

    this.treesPath = typeof (options.treesPath) === 'string' ? options.treesPath : null;
    this.treesName = typeof (options.treesName) === 'string' ? options.treesName : null;

    this.particlesPath = typeof (options.particlesPath) === 'string' ? options.particlesPath : null;
    this.particlesName = typeof (options.particlesName) === 'string' ? options.particlesName : null;

    this.buildingCelShading = typeof (options.buildingCelShading) === 'boolean' ? options.buildingCelShading : false;

    this.shadowGenerator = typeof (options.shadowGenerator) === 'object' ? options.shadowGenerator : null;

    this.msgCallback = typeof (options.msgCallback) === 'function' ? options.msgCallback : null;
    this.onLoadFinished = typeof (options.onLoadFinished) === 'function' ? options.onLoadFinished : null;

    //
    // other fields
    //

    this.subdivision = 64; // CONST

    this.shadowRenderList = null;

    // shader materials

    this.buildingsShaderMaterials = [];
    this.flagShaderMaterials = [];
    this.time = 0.0;

    // trees
    // The size (min/max) of the foliage
    this.minSizeBranch = 15;
    this.maxSizeBranch = 20;
    // The size (min/max) of the trunk
    this.minSizeTrunk = 10;
    this.maxSizeTrunk = 15;
    // The radius (min/max) of the trunk
    this.minRadius = 2;
    this.maxRadius = 4;

    var trunksColor, treesColor, outlineColor;

    trunksColor = BABYLON.Color3.FromInts(145, 73, 10);
    this.trunksMaterial = new BABYLON.StandardMaterial("trunk", this.scene);
    this.trunksMaterial.diffuseColor = new BABYLON.Color3(trunksColor.r, trunksColor.g, trunksColor.b);
    this.trunksMaterial.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0);

    treesColor = BABYLON.Color3.FromInts(5, 116, 5);
    this.treesMaterial = new BABYLON.StandardMaterial("tree", this.scene);
    this.treesMaterial.diffuseColor = new BABYLON.Color3(treesColor.r, treesColor.g, treesColor.b);
    this.treesMaterial.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0);

    // outlines

    outlineColor = BABYLON.Color3.FromInts(24, 25, 28);
    this.outlineMaterial = new BABYLON.StandardMaterial("outline", this.scene);
    this.outlineMaterial.diffuseColor = new BABYLON.Color3(outlineColor.r, outlineColor.g, outlineColor.b);
    this.outlineMaterial.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0);
    this.outlineMaterial.backFaceCulling = true;

    this.outlineMeshes = [];

    // Private functions

    Ground.prototype._copyMesh = function (mesh, copyName, scale) {

        var copy = new BABYLON.Mesh(copyName, this.scene, mesh.parent);

        copy.position = new BABYLON.Vector3(mesh.position.x, mesh.position.y, mesh.position.z);
        copy.rotation = new BABYLON.Vector3(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
        copy.scaling = new BABYLON.Vector3(mesh.scaling.x * scale.x, mesh.scaling.y * scale.y, mesh.scaling.z * scale.z);
        copy.computeWorldMatrix(true);

        var vertexData = new BABYLON.VertexData();
        vertexData.positions = [];
        vertexData.indices = [];
        vertexData.normals = [];
        vertexData.uvs = [];

        // vertices
        var i, positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (i = 0; i < positions.length; i++) { vertexData.positions.push(positions[i]); }

        // indices
        var indices = mesh.getIndices();
        for (i = 0; i < indices.length; i++) { vertexData.indices.push(indices[i]); }

        // normals
        var normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        for (i = 0; i < normals.length; i++) { vertexData.normals.push(normals[i]); }

        vertexData.applyToMesh(copy);

        return copy;
    };
    
    /*
    Ground.prototype._copyMesh = function (mesh, copyName) {

        //console.log(mesh.scaling);

        var copy = new BABYLON.Mesh(copyName, this.scene, mesh.parent);

        copy.position = new BABYLON.Vector3(mesh.position[0], mesh.position[1], mesh.position[2]);
        copy.rotation = new BABYLON.Vector3(mesh.rotation[0], mesh.rotation[1], mesh.rotation[2]);
        copy.scaling = new BABYLON.Vector3(mesh.scaling[0], mesh.scaling[1], mesh.scaling[2]);
        copy.rotation = mesh.rotation;
        copy.position = mesh.position;
        copy.scaling = mesh.scaling;
        copy.computeWorldMatrix(true);

        var vertexData = new BABYLON.VertexData();
        vertexData.positions = [];
        vertexData.indices = [];
        vertexData.normals = [];
        vertexData.uvs = [];

        // vertices
        var i, copyVector,
            positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (i = 0; i < positions.length; i += 3) {
            copyVector = new BABYLON.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            vertexData.positions.push(positions[i]);
        }

        // indices
        var indices = mesh.getIndices();
        for (i = 0; i < indices.length; i++) {
            vertexData.indices.push(indices[i]);
        }

        // normals
        var normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        for (i = 0; i < normals.length; i++) {
            copyVector = new BABYLON.Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
            vertexData.normals.push(normals[i]);
        }

        vertexData.applyToMesh(copy);

        return copy;
    };
    */

    Ground.prototype._addOutlineMesh = function (mesh, outlineChildren, parent) {

        var outlineMesh = new BABYLON.Mesh("Outline", this.scene, parent);
        outlineMesh.material = this.outlineMaterial;

        outlineMesh.position = mesh.position;
        outlineMesh.rotation = mesh.rotation;
        outlineMesh.scaling = mesh.scaling;
        outlineMesh.computeWorldMatrix(true);

        var vertexData = new BABYLON.VertexData();
        vertexData.positions = [];
        vertexData.indices = [];
        vertexData.normals = [];
        vertexData.uvs = [];

        // positions
        var worldMatrixWithoutTranslation = outlineMesh.getWorldMatrix().clone();
        worldMatrixWithoutTranslation.setTranslation(BABYLON.Vector3.Zero());

        var invWorldMatrix = outlineMesh.getWorldMatrix().clone();
        invWorldMatrix.invert();

        var positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        var i, localPos = BABYLON.Vector3.Zero();
        for (i = 0; i < positions.length; i += 3) {

            //var localPos = new BABYLON.Vector3( positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2] );

            BABYLON.Vector3.FromArrayToRef(positions, i, localPos);
            var posWithoutTranslation = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrixWithoutTranslation);

            var worldPos = BABYLON.Vector3.TransformCoordinates(localPos, outlineMesh.getWorldMatrix());

            if (posWithoutTranslation.x >= 0.0) {
                worldPos.x += 0.06 * this.scaleFactor / 50.0;
            } else {
                worldPos.x -= 0.06 * this.scaleFactor / 50.0;
            }
            if (posWithoutTranslation.y >= 0.0) {
                worldPos.y += 0.06 * this.scaleFactor / 50.0;
            } else {
                worldPos.y -= 0.06 * this.scaleFactor / 50.0;
            }
            if (posWithoutTranslation.z >= 0.0) {
                worldPos.z += 0.06 * this.scaleFactor / 50.0;
            } else {
                worldPos.z -= 0.06 * this.scaleFactor / 50.0;
            }

            var newLocalPos = BABYLON.Vector3.TransformCoordinates(worldPos, invWorldMatrix);

            vertexData.positions.push(newLocalPos.x);
            vertexData.positions.push(newLocalPos.y);
            vertexData.positions.push(newLocalPos.z);
        }

        // normals
        var normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        for (i = 0; i < normals.length; i++) {
            vertexData.normals.push(normals[i]);
        }

        // invert faces
        var indices = mesh.getIndices();
        for (i = 0; i < indices.length / 3; i++) {
            vertexData.indices.push(indices[i * 3 + 1]);
            vertexData.indices.push(indices[i * 3]);
            vertexData.indices.push(indices[i * 3 + 2]);
        }

        vertexData.applyToMesh(outlineMesh);

        if (outlineChildren) {
            for (i = 0; i < this.scene.meshes.length; i++) {
                var child = scene.meshes[i];
                if (child.parent === mesh) {
                    this._addOutlineMesh(child, false, outlineMesh);
                }
            }
        }

        this.outlineMeshes.push(outlineMesh);
    };

    Ground.prototype._mergeOutlineMeshes = function () {
        if (this.outlineMeshes.length > 0) {
            BABYLON.Mesh.MergeMeshes(this.outlineMeshes, true, true);
        }
    };

    Ground.prototype._moveAndScaleMesh = function (mesh) {
        // move the mesh to the right position (blender scene is "smaller" than BABYLON one)
        mesh.position.scaleInPlace(this.scaleFactor);
        mesh.position.y += this.buildingBaseHeight;

        mesh.scaling.scaleInPlace(this.scaleFactor);

        // https://github.com/BabylonJS/Babylon.js/wiki/How-to-merge-meshes
        mesh.computeWorldMatrix(true); // VERY important (if scaling is not included in world matrix, it will not be taken into account in mergeMeshes for example)
    };

    Ground.prototype._addDeltaHeight = function (mesh) {
        mesh.position.y += this.outlineShaderDeltaHeight;
        mesh.computeWorldMatrix(true);
    };

    Ground.prototype._createGround = function () {

        if (this.msgCallback) {
            this.msgCallback("create ground...");
        }

        var ground = this;
        BABYLON.SceneLoader.ImportMesh("", this.groundPath, this.groundMesh, this.scene, function (meshes) {

            var i, j;
            for (i = 0; i < meshes.length; i++) {
                var mesh = meshes[i];

                if (mesh.name.indexOf("Water") !== -1) {
                    mesh.receiveShadows = true;
                }
                
                if (mesh.name.indexOf("Support") !== -1) {
                    mesh.receiveShadows = true;
                }

                if (mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) === null) {
                    ground._testEmptyMesh(mesh);
                    continue;
                }

                // The BABYLON file may contain other meshes (different from the ground itself): in this case we load them and continue...
                if (mesh.name !== ground.groundMeshName) {
                    // move the mesh to the right position (blender scene is "smaller" than BABYLON one)
                    ground._moveAndScaleMesh(mesh);
                    mesh.convertToFlatShadedMesh();
                    continue;
                }

                // we load the ground as a mesh then we create a "real" BABYLON ground...
                ground.ground = new BABYLON.GroundMesh("", ground.scene);
                ground.ground._setReady(false);
                ground.ground._subdivisions = ground.subdivision;

                var vertexData = BABYLON.VertexData.CreateGround(ground.width, ground.depth, ground.subdivision);

                if (ground.groundTexture !== null) {
                    var groundMaterial = new BABYLON.StandardMaterial("", ground.scene);
                    groundMaterial.diffuseTexture = new BABYLON.Texture(ground.groundTexture, ground.scene);
                    groundMaterial.backFaceCulling = true;
                    ground.ground.material = groundMaterial;
                }

                var hmPositions = vertexData.positions;

                var positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                var numberOfPoints = positions.length / 3;

                var originalMapWidth = ground.width / ground.scaleFactor;
                for (j = 0; j < numberOfPoints; j++) {
                    var x = positions[j * 3] * mesh.scaling.x;
                    var y = positions[j * 3 + 1] * mesh.scaling.y;
                    var z = positions[j * 3 + 2] * mesh.scaling.z;
                    var xi = Math.round((x + originalMapWidth / 2) * ground.subdivision / originalMapWidth);
                    var zi = Math.round((z + originalMapWidth / 2) * ground.subdivision / originalMapWidth);

                    //console.log(x+" "+y+" "+z);

                    // height map ground coordinates...
                    var xi1 = xi;
                    var zi1 = ground.subdivision - zi;
                    // ... and index
                    var index = xi1 + (ground.subdivision + 1) * zi1;

                    // update heights with mesh height
                    hmPositions[index * 3 + 1] = y * ground.scaleFactor + ground.buildingBaseHeight;
                }

                // Normals
                var hmNormals = vertexData.normals;
                var hmIndices = vertexData.indices;
                BABYLON.VertexData.ComputeNormals(hmPositions, hmIndices, hmNormals);

                // update height field with new buffer
                vertexData.applyToMesh(ground.ground, false);
                ground.ground._setReady(true);

                // finally...
                //ground.ground.convertToFlatShadedMesh();

                // delete temporary mesh
                mesh.dispose();

                // shadows
                ground.ground.receiveShadows = true;

                // wireframe
                /*var wireFrameCopy = ground.ground.clone("x");
                var groundMaterial2 = new BABYLON.StandardMaterial("", ground.scene);
                groundMaterial2.diffuseColor = new BABYLON.Color3(1.,1.,1.);
                groundMaterial2.alpha = 0.8;
                groundMaterial2.wireframe = true;
                wireFrameCopy.material = groundMaterial2;*/

                ground._createCannonHeightfield();
            }
        });

    };

    Ground.prototype._createCannonHeightfield = function () {

        // Create CANNON height matrix
        var x, y, z = 0;
        var hmPositions = this.ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        var matrix = [],
            i,
            j;
        for (i = 0; i <= this.subdivision; i++) {
            matrix.push([]);
            //x = -this.width/2 + i * this.width/this.subdivision;

            for (j = 0; j <= this.subdivision; j++) {
                /*z = -this.depth/2 + j * this.depth/this.subdivision;
                y = groundCopy.getHeightAtCoordinates(x, z)
                console.log( x + " " + y + " " + z);*/

                var index = i + (this.subdivision + 1) * (this.subdivision - j);
                y = hmPositions[index * 3 + 1];
                //console.log( y);

                matrix[i].push(y);
            }
        }

        // Crate shape
        var hfShape = new CANNON.Heightfield(matrix, {
            elementSize: this.width / this.subdivision
        });

        this.groundBody = new CANNON.Body({
            mass: 0, // 0 = ground won't move
            material: this.groundMaterial
        });
        this.groundBody.addShape(hfShape);
        this.groundBody.position.set(-this.width / 2, -this.depth / 2, 0); // center ground at (0,0,heightDelta)

        this.groundBody.collisionFilterGroup = this.groundCollisionFilterGroup;
        this.groundBody.collisionFilterMask = this.groundCollisionFilterMask;

        this.world.add(this.groundBody);

        if (this.waterLevel !== null) {
            this.addWater();
        }

        if (this.solidBuildingsName !== null) {
            this._loadSolidBuildings();
        } else {
            if (this.buildingsName !== null) {
                this._load3dBuildings();
            } else {
                if (this.onLoadFinished !== null) {
                    this.onLoadFinished();
                }
            }
        }
    };

    Ground.prototype._testEmptyMesh = function (mesh) {

        var i, hasChildren = false;
        for (i = 0; i < this.scene.meshes.length; i++) {
            var child = this.scene.meshes[i];
            if (child.parent === mesh) {
                hasChildren = true;
                break;
            }
        }

        if (hasChildren) {
            mesh.setEnabled(true); // necessary to see meshes under "empty" Blender meshes - they can't be enabled while exporting
        } else {
            mesh.dispose(); // destroy meshes with no geometry and no children
        }

    };

    Ground.prototype._loadSolidBuildings = function () {

        this.msgCallback("construct buildings...");

        var ground = this;
        BABYLON.SceneLoader.ImportMesh("", this.solidBuildingsPath, this.solidBuildingsName, this.scene, function (meshes) {

            var buildingsList = [],
                bridgesList = [],
                i;

            for (i = 0; i < meshes.length; i++) {
                var mesh = meshes[i];

                if (mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) === null) {
                    ground._testEmptyMesh(mesh);
                    continue;
                }

                // move the mesh to the right position (blender scene is "smaller" than BABYLON one)
                ground._moveAndScaleMesh(mesh);

                if (ground.buildingCelShading) { ground._addDeltaHeight(mesh); }

                //console.log(mesh.name);
                ground._createCannonBuilding(mesh);

                if (mesh.isVisible === false) {
                    mesh.dispose();
                    continue;
                }

                if (ground.buildingCelShading) { ground._addOutlineMesh(mesh); }

                // convert BABYLON meshes to flat shaded fo better look
                // avoid do this at the beginning cause it creates new vertices (it makes every vertex in one face only) and normals
                mesh.convertToFlatShadedMesh();

                // shadows
                /*if (ground.shadowGenerator !== null)
                    ground.shadowGenerator.getShadowMap().renderList.push( mesh );*/

                if (mesh.parent) {
                    if (mesh.parent.name.indexOf("Building") !== -1) {
                        buildingsList.push(mesh);
                    }
                    if (mesh.parent.name.indexOf("Bridges") !== -1) {
                        bridgesList.push(mesh);
                    }
                }

                // wireframe
                /*var wireFrameCopy = mesh.clone();
                var groundMaterial2 = new BABYLON.StandardMaterial("", ground.scene);
                groundMaterial2.diffuseColor = new BABYLON.Color3(.4,.4,.4);
                groundMaterial2.alpha = 0.8;
                groundMaterial2.wireframe = true;
                wireFrameCopy.material = groundMaterial2;*/
            }

            if (buildingsList.length > 0) {

                if (ground.shadowGenerator !== null) { ground._setShadowImpostor(buildingsList); }

                var buildings = BABYLON.Mesh.MergeMeshes(buildingsList, true, false);
                if (ground.buildingCelShading) { ground._setCellShading(buildings, true); }

                //if (ground.shadowGenerator !== null) { ground.shadowGenerator.getShadowMap().renderList.push(buildings); }
                //buildings.receiveShadows = true;
            }
            if (bridgesList.length > 0) {

                //if (ground.shadowGenerator !== null) { ground._setShadowImpostor(bridgesList); }

                var bridges = BABYLON.Mesh.MergeMeshes(bridgesList, true, false);
                if (ground.buildingCelShading) { ground._setCellShading(bridges, true); }

                if (ground.shadowGenerator !== null) { ground.shadowGenerator.getShadowMap().renderList.push(bridges); }
                //bridges.receiveShadows = true;
            }

            if (ground.buildingsName !== null) {
                ground._load3dBuildings();
            } else {
                if (ground.treesName !== null) {
                    ground._loadTrees();
                } else {
                    if (ground.onLoadFinished !== null) {
                        ground._mergeOutlineMeshes();
                        ground.onLoadFinished();
                    }
                }
            }
        });
    };

    Ground.prototype._createCannonBuilding = function (mesh) {

        // Multiplying Quat f with q - cannon-quats x,z,y,w
        var multiquat = function (f, rev, q) {
            return new CANNON.Quaternion(-f.w * rev * q.x + f.x * -q.w + f.z * q.y - f.y * q.z, -f.w * rev * q.z + f.z * -q.w + f.y * q.x - f.x * q.y, -f.w * rev * q.y + f.y * -q.w + f.x * q.z - f.z * q.x, -f.w * rev * -q.w - f.x * q.x - f.z * q.z - f.y * q.y);
        };

        var positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

        //
        // create a CANNON convex polyhedron for each mesh
        //
        var numberOfPoints = positions.length / 3;

        var indices = mesh.getIndices();
        var numberOfFaces = indices.length / 3;

        // compute normals for each triangle
        var j, i1, i2, i3, v1, v2, normal, normalsTmp = [];
        for (j = 0; j < numberOfFaces; j++) {
            i1 = indices[j * 3];
            i2 = indices[j * 3 + 1];
            i3 = indices[j * 3 + 2];
            v1 = new BABYLON.Vector3(positions[i2 * 3] - positions[i1 * 3],
                positions[i2 * 3 + 1] - positions[i1 * 3 + 1],
                positions[i2 * 3 + 2] - positions[i1 * 3 + 2]);
            v2 = new BABYLON.Vector3(positions[i3 * 3] - positions[i1 * 3],
                positions[i3 * 3 + 1] - positions[i1 * 3 + 1],
                positions[i3 * 3 + 2] - positions[i1 * 3 + 2]);
            normal = BABYLON.Vector3.Normalize(BABYLON.Vector3.Cross(v1, v2));
            normalsTmp.push(normal);
        }

        // create CANNON vertices
        var xScaleFactor = mesh.scaling.x;
        var yScaleFactor = mesh.scaling.y;
        var zScaleFactor = mesh.scaling.z;

        var points = [];
        for (j = 0; j < numberOfPoints; j++) {
            var p = new CANNON.Vec3(positions[j * 3] * xScaleFactor, positions[j * 3 + 2] * zScaleFactor, positions[j * 3 + 1] * yScaleFactor); // do not forget to invert z and y from BABYLON to CANNON !
            points.push(p);
        }

        // create CANNON 4-vertices faces
        var k, i4, faces = [];
        for (j = 0; j < numberOfFaces; j++) {
            for (k = j + 1; k < numberOfFaces; k++) {
                v1 = normalsTmp[j];
                v2 = normalsTmp[k];

                if (BABYLON.Vector3.Cross(v1, v2).length() < 0.0001) {
                    i1 = indices[j * 3];
                    i2 = indices[j * 3 + 1];
                    i3 = indices[j * 3 + 2];
                    i4 = -1;

                    if (indices[k * 3] !== i1 && indices[k * 3] !== i2 && indices[k * 3] !== i3) {
                        i4 = indices[k * 3];
                    } else {
                        if (indices[k * 3 + 1] !== i1 && indices[k * 3 + 1] !== i2 && indices[k * 3 + 1] !== i3) {
                            i4 = indices[k * 3 + 1];
                        } else {
                            if (indices[k * 3 + 2] !== i1 && indices[k * 3 + 2] !== i2 && indices[k * 3 + 2] !== i3) {
                                i4 = indices[k * 3 + 2];
                            }
                        }
                    }

                    var v = new BABYLON.Vector3(positions[i4 * 3] - positions[i1 * 3], positions[i4 * 3 + 1] - positions[i1 * 3 + 1], positions[i4 * 3 + 2] - positions[i1 * 3 + 2]);
                    v = BABYLON.Vector3.Normalize(v);

                    // if the 4 points are coplanar we have a new 4 points face
                    if (BABYLON.Vector3.Dot(v, v1) < 0.0001) {
                        var f = [i1, i2, i3, i4];
                        faces.push(f);
                    }
                }
            }
        }

        // create CANNON polyhedron
        var polyShape = new CANNON.ConvexPolyhedron(points, faces);
        var building = new CANNON.Body({
            mass: 0,
            material: this.groundMaterial
        });
        building.addShape(polyShape);

        building.position.set(mesh.position.x, mesh.position.z, mesh.position.y);

        // RotationYawPitchRoll means RotationYrotationXrotationZ
        var rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(mesh.rotation.y, mesh.rotation.x, mesh.rotation.z);
        building.quaternion = multiquat(rotationQuaternion, 1, new CANNON.Quaternion(0, 0, 0, -1));

        //TODO add if
        building.collisionFilterGroup = this.groundCollisionFilterGroup;
        building.collisionFilterMask = this.groundCollisionFilterMask;

        this.world.add(building);
    };

    /*
    Load simple 3D buildings, that is elements without physics counterpart
    This function assume all the element have the same material (except flag)
    Only two meshes (with and without shadows) are generated to optimize performance
     */
    Ground.prototype._load3dBuildings = function () {

        if (this.msgCallback) {
            this.msgCallback("make special buildings and monuments...");
        }

        var ground = this;
        BABYLON.SceneLoader.ImportMesh("", this.buildingsPath, this.buildingsName, this.scene, function (meshes) {

            var meshWithShadowsList = [],
                meshWithoutShadowsList = [],
                i,
                mesh,
                shadow;

            for (i = 0; i < meshes.length; i++) {
                mesh = meshes[i];

                if (mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) === null) {
                    ground._testEmptyMesh(mesh);
                    continue;
                }

                // move the mesh to the right position (blender scene is "smaller" than BABYLON one)
                ground._moveAndScaleMesh(mesh);

                if (mesh.name.indexOf("Flag") !== -1) {
                    ground._setFlagShader(mesh);
                    continue;
                }

                if (ground.buildingCelShading) {
                    //ground._setCellShading( mesh );
                    ground._addDeltaHeight(mesh);
                    ground._addOutlineMesh(mesh);
                }

                if (meshes[i].name.indexOf("Sphere") === -1 && meshes[i].name.indexOf("Sacre") === -1) { /*&& meshes[i].name.indexOf("Arc") == -1*/
                    meshes[i].convertToFlatShadedMesh();
                }

                shadow = true;
                if (mesh.parent) {
                    if (mesh.parent.name.indexOf("no shadow") !== -1) {
                        shadow = false;
                    }
                }

                // shadows
                if (ground.shadowGenerator !== null) {
                    meshWithShadowsList.push(mesh);
                } else {
                    meshWithoutShadowsList.push(mesh);
                }
            }

            // merge meshes and add shadows
            if (meshWithShadowsList.length > 0) {
                if (ground.shadowGenerator !== null) { ground._setShadowImpostor(meshWithShadowsList); }

                var buildings = BABYLON.Mesh.MergeMeshes(meshWithShadowsList, true, true); // allow 32 bits vertices for large meshes
                if (ground.buildingCelShading) { ground._setCellShading(buildings, true); }
                
                //if (ground.shadowGenerator !== null) { ground.shadowGenerator.getShadowMap().renderList.push(buildings); }
            }
            if (meshWithoutShadowsList.length > 0) {
                BABYLON.Mesh.MergeMeshes(meshWithoutShadowsList, true, false);
            }

            if (ground.treesName !== null) {
                ground._loadTrees();
            } else {
                if (ground.onLoadFinished !== null) {
                    ground._mergeOutlineMeshes();
                    ground.onLoadFinished();
                }
            }
        });
    };

    Ground.prototype._loadTrees = function () {

        if (this.msgCallback) {
            this.msgCallback("plant trees...");
        }

        var randomNumber = function (min, max) {
            if (min === max) {
                return (min);
            }
            var random = Math.random();
            return ((random * (max - min)) + min);
        };

        var ground = this;
        BABYLON.SceneLoader.ImportMesh("", this.treesPath, this.treesName, this.scene, function (meshes) {

            var treesList = [],
                trunkList = [],
                i,
                mesh;

            for (i = 0; i < meshes.length; i++) {
                mesh = meshes[i];

                if (mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) === null) {
                    ground._testEmptyMesh(mesh);
                    continue;
                }

                // move the mesh to the right position (blender scene is "smaller" than BABYLON one)
                ground._moveAndScaleMesh(mesh);

                var size = randomNumber(ground.minSizeBranch, ground.maxSizeBranch),
                    sizeTrunk = randomNumber(ground.minSizeTrunk, ground.maxSizeTrunk),
                    radius = randomNumber(ground.minRadius, ground.maxRadius);

                var tree = new Tree(size, sizeTrunk, radius, ground.scene); /*, ground.shadowGenerator*/
                tree.scaling = new BABYLON.Vector3(0.3, 0.3, 0.3);
                tree.scaling.scaleInPlace(ground.scaleFactor / 50.0);
                tree.position.x = mesh.position.x;
                tree.position.y *= 0.3;
                tree.position.y += mesh.position.y;
                tree.position.z = mesh.position.z;

                ground._createCannonTrunk(tree.trunk, mesh.position);

                mesh.dispose();

                // cel-shading & outlines
                if (ground.buildingCelShading) {
                    //ground._setCellShading(tree);
                    ground._addDeltaHeight(tree);
                    ground._addOutlineMesh(tree, true);

                    //ground._setCellShading(tree.trunk);
                }

                // mandatory for mesh merging
                tree.computeWorldMatrix(true);
                tree.trunk.computeWorldMatrix(true);

                treesList.push(tree);
                trunkList.push(tree.trunk);
            }

            // leave trunks first and trees after
            if (trunkList.length > 0) {
                var trunks = BABYLON.Mesh.MergeMeshes(trunkList, true, false);
                if (ground.shadowGenerator !== null) {
                    ground.shadowGenerator.getShadowMap().renderList.push(trunks);
                }

                trunks.material = ground.trunksMaterial;
            }
            if (treesList.length > 0) {
                var trees = BABYLON.Mesh.MergeMeshes(treesList, true, false);
                if (ground.shadowGenerator !== null) {
                    ground.shadowGenerator.getShadowMap().renderList.push(trees);
                }

                trees.material = ground.treesMaterial;
            }

            // merge all buildings outlines
            ground._mergeOutlineMeshes();

            if (ground.particlesName !== null) {
                ground._loadParticles();
            } else {
                if (ground.onLoadFinished !== null) {
                    ground.onLoadFinished();
                }
            }
        });
    };

    Ground.prototype._createCannonTrunk = function (trunk, treePosition) {
        var boundingBox = trunk.getBoundingInfo().boundingBox;
        var bbMin = boundingBox.minimumWorld;
        var bbMax = boundingBox.maximumWorld;

        var halfextents = bbMin.negate().add(bbMax);
        halfextents.scaleInPlace(0.5);
        halfextents.x = Math.abs(halfextents.x);
        halfextents.y = Math.abs(halfextents.y);
        halfextents.z = Math.abs(halfextents.z);

        halfextents.scaleInPlace(0.3);

        var trunkShape = new CANNON.Box(new CANNON.Vec3(halfextents.x, halfextents.z, halfextents.y));
        var trunkBody = new CANNON.Body({
            mass: 0,
            material: this.groundMaterial
        });
        trunkBody.addShape(trunkShape);

        // TODO add if
        trunkBody.collisionFilterGroup = this.groundCollisionFilterGroup;
        trunkBody.collisionFilterMask = this.groundCollisionFilterMask;

        // set position
        trunkBody.position.set(treePosition.x, treePosition.z + halfextents.z / 2, treePosition.y);

        // update world
        this.world.add(trunkBody);
    };

    Ground.prototype._loadParticles = function () {

        if (this.msgCallback) {
            this.msgCallback("turn on fountains and smoke...");
        }
        
        var mesh, i, ground = this;
        BABYLON.SceneLoader.ImportMesh("", this.particlesPath, this.particlesName, this.scene, function (meshes) {

            for (i = 0; i < meshes.length; i++) {
                mesh = meshes[i];

                if (mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) === null) {
                    ground._testEmptyMesh(mesh);
                    continue;
                }

                // move the mesh to the right position (blender scene is "smaller" than BABYLON one)
                ground._moveAndScaleMesh(mesh);

                var particleSystem = new BABYLON.ParticleSystem("particles", 4000, ground.scene);
                particleSystem.disposeOnStop = true;
                particleSystem.targetStopDuration = 0;

                particleSystem.emitter = mesh.position;

                if (mesh.parent) {
                    if (mesh.parent.name.indexOf("Smoke") !== -1) {
                        particleSystem.particleTexture = new BABYLON.Texture("pics/smoke.png", ground.scene); // TODO
                        particleSystem.minAngularSpeed = -1.5;
                        particleSystem.maxAngularSpeed = 4;
                        particleSystem.minSize = 0.1;
                        particleSystem.maxSize = 0.5;
                        particleSystem.minLifeTime = 0.5;
                        particleSystem.maxLifeTime = 2.0;
                        particleSystem.minEmitPower = 0.1;
                        particleSystem.maxEmitPower = 0.3;
                        particleSystem.emitRate = 400;
                        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
                        //particleSystem.minEmitBox = new BABYLON.Vector3(0, 0, 0);
                        //particleSystem.maxEmitBox = new BABYLON.Vector3(0, 0, 0);
                        particleSystem.direction1 = new BABYLON.Vector3(-0.1, 25, -0.1);
                        particleSystem.direction2 = new BABYLON.Vector3(0.2, 12, 0.2);
                        particleSystem.color1 = new BABYLON.Color4(0.2, 0.2, 0.2, 0.5);
                        particleSystem.color2 = new BABYLON.Color4(0.6, 0.6, 0.6, 0.1);
                        particleSystem.colorDead = new BABYLON.Color4(0.8, 0.8, 0.8, 0.2);
                        particleSystem.gravity = new BABYLON.Vector3(-0.5, 0.5, 0.5);
                        particleSystem.start();
                    }

                    if (mesh.parent.name.indexOf("Fountain") !== -1) {
                        particleSystem.particleTexture = new BABYLON.Texture("pics/water.png", ground.scene); // TODO
                        particleSystem.minAngularSpeed = -1.5;
                        particleSystem.maxAngularSpeed = 1.5;
                        particleSystem.minSize = 0.1;
                        particleSystem.maxSize = 0.5;
                        particleSystem.minLifeTime = 0.5;
                        particleSystem.maxLifeTime = 2.0;
                        particleSystem.minEmitPower = 0.5;
                        particleSystem.maxEmitPower = 1.0;
                        particleSystem.emitRate = 300;
                        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
                        particleSystem.direction1 = new BABYLON.Vector3(-2, 8, -2);
                        particleSystem.direction2 = new BABYLON.Vector3(2, 8, 2);
                        particleSystem.color1 = new BABYLON.Color4(54 / 255, 159 / 255, 207 / 255, 0.9);
                        particleSystem.color2 = new BABYLON.Color4(22 / 255, 106 / 255, 145 / 255, 0.8);
                        particleSystem.colorDead = new BABYLON.Color4(1, 1, 1, 1);
                        particleSystem.gravity = new BABYLON.Vector3(0, -9, 0);
                        particleSystem.start();
                    }
                }

                mesh.dispose();
            }

            if (ground.onLoadFinished !== null) {
                ground.onLoadFinished();
            }
        });

    };

    //
    //  Shadows & shaders
    //

    Ground.prototype._setShadowImpostor = function (meshList) {

        var i, impostor, impostorsList = [];
        for (i = 0; i < meshList.length; i++) {
            impostor = this._copyMesh(meshList[i], "copy", new BABYLON.Vector3(0.98, 0.98, 0.98));
            //impostor.scaling.scaleInPlace(0.985);
            impostor.computeWorldMatrix(true);
            impostorsList.push(impostor);
        }
        var merge = BABYLON.Mesh.MergeMeshes(impostorsList, true, true);
        this.shadowGenerator.getShadowMap().renderList.push(merge);
        merge.visibility = 0.0;
    };

    Ground.prototype._setCellShading = function (mesh, receiveShadow) {
        receiveShadow = typeof receiveShadow !== 'undefined' ? receiveShadow : false;

        var diffuseColor = mesh.material !== null ? mesh.material.diffuseColor : null;

        if (diffuseColor) {

            var shaderMaterial = new BABYLON.ShaderMaterial("", this.scene, "./shaders/cellShading", {
                attributes: ["position", "normal"],
                uniforms: ["world", "view", "worldViewProjection", "lightMatrix", "light0Pos"]
            });

            shaderMaterial.setTexture("shadowSampler", this.shadowGenerator.getShadowMapForRendering());

            shaderMaterial.setVector3("diffuseColor", new BABYLON.Vector3(diffuseColor.r, diffuseColor.g, diffuseColor.b));
            shaderMaterial.backFaceCulling = true;

            mesh.material = shaderMaterial;
            this.buildingsShaderMaterials.push(shaderMaterial);
        }
    };

    Ground.prototype._setFlagShader = function (mesh) {
        var shaderMaterial = new BABYLON.ShaderMaterial("", this.scene, "./shaders/flag", {
            attributes: ["position", "uv"],
            uniforms: ["worldViewProjection"]
        });

        var flagTexture = new BABYLON.Texture("./pics/flag.png", this.scene); // TODO

        shaderMaterial.setFloat("pole_x", -0.053);
        shaderMaterial.setTexture("textureSampler", flagTexture);
        shaderMaterial.setFloat("time", 0.0);

        shaderMaterial.backFaceCulling = false;

        mesh.material = shaderMaterial;
        this.flagShaderMaterials.push(shaderMaterial);
    };
}

//
//  Public
//

Ground.prototype.load = function () {
    "use strict";
    this._createGround();
};

Ground.prototype.addWater = function () {
    "use strict";

    this.water = BABYLON.Mesh.CreateGround("", this.width, this.width, 1, this.scene);
    this.water.position = new BABYLON.Vector3(0, this.waterLevel, 0);

    var waterMaterial = new BABYLON.StandardMaterial("", this.scene);
    waterMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.3, 1);

    this.water.material = waterMaterial;

    // shadows
    this.water.receiveShadows = true;
};

Ground.prototype.updateShaders = function (cameraPosition) {
    "use strict";

    var i;
    for (i = 0; i < this.buildingsShaderMaterials.length; i++) {
        //this.buildingsShaderMaterials[i].setVector3("cameraPosition", cameraPosition);
        this.buildingsShaderMaterials[i].setMatrix("lightMatrix", this.shadowGenerator.getTransformMatrix());
        this.buildingsShaderMaterials[i].setVector3("light0Pos", this.shadowGenerator.getLight().position);
        //this.buildingsShaderMaterials[i].setTexture( "shadowSampler", this.shadowGenerator.getShadowMapForRendering() );
        //console.log( this.shadowGenerator.getLight().getWorldMatrix().m[0] );
    }

    for (i = 0; i < this.flagShaderMaterials.length; i++) {
        this.flagShaderMaterials[i].setFloat("time", this.time);
        this.time += 0.02;
    }
};