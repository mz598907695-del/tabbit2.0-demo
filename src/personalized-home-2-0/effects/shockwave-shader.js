// A single lens envelope bends the page; the four colors do not make four
// displacement waves. Coordinates are CSS pixels, independent of resolution.
export const SHOCKWAVE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPage;
uniform sampler2D uLines;
uniform vec2 uSize;
uniform vec2 uOrigin;
uniform vec3 uColors[4];
uniform float uRadius;
uniform float uStrength;
uniform float uDark;
uniform float uSnapshot;
uniform float uReduced;
uniform float uBrightness;
uniform float uLightOpacity;
uniform float uDarkOpacity;
uniform float uRingWidth;
uniform float uLens;
uniform float uBevel;
uniform float uChromatic;
uniform float uGlint;

vec2 uvAt(vec2 p) { return vec2(clamp(p.x / uSize.x,0.,1.), 1. - clamp(p.y / uSize.y,0.,1.)); }
void main() {
  vec2 p = vec2(vUv.x * uSize.x, (1. - vUv.y) * uSize.y);
  vec2 delta=p-uOrigin;
  float distanceFromOrigin=length(delta);
  vec2 direction=delta/max(distanceFromOrigin,.001);
  float x=(distanceFromOrigin-uRadius)/uRingWidth;
  vec3 ring=vec3(0.);
  float weights=0.;
  for (int i=0;i<4;i++) {
    float c=float(i)-1.5;
    float weight=exp(-pow((x-c)/.8,2.));
    ring+=uColors[i]*weight;
    weights+=weight;
  }
  ring/=max(weights,.00001);
  // Brighten the light itself, keeping sampled page pixels unchanged.
  ring=clamp(ring*uBrightness,0.,1.);
  float envelope=exp(-1.1*pow(x/2.,2.));
  float wave=envelope*uStrength;
  if(wave<.0005) { outColor=vec4(0.); return; }
  float edgeDistance=min(min(p.x,uSize.x-p.x),min(p.y,uSize.y-p.y));
  float bendFade=smoothstep(0.,56.,edgeDistance);
  float z=x*.75;
  float push=uLens*2.33*z*exp(-z*z)*uStrength*bendFade*(1.-uReduced);
  vec2 lensOffset=-direction*push;
  vec2 offset=lensOffset;

  // Side and bottom bevel; the top edge under the toolbar stays straight.
  float bevelDistance=min(min(p.x,uSize.x-p.x),uSize.y-p.y);
  vec2 inward=bevelDistance==p.x ? vec2(1.,0.) : (bevelDistance==uSize.x-p.x ? vec2(-1.,0.) : vec2(0.,-1.));
  float bevel=uBevel*pow(max(0.,1.-bevelDistance/60.),2.)*wave*(1.-uReduced);
  offset+=inward*bevel;
  float bevelLight=exp(-bevelDistance/7.)*wave*(1.-uReduced);
  if(uSnapshot<.001) {
    float alpha=wave*mix(uLightOpacity,uDarkOpacity,uDark);
    outColor=vec4(ring*alpha,alpha);
    return;
  }
  vec4 page=texture(uPage,uvAt(p+offset));
  vec3 sampled=vec3(texture(uPage,uvAt(p+offset+lensOffset*uChromatic)).r, page.g, texture(uPage,uvAt(p+offset-lensOffset*uChromatic)).b);
  vec3 tintLight=mix(sampled,ring,wave*uLightOpacity)+ring*wave*uLightOpacity*.2;
  vec3 tintDark=1.-(1.-sampled)*(1.-ring*wave*uDarkOpacity);
  vec3 color=mix(tintLight,tintDark,uDark);
  // A separate, border-only geometry mask keeps text, logos and photos dark.
  float line=texture(uLines,uvAt(p+offset)).r;
  float glint=exp(-1.4*pow(x/2.,2.))*uStrength*mix(.3,.14,uDark)*line*(1.-uReduced)*uGlint;
  color+=mix(ring,vec3(1.),.2)*glint+mix(ring,vec3(1.),.45)*bevelLight*.14*uGlint;
  // Replace the bent band instead of blending two displaced copies of text.
  // Only its feathered outer fringe blends into the live page.
  float coverage=smoothstep(0.,.15,wave);
  float alpha=coverage*mix(wave*uLightOpacity,1.,page.a);
  float haloAlpha=wave*mix(uLightOpacity,uDarkOpacity,uDark);
  outColor=mix(vec4(ring*haloAlpha,haloAlpha),vec4(clamp(color,0.,1.)*alpha,alpha),uSnapshot);
}
`;
