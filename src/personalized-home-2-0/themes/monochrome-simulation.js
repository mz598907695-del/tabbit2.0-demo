/**
 * Restrained monochrome interpretations of the selected references:
 * #13 React Bits Liquid Ether — a projected, advected velocity field.
 * https://www.reactbits.dev/backgrounds/liquid-ether
 * #26 Pavel Dobryakov's WebGL Fluid Simulation — persistent dye in that field.
 * https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
 * #39 Three.js Compute Water — neighboring heights exchange momentum.
 * https://threejs.org/examples/webgpu_compute_water.html
 *
 * This is an independently written low-resolution solver, not the original
 * components. State is packed into RGBA8 so floating-point color-buffer support
 * is unnecessary. Use simulationEffect to decode the public texture.
 */

const SIZE = 192;
const VELOCITY_RANGE = 0.6;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const VERTEX = `#version 300 es
out vec2 simUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  simUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const PACK = `
vec2 simPack(float v) {
  float n = floor(clamp(v, -1.0, 1.0) * 32767.0 + 32768.0 + 0.5);
  return vec2(floor(n / 256.0), mod(n, 256.0)) / 255.0;
}
float simUnpack(vec2 p) { return (dot(p, vec2(65280.0, 255.0)) - 32768.0) / 32767.0; }
vec2 simVelocity(sampler2D f, vec2 uv) {
  vec4 p = texture(f, clamp(uv, vec2(0.0027), vec2(0.9973)));
  return vec2(simUnpack(p.rg), simUnpack(p.ba)) * 0.6;
}
`;

const HEADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 simUV;
out vec4 outputState;
uniform sampler2D uField;
uniform sampler2D uAux;
uniform vec2 uPixel;
uniform float uDt;
uniform float uTime;
uniform float uInk;
uniform vec4 uPointer;
uniform vec2 uFrom;
uniform float uImpulse;
${PACK}
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 d = b - a;
  return length(p - mix(a, b, clamp(dot(p-a,d)/(dot(d,d)+0.0000001),0.0,1.0)));
}
`;

const ADVECT = `${HEADER}
void main() {
  vec2 old = simVelocity(uField, simUV);
  vec2 origin = simUV - old * uDt;
  vec2 velocity = simVelocity(uField, origin) * exp(-uDt * mix(0.24, 0.12, uInk));
  outputState = vec4(simPack(velocity.x / 0.6), simPack(velocity.y / 0.6));
}`;

const FORCE = `${HEADER}
float curlAt(vec2 uv) {
  vec2 l = simVelocity(uField, uv - vec2(uPixel.x, 0));
  vec2 r = simVelocity(uField, uv + vec2(uPixel.x, 0));
  vec2 b = simVelocity(uField, uv - vec2(0, uPixel.y));
  vec2 t = simVelocity(uField, uv + vec2(0, uPixel.y));
  return (r.y - l.y - t.x + b.x) * 0.5;
}
void main() {
  vec2 v = simVelocity(uField, simUV);
  float curl = curlAt(simUV);
  vec2 g = vec2(abs(curlAt(simUV + vec2(uPixel.x,0))) - abs(curlAt(simUV - vec2(uPixel.x,0))),
                abs(curlAt(simUV + vec2(0,uPixel.y))) - abs(curlAt(simUV - vec2(0,uPixel.y))));
  vec2 normal = g / (length(g) + 0.00005);
  v += vec2(normal.y, -normal.x) * curl * uDt * mix(7.0, 18.0, uInk);
  float radius = mix(0.055, 0.027, uInk);
  float distanceToStroke = segmentDistance(simUV, uFrom, uPointer.xy);
  float stroke = exp(-pow(distanceToStroke / radius, 2.0));
  vec2 delta = uPointer.zw;
  v += delta * stroke * uImpulse * mix(0.65, 1.1, uInk);
  // A very faint boundary current keeps the background alive between gestures.
  vec2 center = vec2(0.17 + 0.035*sin(uTime*0.13), 0.68 + 0.05*cos(uTime*0.11));
  vec2 d = simUV-center;
  v += vec2(-d.y,d.x) * exp(-dot(d,d)*48.0) * uDt * 0.07;
  float wall = smoothstep(0.0,0.035,simUV.x) * smoothstep(0.0,0.035,simUV.y)
    * smoothstep(0.0,0.035,1.0-simUV.x) * smoothstep(0.0,0.035,1.0-simUV.y);
  v *= mix(0.5,1.0,wall);
  outputState = vec4(simPack(v.x/0.6),simPack(v.y/0.6));
}`;

