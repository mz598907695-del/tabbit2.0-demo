import { PARTICLE_EFFECTS_GLSL } from './monochrome-particles.js';
import { MATERIAL_EFFECTS_GLSL } from './monochrome-materials.js';
import { createSimulation, simulationDisplayGLSL } from './monochrome-simulation.js';

const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() { vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }
`;

export function monochromeFragment(theme) {
  const kind = ['ether', 'ink', 'water'].indexOf(theme.simulation);
  const effect = kind >= 0
    ? `simulationEffect(vUv, uTime, uField, ${kind})`
    : `${theme.effect}(vUv, uTime, uPointer, uActive, uDown)`;
  return `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uActive;
uniform float uDown;
uniform float uTime;
uniform vec4 uTrail[16];
uniform sampler2D uField;
out vec4 outColor;
${kind >= 0 ? simulationDisplayGLSL : PARTICLE_EFFECTS_GLSL + MATERIAL_EFFECTS_GLSL}
void main() {
  float textureValue = clamp(${effect}, 0., 1.);
  // Reserve a quieter central reading area; the background never paints on UI.
  float quiet = .54 + .46 * smoothstep(.12, .62, length((vUv - vec2(.5, .56)) * vec2(1., .85)));
  float base = ${theme.mode === 'dark' ? '.098039216' : '.956862745'};
  float gray = base ${theme.mode === 'dark' ? '+' : '-'} textureValue * quiet * ${theme.mode === 'dark' ? '.145' : '.13'};
  outColor = vec4(vec3(gray), 1.);
}`;
}

function programFor(gl, fragment) {
  const shaders = [];
  const program = gl.createProgram();
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  } catch (error) { gl.deleteProgram(program); throw error; }
  finally { shaders.forEach(shader => gl.deleteShader(shader)); }
}

export function createMonochromeRenderer(canvas, theme) {
  const gl = canvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  let program, buffer, vao, simulation;
  try {
    program = programFor(gl, monochromeFragment(theme));
    buffer = gl.createBuffer(); vao = gl.createVertexArray();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    simulation = theme.simulation ? createSimulation(gl, theme.simulation) : null;
  } catch (error) {
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    if (vao) gl.deleteVertexArray(vao);
    throw error;
  }
  const uniforms = Object.fromEntries(['uResolution','uPointer','uActive','uDown','uTime','uTrail[0]','uField']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  let width = 1, height = 1, disposed = false;

  return {
    resize(w, h) {
      width = w; height = h;
      const scale = Math.min(1.25, window.devicePixelRatio || 1, Math.sqrt(950000 / (w * h)));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
    },
    render(time, dt, pointer, trails) {
      if (disposed || gl.isContextLost()) return;
      if (simulation && dt > 0) simulation.step(dt, pointer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program); gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.uResolution, width, height);
      gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
      gl.uniform1f(uniforms.uActive, pointer.active);
      gl.uniform1f(uniforms.uDown, pointer.press || 0);
      gl.uniform1f(uniforms.uTime, time * .35);
      gl.uniform4fv(uniforms['uTrail[0]'], trails);
      if (simulation) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, simulation.texture);
        gl.uniform1i(uniforms.uField, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      simulation?.dispose();
      gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program);
      queueMicrotask(() => { if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); });
    },
  };
}
