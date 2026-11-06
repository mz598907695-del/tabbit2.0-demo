/**
 * Original, restrained monochrome interpretations of the selected references.
 * These shader functions are authored for Tabbit; third-party source is not copied.
 *
 * #10 Yuki Kojima / Codrops: smooth droplet fields and a stretching pointer trail.
 * https://tympanus.net/codrops/2025/06/09/how-to-create-interactive-droplet-like-metaballs-with-three-js-and-glsl/
 * #11 Scott Sun / Sandboard: drawing and pushing a granular surface. This adaptation
 * uses a temporary height impression, not the source's full WebGPU sand solver.
 * https://sand.scottsun.io/
 * #21 React Bits / Faulty Terminal: low-lit cells, phosphor trails and scanlines.
 * https://www.reactbits.dev/backgrounds/faulty-terminal
 * #34 Robin Delaporte / Codrops: local velocity-directed deformation and recovery.
 * https://tympanus.net/codrops/2019/09/25/mouse-flowmap-deformation-with-ogl/
 *
 * Contract: uResolution is CSS viewport size. uTrail[16] stores normalized xy,
 * age in real seconds, and strength (hover <= .45, pressed = 1; 0 is unused).
 * The public functions return monochrome texture intensity in [0, 1].
 */
export const MATERIAL_EFFECTS_GLSL = `
float matHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.73, 311.19))) * 43758.23);
}
float matNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(matHash(cell), matHash(cell + vec2(1.0, 0.0)), f.x),
    mix(matHash(cell + vec2(0.0, 1.0)), matHash(cell + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 matAspect() { return vec2(uResolution.x / max(uResolution.y, 1.0), 1.0); }
float matSoftDisc(vec2 p, vec2 c, float radius) {
  vec2 v = (p - c) / max(radius, .001);
  return exp(-dot(v, v));
}
vec2 matSegmentDelta(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return p - (a + ab * clamp(dot(p - a, ab) / max(dot(ab, ab), .000001), 0.0, 1.0));
}

// An analytic implicit field produces a smooth fused contour and its normal.
// Optical shading stays on the perimeter; interiors remain mostly transparent.
float metaballs(vec2 uv, float time, vec2 pointer, float activation, float down) {
  vec2 aspect = matAspect();
  vec2 p = uv * aspect;
  float field = 0.0;
  vec2 gradient = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 center = vec2(.10 + .16 * fi, .18 + .64 * mod(fi, 2.0));
    center += vec2(sin(time * .16 + fi * 1.71) * .035, cos(time * .13 + fi * 2.31) * .055);
    float radius = .058 + .012 * mod(fi, 3.0);
    vec2 d = p - center * aspect;
    float d2 = dot(d, d) + radius * radius * .10;
    float contribution = radius * radius / d2;
    field += contribution;
    gradient += -2.0 * contribution * d / d2;
  }
  // Smaller trailing droplets coalesce into one elastic neck at the cursor.
  for (int i = 0; i < 16; i++) {
    vec4 mark = uTrail[i];
    if (mark.w <= 0.0 || mark.z > 2.5) continue;
    float fade = exp(-mark.z * 2.0);
    float radius = .021 * sqrt(fade) * min(mark.w * 2.4, 1.0);
    vec2 d = p - mark.xy * aspect;
    float d2 = dot(d, d) + .00012;
    float contribution = radius * radius / d2;
    field += contribution;
    gradient += -2.0 * contribution * d / d2;
  }
  vec2 d = p - pointer * aspect;
  float d2 = dot(d, d) + .00012;
  float contribution = .0014 * activation / d2;
  field += contribution;
  gradient += -2.0 * contribution * d / d2;
  float inside = smoothstep(.90, 1.08, field);
  float rim = exp(-pow((field - 1.0) * 6.0, 2.0));
  vec2 normal = normalize(-gradient + vec2(.0001));
  float highlight = pow(max(dot(normal, normalize(vec2(-.6, .8))), 0.0), 5.0);
  float innerShade = (1.0 - highlight) * .13 * inside;
  float halo = exp(-pow((field - .80) * 3.7, 2.0)) * .12;
  return clamp(rim * (.48 - highlight * .40) + innerShade + halo, 0.0, 1.0);
}

// Broad sediment waves with fixed, fine grains; each pressed stroke leaves a
// continuous groove and raised banks. The bank profile slowly fills back in.
float sandboard(vec2 uv, float time, vec2 pointer, float activation, float down) {
  vec2 aspect = matAspect();
  vec2 p = uv * aspect;
  float dunes = sin(p.y * 25.0 + sin(p.x * 8.0) * 1.5 + matNoise(p * 5.0) * 2.0);
  float fine = matHash(floor(uv * uResolution * .72));
  float shade = .20 + dunes * .055 + (fine - .5) * .11;
  float groove = 0.0;
  float bank = 0.0;
  for (int i = 0; i < 16; i++) {
    vec4 mark = uTrail[i];
    if (mark.w < .6 || mark.z > 6.0) continue;
    vec2 delta = p - mark.xy * aspect;
    if (i < 15) {
      vec4 next = uTrail[i + 1];
      if (next.w > .6 && abs(mark.z - next.z) < .8 && distance(mark.xy, next.xy) < .24)
        delta = matSegmentDelta(p, mark.xy * aspect, next.xy * aspect);
    }
    float radius = .020;
    float dist = length(delta);
    float life = exp(-mark.z * .53);
    groove = max(groove, exp(-pow(dist / radius, 2.0)) * life);
    float ridge = exp(-pow((dist - radius * 1.50) / (radius * .42), 2.0));
    float sideLight = dot(normalize(delta + vec2(.0001)), normalize(vec2(-.5, .8)));
    bank += ridge * sideLight * life * .045;
  }
  float pressing = matSoftDisc(p, pointer * aspect, .022) * activation * down;
  return clamp(shade + max(groove, pressing) * .40 - clamp(bank, -.16, .16), 0.0, 1.0);
}

float matLine(vec2 p, vec2 a, vec2 b, float width) {
  return 1.0 - smoothstep(width, width + .035, length(matSegmentDelta(p, a, b)));
}
float matSevenSegment(vec2 p, int digit) {
  // Conventional seven-segment geometry; no external font texture or copied atlas.
  const int masks[16] = int[16](63, 6, 91, 79, 102, 109, 125, 7, 127, 111, 119, 124, 57, 94, 121, 113);
  int mask = masks[clamp(digit, 0, 15)];
  float v = 0.0;
  if ((mask & 1) != 0) v = max(v, matLine(p, vec2(.22,.86), vec2(.78,.86), .035));
  if ((mask & 2) != 0) v = max(v, matLine(p, vec2(.80,.80), vec2(.80,.55), .035));
  if ((mask & 4) != 0) v = max(v, matLine(p, vec2(.80,.45), vec2(.80,.20), .035));
  if ((mask & 8) != 0) v = max(v, matLine(p, vec2(.22,.14), vec2(.78,.14), .035));
  if ((mask & 16) != 0) v = max(v, matLine(p, vec2(.20,.45), vec2(.20,.20), .035));
  if ((mask & 32) != 0) v = max(v, matLine(p, vec2(.20,.80), vec2(.20,.55), .035));
  if ((mask & 64) != 0) v = max(v, matLine(p, vec2(.24,.50), vec2(.76,.50), .035));
  return v;
}

// A quiet CRT character field. Character updates dissolve instead of flashing;
// the mouse wakes a small grainPatch and leaves soft, decaying phosphor behind it.
float terminal(vec2 uv, float time, vec2 pointer, float activation, float down) {
  vec2 css = uv * uResolution;
  vec2 cells = css / vec2(21.0, 29.0);
  vec2 cell = floor(cells);
  vec2 local = fract(cells);
  float epoch = floor(time * .18);
  float dissolve = smoothstep(.65, 1.0, fract(time * .18));
  int first = int(floor(matHash(cell + epoch * 1.713) * 16.0));
  int second = int(floor(matHash(cell + (epoch + 1.0) * 1.713) * 16.0));
  float glyph = mix(matSevenSegment(local, first), matSevenSegment(local, second), dissolve);
  vec2 center = (cell + .5) * vec2(21.0, 29.0) / uResolution;
  vec2 aspect = matAspect();
  float wake = matSoftDisc(center * aspect, pointer * aspect, .10) * activation;
  for (int i = 0; i < 16; i++) {
    vec4 mark = uTrail[i];
    if (mark.w <= 0.0 || mark.z > 4.0) continue;
    wake = max(wake, matSoftDisc(center * aspect, mark.xy * aspect, .075) * exp(-mark.z * 1.25));
  }
  float grainPatch = .5 + .5 * sin(cell.x * .17 + sin(cell.y * .24 + time * .12));
  float sparse = smoothstep(.23, .78, matHash(cell * 1.47));
  float scan = .90 + .10 * cos(css.y * 3.14159265);
  float ambient = .12 + .18 * grainPatch;
  return clamp(glyph * sparse * (ambient + wake * .55) * scan, 0.0, .85);
}

// A monochrome satin image, warped by the velocity of recent pointer segments.
// Long ribbons and fine engraving carry the deformation without photographic UI.
float flowmap(vec2 uv, float time, vec2 pointer, float activation, float down) {
  vec2 aspect = matAspect();
  vec2 p = uv * aspect;
  vec2 flow = vec2(0.0);
  for (int i = 0; i < 15; i++) {
    vec4 mark = uTrail[i];
    vec4 next = uTrail[i + 1];
    if (mark.w <= 0.0 || next.w <= 0.0 || mark.z > 4.0) continue;
    vec2 velocity = (mark.xy - next.xy) * aspect;
    float distance2 = dot(p - mark.xy * aspect, p - mark.xy * aspect);
    float life = exp(-mark.z * 1.2);
    float near = exp(-distance2 / .012);
    float speed = min(length(velocity) * 26.0, 1.0);
    vec2 direction = velocity / max(length(velocity), .0001);
    flow += (direction + vec2(-direction.y, direction.x) * .28) * near * life * speed * .023;
  }
  float idle = sin(p.y * 2.4 + time * .10) * .006;
  vec2 q = p + flow + vec2(idle, sin(time * .08 + p.x * 1.7) * .005);
  float fold = q.y * 10.0 + sin(q.x * 3.5 + sin(q.y * 2.0)) * 1.9;
  float broad = .5 + .5 * cos(fold);
  float silk = .5 + .5 * sin(fold * 5.0 + q.x * 1.3);
  float hairline = pow(silk, 8.0);
  float emboss = matNoise(q * 7.0) * .06;
  return clamp(.08 + broad * .30 + hairline * .12 + emboss, 0.0, 1.0);
}
`;
