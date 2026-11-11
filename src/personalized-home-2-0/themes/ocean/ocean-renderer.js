export const OCEAN_ATLAS_URL = '/personalized-home-2-0/asset/themes/ocean/depth-atlas.webp';

const MAX_PIXELS = 1_000_000;
const WATERLINE = 0.15;
const ATLAS_HEIGHT_OVER_WIDTH = 1.5;

/** Shared camera geometry for the painted waterline and physical splash. */
export function getOceanView(width, height, depth = 0) {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const progress = Number.isFinite(depth) ? Math.max(0, Math.min(1, depth)) : 0;
  // A tall phone also needs a submerged endpoint. Crop both axes equally
  // rather than fit the entire atlas and leave its sky visible at full depth.
  const visibleH = Math.min(0.78, (h / w) / ATLAS_HEIGHT_OVER_WIDTH);
  const visibleW = visibleH * ATLAS_HEIGHT_OVER_WIDTH / (h / w);
  const initialOffset = WATERLINE - 0.68 * visibleH;
  const offset = initialOffset + ((1 - visibleH) - initialOffset) * progress;
  return {
    offset,
    visibleH,
    visibleW,
    offsetX: (1 - visibleW) * 0.5,
    waterY: (WATERLINE - offset) / visibleH * h,
  };
}
const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * .5 + .5;
  gl_Position = vec4(aPosition, 0., 1.);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uArtwork;
