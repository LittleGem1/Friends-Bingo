'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const GAME_MS = 60 * 60 * 1000;
const rooms = new Map();
const DEFAULT_POOL = [
  'Das war knapp!','Ich bin gleich wieder da','Was war das denn?!','Oh nein!','Ich hab’s doch gesagt!',
  'Warte kurz','Das zählt nicht!','Ich hab keine Ahnung','Hast du das gesehen?','Nicht schon wieder!',
  'Das war Absicht','Ich bin unschuldig','Wie bitte?!','Ich kann das erklären','Das ist unfair!',
  'Eine Runde noch','Ich hab Hunger','Hilfe!','Ich bin tot','Wo bist du?',
  'Das war nicht ich','Ich brauch Heilung','Das gibt’s doch nicht','Moment mal','Ich wusste es!',
  'Mach die Tür zu','Wer war das?','Das ist ja wild','Ich seh nichts','Ganz ruhig!',
  'Das war Glück','Ich komm gleich','Was machst du?!','Bitte nicht','Ich bin bereit'
];
const send = (res, status, data) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const fail = (code, message) => {const e = new Error(message);e.status = code;throw e;};
function sanitizeText(value, max=70) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0,max); }
function getRoom(code) {const room = rooms.get(code);if(!room)fail(404,'Diese Sitzung gibt es nicht (mehr).');return room;}
function getPlayer(room, id) {const p = room.players.get(id);if(!p)fail(403,'Spieler nicht gefunden. Bitte erneut beitreten.');return p;}
function publicState(room, forId) {
  return {code:room.code,name:room.name,phase:room.phase,startedAt:room.startedAt,endsAt:room.endsAt,
    winnerName:room.winnerName,hostId:room.hostId,meId:forId,
    pool:room.pool,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,marked:p.marks.filter(Boolean).length,bingo:p.bingo})),
    board:room.players.get(forId)?.board || Array(9).fill(''),marks:room.players.get(forId)?.marks || Array(9).fill(false)};
}
function broadcast(room, type, extra={}) {
  for (const [id, clients] of room.clients) for(const res of clients) {
    try {res.write(`event: state\ndata: ${JSON.stringify({type,...extra,state:publicState(room,id)})}\n\n`);} catch {clients.delete(res);}
  }
}
function shuffleItems(pool){const a=[...pool];for(let i=a.length-1;i>0;i--){let j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function checkWin(p){return lines.some(line=>line.every(i=>p.marks[i]&&p.board[i].trim()));}
function expire(room){if(room.phase==='playing' && Date.now()>=room.endsAt){room.phase='ended';room.endReason='time';broadcast(room,'timeout');}}
setInterval(()=>{for(const [code,r] of rooms){expire(r);if(Date.now()-r.createdAt>24*60*60*1000 && r.clients.size===0)rooms.delete(code);}},1000).unref();
function readBody(req){return new Promise((resolve,reject)=>{let text='';req.on('data',chunk=>{text+=chunk;if(text.length>12000){reject(Object.assign(new Error('Eingabe zu groß'),{status:413}));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(text || '{}'));}catch{reject(Object.assign(new Error('Ungültige Daten'),{status:400}));}});req.on('error',reject);});}
function uniqueCode(){let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));return code;}
async function api(req,res,pathname){
  const body=await readBody(req);
  if(pathname==='/api/create'){
    const name=sanitizeText(body.roomName,48), playerName=sanitizeText(body.playerName,25);
    if(!name||!playerName)fail(400,'Bitte Sitzungsnamen und deinen Namen eingeben.');
    const code=uniqueCode(),id=crypto.randomUUID();
    const room={code,name,hostId:id,phase:'lobby',startedAt:null,endsAt:null,winnerName:null,createdAt:Date.now(),pool:[...DEFAULT_POOL],players:new Map(),clients:new Map()};
    room.players.set(id,{id,name:playerName,board:Array(9).fill(''),marks:Array(9).fill(false),bingo:false});
    rooms.set(code,room);return send(res,200,{code,id});
  }
  if(pathname==='/api/join'){
    const room=getRoom(sanitizeText(body.code,12).toUpperCase());
    const name=sanitizeText(body.playerName,25);if(!name)fail(400,'Bitte deinen Namen eingeben.');
    if(room.phase!=='lobby')fail(409,'Die Runde läuft bereits. Neue Spieler können erst zur nächsten Runde beitreten.');
    if(room.players.size>=30)fail(409,'Diese Sitzung ist voll (maximal 30 Spieler).');
    const id=crypto.randomUUID();room.players.set(id,{id,name,board:Array(9).fill(''),marks:Array(9).fill(false),bingo:false});
    broadcast(room,'join');return send(res,200,{code:room.code,id});
  }
  const room=getRoom(sanitizeText(body.code,12).toUpperCase()),p=getPlayer(room,body.id);
  expire(room);
  if(pathname==='/api/state')return send(res,200,publicState(room,p.id));
  if(pathname==='/api/board'){
    if(room.phase!=='lobby')fail(409,'Felder können nur vor dem Start bearbeitet werden.');
    if(!Array.isArray(body.board)||body.board.length!==9)fail(400,'Ein Feld braucht genau neun Kästchen.');
    p.board=body.board.map(v=>sanitizeText(v,65));p.marks=Array(9).fill(false);
    broadcast(room,'board');return send(res,200,{ok:true});
  }
  if(pathname==='/api/pool'){
    if(p.id!==room.hostId)fail(403,'Nur die Spielleitung kann den Zufallspool ändern.');
    if(room.phase!=='lobby')fail(409,'Nur in der Lobby möglich.');
    if(!Array.isArray(body.pool))fail(400,'Ungültige Begriffsliste.');
    const items=[...new Set(body.pool.map(v=>sanitizeText(v,65)).filter(Boolean))].slice(0,150);
    if(items.length<9)fail(400,'Bitte mindestens neun unterschiedliche Begriffe eintragen.');
    room.pool=items;broadcast(room,'pool');return send(res,200,{ok:true});
  }
  if(pathname==='/api/random'){
    if(room.phase!=='lobby')fail(409,'Zufall ist nur vor dem Start möglich.');
    if(room.pool.length<9)fail(409,'Zu wenige Zufallsbegriffe.');
    p.board=shuffleItems(room.pool).slice(0,9);p.marks=Array(9).fill(false);
    broadcast(room,'board');return send(res,200,{ok:true});
  }
  if(pathname==='/api/start'){
    if(p.id!==room.hostId)fail(403,'Nur die Spielleitung startet das Spiel.');
    if(room.phase!=='lobby')fail(409,'Die Runde wurde bereits gestartet.');
    const unready=[...room.players.values()].filter(x=>x.board.some(v=>!v.trim()));
    if(unready.length)fail(409,'Alle neun Kästchen müssen bei allen Spielern ausgefüllt sein. Noch nicht fertig: '+unready.map(x=>x.name).join(', '));
    room.phase='playing';room.startedAt=Date.now();room.endsAt=room.startedAt+GAME_MS;room.winnerName=null;
    for(const x of room.players.values()){x.marks=Array(9).fill(false);x.bingo=false;}
    broadcast(room,'start');return send(res,200,{ok:true});
  }
  if(pathname==='/api/mark'){
    if(room.phase!=='playing')fail(409,'Diese Runde läuft nicht.');
    const i=Number(body.index);if(!Number.isInteger(i)||i<0||i>8)fail(400,'Ungültiges Feld.');
    p.marks[i]=!p.marks[i];
    const won=checkWin(p);p.bingo=won;
    if(won&&!room.winnerName){room.winnerName=p.name;room.phase='ended';room.endReason='bingo';broadcast(room,'winner',{winnerName:p.name});}
    else broadcast(room,'mark');
    return send(res,200,{ok:true});
  }
  if(pathname==='/api/reset'){
    if(p.id!==room.hostId)fail(403,'Nur die Spielleitung kann eine neue Runde eröffnen.');
    room.phase='lobby';room.startedAt=null;room.endsAt=null;room.winnerName=null;
    for(const x of room.players.values()){x.marks=Array(9).fill(false);x.bingo=false;}
    broadcast(room,'reset');return send(res,200,{ok:true});
  }
  fail(404,'Unbekannte Aktion.');
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');const pathname=url.pathname;
    if(req.method==='GET' && pathname==='/api/events'){
      const room=getRoom(sanitizeText(url.searchParams.get('code'),12).toUpperCase());
      const player=getPlayer(room,url.searchParams.get('id'));expire(room);
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.write(`event: state\ndata: ${JSON.stringify({type:'initial',state:publicState(room,player.id)})}\n\n`);
      if(!room.clients.has(player.id))room.clients.set(player.id,new Set());room.clients.get(player.id).add(res);
      const ping=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n');},20000);
      req.on('close',()=>{clearInterval(ping);room.clients.get(player.id)?.delete(res);if(room.clients.get(player.id)?.size===0)room.clients.delete(player.id);});return;
    }
    if(req.method==='POST' && pathname.startsWith('/api/'))return await api(req,res,pathname);
    if(req.method==='GET'){
      const filename=pathname==='/'?'/index.html':pathname;
      const full=path.resolve(ROOT,'.'+filename);
      if(!full.startsWith(ROOT+path.sep))fail(403,'Nicht erlaubt.');
      const stat=fs.statSync(full);if(!stat.isFile())fail(404,'Nicht gefunden.');
      res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache'});return fs.createReadStream(full).pipe(res);
    }
    fail(405,'Methode nicht erlaubt.');
  }catch(e){if(!res.headersSent)send(res,e.status|| (e.code==='ENOENT'?404:500),{error:e.status||e.code==='ENOENT'?e.message:'Serverfehler'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Bingo läuft auf http://localhost:${PORT}`));
