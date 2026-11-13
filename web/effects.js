'use strict';
const ComboEffects = (() => {
  const milestone = n => n === 100 || (n >= 500 && n % 500 === 0);
  const tau = 2 * Math.PI;
  function tangent(angle, speed, outward) {
    const x=Math.cos(angle), y=Math.sin(angle);
    return {vx: -y*speed+x*outward, vy: x*speed+y*outward};
  }

  function attach(wrap,disc) {
    const canvas=document.createElement('canvas');
    canvas.className='ember-layer';canvas.setAttribute('aria-hidden','true');
    const banner=document.createElement('strong');
    banner.className='combo-award';banner.setAttribute('role','status');
    wrap.append(canvas,banner);
    const ctx=canvas.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    let particles=[],frame=0,previous=0,phase=-Math.PI/2;
    let width=0,height=0,radius=0,burstTimer,restoreTimer,flight=null,lettering=null;
    const ink=disc.querySelector('.ink');
    const hot=['#ffbd46','#ff8735','#f85625','#ffcc5b'];
    const festival=['#ffb632','#f96829','#ff497c','#d42e50','#ffdb66'];

    function resize(){
      radius=disc.offsetWidth/2;
      width=Math.min(window.innerWidth,Math.ceil(radius*4.2));
      height=Math.ceil(radius*4.2);
      const ratio=Math.min(window.devicePixelRatio||1,2);
      canvas.style.width=width+'px';canvas.style.height=height+'px';
      canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);
      ctx?.setTransform(ratio,0,0,ratio,0,0);
    }
    resize();
    const observer=new ResizeObserver(resize);observer.observe(disc);

    function draw(now){
      frame=0;
      const dt=Math.min(.04,Math.max(0,(now-previous)/1000));previous=now;
      ctx.clearRect(0,0,width,height);
      particles=particles.filter(p=>p.age+dt<p.life);
      ctx.lineCap='round';
      for(const p of particles){
        p.age+=dt;
        p.vx*=Math.exp(-p.drag*dt);p.vy=p.vy*Math.exp(-p.drag*dt)+p.gravity*dt;
        p.x+=p.vx*dt;p.y+=p.vy*dt;
        const x=width/2+p.x,y=height/2+p.y;
        ctx.globalAlpha=Math.min(1,(1-p.age/p.life)*1.8);
        ctx.lineWidth=p.thick;ctx.strokeStyle=p.color;
        ctx.beginPath();ctx.moveTo(x-p.vx*p.trail,y-p.vy*p.trail);ctx.lineTo(x,y);ctx.stroke();
        ctx.fillStyle='#fff1a4';ctx.fillRect(x-.65,y-.65,1.3,1.3);
      }
      ctx.globalAlpha=1;
      if(particles.length)frame=requestAnimationFrame(draw);
    }
    function wake(){
      if(!ctx)return;
      if(particles.length>220)particles.splice(0,particles.length-220);
      if(!frame){previous=performance.now();frame=requestAnimationFrame(draw);}
    }
    function sparks(n){
      phase=(phase+.32)%tau;
      const intensity=Math.min(1,Math.log2(1+n/3)/5),contacts=1+Math.floor(intensity*3);
      for(let j=0;j<contacts;j++){
        for(let i=0;i<3+intensity*4;i++){
          const a=phase+j*tau/contacts+(Math.random()-.5)*.13;
          const v=tangent(a,radius*(1.0+intensity+Math.random()*1.4),radius*(.05+Math.random()*.13));
          particles.push({x:radius*Math.cos(a),y:radius*Math.sin(a),...v,age:0,life:.18+Math.random()*.25,
            color:hot[i%hot.length],trail:.035+Math.random()*.025,thick:1+Math.random()*1.4,drag:2,gravity:radius*.55});
        }
      }
      wake();
    }
    function firework(x,y,color,count){
      for(let i=0;i<count;i++){
        const angle=tau*(i+Math.random()*.6)/count,speed=radius*(.35+Math.random()*1.30);
        particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,age:0,
          life:.4+Math.random()*.55,color:i%5?color:'#ffd761',trail:.052,thick:1.8,drag:1.7,gravity:radius*.82});
      }
      wake();
    }
    function clearAward(){
      clearTimeout(burstTimer);clearTimeout(restoreTimer);flight?.cancel();lettering?.cancel();
      flight=null;lettering=null;disc.classList.remove('lifting');banner.textContent='';
    }
    function celebrate(n,still){
      clearAward();
      function reveal(){
        banner.textContent=n+' Combo!';
        if(!still){
          firework(0,-radius*.96,festival[0],40);
          firework(-radius*.86,-radius*.64,festival[2],26);
          firework(radius*.86,-radius*.7,festival[1],28);
          lettering=banner.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.70)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.10)',offset:.20},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.76},{opacity:0,transform:'translate(-50%,-63%) scale(1)'}],{duration:1120,fill:'forwards'});
        }
        restoreTimer=setTimeout(clearAward,still?1050:1140);
      }
      if(still){reveal();return;}
      disc.classList.add('lifting');
      const rise=Math.round(radius*.96);
      flight=ink.animate([
        {transform:'perspective(500px) translateY(0) rotateY(0deg) scale(1)',opacity:1},
        {transform:'perspective(500px) translateY(4px) rotateY(-22deg) scale(.94)',opacity:1,offset:.13},
        {transform:'perspective(500px) translateY(-'+rise+'px) rotateY(710deg) scale(.68)',opacity:1,offset:.84},
        {transform:'perspective(500px) translateY(-'+(rise+7)+'px) rotateY(720deg) scale(.49)',opacity:0}
      ],{duration:680,easing:'ease-in-out',fill:'forwards'});
      burstTimer=setTimeout(reveal,650);
    }
    return {
      tap(n){
        if(n<3)return;
        if(milestone(n))celebrate(n,reduce.matches);
        if(!reduce.matches&&ctx)sparks(n);
      },
      destroy(){
        clearAward();observer.disconnect();cancelAnimationFrame(frame);particles=[];
        canvas.remove();banner.remove();
      }
    };
  }
  return {milestone,tangent,attach};
})();
if(typeof module!=='undefined')module.exports=ComboEffects;
