// GLSL shared by the live wallpapers: hash/value noise, fbm and a twinkling star layer.
export const NOISE_GLSL = `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x),
             mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= .5; }
  return v;
}
float starLayer(vec2 px, float cell, float seed, float density, float size, float t) {
  vec2 g = px / cell + seed * 17.31;
  vec2 id = floor(g), f = fract(g);
  float h = hash21(id + seed * 3.7);
  if (h > density) return 0.;
  vec2 pos = vec2(hash21(id + 11.3), hash21(id + 5.9)) * .72 + .14;
  float d = length((f - pos) * cell);
  float mag = hash21(id + 2.2);
  float r = size * (.55 + mag * mag * 1.1);
  float twinkle = .74 + .26 * sin(t * (.7 + hash21(id + 8.8) * 2.4) + h * 90.);
  float core = exp(-d * d / (r * r));
  float halo = exp(-d / (r * 5.)) * .1 * mag;
  return (core + halo) * twinkle * (.3 + .7 * mag);
}
`;
