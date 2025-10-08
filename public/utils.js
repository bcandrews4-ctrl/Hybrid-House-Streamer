function el(id){ return document.getElementById(id); }
function fmt(s){
  s = Math.max(0, Math.floor(s||0));
  const m = Math.floor(s/60);
  const ss = String(s%60).padStart(2,'0');
  return `${m}:${ss}`;
}
