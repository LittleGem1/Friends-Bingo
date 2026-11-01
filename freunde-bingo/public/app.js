'use strict';
const $=id=>document.getElementById(id);
let identity=null,state=null,stream=null,audioCtx=null,soundEnabled=false,dirty=false,toastTimer=null,lastEventKey='';
const params=new URLSearchParams(location.search);
if(params.get('room'))$('joinCode').value=params.get('room').toUpperCase();
const stored=localStorage.getItem('spruch-bingo-player');
if(stored){try{identity=JSON.parse(stored);}catch{localStorage.removeItem('spruch-bingo-player');}}
function notice(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
async function post(route,body={}){const r=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...identity,...body})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Fehler');return data;}
async function action(fn){try{await fn();}catch(e){notice('⚠ '+e.message);}}
function setIdentity(i){identity=i;localStorage.setItem('spruch-bingo-player',JSON.stringify(i));history.replaceState({},'',`/?room=${encodeURIComponent(i.code)}`);connect();}
function disconnect(){stream?.close();stream=null;}
function leave(){disconnect();identity=null;state=null;localStorage.removeItem('spruch-bingo-player');history.replaceState({},'','/');$('game').hidden=true;$('landing').hidden=false;}
function connect(){if(!identity)return;disconnect();$('landing').hidden=true;$('game').hidden=false;
 stream=new EventSource(`/api/events?code=${encodeURIComponent(identity.code)}&id=${encodeURIComponent(identity.id)}`);
 stream.addEventListener('state',e=>{const payload=JSON.parse(e.data);const prev=state;state=payload.state;
   if(payload.type==='winner'&&prev?.phase==='playing'){celebrate(payload.winnerName||state.winnerName);}
   if(payload.type==='timeout'&&prev?.phase==='playing'){timeAlarm();}
   render(payload.type);
 });
 stream.onerror=()=>{if(stream?.readyState===EventSource.CLOSED)notice('Verbindung verloren. Lade die Seite neu.');};
}
function boardFromInputs(){return [...$('board').querySelectorAll('textarea')].map(el=>el.value.trim());}
function render(type){if(!state)return;let lobby=state.phase==='lobby',host=state.meId===state.hostId;
 $('displayRoom').textContent=state.name;$('code').textContent=state.code;$('playerCount').textContent=state.players.length+' Spieler';
 $('phaseTag').textContent=lobby?'LOBBY':state.phase==='playing'?'SPIEL LÄUFT':'BEENDET';
 $('boardHint').textContent=lobby?'Fülle alle 9 Felder aus oder würfle ein Zufallsfeld.':state.phase==='playing'?'Klicke jeden gehörten Spruch an. Drei in einer Reihe = BINGO!':'Diese Runde ist vorbei.';
 $('editControls').hidden=!lobby;$('hostPanel').hidden=!host;
 $('start').hidden=!lobby;$('newRound').hidden=state.phase!=='ended';$('poolDetails').hidden=!lobby;
 if(document.activeElement?.closest('#board')&&lobby&&type==='board')return;
 const shouldRefresh=!(lobby&&dirty&&['join','pool','initial'].includes(type));
 if(shouldRefresh){const b=$('board');b.replaceChildren();state.board.forEach((word,i)=>{const cell=document.createElement('div');cell.className='cell'+(state.marks[i]?' marked':'');if(lobby){const area=document.createElement('textarea');area.maxLength=65;area.placeholder=`Spruch ${i+1}`;area.value=word;area.setAttribute('aria-label','Spruch '+(i+1));area.addEventListener('input',()=>{dirty=true;$('boardStatus').textContent='Nicht gespeicherte Änderungen';});cell.append(area);}else{const btn=document.createElement('button');btn.type='button';btn.textContent=word||'—';btn.disabled=state.phase!=='playing';btn.setAttribute('aria-pressed',String(state.marks[i]));btn.onclick=()=>action(()=>post('mark',{index:i}));cell.append(btn);}b.append(cell);});dirty=false;}
 const ppl=$('players');ppl.replaceChildren();state.players.forEach(p=>{const row=document.createElement('div');row.className='person';const n=document.createElement('span');n.textContent=p.name+(p.id===state.hostId?' 👑':'')+(p.id===state.meId?' (du)':'');const s=document.createElement('small');s.textContent=p.bingo?'🏆 BINGO':p.marked+' / 9';row.append(n,s);ppl.append(row);});
 if(type==='initial'||type==='pool')$('pool').value=state.pool.join('\n');
 const result=$('result');result.hidden=state.phase!=='ended';if(!result.hidden)result.textContent=state.winnerName?'🏆 BINGO! '+state.winnerName+' hat gewonnen!':'🔔 ZEIT ABGELAUFEN! Niemand hat Bingo geschafft.';
 updateClock();
}
function updateClock(){if(!state)return;let ms=state.phase==='playing'?Math.max(0,state.endsAt-Date.now()):state.phase==='lobby'?3600000:state.winnerName?Math.max(0,state.endsAt-Date.now()):0;let total=Math.ceil(ms/1000);$('timer').textContent=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
setInterval(updateClock,300);
function chime(notes,kind='sine'){if(!soundEnabled||!audioCtx)return;let t=audioCtx.currentTime+0.06;notes.forEach(([f,d])=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type=kind;osc.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.22,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d);osc.connect(g).connect(audioCtx.destination);osc.start(t);osc.stop(t+d+.02);t+=d+.055;});}
function say(words){if(!soundEnabled||!('speechSynthesis'in window))return;try{speechSynthesis.cancel();const s=new SpeechSynthesisUtterance(words);s.lang='de-DE';s.rate=.95;s.volume=1;speechSynthesis.speak(s);}catch{}}
function celebrate(name){chime([[523,.22],[659,.22],[784,.22],[1047,.65]],'triangle');setTimeout(()=>say('Bingo! '+name+' hat gewonnen!'),1100);notice('🏆 BINGO! '+name+' hat gewonnen!');}
function timeAlarm(){chime([[740,.30],[370,.30],[740,.30],[370,.30],[740,.65]],'sawtooth');setTimeout(()=>say('Alarm! Die Zeit ist um! Niemand hat gewonnen!'),1750);notice('🔔 Zeit abgelaufen!');}
$('sound').onclick=async()=>{try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();soundEnabled=true;$('sound').textContent='🔊 Ton aktiviert';chime([[523,.12],[784,.25]]);say('Ton ist aktiviert');}catch{notice('Ton konnte nicht aktiviert werden.');}};
$('createForm').onsubmit=e=>{e.preventDefault();action(async()=>{const data=await post('create',{playerName:$('createName').value,roomName:$('roomName').value});setIdentity(data);});};
$('joinForm').onsubmit=e=>{e.preventDefault();action(async()=>{const data=await post('join',{playerName:$('joinName').value,code:$('joinCode').value});setIdentity(data);});};
$('leave').onclick=leave;
$('copyLink').onclick=()=>action(async()=>{await navigator.clipboard.writeText(`${location.origin}/?room=${state.code}`);notice('Einladungslink kopiert!');});
$('save').onclick=()=>action(async()=>{const board=boardFromInputs();if(board.some(x=>!x))throw new Error('Bitte alle neun Felder ausfüllen.');await post('board',{board});dirty=false;$('boardStatus').textContent='✅ Dein Feld ist gespeichert!';});
$('random').onclick=()=>action(async()=>{await post('random');$('boardStatus').textContent='Zufallsfeld erstellt. Du kannst erneut würfeln!';});
$('shuffle').onclick=()=>action(async()=>{const board=boardFromInputs();for(let i=8;i>0;i--){const j=Math.floor(Math.random()*(i+1));[board[i],board[j]]=[board[j],board[i]];}await post('board',{board});$('boardStatus').textContent='Feld gemischt!';});
$('savePool').onclick=()=>action(async()=>{await post('pool',{pool:$('pool').value.split('\n')});notice('Zufallsbegriffe gespeichert!');});
$('start').onclick=()=>action(async()=>{if(dirty)throw new Error('Bitte erst dein Feld speichern.');await post('start');});
$('newRound').onclick=()=>action(()=>post('reset'));
if(identity)connect();
