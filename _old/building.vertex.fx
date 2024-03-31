precision mediump float;

// Attributes
attribute vec3 position;
attribute vec3 normal;

// Uniforms
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 worldViewProjection;
uniform vec3 cameraPosition;

// Varying
varying vec3 vPositionW;
varying vec3 vNormalW;
varying float moved;

void main(void) {

    moved = 0.;
    vec4 worldPos = world * vec4(position, 1.0);

    vPositionW = vec3(world * vec4(position, 1.0));
    vNormalW = normalize(vec3(world * vec4(normal, 0.0)));
    vec3 viewDirectionW = normalize(cameraPosition - vPositionW);
    float viewScalarNorm = dot(viewDirectionW, vNormalW);

    if(viewScalarNorm < 0.) {

        mat3 mRotScaleL3 = mat3( world );           // remove translation...
        mat4 mRotScaleL = mat4( mRotScaleL3 );      // ... in two steps
        vec4 v = mRotScaleL * vec4(position, 1.0);  // get the vertex position in local space (i.e. with rotation and scaling, but scaling is not important)
        v = normalize( v );

        if(v.x>0.) worldPos.x += 0.06; else worldPos.x -= 0.06;
        if(v.y>0.) worldPos.y += 0.06; else worldPos.y -= 0.06;
        if(v.z>0.) worldPos.z += 0.06; else worldPos.z -= 0.06;

        /*worldPos.x += v.x * 0.06;
        worldPos.y += v.y * 0.06;
        worldPos.z += v.z * 0.06;*/

        moved= 1.;
    }

    //vec4 outPosition = worldViewProjection * vec4(v, 1.0);
    vec4 outPosition = projection * view * worldPos;

    gl_Position = outPosition;
}
