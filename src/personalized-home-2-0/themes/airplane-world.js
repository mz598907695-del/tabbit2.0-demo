import { NOISE_GLSL } from './glsl-common.js';

// 飞机舷窗 — the world outside the window. One full-screen fragment shader traces each pixel's
// ray through a pinhole camera that is bolted to the fuselage (the camera looks out of the
// starboard side; image-right is aft), then rotates it by the aircraft's pitch and roll into a
// world frame (x = forward, y = up, z = starboard). The world is a planet of radius R with an
// exponential atmosphere, so the horizon dips and curves as the altitude grows. Layers, from the
// bottom up: ground (fields, sea, city, airports with lamp rows), billboard strips (ridges, skyline,
// terminal) for the low-altitude silhouettes, a cumulus deck seen from below / above / inside,
// and the sky with its limb, stars and sun. Everything is a function of the uniforms only.
export const WORLD_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;      // render size, device px
uniform float uF;       // focal length, device px
uniform vec2 uC;        // optical centre, device px from the bottom-left corner
uniform float uTime;
uniform float uAlt;     // km above the surface
uniform float uDist;    // km flown along the track
uniform float uSide;    // metres right of the runway centre line
uniform vec2 uAtt;      // pitch (nose up +), roll (right wing down +), rad
uniform vec3 uSun;      // sun direction in the world frame
uniform vec3 uZen, uHor, uGlowC, uSunC, uAmb, uLimb;
uniform float uBlur;    // metres the aircraft moves during one exposure
uniform float uBlurN;   // samples across the exposure
uniform float uCover;   // cumulus cover
uniform float uLights;  // 0..1 lamps and city lights
uniform float uFog;     // 0..1 flying inside cloud
uniform float uLand;    // km, arrival runway threshold along the track
uniform float uHaze;    // 0..1 low haze
uniform float uStars;   // 0..1 star visibility
uniform float uSunVis;  // 0..1 sun disc brightness

#define R 1800.
#define DECK_BASE 1.9
#define DECK_TOP 3.5
#define PI 3.14159265

${NOISE_GLSL}

float gFpx = 1., gNdr = 1.;   // metres per pixel across the view, and how flat the ground is seen
float gVis = 95.;             // visibility in km