uniform vec2 uResolution;
uniform vec4 uWindow;
uniform float uTime;
uniform float uMotion;
out vec4 outColor;
void main() {
  // The uploaded image is NOT flipped. Texture y=0 is its top source row;
  // vUv.y=1 is the top screen edge, so convert once to top-origin coordinates.
  vec2 screenUv = vec2(vUv.x, 1. - vUv.y);
  vec2 uv = uWindow.xy + screenUv * uWindow.zw;
  float water = smoothstep(${WATERLINE.toFixed(2)}, ${(WATERLINE + 0.022).toFixed(3)}, uv.y);
  float t = uTime;

  // Under one CSS pixel in either axis: enough to animate paint without
  // bending the rock silhouettes or making the foreground glass shimmer.
  vec2 wave = vec2(
    .55 * (sin(uv.y * 43. + t * .26) + .4 * sin(uv.x * 37. - t * .19)),
    .42 * sin(uv.x * 51. + uv.y * 19. + t * .21)
  );
  vec2 sampleUv = uv + wave * (uWindow.zw / uResolution) * water * uMotion;
  vec3 color = texture(uArtwork, clamp(sampleUv, vec2(0.), vec2(1.))).rgb;
  // Initial framing needs more sky than the atlas contains. Extend its quiet
  // central sky colour, not every top-edge column (which would streak rocks).
  if (uv.y < .025) {
    vec3 sky = texture(uArtwork, vec2(.5, .001)).rgb;
    sky += vec3(-.045, -.026, .035) * clamp(-uv.y * 1.1, 0., .25);
    color = mix(sky, color, smoothstep(-.005, .025, uv.y));
  }

  // Broad, dappled shafts follow world/artwork coordinates, so scrolling
  // reveals another part of one ocean instead of dragging an overlay along.
  float sway = sin(t * .075) * .18;
  float broad = pow(max(0., sin(uv.x * 22. + uv.y * 5.2 + sway)), 14.);
  float fine = pow(max(0., sin(uv.x * 57. + uv.y * 12. - sway * .7)), 18.);
  float attenuation = exp(-max(0., uv.y - ${WATERLINE.toFixed(2)}) * 3.8);
  color += vec3(.50, .78, .71) * (broad + fine * .25) * attenuation * water * .038;
  float dapple = pow(.5 + .5 * sin(uv.x * 83. + t * .13) * sin(uv.y * 103. - t * .16), 7.);
  color += vec3(.49, .72, .64) * dapple * attenuation * water * .012;

  // The atlas supplies the primary palette and depth; haze is deliberately
  // restrained and does not recolor its pink sky or erase the painted detail.
  float haze = smoothstep(.40, 1., uv.y) * .035;
  color = mix(color, vec3(.07, .16, .25), haze);
  outColor = vec4(color, 1.);
}
`;

function compileProgram(gl) {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to allocate ocean shader program');
  const shaders = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Unable to allocate ocean shader');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Ocean shader compilation failed');
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Ocean shader linking failed');
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
}

/**
 * One fullscreen WebGL2 draw over a painted depth atlas. There is no internal
 * animation loop: the controller owns visibility, pause and frame scheduling.
 * Image loading is async; until ready the canvas remains transparent.
 */
export function createOceanRenderer(canvas, { onFallback } = {}) {
  let gl;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
  } catch (error) {
    onFallback?.(error);
    return null;
  }
  if (!gl) {
    onFallback?.(new Error('WebGL2 is unavailable'));
    return null;
  }

  let program;
  let buffer;
  let vao;
  let texture;
  let uniforms;
  let image;
  let ready = false;
  let destroyed = false;
  let failed = false;
  let contextLost = false;
  let cssWidth = 0;
  let cssHeight = 0;
  let lastFrame = null;
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    ready = false;
    lastFrame = null;
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    if (image) {
      image.onload = null;
      image.onerror = null;
      if (!image.complete) image.src = '';
      image = null;
    }
    if (!contextLost) {
      // Reveal the CSS fallback immediately, including texture-load failure.
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Release bindings before deleting resources. Keep the canvas context
      // alive: React StrictMode immediately mounts the effect on this same
      // canvas, and forcibly losing its context would break the second mount.
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.useProgram(null);
      if (texture) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer(buffer);
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
    }
  }

  function fail(error) {
    if (failed || destroyed) return;
    failed = true;
    destroy();
    onFallback?.(error);
  }

  function handleContextLost() {
    // Lost context owns no surviving GPU resources. Do not restore another
    // renderer behind the fallback or keep an image callback that uploads later.
    contextLost = true;
    fail(new Error('Ocean graphics context was lost'));
  }

  canvas.addEventListener('webglcontextlost', handleContextLost);
  try {
    program = compileProgram(gl);
    buffer = gl.createBuffer();
    vao = gl.createVertexArray();
    texture = gl.createTexture();
    if (!buffer || !vao || !texture) throw new Error('Unable to allocate ocean graphics resources');
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    uniforms = Object.fromEntries(['uArtwork', 'uResolution', 'uWindow', 'uTime', 'uMotion'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform1i(uniforms.uArtwork, 0);
  } catch (error) {
    fail(error);
    return null;
  }

  function render({ time = 0, depth = 0, width, height, reducedMotion = false, surfaceY } = {}) {
    // true means settled (painted or permanent fallback); false asks the caller
    // to retry while the texture/viewport is not ready. No self-owned RAF.
    if (destroyed) return true;
    if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return false;
    if (!ready) {
      lastFrame = { time, depth, width, height, reducedMotion, surfaceY };
      return false;
    }
    if (width !== cssWidth || height !== cssHeight) {
      cssWidth = width;
      cssHeight = height;
      const dpr = Math.max(0.1, Number.isFinite(globalThis.devicePixelRatio) ? globalThis.devicePixelRatio : 1);
      const scale = Math.min(1.25, dpr, Math.sqrt(MAX_PIXELS / (width * height)));
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uResolution, width, height);
    }
    const view = getOceanView(width, height, depth);
    // surfaceY can explicitly synchronize an independently animated camera;
    // normal scrolling uses the helper's depth mapping with no override.
    const offset = Number.isFinite(surfaceY)
      ? Math.min(1 - view.visibleH, WATERLINE - surfaceY / height * view.visibleH)
      : view.offset;
    gl.uniform4f(uniforms.uWindow, view.offsetX, offset, view.visibleW, view.visibleH);
    gl.uniform1f(uniforms.uTime, reducedMotion || !Number.isFinite(time) ? 0 : time);
    gl.uniform1f(uniforms.uMotion, reducedMotion ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }

  image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    if (destroyed) return;
    try {
      const source = image;
      if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth > maxTextureSize || source.naturalHeight > maxTextureSize) {
        throw new Error('Ocean artwork dimensions exceed this graphics device');
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Unable to upload ocean artwork');
      // Release decoded image storage after its sole GPU upload.
      source.onload = null;
      source.onerror = null;
      image = null;
      ready = true;
      const pendingFrame = lastFrame;
      lastFrame = null;
      if (pendingFrame) render(pendingFrame);
    } catch (error) {
      fail(error);
    }
  };
  image.onerror = () => fail(new Error('Ocean artwork could not be loaded'));
  image.src = OCEAN_ATLAS_URL;

  return { render, destroy };
}