const DIVERGENCE = `${HEADER}
void main() {
  vec2 l=simVelocity(uField,simUV-vec2(uPixel.x,0));
  vec2 r=simVelocity(uField,simUV+vec2(uPixel.x,0));
  vec2 b=simVelocity(uField,simUV-vec2(0,uPixel.y));
  vec2 t=simVelocity(uField,simUV+vec2(0,uPixel.y));
  float div=(r.x-l.x+t.y-b.y)*0.5;
  outputState=vec4(simPack(div),0.0,1.0);
}`;

const PRESSURE = `${HEADER}
float pressure(vec2 uv) { return simUnpack(texture(uField,uv).rg); }
void main() {
  float sum=pressure(simUV-vec2(uPixel.x,0))+pressure(simUV+vec2(uPixel.x,0))
    +pressure(simUV-vec2(0,uPixel.y))+pressure(simUV+vec2(0,uPixel.y));
  float divergence=simUnpack(texture(uAux,simUV).rg);
  outputState=vec4(simPack((sum-divergence)*0.25),0.0,1.0);
}`;

const PROJECT = `${HEADER}
float pressure(vec2 uv) { return simUnpack(texture(uAux,uv).rg); }
void main() {
  vec2 gradient=vec2(pressure(simUV+vec2(uPixel.x,0))-pressure(simUV-vec2(uPixel.x,0)),
    pressure(simUV+vec2(0,uPixel.y))-pressure(simUV-vec2(0,uPixel.y)))*0.5;
  vec2 v=simVelocity(uField,simUV)-gradient;
  outputState=vec4(simPack(v.x/0.6),simPack(v.y/0.6));
}`;

const DYE = `${HEADER}
void main() {
  vec2 v=simVelocity(uAux,simUV);
  float old=simUnpack(texture(uField,simUV-v*uDt).rg)*0.5+0.5;
  float radius=0.022;
  float d=segmentDistance(simUV,uFrom,uPointer.xy);
  float stroke=exp(-pow(d/radius,2.0))*uImpulse;
  float density=old*exp(-uDt*0.30)+stroke*0.23;
  // Rare, low-contrast eddies at the margin, not a central auto-demo sweep.
  vec2 p=simUV-vec2(0.15+0.025*sin(uTime*.11),.72);
  density+=exp(-dot(p,p)*190.0)*uDt*.012;
  outputState=vec4(simPack(clamp(density,0.0,1.0)*2.0-1.0),0.0,1.0);
}`;

const WATER = `${HEADER}
float heightAt(vec2 uv) { return simUnpack(texture(uField,uv).rg); }
void main() {
  vec4 current=texture(uField,simUV);
  float h=simUnpack(current.rg);
  float previous=simUnpack(current.ba);
  float lap=heightAt(simUV-vec2(uPixel.x,0))+heightAt(simUV+vec2(uPixel.x,0))
    +heightAt(simUV-vec2(0,uPixel.y))+heightAt(simUV+vec2(0,uPixel.y))-4.0*h;
  float next=h+(h-previous)*0.982+lap*0.42;
  float d=segmentDistance(simUV,uFrom,uPointer.xy);
  next+=exp(-pow(d/0.019,2.0))*uImpulse*0.055;
  float edge=min(min(simUV.x,1.0-simUV.x),min(simUV.y,1.0-simUV.y));
  next*=mix(0.88,0.9995,smoothstep(0.0,0.05,edge));
  outputState=vec4(simPack(clamp(next,-0.9,0.9)),simPack(h));
}`;