float sat(float x) { return clamp(x, 0., 1.); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float hash31(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
// fbm whose octaves fade out once they are finer than a pixel (fpu = pixel size in cells)
float fbmL(vec2 p, float fpu) {
  float v = 0., a = .5;
  for (int i = 0; i < 6; i++) {
    if (fpu > .75) { v += a * (1. - exp2(float(i) - 6.)); break; }
    v += a * mix(.5, vnoise(p), sat(1.6 - fpu * 2.2));
    p = p * 2.03 + vec2(17.1, 9.7); a *= .5; fpu *= 2.03;
  }
  return v / .984;
}
float box(vec2 p, vec2 c, vec2 hs, float aa) {
  vec2 d = abs(p - c) - hs;
  return 1. - smoothstep(-aa, aa, max(d.x, d.y));
}

// Distance (km) along a ray to the sphere of radius R+hs; -1 when it misses. graze: take the tangent.
float shell(float hs, float ry, bool graze) {
  float c = (uAlt - hs) * (2. * R + uAlt + hs);
  float b = (R + uAlt) * ry;
  float disc = b * b - c;
  if (disc < 0.) { if (!graze) return -1.; disc = 0.; }
  float sq = sqrt(disc);
  if (c > 0.) return b >= 0. ? -1. : c / (sq - b);
  return b >= 0. ? -c / (b + sq) : sq - b;
}

// ---- sky ------------------------------------------------------------------------------
float starField(vec3 rd) {
  float s = 0.;
  for (int k = 0; k < 3; k++) {
    float N = k == 0 ? 34. : k == 1 ? 80. : 190.;
    float prob = k == 0 ? .12 : k == 1 ? .06 : .02;
    vec3 p = rd * N, id = floor(p);
    float h = hash31(id + float(k) * 13.7);
    if (h > prob) continue;
    vec3 c = id + .2 + .6 * vec3(hash31(id + 3.3), hash31(id + 7.7), hash31(id + 1.9));
    float d = length(p - c) / N * uF;                 // px
    float mag = hash31(id + 5.5);
    float r = (.55 + mag * mag * 1.1) * (k == 0 ? 1.25 : 1.);
    float tw = .78 + .22 * sin(uTime * (.8 + 2.2 * hash31(id + 9.1)) + h * 80.);
    s += (exp(-d * d / (r * r)) + exp(-d / (r * 4.)) * .08 * mag) * tw * (.3 + .7 * mag) * (k == 0 ? 1.5 : 1.);
  }
  return s;
}
vec3 milkyWay(vec3 rd) {
  vec3 ng = normalize(vec3(.35, .62, .7));
  float g = dot(rd, ng);
  vec2 q = vec2(atan(rd.z, rd.x) * 2.2, rd.y * 3.);
  float band = exp(-g * g / .03);
  float cl = fbm(q * vec2(1.3, 2.4) + 2.7);
  float lane = smoothstep(.45, .7, fbm(q * 3.1 + 9.));
  vec3 tint = mix(vec3(.3, .42, .9), vec3(.85, .6, .85), cl);
  return tint * band * (.2 + cl * cl * 1.1) * (1. - lane * .55) * .22;
}

// Sky without stars and sun; up = elevation above the visible horizon (rad). Also the colour of distant haze.
vec3 skyBase(vec3 rd, float up) {
  float spaceK = smoothstep(14., 58., uAlt);
  float highK = smoothstep(1., 26., uAlt) * (1. - spaceK);
  float w = .3 / pow(1. + uAlt / 9., .9);
  float band = exp(-up / w);
  vec3 zen = mix(uZen * (1. - .55 * highK) + vec3(.0, .01, .05) * highK, vec3(.003, .006, .02), spaceK);
  vec3 col = mix(zen, uHor, pow(band, .85));
  float sa = acos(clamp(dot(rd, uSun), -1., 1.));
  col += uGlowC * exp(-sa / mix(.62, .2, spaceK)) * exp(-up / (w * 2.4)) * 1.15;
  float limbK = smoothstep(7., 40., uAlt);
  col += uLimb * (exp(-up / (w * .32)) * .9 + exp(-up / (w * 1.5)) * .3) * limbK;
  col += vec3(.05, .32, .2) * exp(-pow((up - w * .9) / (w * .45), 2.)) * spaceK * .1;
  col = mix(col, uHor * 1.05 + uGlowC * .5, uHaze * exp(-up / .05) * (1. - spaceK) * .6);
  col += vec3(1., .5, .22) * uLights * exp(-up / .035) * (1. - spaceK) * .16 * (1. - sat(uSun.y * 4.));   // glow of the lit city on the night horizon
  return col;
}
vec3 skyColor(vec3 rd, float eh) {
  float up = max(eh, 0.);
  vec3 col = skyBase(rd, up);
  float sa = acos(clamp(dot(rd, uSun), -1., 1.));
  if (uStars > .003) {
    float vis = uStars * (1. - sat(dot(col, vec3(.6, .3, .1)) * 2.4)) * smoothstep(-.01, .05, eh);
    col += (vec3(.82, .88, 1.) * starField(rd) + milkyWay(rd)) * vis;
  }
  // the sun: disc, tight bloom and a soft glow
  float disc = 1. - smoothstep(.0105, .0135, sa);
  col += (vec3(1., .94, .82) * disc * 7. + uSunC * (exp(-sa / .012) * .42 + exp(-sa / .05) * .26 + exp(-sa / .26) * .06)) * uSunVis;
  return col;
}

// ---- clouds ----------------------------------------------------------------------------
float worley(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d = 1.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash21(i + g + 1.7), hash21(i + g + 8.3));
    d = min(d, length(g + o - f));
  }
  return d;
}
float deckDens(vec2 Pm, float fp) {
  float big = fbmL(Pm / 26000. + 4.2, fp / 26000.);
  float mid = fbmL(Pm / 5200. + 17.5, fp / 5200.);
  float fine = fbmL(Pm / 1100. + 3.3, fp / 1100.);
  float cells = fp < 900. ? 1. - worley(Pm / 2300.) : .5;
  float d = big * .46 + mid * .3 + fine * .14 + cells * .1;
  float th = .78 - uCover * .56;
  return smoothstep(th - .1, th + .26, d);
}
vec2 sunDirH() { return normalize(uSun.xz + vec2(1e-4)); }
float sunLevel() { return smoothstep(-.06, .3, uSun.y); }
vec3 hazeColor(vec3 rd) { return skyBase(rd, 0.); }

// Cloud bottoms seen from below: grey, edges glowing where thin.
vec3 cloudBelow(vec3 col, vec3 rd) {
  if (uAlt > DECK_BASE - .05 || rd.y < -.2) return col;
  float t = shell(DECK_BASE, rd.y, false);
  if (t <= 0.) return col;
  float fp = t * 1000. / uF / max(abs(rd.y), .05);
  vec2 Pm = vec2(uDist + rd.x * t, uSide * .001 + rd.z * t) * 1000.;
  float d = deckDens(Pm, fp);
  float sa = acos(clamp(dot(rd, uSun), -1., 1.));
  float prox = exp(-sa / .8) * (1. - smoothstep(0., .5, uSun.y));
  vec3 under = mix(uAmb * .95 + uSunC * .1 * sunLevel(), uAmb * .45, d);
  under += (uGlowC * 1.6 + uSunC * .5) * prox * (1. - d * .55);
  float thin = 1. - d;
  under += uSunC * .22 * sunLevel() * thin * thin * exp(-sa / .5);
  float fog = 1. - exp(-t / mix(70., 22., uHaze));
  under = mix(under, hazeColor(rd), fog);
  float alpha = d * (1. - fog * .6) * smoothstep(-.03, .1, rd.y + .02);
  return mix(col, under, alpha);
}

