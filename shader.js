/* ---- WebGL setup ---- */

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl', { antialias: false });
const hasDerivatives = gl.getExtension('OES_standard_derivatives');

/* ---- vertex shader (passthrough fullscreen quad) ---- */

const vertSrc = `#version 100
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/* ---- fragment shader (animated 2D Perlin-ish noise) ---- */

const fragSrc = `#version 100
${hasDerivatives ? '#extension GL_OES_standard_derivatives : enable' : ''}
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_speed;
uniform vec4  u_card;

// ---- tunable knobs ----

const float SCALE     = 72.0;   // zoom-out factor: higher = smaller features
const float SKEW      = 0.6;    // diagonal bias amount
const float THRESHOLD = 0.56;   // cutoff for black / white
const vec2  DRIFT     = vec2(0.18, 0.3);  // panning direction (x/y == SKEW)
const int   OCTAVES   = 2;      // detail layers (fewer = rounder blobs)
const vec3  BLOB_COLOUR  = vec3(0.361, 0.427, 0.788);
const vec3  BACKGROUND_COLOUR = vec3(0.992, 0.965, 0.890);

// ---- noise primitives ----
float hash(vec2 p) {
    p  = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * (p.x + p.y));
}

float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 frac = fract(p);
    frac = frac * frac * (3.0 - 2.0 * frac);

    return mix(
        mix(hash(cell),                 hash(cell + vec2(1, 0)), frac.x),
        mix(hash(cell + vec2(0, 1)),    hash(cell + vec2(1, 1)), frac.x),
        frac.y
    );
}

float fbm(vec2 p) {
    const mat2 rot = mat2(0.8775826, 0.4794255, -0.4794255, 0.8775826);
    float value = 0.0;
    float amp   = 0.5;

    for (int i = 0; i < OCTAVES; i++) {
        value += amp * noise(p);
        p      = rot * p * 2.0;
        amp   *= 0.5;
    }
    return value;
}

// ---- main ----

void main() {
    float divisor = mix(u_resolution.y, min(u_resolution.x, u_resolution.y), 0.35);
    vec2 uv  = (gl_FragCoord.xy - 0.5 * u_resolution) / divisor;

    uv.x    += uv.y * SKEW;
    vec2 t   = vec2(u_time * u_speed);

    float n1 = fbm(uv * SCALE       + t * DRIFT);
    float n2 = fbm(uv * SCALE * 1.4 + t * vec2(-0.2, 0.4));
    float n  = mix(n1, n2, 0.45);

    // card dimensions in UV space
    vec2  card_uv   = (u_card.xy - 0.5 * u_resolution) / divisor;
    vec2  card_half = u_card.zw / divisor;
    vec2  d         = abs(uv - card_uv) - card_half;
    float dist      = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);

    ${hasDerivatives
        ? `float edge  = fwidth(n) * 0.5;
    float bw    = 1.0 - smoothstep(THRESHOLD - edge, THRESHOLD + edge, n);`
        : `float bw = 1.0 - smoothstep(THRESHOLD - 0.005, THRESHOLD + 0.005, n);`
    }

    vec3 col = mix(BLOB_COLOUR, BACKGROUND_COLOUR, bw);

    gl_FragColor = vec4(col, 1.0);
}
`;

/* ---- compile & link ---- */

function makeShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(s));
    return s;
}

const vert = makeShader(vertSrc, gl.VERTEX_SHADER);
const frag = makeShader(fragSrc, gl.FRAGMENT_SHADER);

const program = gl.createProgram();
gl.attachShader(program, vert);
gl.attachShader(program, frag);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    console.error(gl.getProgramInfoLog(program));
gl.useProgram(program);

/* ---- fullscreen quad ---- */

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,   1, -1,  -1, 1,
    -1,  1,   1, -1,   1, 1
]), gl.STATIC_DRAW);

const attrPos = gl.getAttribLocation(program, 'a_pos');
gl.enableVertexAttribArray(attrPos);
gl.vertexAttribPointer(attrPos, 2, gl.FLOAT, false, 0, 0);

/* ---- uniforms ---- */

const uResolution = gl.getUniformLocation(program, 'u_resolution');
const uTime       = gl.getUniformLocation(program, 'u_time');
const uSpeed      = gl.getUniformLocation(program, 'u_speed');
const uCard       = gl.getUniformLocation(program, 'u_card');

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let SPEED = mqReduced.matches ? 0.15 : 0.8;
gl.uniform1f(uSpeed, SPEED);

mqReduced.addEventListener('change', e => {
    SPEED = e.matches ? 0.15 : 0.8;
    gl.uniform1f(uSpeed, SPEED);
});

/* ---- time continuity across page loads ---- */

const baseTime = parseFloat(sessionStorage.getItem('shader-total')) || 0;
const t0 = performance.now();
const livePages = ['/', '/index.html'];
const isLive = livePages.includes(location.pathname);

window.addEventListener('beforeunload', () => {
    const elapsed = isLive ? (performance.now() - t0) * 0.001 : 0;
    sessionStorage.setItem('shader-total', baseTime + elapsed);
});

function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uResolution, canvas.width, canvas.height);

    const card = document.getElementById('card');
    if (card && uCard) {
        const r = card.getBoundingClientRect();
        gl.uniform4f(uCard,
            r.left + r.width  * 0.5,
            r.top  + r.height * 0.5,
            r.width  * 0.5,
            r.height * 0.5
        );
    }

    const t = baseTime + (performance.now() - t0) * 0.001;
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
window.addEventListener('resize', resize);
resize();

let lastFrameTime = 0;
function frameCapped() {
    const raw = baseTime + (performance.now() - t0) * 0.001;
    const dt  = raw - lastFrameTime;
    if (lastFrameTime && dt > 0.1) {
        baseTime -= dt - 0.1;
    }
    lastFrameTime = raw;
    gl.uniform1f(uTime, raw);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frameCapped);
}

if (isLive) {
    requestAnimationFrame(frameCapped);
} else {
    gl.uniform1f(uTime, baseTime);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