// Called from the host's full-screen display program. All three return grayscale
// energy in 0..1; the host applies a restrained final contrast and neutral palette.
export const simulationDisplayGLSL = `
float monoSimValue(vec2 p) { return (dot(p,vec2(65280.0,255.0))-32768.0)/32767.0; }
float simulationEffect(vec2 uv,float time,sampler2D field,int kind) {
  vec4 state=texture(field,uv);
  if(kind==0) {
    vec2 flow=vec2(monoSimValue(state.rg),monoSimValue(state.ba))*.6;
    float speed=length(flow);
    float satin=pow(clamp(speed*13.0,0.0,1.0),0.72);
    return satin*.8;
  }
  if(kind==1) {
    float ink=monoSimValue(state.rg)*.5+.5;
    vec2 pixel=1.0/vec2(textureSize(field,0));
    float l=monoSimValue(texture(field,uv-vec2(pixel.x,0)).rg);
    float r=monoSimValue(texture(field,uv+vec2(pixel.x,0)).rg);
    float b=monoSimValue(texture(field,uv-vec2(0,pixel.y)).rg);
    float t=monoSimValue(texture(field,uv+vec2(0,pixel.y)).rg);
    float ridge=length(vec2(r-l,t-b));
    return clamp(pow(max(ink,0.0),.78)*.85+ridge*.5,0.0,1.0);
  }
  vec2 pixel=1.0/vec2(textureSize(field,0));
  float h=monoSimValue(state.rg);
  float l=monoSimValue(texture(field,uv-vec2(pixel.x,0)).rg);
  float r=monoSimValue(texture(field,uv+vec2(pixel.x,0)).rg);
  float b=monoSimValue(texture(field,uv-vec2(0,pixel.y)).rg);
  float t=monoSimValue(texture(field,uv+vec2(0,pixel.y)).rg);
  vec2 slope=vec2(r-l,t-b)*8.0;
  float reflection=dot(normalize(vec3(-slope,1.0)),normalize(vec3(-.5,.65,1.0)));
  // Reflection bands bend with the simulated height rather than using a fixed
  // concentric-circle animation. Keep the base sheet faint at complete rest.
  float band=sin((uv.x*.75+uv.y)*13.0+h*5.0+time*.045)*.5+.5;
  return clamp(.12+abs(reflection-.773)*3.0+abs(h)*.45+band*.10,0.0,1.0);
}
`;

function compileProgram(gl, fragmentSource) {
  const shaders=[];
  let program=null;
  try {
    for(const [type,source] of [[gl.VERTEX_SHADER,VERTEX],[gl.FRAGMENT_SHADER,fragmentSource]]) {
      const shader=gl.createShader(type);
      if(!shader) throw new Error('Unable to allocate monochrome simulation shader');
      shaders.push(shader);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)||'Simulation shader compilation failed');
    }
    program=gl.createProgram();
    if(!program) throw new Error('Unable to allocate monochrome simulation program');
    shaders.forEach(shader=>gl.attachShader(program,shader));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Simulation program linking failed');
    const names=['uField','uAux','uPixel','uDt','uTime','uInk','uPointer','uFrom','uImpulse'];
    return {program,uniforms:Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]))};
  } catch(error) {
    if(program)gl.deleteProgram(program);
    throw error;
  } finally {shaders.forEach(shader=>gl.deleteShader(shader));}
}

function packed(value) {
  const n=Math.round(clamp(value,-1,1)*32767+32768);
  return [n>>8,n&255];
}