// Cloud tops seen from above (two layers for a little parallax). Returns rgb, alpha.
vec4 cloudAbove(vec3 rd) {
  if (uAlt < DECK_TOP + .03) return vec4(0.);
  float t = shell(DECK_TOP, rd.y, false);
  if (t <= 0.) return vec4(0.);
  vec3 n = normalize(vec3(rd.x * t, R + uAlt + rd.y * t, rd.z * t));
  float ndr = max(-dot(rd, n), .02);
  float fp = t * 1000. / uF / ndr;
  vec2 Pm = vec2(uDist + rd.x * t, uSide * .001 + rd.z * t) * 1000.;
  vec2 sh = sunDirH();
  float sl = sunLevel();
  float sunLen = mix(380., 1100., 1. - sat(uSun.y * 2.));
  float d = deckDens(Pm, fp);
  float d2 = deckDens(Pm + sh * sunLen, fp);
  float lit = sat(.56 + (d - d2) * 1.7);
  float hgt = smoothstep(.1, .95, d);
  vec3 sunlit = uSunC * (.46 + .36 * lit) * sl + uAmb * .62;
  vec3 shade = uAmb * vec3(.7, .79, .96) * .95 + uSunC * .05 * sl;
  vec3 top = mix(shade * mix(.78, 1., hgt), sunlit, sat(hgt * .45 + lit * .7 - .12));
  // second, deeper layer showing through the gaps
  float t2 = shell(DECK_TOP - .7, rd.y, false);
  vec2 P2 = vec2(uDist + rd.x * t2, uSide * .001 + rd.z * t2) * 1000. + vec2(7777., 3131.);
  float dl = t2 > 0. ? deckDens(P2, fp) : 0.;
  vec3 low = mix(uAmb * vec3(.5, .56, .7), uAmb * vec3(.8, .84, .95) + uSunC * .12 * sl, dl) * .85;
  float aTop = smoothstep(.04, .5, d);
  float aLow = smoothstep(.02, .45, dl) * .94;
  vec3 col = mix(low, top, aTop);
  float alpha = max(aTop, aLow);
  // haze towards the horizon and with distance through thin air
  float hs = 8.;
  float path = hs * (1. - exp(-(uAlt - DECK_TOP) / hs)) / ndr;
  float fog = 1. - exp(-path / mix(80., 26., uHaze));
  col = mix(col, hazeColor(rd), fog);
  // silver rim where the sun grazes the cloud
  float sa = acos(clamp(dot(rd, uSun), -1., 1.));
  col += uSunC * exp(-sa / .25) * .22 * sl * (1. - d) * alpha;
  return vec4(col, alpha);
}

// Inside the cloud: everything washes to white, streaks racing past.
vec3 inCloud(vec3 col, vec2 s, vec3 rd) {
  if (uFog < .002) return col;
  float flow = uDist * 10.;
  float w1 = fbmL(vec2(s.x * 1.8 - flow, s.y * 7.), 0.);
  float w2 = fbmL(vec2(s.x * 4.2 - flow * 1.7, s.y * 20. + 4.), 0.);
  float wisp = w1 * .6 + w2 * .4;
  float dens = smoothstep(.55 - uFog * .42, .9 - uFog * .46, wisp);
  dens = max(dens, smoothstep(.9, 1., uFog));
  float sa = acos(clamp(dot(rd, uSun), -1., 1.));
  float sl = sunLevel();
  vec3 fogC = (vec3(.9, .93, .98) * (.4 + .5 * sl) + uAmb * .25) * mix(.62, 1.08, smoothstep(.2, .8, wisp));
  fogC += (uGlowC * .5 + uSunC * .55) * exp(-sa / .55) * (.6 + .4 * sl);
  return mix(col, fogC, dens * (.3 + .7 * uFog));
}

// ---- lamps ---------------------------------------------------------------------------
// Round on screen whatever the viewing angle: the ground offset is flattened by the view angle,
// then measured in pixels. Sub-pixel lamps keep their energy and get a soft bloom.
vec3 lamp(vec2 d, float r0, vec3 col, float I) {
  vec2 s = vec2(d.x, d.y * gNdr) / gFpx;
  float rp0 = r0 / gFpx, rp = max(rp0, 1.25);
  float e = (rp0 * rp0) / (rp * rp), q = dot(s, s);
  return col * I * (exp(-q / (rp * rp)) + .12 * exp(-sqrt(q) / (rp * 5.))) * e;
}
// a row of lamps every s metres along x, at y = y0; falls back to a thin line when the lamps merge
vec3 lampRowX(vec2 q, float y0, float s, float r0, vec3 col, float I, float x0, float x1) {
  if (s / gFpx < 3.) {
    float dy = (q.y - y0) * gNdr / gFpx;
    return col * I * r0 * r0 / (gFpx * s) * exp(-dy * dy / 2.) * step(x0, q.x) * step(q.x, x1);
  }
  float n = floor((x1 - x0) / s), i = floor((q.x - x0) / s + .5);
  vec3 e = vec3(0.);
  for (int k = -1; k <= 1; k++) {
    float ii = i + float(k);
    if (ii < 0. || ii > n) continue;
    e += lamp(q - vec2(x0 + ii * s, y0), r0, col, I);
  }
  return e;
}
vec3 lampRowY(vec2 q, float x0, float s, float r0, vec3 col, float I, float y0, float y1) {
  float n = floor((y1 - y0) / s), i = floor((q.y - y0) / s + .5);
  vec3 e = vec3(0.);
  for (int k = -1; k <= 1; k++) {
    float ii = i + float(k);
    if (ii < 0. || ii > n) continue;
    e += lamp(q - vec2(x0, y0 + ii * s), r0, col, I);
  }
  return e;
}

