'use strict';
const ComboEffects = (() => {
  const milestone = n => n === 100 || (n >= 500 && n % 500 === 0);
  const tau = 2 * Math.PI;
  function tangent(angle, speed, outward) {
    const x=Math.cos(angle), y=Math.sin(angle);
    return {vx: -y*speed+x*outward, vy: x*speed+y*outward};
  }

  function attach(wrap,disc,theme='brake') {
    const canvas=document.createElement('canvas');
    canvas.className='ember-layer';canvas.setAttribute('aria-hidden','true');
    const banner=document.createElement('strong');
    banner.className='combo-award';banner.setAttribute('role','status');
    wrap.append(canvas,banner);
    const ctx=canvas.getContext('2d');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    let particles=[],frame=0,previous=0,phase=-Math.PI/2;
    let coverage=0,contacts=0,nextEmission=0;
    let width=0,height=0,radius=0,restoreTimer,flight=null,lettering=null;
    const ink=disc.querySelector('.ink');
    const hot=['#ffbd46','#ff8735','#f85625','#ffcc5b'];
    const festival=['#ffb632','#f96829','#ff497c','#d42e50','#ffdb66'];

    const colors={
      frost:['#a5e6ff','#3a99ce','#eefaff'],
      bolt:['#b596ff','#7950f4','#d7e8ff'],
      meteor:['#ffbc43','#ed7535','#fff4ab'],
      aurora:['#26d5ad','#4eb9fc','#bc89ff']
    };
    const palette=colors[theme];
    function themedRim(span,now){
      const steps=Math.max(3,Math.ceil(70*coverage));
      ctx.lineJoin='round';
      for(let band=0;band<(theme==='aurora'?3:1);band++){
        ctx.beginPath();ctx.strokeStyle=palette[band];ctx.lineWidth=theme==='bolt'?2.8:2;
        for(let i=0;i<=steps;i++){
          const a=phase+span*i/steps;
          let r=radius;
          if(theme==='aurora')r+=4*Math.sin(5*a+now*.002+band)+band*3;
          if(theme==='bolt')r+=6*Math.sin(i*17+Math.floor(now/100)*2);
          const x=width/2+r*Math.cos(a), y=height/2+r*Math.sin(a);
          if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    }
    function drawMote(p,x,y){
      ctx.beginPath();
      if(p.shape==='frost'||p.shape==='aurora'){
        const arms=p.shape==='frost'?6:4;
        for(let i=0;i<arms;i++){
          const a=i*tau/arms+p.age;
          ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*3.8,y+Math.sin(a)*3.8);
        }
      }else if(p.shape==='bolt'){
        ctx.moveTo(x-5,y+5);ctx.lineTo(x,y);ctx.lineTo(x-2,y-1);ctx.lineTo(x+3,y-7);
      }else{
        ctx.moveTo(x-p.vx*p.trail,y-p.vy*p.trail);ctx.lineTo(x,y);
      }
      ctx.stroke();
    }

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
      if(contacts){
        phase=(phase+dt*(1.8+coverage*1.8))%tau;
        const span=tau*coverage;
        // A continuous hot rim sits beneath the individual clockwise trails.
        ctx.lineCap='round';
        if(palette)themedRim(span,now);
        else for(const [stroke,thickness] of [['rgba(255,105,27,.22)',8],['#ff8e30',3.5],['#ffe6a1',1.4]]){
          ctx.strokeStyle=stroke;ctx.lineWidth=thickness;
          ctx.beginPath();ctx.arc(width/2,height/2,radius,phase,phase+span);ctx.stroke();
        }
        if(now>=nextEmission){emitSparks();nextEmission=now+55;}
      }
      particles=particles.filter(p=>p.age+dt<p.life);
      ctx.lineCap='round';
      for(const p of particles){
        p.age+=dt;
        p.vx*=Math.exp(-p.drag*dt);p.vy=p.vy*Math.exp(-p.drag*dt)+p.gravity*dt;
        p.x+=p.vx*dt;p.y+=p.vy*dt;
        const x=width/2+p.x,y=height/2+p.y;
        ctx.globalAlpha=Math.min(1,(1-p.age/p.life)*1.8);
        ctx.lineWidth=p.thick;ctx.strokeStyle=p.color;
        drawMote(p,x,y);
        ctx.fillStyle='#fff1a4';ctx.fillRect(x-.65,y-.65,1.3,1.3);
      }
      ctx.globalAlpha=1;
      if(particles.length||contacts)frame=requestAnimationFrame(draw);
    }
    function wake(){
      if(!ctx)return;
      if(!frame){previous=performance.now();frame=requestAnimationFrame(draw);}
    }
    function emitSparks(){
      for(let j=0;j<contacts;j++){
        const angle=phase+(j+Math.random()*.65)*tau*coverage/contacts;
        const v=tangent(angle,radius*(1.0+coverage+Math.random()*1.35),radius*(.04+Math.random()*.22));
        if(theme==='meteor'){v.vx=-radius*(.6+Math.random());v.vy=radius*(.9+Math.random());}
        particles.push({shape:theme,x:radius*Math.cos(angle),y:radius*Math.sin(angle),...v,age:0,life:.20+Math.random()*.23,
          color:palette?palette[j%palette.length]:hot[j%hot.length],trail:theme==='meteor'?.14:.035+Math.random()*.025,thick:1+Math.random()*1.4,drag:2,gravity:radius*.55});
      }
      // Reserve space for milestone fireworks even during sustained tapping.
      if(particles.length>400)particles.splice(0,particles.length-400);
    }
    function sparks(n){
      coverage=Math.min(1,n/50);
      contacts=Math.ceil(40*coverage);
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
      clearTimeout(restoreTimer);flight?.cancel();lettering?.cancel();
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
        {transform:'perspective(600px) translate3d(0,0,0) rotateY(0deg) scale(1)',opacity:1},
        {transform:'perspective(600px) translate3d(0,-'+rise+'px,0) rotateY(360deg) scale(.49)',opacity:0.12}
      ],{duration:980,easing:'cubic-bezier(.28,.12,.28,1)',fill:'forwards'});
      flight.onfinish=reveal;
    }
    return {
      tap(n){
        if(n<3)return;
        if(milestone(n))celebrate(n,reduce.matches);
        if(!reduce.matches&&ctx)sparks(n);
      },
      endStreak(){contacts=0;coverage=0;nextEmission=0;},
      destroy(){
        clearAward();observer.disconnect();cancelAnimationFrame(frame);particles=[];
        canvas.remove();banner.remove();
      }
    };
  }
  return {milestone,tangent,attach};
})();
if(typeof module!=='undefined')module.exports=ComboEffects;
