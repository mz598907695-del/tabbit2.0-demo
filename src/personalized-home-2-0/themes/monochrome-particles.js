/**
 * Original, low-contrast monochrome interpretations of the selected references.
 * No third-party source or image assets are embedded in these shaders.
 *
 * #07 React Bits Antigravity — a cursor-centred particle attraction ring.
 * https://www.reactbits.dev/backgrounds/antigravity
 * #33 Bruno Imbrizi / Codrops — image particles displaced by pointer proximity.
 * https://tympanus.net/codrops/2019/01/17/interactive-particles-with-three-js/
 * #35 Ion D. Filho / Codrops — geometry height, rotation and size follow distance.
 * https://tympanus.net/codrops/2018/12/06/interactive-repulsion-effect-with-three-js/
 *
 * Coordinates are bottom-left normalized UV. uResolution is CSS viewport size.
 * Functions return a bounded scalar; the host owns the neutral palette/contrast.
 */
export const PARTICLE_EFFECTS_GLSL = `
float mpHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.13, 311.71))) * 43758.5453);
}
vec2 mpHash2(vec2 p) {
  return vec2(mpHash(p), mpHash(p + vec2(43.7, 19.3)));
}
mat2 mpRotate(float angle) {
  float c = cos(angle), s = sin(angle);
  return mat2(c, -s, s, c);
}
vec2 mpAspect() {
  return uResolution / max(min(uResolution.x, uResolution.y), 1.0);
}
float mpDotField(vec2 position, float pitch, float time) {
  vec2 cell = floor(position / pitch);
  float result = 0.0;
  // Each dot only visits its own cell and the eight adjacent cells.
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 id = cell + vec2(float(x), float(y));
      vec2 random = mpHash2(id);
      vec2 centre = (id + 0.17 + random * 0.66) * pitch;
      centre += vec2(sin(time * 0.43 + random.y * 6.283), cos(time * 0.37 + random.x * 6.283)) * pitch * 0.055;
      float radius = pitch * mix(0.029, 0.085, random.x * random.x);
      float distanceToDot = length(position - centre);
      float aa = max(fwidth(distanceToDot), 0.00042);
      float dotLight = 1.0 - smoothstep(radius, radius + aa, distanceToDot);
      float halo = exp(-distanceToDot * distanceToDot / (pitch * pitch * 0.018)) * 0.075;
      result += (dotLight + halo) * mix(0.28, 0.9, random.y);
    }
  }
  return min(result, 1.0);
}

float antigravity(vec2 uv, float time, vec2 pointer, float activation, float down) {
  vec2 aspect = mpAspect();
  vec2 p = (uv - 0.5) * aspect;
  vec2 restingCentre = vec2(sin(time * 0.13) * 0.035, -0.065 + cos(time * 0.11) * 0.02);
  vec2 centre = mix(restingCentre, (pointer - 0.5) * aspect, activation);
  vec2 delta = p - centre;
  float distanceToCentre = length(delta);
  vec2 radial = delta / max(distanceToCentre, 0.0001);
  float ringRadius = 0.175 + down * 0.055;
  float envelope = exp(-pow((distanceToCentre - ringRadius) / 0.075, 2.0));
  float response = 0.36 + activation * 0.64;
  // An inverse radial warp compresses a fine particle field into a curved band;
  // angular shear lets the particles orbit instead of rotating a painted ring.
  float mappedRadius = distanceToCentre + (distanceToCentre - ringRadius) * envelope * response * 0.95;
  float angle = atan(delta.y, delta.x) + envelope * (0.27 + time * 0.045) * response;
  vec2 warped = centre + vec2(cos(angle), sin(angle)) * mappedRadius;
  warped += radial * down * envelope * 0.014;
  float particles = mpDotField(warped, 0.018, time);
  float secondLayer = mpDotField(warped * 0.71 + vec2(4.23, 7.19), 0.022, time * 0.65);
  float radialHalo = exp(-pow((distanceToCentre - ringRadius) / 0.042, 2.0)) * 0.035 * response;
  float focus = 0.22 + envelope * 0.78 * response;
  return clamp(particles * focus + secondLayer * 0.13 + radialHalo, 0.0, 1.0);
}

float mpCapsule(vec2 p, vec2 a, vec2 b, float radius) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - radius;
}
float mpTabbitShape(vec2 p) {
  // Four independent rounded strokes echo the homepage mark, without a raster.
  float d = 10.0;
  for (int i = 0; i < 4; i++) {
    vec2 q = mpRotate(float(i) * 1.5707963) * p;
    d = min(d, mpCapsule(q, vec2(-0.11, 0.20), vec2(0.11, 0.0), 0.052));
  }
  return 1.0 - smoothstep(-0.008, 0.014, d);
}
float imageParticles(vec2 uv, float time, vec2 pointer, float activation, float down) {
  vec2 aspect = mpAspect();
  vec2 p = (uv - 0.5) * aspect;
  vec2 mouse = (pointer - 0.5) * aspect;
  vec2 delta = p - mouse;
  float r = length(delta);
  float influence = exp(-r * r / 0.015) * activation;
  // Magnification of the source coordinates creates a soft evacuated centre and
  // displaced particle rim. Smoothed host pointer state makes the rim settle.
  vec2 warped = p + delta / max(r, 0.0001) * influence * (0.048 + down * 0.018);
  warped += vec2(-delta.y, delta.x) * influence * 0.14;
  vec2 imagePos = warped / 1.25;
  float shape = mpTabbitShape(imagePos);
  float bevel = mpTabbitShape(imagePos + vec2(0.009, -0.011));
  float shading = shape * (0.5 + 0.25 * sin(imagePos.x * 6.0 + imagePos.y * 4.0 + 0.6));
  shading += max(shape - bevel, 0.0) * 0.3;
  float dots = mpDotField(warped + vec2(2.16, 5.73), 0.0105, time * 0.3);
  float dissipation = smoothstep(0.0, 0.055, r + (1.0 - activation));
  float haze = shape * 0.018;
  return clamp((dots * (shading + 0.025) + haze) * mix(1.0, dissipation, influence), 0.0, 1.0);
}

float mpGeometry(vec2 q, float seed, float lift, float time) {
  q = mpRotate(lift * 0.72 + seed * 0.55 + sin(time * 0.15 + seed * 9.0) * 0.018) * q;
  q /= 1.0 + lift * 0.2;
  float aa = max(fwidth(length(q)), 0.009);
  float shape, shade;
  if (seed < 0.34) {
    // Ring: a smooth tube with light on its upper left and a darker inner lip.
    float r = length(q);
    float tube = abs(r - 0.19);
    shape = 1.0 - smoothstep(0.051, 0.051 + aa, tube);
    float nz = sqrt(max(0.0, 1.0 - pow(tube / 0.058, 2.0)));
    shade = 0.30 + nz * 0.33 + dot(normalize(q + 0.0001), vec2(-0.19, 0.23));
  } else if (seed < 0.69) {
    // A shallow isometric block; its three faces have distinct neutral values.
    vec2 a = abs(q);
    float hex = max(a.x * 0.8660254 + a.y * 0.5, a.y);
    shape = 1.0 - smoothstep(0.205, 0.205 + aa, hex);
    float face = q.y > abs(q.x) * 0.57735 ? 0.28 : (q.x < 0.0 ? 0.68 : 0.48);
    float edge = 1.0 - smoothstep(0.0, aa * 1.6, abs(q.y - abs(q.x) * 0.57735));
    shade = face + edge * 0.09;
  } else {
    // A dome/cone: a displaced apex reveals its height through a soft highlight.
    float r = length(q);
    shape = 1.0 - smoothstep(0.215, 0.215 + aa, r);
    vec2 normalXY = normalize(q + vec2(0.025, -0.035));
    shade = 0.48 + dot(normalXY, vec2(0.22, -0.23)) * smoothstep(0.0, 0.09, r);
  }
  return clamp(shape * shade, 0.0, 1.0);
}
float repulsion(vec2 uv, float time, vec2 pointer, float activation, float down) {
  vec2 aspect = mpAspect();
  vec2 p = (uv - 0.5) * aspect;
  vec2 mouse = (pointer - 0.5) * aspect;
  const float pitch = 0.070;
  vec2 grid = p / pitch;
  vec2 base = floor(grid);
  float value = 0.0;
  // Neighbours are required because raised objects shift outside their home cell.
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 id = base + vec2(float(x), float(y));
      vec2 origin = (id + 0.5) * pitch;
      float distanceToMouse = length(origin - mouse);
      float lift = exp(-distanceToMouse * distanceToMouse / 0.016) * activation;
      lift *= 0.85 + down * 0.15;
      vec2 centre = id + 0.5;
      centre += normalize(origin - mouse + 0.0001) * lift * 0.11;
      centre.y += lift * 0.18;
      vec2 q = grid - centre;
      float seed = mpHash(id + vec2(1.7, 3.1));
      float surface = mpGeometry(q, seed, lift, time);
      // A stationary, soft offset shadow anchors the lifted array to its plane.
      vec2 shadowP = grid - (id + 0.5) + vec2(-0.035, 0.07 + lift * 0.12);
      float shadow = exp(-dot(shadowP, shadowP) / (0.032 + lift * 0.018)) * (0.12 + lift * 0.08);
      value = max(value, max(surface, shadow));
    }
  }
  float vignette = 0.78 + 0.22 * smoothstep(0.1, 0.7, length(p));
  return clamp(value * vignette, 0.0, 1.0);
}
`;