// ---- ground ---------------------------------------------------------------------------
// Everyday countryside: field mosaic, woods, lakes, roads, hills. gloss: how mirror-like the surface is.
vec3 landscape(vec2 P, float fp, out vec3 emis, out float gloss) {
  emis = vec3(0.); gloss = .05;
  float reg = fbmL(P / 15000. + 3.7, fp / 15000.);
  float reg2 = fbmL(P / 3400. + 8.1, fp / 3400.);
  vec2 fq = rot2(.5 + reg * 1.3) * P / 260.;
  vec2 fid = floor(fq);
  float fh = hash21(fid + 3.1);
  vec3 f1 = vec3(.3, .37, .17), f2 = vec3(.5, .47, .27), f3 = vec3(.4, .31, .21), f4 = vec3(.21, .3, .14), f5 = vec3(.58, .54, .38);
  vec3 field = fh < .2 ? f1 : fh < .4 ? f2 : fh < .53 ? f3 : fh < .8 ? f4 : f5;
  field *= .88 + .24 * hash21(fid + 9.9);
  float fl = smoothstep(90., 420., fp);
  vec3 avg = vec3(.4, .4, .23) * (.85 + .3 * reg2);
  vec3 col = mix(field, avg, fl);
  float lines = .5 + .5 * sin(dot(fq, vec2(.6, .8)) * 7.);
  col *= 1. - .07 * lines * (1. - smoothstep(4., 14., fp)) * step(.55, fh);
  // woods
  float wood = smoothstep(.52, .64, reg2 + (fbmL(P / 600., fp / 600.) - .5) * .25);
  vec3 wcol = vec3(.09, .16, .08) * (.8 + .4 * fbmL(P / 40., fp / 40.));
  col = mix(col, wcol, wood);
  // hedgerows, roads
  vec2 h = abs(fract(fq) - .5);
  float hedge = (1. - smoothstep(0., .02 + fp / 260., .5 - max(h.x, h.y))) * (1. - fl);
  col = mix(col, vec3(.11, .18, .08), hedge * .5);
  vec2 rq = rot2(.5) * P / 1900.;
  vec2 rr = abs(fract(rq) - .5);
  float road = (1. - smoothstep(0., .006 + fp / 1900. * .9, min(rr.x, rr.y) - .003)) * step(.4, hash21(floor(rq) + 4.4)) * (1. - smoothstep(60., 300., fp));
  col = mix(col, vec3(.48, .45, .4), road * .8);
  col *= .88 + .24 * smoothstep(.3, .75, reg);
  // lakes and a river, in some regions only
  float wet = smoothstep(.5, .62, fbmL(P / 48000. + 31., fp / 48000.));
  float lake = 1. - smoothstep(.3, .34, fbmL(P / 6200. + 51., fp / 6200.) + (1. - wet) * .3);
  float rv = abs(fbmL(P / 9000. + 21., fp / 9000.) - .5);
  float river = (1. - smoothstep(.004, .004 + .003 + fp / 9000. * .8, rv)) * wet;
  float water = max(lake, river);
  col = mix(col, vec3(.07, .15, .2), water);
  gloss = max(gloss, water * .9);
  return col;
}

// Block-grid city made of parcels. u: how urban (0..1).
vec3 cityAlbedo(vec2 P, float fp, float u, out vec3 emis, out float gloss) {
  float dens = fbmL(P / 2400. + 5., fp / 2400.);                 // downtown .. suburbs
  vec2 w = (vec2(fbmL(P / 1100. + 3., fp / 1100.), fbmL(P / 1100. + 11., fp / 1100.)) - .5) * 220.;
  vec2 Pw = rot2(.38) * (P + w);
  vec2 g = Pw / 110.;
  vec2 id = floor(g), f = fract(g);
  vec2 e = min(f, 1. - f);
  float sw = .045 + .04 * hash21(id + .5);
  float lod = smoothstep(14., 70., fp);
  float street = mix(step(min(e.x, e.y), sw), .2, lod);
  float hb = hash21(id);
  // parcels: houses and buildings inside the block
  vec2 pq = Pw / 21.;
  vec2 pid = floor(pq), pf = fract(pq);
  float hp = hash21(pid + id * 7.3);
  float gap = step(min(pf.x, pf.y), .07) * (1. - smoothstep(3., 10., fp));
  vec3 roof = mix(vec3(.47, .43, .39), vec3(.4, .4, .42), hash21(pid + 3.)) * (.82 + .36 * hp);
  roof = mix(roof, vec3(.5, .36, .3) * (.8 + .3 * hp), step(.82, hp) * .8);
  roof *= 1. - .35 * gap;
  vec3 park = vec3(.17, .27, .12) * (.8 + .4 * hash21(floor(P / 9.)));
  float isPark = step(hb, .07 + .06 * (1. - dens));
  vec3 blockCol = mix(roof, park, isPark);
  vec3 col = mix(blockCol, vec3(.24, .24, .25), street);
  vec3 avg = mix(vec3(.4, .38, .35), vec3(.3, .36, .24), isPark);
  col = mix(col, mix(avg * (1. - .35 * street), avg, .5), lod * .75);
  gloss = street * .2;
  emis = vec3(0.);
  if (uLights > .01) {
    // street lamps: a dot per 26 m cell if the cell centre lies on a street
    vec2 cc = (floor(P / 26.) + .5) * 26.;
    vec2 g2 = (rot2(.38) * (cc + w)) / 110.;
    vec2 e2 = min(fract(g2), 1. - fract(g2));
    float on = step(min(e2.x, e2.y), sw + .02) * step(.5 - dens * .35, hash21(floor(P / 26.) + 2.2));
    float lampLod = 1. - smoothstep(20., 60., fp);
    vec3 warm = mix(vec3(1., .66, .3), vec3(1., .88, .72), hash21(floor(P / 26.) + 8.8));
    emis += lamp(P - cc, 1.4, warm, 2.6) * on * lampLod;
    // lit windows glow through the parcels; busy districts burn brighter and whiter
    float litP = step(.55 - dens * .35, hash21(pid + 7.7)) * (.1 + .28 * hash21(pid + 1.3)) * (1. - street) * (1. - isPark) * (1. - gap);
    vec3 winC = mix(vec3(1., .7, .4), vec3(.95, .88, .75), smoothstep(.55, .8, dens) * hash21(pid + 4.1));
    emis += winC * litP * mix(1., .75, lod) * (.6 + 1.2 * smoothstep(.45, .8, dens));
    float av = (1. - smoothstep(.0, .06 + fp / 110., abs(g.x - floor(g.x / 7. + .5) * 7.))) * step(.45, hash21(vec2(floor(g.x / 7. + .5) * 3.1 + 2., 1.))) * smoothstep(.35, .6, vnoise(vec2(g.y * .1, floor(g.x / 7. + .5) * 7.)));
    emis += vec3(1., .6, .28) * av * mix(.8, .4, lod);
    emis += vec3(.9, .55, .3) * lod * (.14 + .2 * dens) * (1. - isPark);
    emis *= uLights * u;
  }
  return col;
}

