/* ===== Carousel (unchanged behavior) ===== */
    const dishes=[
      {name:'Chicken Inasal',tag:'Grilled favorite',img:'/images/menu-images/chicken-inasal-meal.webp',text:'Smoky, savory Filipino grilled chicken served with rice.'},
      {name:'Beef Kare-Kare',tag:'Filipino classic',img:'/images/menu-images/beef-kare-kare.webp',text:'A comforting favorite with a rich, savory peanut sauce.'},
      {name:'Pork Sinigang',tag:'Comfort food',img:'/images/menu-images/pork-sinigang.webp',text:'A warm, tangy Filipino soup made for sharing.'},
      {name:'Garlic Butter Shrimp',tag:'Guest favorite',img:'/images/menu-images/garlic-butter-shrimp.webp',text:'Juicy shrimp tossed in fragrant garlic butter.'},
      {name:'Leche Flan',tag:'Something sweet',img:'/images/menu-images/leche-flan.webp',text:'A silky caramel custard to finish your meal.'},
      {name:'Turon',tag:'Filipino merienda',img:'/images/menu-images/turon.webp',text:'Crisp golden banana rolls with a sweet caramel finish.'}
    ];
    const stage=document.getElementById('stage'),caption=document.getElementById('caption'),capTitle=document.getElementById('capTitle'),capText=document.getElementById('capText'),counter=document.getElementById('counter'),barFill=document.getElementById('barFill');
    let current=0,dragging=false,dragMoved=false,startX=0,paused=false,startTime=0,raf=0;const duration=4800,N=dishes.length;
    dishes.forEach((dish,i)=>{const slide=document.createElement('div');slide.className='slide';slide.dataset.i=i;const card=document.createElement('div');card.className='card';const tag=document.createElement('span');tag.className='tag';tag.textContent=dish.tag;const img=document.createElement('img');img.src=dish.img;img.alt=dish.name;img.loading='lazy';img.draggable=false;img.addEventListener('error',()=>{img.style.display='none';card.style.background='linear-gradient(145deg,#50382d,#a77d3e)'});card.append(tag,img);slide.append(card);stage.append(slide)});
    const slides=[...stage.querySelectorAll('.slide')],reflect=document.createElement('div');reflect.className='reflect';stage.append(reflect);const prior=slides.map(()=>0);
    function render(first=false){slides.forEach((el,i)=>{let d=i-current;if(d>N/2)d-=N;if(d< -N/2)d+=N;const abs=Math.abs(d);if(!first&&Math.abs(d-prior[i])>1.5){el.classList.add('no-anim');requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('no-anim')))}prior[i]=d;el.style.setProperty('--d',d);el.style.setProperty('--abs',abs);el.classList.toggle('hidden',abs>2);el.classList.toggle('active',d===0);el.setAttribute('aria-hidden',d!==0)});caption.classList.add('swap');setTimeout(()=>{capTitle.textContent=dishes[current].name;capText.textContent=dishes[current].text;caption.classList.remove('swap')},first?0:220);counter.innerHTML=`${String(current+1).padStart(2,'0')} <span>/ ${String(N).padStart(2,'0')}</span>`}
    function restart(){cancelAnimationFrame(raf);startTime=performance.now();barFill.style.width='0%';tick()}function tick(now=performance.now()){if(!paused){const p=Math.min((now-startTime)/duration,1);barFill.style.width=`${p*100}%`;if(p>=1){go(current+1);return}}else startTime=now-(parseFloat(barFill.style.width||'0')/100)*duration;raf=requestAnimationFrame(tick)}function go(n){current=(n+N)%N;render();restart()}
    document.getElementById('next').addEventListener('click',()=>go(current+1));document.getElementById('prev').addEventListener('click',()=>go(current-1));slides.forEach(el=>el.addEventListener('click',()=>{if(!dragMoved&&Number(el.dataset.i)!==current)go(Number(el.dataset.i))}));document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(current+1);if(e.key==='ArrowLeft')go(current-1)});stage.addEventListener('mouseenter',()=>paused=true);stage.addEventListener('mouseleave',()=>paused=false);document.addEventListener('visibilitychange',()=>paused=document.hidden);
    stage.addEventListener('pointerdown',e=>{dragging=true;dragMoved=false;startX=e.clientX;stage.classList.add('dragging')});window.addEventListener('pointermove',e=>{if(dragging&&Math.abs(e.clientX-startX)>8)dragMoved=true});window.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;stage.classList.remove('dragging');const dx=e.clientX-startX;if(Math.abs(dx)>50)go(current+(dx<0?1:-1));setTimeout(()=>dragMoved=false,50)});
    stage.addEventListener('mousemove',e=>{const card=stage.querySelector('.slide.active .card');if(!card)return;const r=card.getBoundingClientRect();card.style.setProperty('--ry',`${((e.clientX-r.left)/r.width-.5)*10}deg`);card.style.setProperty('--rx',`${-((e.clientY-r.top)/r.height-.5)*10}deg`)});stage.addEventListener('mouseleave',()=>{const card=stage.querySelector('.slide.active .card');if(card){card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg')}});
    render(true);restart();

    /* Load the non-hero video only when its section is about to be seen. */
    const titleVideo=document.querySelector('.title-background-video');
    const titleVideoSource=titleVideo.querySelector('source');
    let titleVideoLoaded=false,titleVideoVisible=false;
    function updateTitleVideoPlayback(){
      if(!titleVideoVisible||document.hidden){titleVideo.pause();return}
      if(titleVideoSource.dataset.src){
        titleVideoSource.src=titleVideoSource.dataset.src;
        delete titleVideoSource.dataset.src;
        titleVideo.load();
        titleVideoLoaded=true;
      }
      if(titleVideoLoaded){
        titleVideo.play().catch(error=>{
          if(error.name!=='NotAllowedError'&&error.name!=='AbortError'){
            console.error('Could not start the welcome background video:',error);
          }
        });
      }
    }
    if('IntersectionObserver' in window){
      const titleVideoObserver=new IntersectionObserver(entries=>{
        titleVideoVisible=entries.some(entry=>entry.isIntersecting);
        updateTitleVideoPlayback();
      },{threshold:.1});
      titleVideoObserver.observe(titleVideo);
    }else{
      titleVideoVisible=true;
      updateTitleVideoPlayback();
    }
    document.addEventListener('visibilitychange',updateTitleVideoPlayback);

    /* ===== Editor-style scroll choreography ===== */
    const clamp01=v=>Math.min(Math.max(v,0),1);
    const titleCard=document.getElementById('story');
    const cardLines=[...titleCard.querySelectorAll('[data-s]')];
    const SECONDS=8;               /* the title card lasts an 8-second "clip" */

    function setCardProgress(elapsed){
      const t=clamp01(elapsed/SECONDS);
      titleCard.style.setProperty('--open',clamp01(elapsed/1.1).toFixed(4));
      cardLines.forEach(el=>{
        const cue=parseFloat(el.dataset.s||0);
        el.style.setProperty('--lp',clamp01((t-cue)/0.14).toFixed(4));
      });
    }
    function playTitleAnimation(){
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){setCardProgress(SECONDS);return}
      const startedAt=performance.now();
      function frame(now){
        const elapsed=Math.min((now-startedAt)/1000,SECONDS);
        setCardProgress(elapsed);
        if(elapsed<SECONDS)requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    const titleObserver=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){titleObserver.disconnect();playTitleAnimation()}
    },{threshold:.12});
    titleObserver.observe(titleCard);

    /* ===== Navigation, progress, hero, reveal ===== */
    const nav=document.getElementById('nav'),progress=document.getElementById('progress');
    const brand=document.querySelector('.brand');
    let previousLogoScroll=scrollY;
    const hero=document.querySelector('.hero');
    let heroTicking=false;
    function onScroll(){
      heroTicking=false;
      const y=scrollY,vh=innerHeight;
      if(y<vh*1.2)hero.style.setProperty('--hp',Math.min(y/vh,1).toFixed(3));
    }
    addEventListener('scroll',()=>{
      nav.classList.toggle('scrolled',scrollY>45);
      const max=document.documentElement.scrollHeight-innerHeight;
      progress.style.width=`${max?scrollY/max*100:0}%`;
      const y=scrollY;
      if(y<80||y<previousLogoScroll-2)brand.classList.remove('logo-hidden');
      else if(y>previousLogoScroll+2)brand.classList.add('logo-hidden');
      previousLogoScroll=y;
      if(!heroTicking){heroTicking=true;requestAnimationFrame(onScroll)}
    },{passive:true});
    onScroll();

    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}
    }),{threshold:.12});
    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
