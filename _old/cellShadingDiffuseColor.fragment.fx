precision highp float;

// Lights
varying vec3 vPositionW;
varying vec3 vNormalW;
//varying vec2 vUV;

// Refs
uniform vec3 diffuseColor;
//uniform sampler2D textureSampler;

void Thresholds(in vec3 diffuseColor, out vec3 pixelColor) {

    float ToonThresholds[4];
    ToonThresholds[0] = 0.95;
    ToonThresholds[1] = 0.5;
    ToonThresholds[2] = 0.2;
    ToonThresholds[3] = 0.03;

    float ToonBrightnessLevels[5];
    ToonBrightnessLevels[0] = 1.0;
    ToonBrightnessLevels[1] = 1.0;
        ToonBrightnessLevels[2] = 1.;
        ToonBrightnessLevels[3] = 1.;
        ToonBrightnessLevels[4] = 1.;
    /*ToonBrightnessLevels[1] = 0.8;
    ToonBrightnessLevels[2] = 0.6;
    ToonBrightnessLevels[3] = 0.35;
    ToonBrightnessLevels[4] = 0.2;*/

    // put the light center far away (*100) to simulate directional parallel rays (like directional BABYLON light)
    vec3 vLightPosition = vec3(-150*100, 800*100, 150*100);  // TODO

    // Light
    vec3 lightVectorW = normalize(vLightPosition - vPositionW);

    // diffuse
    float ndl = max(0., dot(vNormalW, lightVectorW));

    //vec3 color = texture2D(textureSampler, vUV).rgb;
    pixelColor = diffuseColor;

    if (ndl > ToonThresholds[0])
    {
        pixelColor *= ToonBrightnessLevels[0];
    }
    else if (ndl > ToonThresholds[1])
    {
        pixelColor *= ToonBrightnessLevels[1];
    }
    else if (ndl > ToonThresholds[2])
    {
        pixelColor *= ToonBrightnessLevels[2];
    }
    else if (ndl > ToonThresholds[3])
    {
        pixelColor *= ToonBrightnessLevels[3];
    }
    else
    {
        pixelColor *= ToonBrightnessLevels[4];
    }
}

void main(void)
{
    vec3 pixelColor;
    Thresholds(diffuseColor, pixelColor);

    gl_FragColor = vec4(pixelColor, 1.);
}