// Runway, taxiway, apron, terminal roof. q: metres, x along the runway from its threshold, y to starboard.
vec3 airportSurf(vec2 q, float fp, out vec3 emis, out float gloss) {
  emis = vec3(0.);
  float aa = max(fp * .8, .12);
  float lodG = smoothstep(6., 30., fp);
  float stripe = mix(step(.5, fract(q.y / 14.)), .5, lodG);
  vec3 col = mix(vec3(.2, .31, .1), vec3(.27, .38, .14), stripe) * (.88 + .24 * fbmL(q / 24., fp / 24.));
  gloss = .04;
  // taxiway with connectors
  float tw = box(q, vec2(1500., 118.), vec2(1560., 11.5), aa);
  for (int i = 0; i < 4; i++) tw = max(tw, box(q, vec2(400. + 700. * float(i), 70.), vec2(11.5, 52.), aa));
  col = mix(col, vec3(.19, .19, .2), tw);
  float apron = box(q, vec2(1250., 285.), vec2(1050., 150.), aa);
  vec3 conc = vec3(.4, .4, .39) * (.9 + .15 * fbmL(q / 12., fp / 12.));
  col = mix(col, conc, apron);
  gloss = max(gloss, tw * .5 + apron * .3);
  float mk = 1. - smoothstep(1.5, 9., fp);
  float sl = (1. - smoothstep(.2, .2 + aa, 31. - abs(mod(q.x, 62.) - 31.))) * apron * step(160., q.y) * step(q.y, 380.);
  col = mix(col, vec3(.8, .66, .14), sl * mk * .8);
  col = mix(col, vec3(.8, .66, .12), (1. - smoothstep(.2, .2 + aa, abs(q.y - 118.))) * tw * mk * .85);
  // terminal roof
  float roof = box(q, vec2(1250., 432.), vec2(1050., 26.), aa);
  col = mix(col, vec3(.36, .38, .42) * (.9 + .2 * hash21(floor(q / 40.))), roof);
  // runway
  float rw = box(q, vec2(1500., 0.), vec2(1560., 22.5), aa);
  vec3 asph = vec3(.14, .14, .15) * (.88 + .24 * fbmL(q / vec2(30., 5.), fp / 5.));
  float rubber = box(q, vec2(520., 0.), vec2(260., 6.5), aa * 3.) * smoothstep(.4, .7, fbmL(q / vec2(9., 2.5), fp / 2.5));
  asph *= 1. - .4 * rubber;
  col = mix(col, asph, rw);
  gloss = max(gloss, rw * .6);
  float onRun = rw * step(0., q.x) * step(q.x, 3000.);
  float ay = abs(q.y);
  float line = (1. - smoothstep(.45, .45 + aa, abs(ay - 21.6))) + (1. - smoothstep(.4, .4 + aa, ay)) * step(mod(q.x, 50.), 30.);
  float thr = (1. - smoothstep(.0, aa, abs(q.x - 25.) - 15.)) * step(3.2, ay) * step(ay, 21.) * step(mod(ay, 3.6), 1.9);
  float tdz = step(150., q.x) * step(q.x, 650.) * step(mod(q.x - 150., 150.), 22.) * (step(5.5, ay) * step(ay, 8.) + step(11.5, ay) * step(ay, 14.));
  float aim = (1. - smoothstep(0., aa, abs(q.x - 330.) - 30.)) * step(7., ay) * step(ay, 11.);
  col = mix(col, vec3(.8), sat(line + thr + tdz + aim) * onRun * mk);

  // lamps
  float Lo = uLights;
  if (Lo > .01) {
    vec3 white = vec3(1., .93, .8);
    emis += lampRowX(q, 23.6, 20., .34, white, 3.4, 0., 3000.) * Lo;
    emis += lampRowX(q, -23.6, 20., .34, white, 3.4, 0., 3000.) * Lo;
    emis += lampRowX(q, 0., 7.5, .22, vec3(1., .96, .9), 1.7, 0., 2800.) * Lo;
    emis += lampRowY(q, -2., 3., .3, vec3(.25, 1., .45), 2.4, -22.5, 22.5) * Lo;
    emis += lampRowY(q, 3002., 3., .3, vec3(1., .12, .08), 2.4, -22.5, 22.5) * Lo;
    emis += lampRowX(q, 118. + 12.8, 15., .24, vec3(.18, .38, 1.), 2.4, -40., 3000.) * Lo;
    emis += lampRowX(q, 118. - 12.8, 15., .24, vec3(.18, .38, 1.), 2.4, -40., 3000.) * Lo;
    emis += lampRowX(q, 118., 10., .2, vec3(.3, 1., .5), 1.4, -40., 3000.) * Lo;
    // apron floodlights: sodium pools on the concrete
    vec2 m = vec2(floor((q.x - 700.) / 280. + .5) * 280. + 700., 330.);
    float pool = exp(-dot(q - m, q - m) / 7000.) * apron * step(500., q.x) * step(q.x, 2000.);
    emis += vec3(1., .62, .3) * pool * .7 * Lo;
    float glass = box(q, vec2(1250., 410.), vec2(1050., 2.), aa) * (.5 + .5 * hash21(floor(q.xx / 8.)));
    emis += vec3(1., .74, .42) * glass * 1.3 * Lo;
  }
  return col;
}

