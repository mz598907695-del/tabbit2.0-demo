const vertex = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D art;
uniform vec4 viewRect,head,torso,tail,paw,composer,poop;
uniform vec2 size,headPivot,tailPivot,pawPivot,mouth;
uniform vec4 pose;
uniform vec4 sceneInfo,catBounds;
uniform vec4 prop;
uniform vec2 propPivot;
uniform vec3 propPose;
uniform float blink,cleaned,original,time,earMotion;
uniform vec4 eyes[2];
uniform vec4 ears[2];
uniform vec4 uiMasks[2];
uniform vec4 effects[8];
uniform float effectPower[8];
uniform vec4 waterEdges[8];
uniform float waterEdgeCount;
// A broad, rigid centre carries the painted silhouette; a soft outer band joins it to the untouched art.
float region(vec2 p,vec4 e){vec2 q=(p-e.xy)/max(e.zw,vec2(.00001));return 1.-smoothstep(.58,1.42,length(q));}
float breathing(vec2 p,vec4 e){vec2 q=(p-e.xy)/max(e.zw,vec2(.00001));float support=1.-smoothstep(.62,1.3,length(q));return support*(1.-smoothstep(.12,.97,q.y));}
float box(vec2 p,vec4 r,float feather){vec2 d=min(p-r.xy,r.xy+r.zw-p);return smoothstep(0.,feather,min(d.x,d.y));}
float waterArea(vec2 p){
 float inside=0.;
 for(int i=0;i<8;i++){
  if(float(i)<waterEdgeCount){
   vec4 edge=waterEdges[i];vec2 a=edge.xy,b=edge.zw;
   if((a.y>p.y)!=(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=1.-inside;
  }
 }
 vec2 pad=vec2(6.)/size;
 float catMask=box(p,vec4(catBounds.xy-pad,catBounds.zw+pad*2.),.002);
 return inside*(1.-catMask);
}
vec2 turn(vec2 p,vec2 pivot,float a){vec2 q=(p-pivot)*size;float c=cos(a),s=sin(a);return pivot+vec2(c*q.x-s*q.y,s*q.x+c*q.y)/size;}
vec4 tex(vec2 p){return texture2D(art,clamp(p,vec2(.00001),vec2(.99999)));}
vec4 surface(vec2 p){
 vec4 c=tex(p);
 // Reconstruct only the old baked-in controls from neighbouring blank background.
 float m=box(p,composer,.003);
 float f=clamp((p.x-composer.x)/max(composer.z,.00001),0.,1.);
 vec4 fill=mix(tex(vec2(composer.x-.007,p.y)),tex(vec2(composer.x+composer.z+.007,p.y)),f);
 c=mix(c,fill,m);
 float l=box(p,uiMasks[0],.002);
 float r=box(p,uiMasks[1],.002);
 c=mix(c,tex(vec2(.09,p.y)),l);c=mix(c,tex(vec2(.92,p.y)),r);
 if(cleaned>.001){float k=box(p,poop,.002)*cleaned;c=mix(c,tex(p+vec2(poop.z+.01,0.)),k);}
 return c;
}
void main(){
 vec2 p=viewRect.xy+vec2(uv.x,1.-uv.y)*viewRect.zw;
 vec2 q=p;
 if(original<.5){
  q.y+=pose.x*breathing(p,torso);
  q+=(turn(p,headPivot,pose.y)-p)*region(p,head);
  q+=(turn(p,tailPivot,pose.z)-p)*region(p,tail);
  q+=(turn(p,pawPivot,pose.w)-p)*region(p,paw);
  for(int j=0;j<2;j++)q+=(turn(p,ears[j].xy+vec2(0.,ears[j].w),earMotion)-p)*region(p,ears[j]);
  // Keep the paper edge fixed in the partially hidden paper-hill scene.
  if(abs(sceneInfo.x-7.)<.1)q=mix(p,q,1.-smoothstep(.787,.799,p.y));
  vec2 delta=(q-p)*size;
  q=p+delta/max(1.,length(delta)/5.5)/size;
  // The painted prop has its own pivot. Never let its deformation reach the cat.
  if(prop.z>.00001){
   float support=region(p,prop)*(1.-box(p,catBounds,.003));
   vec2 propDelta=(turn(p,propPivot,propPose.z)-p)*size-propPose.xy;
   float limit=min(12.,min(prop.z*size.x,prop.w*size.y)*.32);
   propDelta/=max(1.,length(propDelta)/max(limit,.1));
   q+=propDelta/size*support;
  }
  // Only the water below the cat refracts. The cat and shore keep their outline.
  for(int i=0;i<8;i++){
   vec4 e=effects[i];float age=time-e.z;
   if(e.w>.5&&e.w<1.5&&age>0.&&age<3.8){
    vec2 d=(p-e.xy)*vec2(size.x/size.y,2.7);float dist=length(d);
    float radius=.008+age*.036;
    float wave=sin((dist-radius)*240.)*exp(-pow((dist-radius)/.022,2.))*sin(age/3.8*3.14159);
    q+=normalize(d+vec2(.00001))*vec2(.00065,.00024)*wave*effectPower[i]*waterArea(p);
   }
  }
 }
 vec4 c=surface(q);
 if(original<.5){
  for(int j=0;j<2;j++){
   vec4 e=eyes[j];
   if(e.z>.000001){
    vec2 d=(q-e.xy)/e.zw;
    float disk=1.-smoothstep(1.2,1.7,length(d));
    // Sample each eye's surrounding cheek, not the darker centre of the face.
    vec3 pigment=(tex(e.xy+vec2(e.z*1.9,0.)).rgb+tex(e.xy-vec2(e.z*1.9,0.)).rgb+tex(e.xy+vec2(0.,e.w*1.9)).rgb)/3.;
    if(sceneInfo.x>20.5){
     // Several new cats look sideways: sample toward the face, never across its outer silhouette.
     vec2 inward=normalize((head.xy-e.xy)/e.zw+vec2(.00001));
     vec2 across=vec2(-inward.y,inward.x);
     pigment=(tex(e.xy+inward*e.zw*2.2).rgb+tex(e.xy+(inward*2.6+across*.35)*e.zw).rgb+tex(e.xy+(inward*2.6-across*.35)*e.zw).rgb)/3.;
    }
    float openHeight=max(.055,1.-blink);
    float lid=max(smoothstep(openHeight-.06,openHeight+.06,abs(d.y)),smoothstep(.88,1.,blink));
    c.rgb=mix(c.rgb,pigment,disk*lid*smoothstep(0.,.18,blink));
    float seam=(1.-smoothstep(.07,.18,abs(d.y-.10-.12*d.x*d.x)))*(1.-smoothstep(.65,1.,abs(d.x)));
    c.rgb=mix(c.rgb,pigment*.65,seam*smoothstep(.75,1.,blink));
   }
  }
  for(int i=0;i<8;i++){
   vec4 e=effects[i];float age=time-e.z;
   if(e.w>.5&&age>=0.&&age<3.8){
    vec2 d=(p-e.xy)*vec2(size.x/size.y,1.);
    float life=sin(min(1.,age/3.8)*3.14159265)*effectPower[i];
    float radius=.008+age*.036;
    if(e.w<1.5){
     life*=waterArea(p);
     d.y*=2.7;float dist=length(d);
     float ring=exp(-pow((dist-radius)/.0017,2.))*.62;
     ring+=exp(-pow((dist-radius*.72)/.0014,2.))*.36;
     float edge=exp(-pow((dist-radius-.0024)/.0011,2.));
     c.rgb=mix(c.rgb,vec3(.36,.64,.77),edge*life*.15);
     c.rgb=mix(c.rgb,vec3(.9,.98,1.),ring*life);
    }else if(e.w<2.5){
     float line=exp(-pow((d.y-sin(d.x*35.+age*1.7)*.006)/.0008,2.));
     float fade=exp(-pow((d.x-age*.035)/.09,2.));
     float second=exp(-pow((d.y-.013-sin(d.x*29.+age*1.6)*.006)/.001,2.));
     c.rgb=mix(c.rgb,vec3(.73,.85,.9),(line+second*.6)*fade*life*.55);
    }else if(e.w<3.5){
     vec2 lightPoint=d-vec2(age*.014,-age*.002);
     float glow=exp(-dot(lightPoint*vec2(6.,14.),lightPoint*vec2(6.,14.)));
     c.rgb=mix(c.rgb,vec3(1.,.91,.72),glow*life*.28);
    }else if(e.w<4.5){
     float pad=exp(-dot(d*vec2(260.,330.),d*vec2(260.,330.)));
     for(int k=0;k<4;k++){
      float n=float(k);vec2 off=vec2((n-1.5)*.0034,-.006+abs(n-1.5)*.0015);
      pad+=exp(-dot((d-off)*550.,(d-off)*550.));
     }
     c.rgb=mix(c.rgb,vec3(.44,.61,.73),min(1.,pad)*life*.42);
    }else if(e.w<5.5){
     vec2 drift=d-vec2(age*.022,0.);
     float wash=exp(-dot(drift*vec2(6.,25.),drift*vec2(6.,25.)));
     c.rgb=mix(c.rgb,vec3(.98,.99,1.),wash*life*.42);
    }else if(e.w<6.5){
     vec2 star=d*vec2(1.,1.3);float ray=exp(-abs(star.x)*2200.)*exp(-abs(star.y)*100.);
     ray+=exp(-abs(star.y)*2200.)*exp(-abs(star.x)*100.);
     float halo=exp(-dot(star*70.,star*70.))*.09;
     c.rgb=mix(c.rgb,vec3(.86,.92,1.),min(1.,ray+halo)*life*.8);
    }else if(e.w<7.5){
     float ring=exp(-pow((length(d)-radius*.35)/.0008,2.));
     c.rgb=mix(c.rgb,vec3(.50,.57,.59),ring*life*.1);
    }else if(e.w<8.5){
     float fold=exp(-abs(d.x+d.y*1.8)*800.)*exp(-dot(d*18.,d*18.));
     c.rgb=mix(c.rgb,vec3(.65,.7,.75),fold*life*.24);
    }else if(e.w<9.5){
     float soft=exp(-dot(d*vec2(25.,36.),d*vec2(25.,36.)));
     c.rgb=mix(c.rgb,vec3(.75,.82,.67),soft*life*.3);
    }else if(e.w<10.5){
     float soft=exp(-dot(d*vec2(17.,25.),d*vec2(17.,25.)));
     c.rgb=mix(c.rgb,vec3(.79,.83,.91),soft*life*.3);
    }else if(e.w<11.5){
     float ridge=exp(-pow(d.y/.0016,2.))*exp(-pow(d.x/.09,2.));
     float shadow=exp(-pow((d.y-.002)/.0015,2.))*exp(-pow(d.x/.09,2.));
     c.rgb+=vec3((ridge*.16-shadow*.12)*life);
    }else if(e.w<12.5){
     float wash=exp(-dot(d/(.005+age*.003),d/(.005+age*.003)));
     c.rgb=mix(c.rgb,vec3(.5,.54,.56),wash*life*.3);
    }else if(e.w<13.5){
     float dash=exp(-pow(d.y/.0006,2.))*exp(-pow((d.x-age*.025)/.025,2.));
     c.rgb=mix(c.rgb,vec3(.38,.56,.65),dash*life*.5);
    }else if(e.w<14.5){
     float pencil=exp(-pow((d.y-d.x*.16)/.0005,2.))*exp(-pow(d.x/.025,2.));
     c.rgb=mix(c.rgb,vec3(.46,.5,.5),pencil*life*.36);
    }else if(e.w<15.5){
     vec2 grid=fract(p*size*.3)-.5;float dots=1.-smoothstep(.1,.3,length(grid));
     float spread=exp(-pow((length(d)-radius*.45)/.006,2.));
     c.rgb=mix(c.rgb,vec3(.49,.7,.82),dots*spread*life*.38);
    }else if(e.w<16.5){
     vec2 drop=d-vec2(sin(age*3.)*.002,age*.014);
     float bead=exp(-dot(drop*vec2(600.,360.),drop*vec2(600.,360.)));
     float shine=exp(-dot(d*170.,d*170.));
     c.rgb=mix(c.rgb,vec3(.62,.84,.85),(bead*.55+shine*.12)*life);
    }else if(e.w<17.5){
     vec2 leaf=d-vec2(age*.016+sin(age*2.)*.007,age*.011);
     float a=sin(age*2.)*.7;leaf=mat2(cos(a),-sin(a),sin(a),cos(a))*leaf;
     float form=1.-smoothstep(.75,1.,length(leaf/vec2(.005,.003)));
     c.rgb=mix(c.rgb,vec3(.80,.62,.31),form*life*.65);
    }else if(e.w<18.5){
     for(int k=0;k<3;k++){
      float n=float(k);vec2 seed=d-vec2(age*(.014+n*.004)+sin(age*2.+n)*.005,-age*.011-n*.006);
      float stem=exp(-pow(seed.x/.00045,2.))*step(-.004,seed.y)*step(seed.y,.004);
      float tuft=exp(-pow((seed.y+.004-abs(seed.x)*.7)/.00055,2.))*exp(-pow(seed.x/.0038,2.));
      c.rgb=mix(c.rgb,vec3(.57,.65,.59),min(1.,stem+tuft)*life*.55);
     }
    }else if(e.w<19.5){
     for(int k=0;k<5;k++){
      float n=float(k);vec2 dotp=d-vec2(sin(n*2.1)*age*.009,-abs(cos(n*2.1))*age*.012+age*age*.004);
      float dust=exp(-dot(dotp*700.,dotp*700.));
      c.rgb=mix(c.rgb,vec3(.72,.70,.57),dust*life*.65);
     }
    }else if(e.w<20.5){
     for(int k=0;k<3;k++){
      float n=float(k);vec2 b=d-vec2(sin(n*2.+age)*.012,-age*.016-n*.01);
      float r=.003+n*.0014;float ring=exp(-pow((length(b)-r)/.0007,2.));
      c.rgb=mix(c.rgb,vec3(.66,.77,.84),ring*life*.5);
     }
    }else if(e.w<21.5){
     for(int k=0;k<3;k++){
      float n=float(k);vec2 fire=d-vec2(sin(age*1.7+n*2.1)*.018,cos(age*1.2+n*2.)*.014-age*.003);
      float core=exp(-dot(fire*750.,fire*750.)),halo=exp(-dot(fire*140.,fire*140.))*.2;
      c.rgb=mix(c.rgb,vec3(1.,.86,.43),(core+halo)*life*(.65+.35*sin(age*3.+n)));
     }
    }else if(e.w<22.5){
     for(int k=0;k<5;k++){
      float n=float(k);vec2 rain=d-vec2((n-2.)*.012,mod(age*.08+n*.027,.12)-.06);
      float line=exp(-pow((rain.x+rain.y*.17)/.00055,2.))*exp(-pow(rain.y/.006,2.));
      c.rgb=mix(c.rgb,vec3(.54,.68,.76),line*life*.45);
     }
    }else if(e.w<23.5){
     for(int k=0;k<5;k++){
      float n=float(k);vec2 flake=d-vec2(sin(n*2.)*age*.008,age*.008-cos(n*2.)*.007);
      float snow=exp(-dot(flake*540.,flake*540.));
      c.rgb=mix(c.rgb,vec3(.61,.76,.86),snow*life*.5);
     }
    }else if(e.w<24.5){
     float thread=exp(-pow((d.y-sin(d.x*105.+age*2.)*.003)/.00065,2.))*exp(-pow(d.x/.025,2.));
     c.rgb=mix(c.rgb,vec3(.65,.52,.57),thread*life*.4);
    }else if(e.w<25.5){
     for(int k=0;k<3;k++){
      float n=float(k);vec2 petal=d-vec2(sin(age*1.6+n*2.)*.012+age*.01,age*.014-n*.007);
      float form=1.-smoothstep(.7,1.,length(petal/vec2(.0035,.002)));
      c.rgb=mix(c.rgb,vec3(.86,.62,.66),form*life*.6);
     }
    }else if(e.w<26.5){
     // A paper fold catches soft light; never draw a straight line through the hidden cat.
     vec2 glow=d-vec2(age*.004,-age*.003);
     float wash=exp(-dot(glow*vec2(24.,18.),glow*vec2(24.,18.)));
     float mask=region(p,prop)*(1.-box(p,catBounds,.003));
     c.rgb=mix(c.rgb,vec3(.99,.98,.94),wash*life*mask*.12);
    }else{
     vec2 drift=d-vec2(age*.012,-age*.004);
     float shade=exp(-dot(drift*vec2(17.,38.),drift*vec2(17.,38.)));
     float mask=region(p,prop)*(1.-box(p,catBounds,.003));
     c.rgb=mix(c.rgb,vec3(.57,.64,.53),shade*life*mask*.07);
    }
   }
  }
 }
 gl_FragColor=vec4(c.rgb,1.);
}`;

// Shared by the WebGL frame and its clean static fallback so their crop never jumps.
export function getSceneView(scene,width,height){
 const w=Math.max(1,width),h=Math.max(1,height);
 const [sw,sh]=scene.size,scale=Math.max(w/sw,h/sh);
 let vw=w/(sw*scale),vh=h/(sh*scale);
 const cat=scene.cat,prop=scene.prop;
 let cx=w<760?cat[0]+cat[2]/2:.5;
 if(w<760&&prop?.[2]>0){
  const left=Math.min(cat[0],prop[0]-prop[2]),right=Math.max(cat[0]+cat[2],prop[0]+prop[2]);
  cx=(left+right)/2;
  vw=Math.max(vw,Math.min(1,right-left+.035));vh=vw*sw*h/(sh*w);
 }
 const left=Math.max(0,Math.min(1-vw,cx-vw/2));
 return [left,(1-vh)/2,vw,vh];
}

export class ArtRenderer {
 constructor(canvas){
  this.canvas=canvas;this.view=[0,0,1,1];this.scene=null;this.disposed=false;this.shaders=[];
  this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!this.gl)throw new Error('当前浏览器没有启用 WebGL');
  const gl=this.gl;
  try{
  const compile=(type,source)=>{const s=gl.createShader(type);this.shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();this.program=program;gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);this.uniforms={};
  for(const name of ['art','viewRect','head','torso','tail','paw','composer','poop','size','headPivot','tailPivot','pawPivot','mouth','pose','prop','propPivot','propPose','sceneInfo','catBounds','blink','cleaned','original','time','eyes','ears','earMotion','uiMasks','effects','effectPower','waterEdges','waterEdgeCount'])this.uniforms[name]=gl.getUniformLocation(program,name);
  const buffer=gl.createBuffer();this.buffer=buffer;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(this.uniforms.art,0);
  }catch(error){this.dispose();throw error;}
 }
 setScene(scene,img){
  if(this.disposed)return;
  this.scene=scene;const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  const vec4=(name,value)=>gl.uniform4fv(this.uniforms[name],value||[0,0,0,0]);
  for(const name of ['head','torso','tail','paw','composer','poop'])vec4(name,scene[name]);
  gl.uniform2fv(this.uniforms.size,scene.size);
  gl.uniform4fv(this.uniforms.sceneInfo,[Number(scene.id),scene.surface||.8,0,0]);
  gl.uniform4fv(this.uniforms.catBounds,scene.cat);
  gl.uniform4fv(this.uniforms.prop,scene.prop||[0,0,0,0]);gl.uniform2fv(this.uniforms.propPivot,scene.propPivot||scene.prop?.slice(0,2)||[0,0]);
  const polygon=scene.waterPolygon||[],edges=polygon.map((a,i)=>[...a,...polygon[(i+1)%polygon.length]]);
  gl.uniform1f(this.uniforms.waterEdgeCount,edges.length);while(edges.length<8)edges.push([0,0,0,0]);gl.uniform4fv(this.uniforms.waterEdges,edges.flat());
  for(const name of ['head','tail','paw'])gl.uniform2fv(this.uniforms[name+'Pivot'],scene[name+'Pivot']||scene[name]?.slice(0,2)||[0,0]);
  gl.uniform2fv(this.uniforms.mouth,scene.mouth||[0,0]);
  const eyes=[...(scene.eyes||[]).slice(0,2)];while(eyes.length<2)eyes.push([0,0,0,0]);gl.uniform4fv(this.uniforms.eyes,eyes.flat());
  const ears=[...(scene.ears||[]).slice(0,2)];while(ears.length<2)ears.push([0,0,0,0]);gl.uniform4fv(this.uniforms.ears,ears.flat());
  gl.uniform4fv(this.uniforms.uiMasks,(scene.uiMasks||[[0,.915,.075,.075],[.935,.915,.065,.075]]).flat());
  this.resize();
 }
 resize(){
  if(this.disposed)return;
  const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight),dpr=Math.min(globalThis.devicePixelRatio||1,2);
  const width=Math.max(1,Math.round(w*dpr)),height=Math.max(1,Math.round(h*dpr));
  if(this.canvas.width!==width)this.canvas.width=width;
  if(this.canvas.height!==height)this.canvas.height=height;
  this.gl.viewport(0,0,width,height);
  if(!this.scene)return;
  this.view=getSceneView(this.scene,w,h);this.gl.uniform4fv(this.uniforms.viewRect,this.view);
 }
 toScreen(x,y){return[(x-this.view[0])/this.view[2]*this.canvas.clientWidth,(y-this.view[1])/this.view[3]*this.canvas.clientHeight];}
 toArt(x,y){return[this.view[0]+x/this.canvas.clientWidth*this.view[2],this.view[1]+y/this.canvas.clientHeight*this.view[3]];}
 render(state){
  if(this.disposed||!this.scene||this.gl.isContextLost())return;const gl=this.gl,u=this.uniforms;
  // A homepage theme is always a clean surface, including while motion is paused.
  gl.uniform4fv(u.pose,state.pose);gl.uniform1f(u.earMotion,state.earMotion||0);gl.uniform1f(u.blink,state.blink);gl.uniform1f(u.cleaned,1);gl.uniform1f(u.original,0);gl.uniform1f(u.time,state.elapsed);
  gl.uniform3fv(u.propPose,state.propPose||[0,0,0]);
  const active=state.effects.slice(-8),effects=active.map(e=>[e.x,e.y,e.start,e.kind]),powers=active.map(e=>e.power??1);
  while(effects.length<8){effects.push([0,0,0,0]);powers.push(0);}
  gl.uniform4fv(u.effects,effects.flat());gl.uniform1fv(u.effectPower,powers);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;
  const gl=this.gl;
  if(gl){
   if(this.texture)gl.deleteTexture(this.texture);
   if(this.buffer)gl.deleteBuffer(this.buffer);
   if(this.program)gl.deleteProgram(this.program);
   for(const shader of this.shaders||[])if(shader)gl.deleteShader(shader);
  }
  this.texture=null;this.buffer=null;this.program=null;this.shaders=[];
  this.uniforms=null;this.scene=null;this.canvas=null;this.gl=null;
 }
}