/** Caller owns context loss/recreation, viewport restoration and animation policy. */
export function createSimulation(gl, kind) {
  if(!['ether','ink','water'].includes(kind)) throw new Error(`Unknown monochrome simulation: ${kind}`);
  const targets=[];const programs=[];
  let vao=null;let disposed=false;let elapsed=0;let waterRemainder=0;let pendingClick=false;
  const makeTarget=(data)=>{
    const texture=gl.createTexture();const framebuffer=gl.createFramebuffer();
    if(!texture||!framebuffer) {
      if(texture)gl.deleteTexture(texture);if(framebuffer)gl.deleteFramebuffer(framebuffer);
      throw new Error('Unable to allocate monochrome simulation target');
    }
    const target={texture,framebuffer};targets.push(target);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,SIZE,SIZE,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('Monochrome simulation framebuffer incomplete');
    return target;
  };
  const pair=data=>({read:makeTarget(data),write:makeTarget(data)});
  const swap=p=>{[p.read,p.write]=[p.write,p.read];};
  const createProgram=source=>{const p=compileProgram(gl,source);programs.push(p);return p;};
  const dispose=()=>{
    if(disposed)return;disposed=true;
    targets.forEach(t=>{gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);});
    programs.forEach(p=>gl.deleteProgram(p.program));if(vao)gl.deleteVertexArray(vao);
  };
  const seed=(type)=>{
    const bytes=new Uint8Array(SIZE*SIZE*4);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++) {
      const u=(x+.5)/SIZE,v=(y+.5)/SIZE,i=(y*SIZE+x)*4;
      let a=0,b=0;
      if(type==='velocity') {
        for(const [cx,cy,strength,radius] of [[.19,.67,.12,.12],[.8,.29,-.075,.18],[.64,.76,.045,.10]]) {
          const dx=u-cx,dy=v-cy;const k=Math.exp(-(dx*dx+dy*dy)/radius);
          a-=dy*k*strength/VELOCITY_RANGE;b+=dx*k*strength/VELOCITY_RANGE;
        }
      } else if(type==='dye') {
        const path=.29+.15*Math.sin(u*7.0);
        const dye=.32*Math.exp(-((v-path)**2)/.018)*Math.exp(-((u-.3)**2)/.19)
          +.11*Math.exp(-((u-.76)**2+(v-.78)**2)/.028);
        a=dye*2-1;
      } else if(type==='water') {
        const d=Math.hypot(u-.23,v-.68);
        a=.042*Math.exp(-(((d-.13)/.035)**2));b=a;
      }
      const pa=packed(a),pb=packed(b);bytes[i]=pa[0];bytes[i+1]=pa[1];bytes[i+2]=pb[0];bytes[i+3]=pb[1];
    }
    return bytes;
  };
  let state,velocity,dye,pressure,divergence,p;
  try {
    vao=gl.createVertexArray();if(!vao)throw new Error('Unable to allocate monochrome simulation VAO');
    if(kind==='water') {state=pair(seed('water'));p={water:createProgram(WATER)};}
    else {
      velocity=pair(seed('velocity'));pressure=pair(seed('neutral'));divergence=makeTarget(seed('neutral'));
      if(kind==='ink')dye=pair(seed('dye'));
      p={advect:createProgram(ADVECT),force:createProgram(FORCE),divergence:createProgram(DIVERGENCE),pressure:createProgram(PRESSURE),project:createProgram(PROJECT)};
      if(kind==='ink')p.dye=createProgram(DYE);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  } catch(error) {dispose();gl.bindFramebuffer(gl.FRAMEBUFFER,null);throw error;}

  function pass(entry,output,field,aux,dt,input,impulse) {
    gl.useProgram(entry.program);gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER,output.framebuffer);gl.viewport(0,0,SIZE,SIZE);
    const u=entry.uniforms;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,field.texture);gl.uniform1i(u.uField,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,(aux||field).texture);gl.uniform1i(u.uAux,1);
    gl.uniform2f(u.uPixel,1/SIZE,1/SIZE);gl.uniform1f(u.uDt,dt);gl.uniform1f(u.uTime,elapsed);
    gl.uniform1f(u.uInk,kind==='ink'?1:0);
    gl.uniform4f(u.uPointer,input.x,input.y,input.dx,input.dy);
    gl.uniform2f(u.uFrom,clamp(input.x-input.dx,0,1),clamp(input.y-input.dy,0,1));
    gl.uniform1f(u.uImpulse,impulse);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function step(dt,pointer={}) {
    if(disposed)return;
    dt=clamp(Number.isFinite(dt)?dt:0,0,.05);
    if(dt<=0)return;
    elapsed+=dt;
    const input={x:clamp(pointer.x??.5,0,1),y:clamp(pointer.y??.5,0,1),dx:clamp(pointer.dx||0,-.08,.08),dy:clamp(pointer.dy||0,-.08,.08)};
    const moving=Math.hypot(input.dx,input.dy)>.0002;
    // The host may use an eased numeric activation as well as a boolean.
    const active=Number(pointer.active) > .01;
    gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.DEPTH_TEST);
    if(kind==='water') {
      pendingClick ||= Boolean(pointer.click&&active);
      waterRemainder+=dt;
      let iterations=0;
      while(waterRemainder>=1/60&&iterations<3) {
        let impulse=active&&pointer.down&&moving ? .35 : 0;
        if(pendingClick){impulse=1;pendingClick=false;}
        // An occasional edge drop provides quiet idle motion without a splash demo.
        const period=elapsed%11;
        if(!active && period<1/60) {
          input.x=.16+.035*Math.sin(elapsed*.1);input.y=.76;
          input.dx=input.dy=0;impulse=.15;
        }
        pass(p.water,state.write,state.read,null,1/60,input,impulse);swap(state);
        waterRemainder-=1/60;iterations++;
      }
    } else {
      const impulse=active&&moving&&(kind==='ether'||pointer.down)?1:0;
      pass(p.advect,velocity.write,velocity.read,null,dt,input,0);swap(velocity);
      pass(p.force,velocity.write,velocity.read,null,dt,input,impulse);swap(velocity);
      pass(p.divergence,divergence,velocity.read,null,dt,input,0);
      for(let i=0;i<9;i++){pass(p.pressure,pressure.write,pressure.read,divergence,dt,input,0);swap(pressure);}
      pass(p.project,velocity.write,velocity.read,pressure.read,dt,input,0);swap(velocity);
      if(dye){pass(p.dye,dye.write,dye.read,velocity.read,dt,input,impulse);swap(dye);}
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  return {step,get texture(){return kind==='water'?state.read.texture:(dye||velocity).read.texture;},dispose};
}