// ---- billboard strips (silhouettes at low altitude) -----------------------------------
// A vertical wall at cross-track distance X: ridges, skyline, terminal.
bool stripHit(float X, vec3 rd, float off, out float Y, out float a, out float aa) {
  Y = 0.; a = 0.; aa = 1.;
  if (rd.z < .003) return false;
  float ts = (X - uSide) / rd.z;
  if (ts < 0.) return false;
  float hd = ts * length(rd.xz);
  Y = uAlt * 1000. + ts * rd.y + hd * hd / (2. * R * 1000.);
  a = uDist * 1000. + off + ts * rd.x;
  aa = ts / uF;
  return true;
}
float cov(float Y, float H, float aa) { return smoothstep(-aa, aa, Y) * smoothstep(-aa, aa, H - Y); }
float mistK(float aa) { return 1. - exp(-aa * uF / 1000. / gVis); }

vec3 silhouette(float haze) {
  // dark against the dawn sky, tinted by atmosphere with distance
  vec3 body = uAmb * .22 + uZen * .12 + vec3(.012, .012, .02);
  return mix(body, mix(uHor, uZen, .25) * .78, haze);
}

vec3 strips(vec3 col, vec3 rd, float off) {
  float Y, a, aa;
  float alt = uAlt * 1000.;
  // far ridge, near ridge
  if (alt < 6000. && stripHit(32000., rd, off, Y, a, aa)) {
    float H = 140. + 720. * fbmL(vec2(a / 9000. + 3., 1.), aa / 9000.);
    float c = cov(Y, H, aa) * (1. - smoothstep(2500., 6000., alt));
    col = mix(col, mix(silhouette(.82), hazeColor(rd), mistK(aa)), c);
  }
  if (alt < 2800. && stripHit(17000., rd, off, Y, a, aa)) {
    float H = 70. + 400. * fbmL(vec2(a / 5200. + 9., 4.), aa / 5200.);
    float c = cov(Y, H, aa) * (1. - smoothstep(1200., 2800., alt));
    col = mix(col, mix(silhouette(.62), hazeColor(rd), mistK(aa)), c);
  }
  // city skyline (arrival side)
  if (alt < 1100. && stripHit(6200., rd, off, Y, a, aa)) {
    float ca = uLand * 1000. + 3500.;
    float cell = floor(a / 52.);
    float h = hash21(vec2(cell, 9.));
    float centre = exp(-pow((a - ca) / 2800., 2.));
    float H = (10. + 38. * h * h + 230. * pow(hash21(vec2(cell, 21.)), 3.) * centre) * step(.1, h) * step(uLand * 1000. - 2500., a) * step(a, uLand * 1000. + 11000.);
    float c = cov(Y, H, aa) * (1. - smoothstep(500., 1100., alt));
    vec3 s = silhouette(.35);
    vec2 wq = vec2(a / 3.4, Y / 3.6);
    float win = step(.55, fract(wq.x)) * step(.4, fract(wq.y)) * step(hash21(floor(wq) + cell), .38 + .3 * h) * (1. - smoothstep(1.2, 3.4, aa));
    s += vec3(1., .78, .5) * win * uLights * (.55 + .5 * hash21(floor(wq) + 4.)) * step(Y, H - 2.) * smoothstep(0., 40., Y);
    col = mix(col, mix(s, hazeColor(rd), mistK(aa)), c);
  }
  // trees along the airport fence: round crowns of varied size
  if (alt < 90.) {
    bool arrT = uDist * 1000. + off > uLand * 500.;
    float baseT = arrT ? uLand * 1000. : -150.;
    if (stripHit(150., rd, off, Y, a, aa)) {
      float x = a - baseT;
      float H = 0.;
      for (int k = -1; k <= 1; k++) {
        float ci = floor(x / 13.) + float(k);
        float hh = hash21(vec2(ci, 17.));
        float cxx = (ci + .3 + .4 * hash21(vec2(ci, 3.))) * 13.;
        float rw = 3.2 + 2.2 * hh, th = 2.5 + 6. * hh * hh;
        float dx = (x - cxx) / rw;
        H = max(H, (th - 1.) * sqrt(max(1. - dx * dx, 0.)) + 1.5 * step(abs(dx), 1.) );
      }
      H *= step(-400., x) * step(x, 2500.) * step(.4, fbmL(vec2(x / 380., 1.3), aa / 380.));
      float c = cov(Y, H, aa) * (1. - smoothstep(8., 35., alt));
      vec3 leaf = silhouette(.05) * vec3(.85, 1.1, .8) + uSunC * .025 * (.4 + .6 * hash21(vec2(floor(x / 1.5), floor(Y / 1.5))));
      col = mix(col, mix(leaf, hazeColor(rd), mistK(aa)), c);
    }
  }
  // terminal: low concourse, control tower, apron masts, parked aircraft
  if (alt < 160.) {
    bool arr = uDist * 1000. + off > uLand * 500.;
    float base = arr ? uLand * 1000. : -150.;
    float fade = 1. - smoothstep(60., 160., alt);
    if (stripHit(430., rd, off, Y, a, aa)) {
      float x = a - base;
      float cell = floor(x / 70.);
      float hh = 12. + 6. * step(.5, hash21(vec2(cell, 3.))) + 4. * hash21(vec2(cell, 6.));
      float H = (x > -300. && x < 2250. ? hh : 0.);
      float tx = arr ? 940. : 470.;
      float shaft = 1. - smoothstep(0., aa, abs(x - tx) - 4.5);
      float cab = (1. - smoothstep(0., aa, abs(x - tx) - 11.)) * step(46., Y) * step(Y, 60.);
      float c = max(cov(Y, H, aa), max(shaft * cov(Y, 52., aa), cab)) * fade;
      vec3 s = silhouette(.08) * .9;
      // ribbon windows: two lit bands with mullions, some bays dark
      float seg = hash21(vec2(floor(x / 38.), 3.));
      float bays = step(.16, seg) * (.55 + .45 * hash21(vec2(floor(x / 4.2), floor(Y / 4.))));
      float ribbon = (step(2.4, Y) * step(Y, 5.9) + step(7.4, Y) * step(Y, 10.8)) * step(.14, fract(x / 4.2)) * step(x, 2250.) * step(-300., x) * step(Y, H - .8) * (1. - smoothstep(1.2, 3., aa));
      vec3 wc = mix(vec3(1., .78, .5), vec3(.82, .93, 1.), step(.55, seg));
      s += wc * ribbon * bays * (.28 + .95 * uLights);
      s += vec3(1., .78, .5) * (1. - smoothstep(0., aa, abs(Y - 11.8))) * step(0., Y) * 0.;
      s += vec3(.9, 1., .9) * cab * step(Y, 56.) * (.6 + .8 * uLights);
      float mk = mistK(aa);
      col = mix(col, mix(s, hazeColor(rd), mk), c);
      // beacon on top of the tower
      float bk = step(.5, fract(uTime * .45));
      col += vec3(.5, 1., .6) * exp(-dot(vec2(x - tx, Y - 62.), vec2(x - tx, Y - 62.)) / (4. + aa * aa * 2.)) * (.5 + 1.5 * bk) * (.3 + uLights) * fade;
    }
    if (stripHit(330., rd, off, Y, a, aa)) {
      float x = a - base;
      float mx = floor((x - 140.) / 280. + .5) * 280. + 140.;
      float pole = (1. - smoothstep(0., aa, abs(x - mx) - .3)) * cov(Y, 28., aa) * step(500., mx) * step(mx, 2000.) * fade;
      col = mix(col, mix(silhouette(.1) * .8, hazeColor(rd), mistK(aa)), pole);
      float head = exp(-dot(vec2(x - mx, Y - 28.), vec2(x - mx, Y - 28.)) / (1.2 + aa * aa * 2.)) * step(500., mx) * step(mx, 2000.);
      col += vec3(1., .7, .4) * head * (.4 + 5. * uLights) * fade;
    }
    if (stripHit(250., rd, off, Y, a, aa)) {
      float x2 = a - base;
      float ph = mod(x2 + 12., 75.);
      float n = floor((x2 + 12.) / 75.);
      float present = step(.35, hash21(vec2(n, 14.))) * step(0., x2) * step(x2, 2000.);
      float body = ph < 38. ? 5.6 * (ph > 2. ? 1. : .6) : 0.;
      float fin = (ph > 30. && ph < 38.) ? 5.6 + (ph - 30.) * 0.95 : 0.;
      float H = max(body, fin) * present;
      float c = cov(Y, H, aa) * step(0., Y) * fade;
      vec3 s = silhouette(.15) * 1.2 + vec3(.05, .05, .06);
      float nav = exp(-dot(vec2(ph - 31., Y - 12.4), vec2(ph - 31., Y - 12.4)) / (.8 + aa * aa)) * present;
      col = mix(col, mix(s, hazeColor(rd), mistK(aa)), c);
      col += vec3(1., .08, .06) * nav * (.4 + .6 * step(.5, fract(uTime * .8 + n))) * 1.5 * fade;
    }
  }
  return col;
}

// ---- compose ---------------------------------------------------------------------------
void main() {
  vec2 s = (gl_FragCoord.xy - uC) / uF;
  vec3 rc = normalize(vec3(s, 1.));
  vec3 body = vec3(-rc.x, rc.y, rc.z);
  float cr = cos(uAtt.y), sr = sin(uAtt.y), cp = cos(uAtt.x), sp = sin(uAtt.x);
  vec3 r1 = vec3(body.x, body.y * cr - body.z * sr, body.y * sr + body.z * cr);
  vec3 rd = vec3(r1.x * cp - r1.y * sp, r1.x * sp + r1.y * cp, r1.z);

  float d0 = atan(sqrt(uAlt * (2. * R + uAlt)) / R);
  float dc = uAlt > DECK_TOP ? atan(sqrt((uAlt - DECK_TOP) * (2. * R + uAlt + DECK_TOP)) / (R + DECK_TOP)) : 0.;
  float dv = mix(d0, dc, smoothstep(DECK_TOP, DECK_TOP + 1., uAlt));
  float eh = asin(clamp(rd.y, -1., 1.)) + dv;

  gVis = 30. * pow(1.5 / 30., uHaze) * mix(1., 3., smoothstep(.05, 1.5, uAlt));
  vec3 sky = skyColor(rd, eh);
  sky = cloudBelow(sky, rd);
  float tg = shell(0., rd.y, false);
  if (tg <= 0. && eh < 0.) tg = shell(0., rd.y, true);
  vec4 cl = cloudAbove(rd);

  vec3 col;
  if (cl.a > .985) col = cl.rgb;
  else if (tg <= 0.) {
    col = sky;
    if (uAlt < 6.) col = strips(col, rd, 0.);   // ridge lines above the horizon
    if (cl.a > 0.) col = mix(col, cl.rgb, cl.a);
  } else {
    // ground: the landscape is computed once, the airport and silhouettes per blur sample
    vec3 pos = vec3(rd.x * tg, R + uAlt + rd.y * tg, rd.z * tg);
    vec3 n = normalize(pos);
    float ndr = max(-dot(rd, n), .015), ndl = dot(n, uSun);
    float fp = tg * 1000. / uF / ndr;
    gFpx = tg * 1000. / uF; gNdr = ndr;
    vec3 refl = reflect(rd, n);
    float glint = pow(sat(dot(refl, uSun)), 40.) * uSunVis;
    vec2 P0 = vec2(uDist * 1000. + rd.x * tg * 1000., uSide + rd.z * tg * 1000.);

    vec3 landEmis, cityEmis; float landGloss, cityGloss;
    vec3 landAlb = landscape(P0, fp, landEmis, landGloss);
    // towns: one beside the departure airport, a big city around the arrival one
    vec2 c0 = vec2(2300., 2900.), c1 = vec2(uLand * 1000. + 2600., 5400.);
    float warp = (fbmL(P0 / 2800., fp / 2800.) - .5) * .5;
    float u = max(1. - smoothstep(.5, 1., length((P0 - c0) * vec2(1., 1.2)) / 2600. + warp), 1. - smoothstep(.45, 1., length((P0 - c1) * vec2(1., 1.1)) / 12500. + warp));
    if (u > .002) {
      vec3 cc = cityAlbedo(P0, fp, u, cityEmis, cityGloss);
      landAlb = mix(landAlb, cc, smoothstep(0., .25, u));
      landEmis += cityEmis; landGloss = mix(landGloss, cityGloss, smoothstep(0., .25, u));
    }
    // cloud shadows
    if (uAlt > .25 && fp < 3000.) {
      vec2 so = sunDirH() * min(DECK_TOP * 1000. / max(uSun.y, .2), 6000.);
      landAlb *= 1. - .5 * deckDens(P0 + so, max(fp, 200.)) * sunLevel();
    }

    float sl = smoothstep(-.06, .1, ndl);
    vec3 lightC = uAmb * (.65 + .35 * n.y) + uSunC * (max(ndl, 0.) * .95 + .2 * sl);
    float hs = 8., path = hs * (1. - exp(-uAlt / hs)) / ndr, fogK = 1. - exp(-path / gVis);
    vec3 hz = hazeColor(rd);
    float fres = .04 + .96 * pow(1. - ndr, 5.);

    int cnt = int(clamp(uBlurN, 1., 12.));
    vec3 acc = vec3(0.);
    for (int i = 0; i < 12; i++) {
      if (i >= cnt) break;
      float off = ((float(i) + .5) / float(cnt) - .5) * uBlur;
      vec2 P = P0 + vec2(off, 0.);
      vec3 alb = landAlb, emis = landEmis;
      float gloss = landGloss;
      // airports at both ends of the flight
      bool arr = P.x > uLand * 500.;
      vec2 q = arr ? vec2(P.x - uLand * 1000., P.y) : vec2(P.x + 150., P.y);
      if (abs(q.x - 1500.) < 1750. && q.y > -150. && q.y < 520.) {
        vec3 ea; float ag;
        vec3 ac = airportSurf(q, fp, ea, ag);
        float m = box(q, vec2(1500., 185.), vec2(1620., 330.), 90.);
        alb = mix(alb, ac, m); emis = mix(emis, ea, m); gloss = mix(gloss, ag, m);
      }
      vec3 c = alb * lightC * 1.15 + emis;
      c += hz * gloss * fres * (.5 + .5 * sl);                 // sheen: pavement and water mirror the sky
      c += (uSunC * 1.2 + uGlowC) * glint * gloss * (.4 + .6 * fres);    // and the sun's reflection
      c = mix(c, hz, fogK);
      acc += uAlt < 6. ? strips(c, rd, off) : c;
    }
    col = acc / float(cnt);
    if (cl.a > 0.) col = mix(col, cl.rgb, cl.a);
  }
  col = inCloud(col, s, rd);

  // tone: keep midtones, roll highlights off, a touch of grain
  float m = max(col.r, max(col.g, col.b));
  if (m > .82) col *= (.82 + .18 * (1. - exp(-(m - .82) / .18))) / m;
  col = mix(col, vec3(1.), smoothstep(1.4, 3., m) * .5);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.7) - .5) * (1.6 / 255.);
  outColor = vec4(clamp(col, 0., 1.), 1.);
}`;
