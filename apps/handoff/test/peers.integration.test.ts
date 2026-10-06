import { env, SELF, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
type Client = { id: string; token?: string; cookie?: string; label: string };
const schema = `CREATE TABLE IF NOT EXISTS receivers(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,kind TEXT NOT NULL,label TEXT NOT NULL,created_at INTEGER NOT NULL,revoked_at INTEGER);
CREATE TABLE IF NOT EXISTS pairings(id TEXT PRIMARY KEY,web_receiver_id TEXT NOT NULL,mobile_receiver_id TEXT NOT NULL,created_at INTEGER NOT NULL,revoked_at INTEGER);
CREATE TABLE IF NOT EXISTS peer_links(id TEXT PRIMARY KEY,first_id TEXT NOT NULL,second_id TEXT NOT NULL,created_at INTEGER NOT NULL,revoked_at INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS idx_peer_links_active ON peer_links(first_id,second_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS receiver_delivery_channels(id TEXT PRIMARY KEY,receiver_id TEXT NOT NULL,connector_id TEXT,kind TEXT NOT NULL,endpoint TEXT NOT NULL,p256dh TEXT NOT NULL,auth TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,revoked_at INTEGER);
CREATE TABLE IF NOT EXISTS receiver_connectors(id TEXT PRIMARY KEY,receiver_id TEXT NOT NULL,token_hash TEXT NOT NULL,extension_id TEXT NOT NULL,label TEXT NOT NULL,created_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,revoked_at INTEGER);
CREATE TABLE IF NOT EXISTS connector_link_tokens(token_hash TEXT PRIMARY KEY,receiver_id TEXT NOT NULL,pairing_id TEXT NOT NULL,extension_id TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,used_at INTEGER);`;
let prefix = '';
beforeEach(async () => { prefix=crypto.randomUUID();await env.DB.exec(schema);await env.DB.exec('DELETE FROM peer_links;DELETE FROM pairings;DELETE FROM receiver_delivery_channels;DELETE FROM receiver_connectors;DELETE FROM connector_link_tokens;DELETE FROM receivers;'); });
async function call(client: Client | null, path: string, body?: object) {
  return SELF.fetch(`https://qr.test${path.startsWith('/api/') ? path : '/api/v2/'+path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json','CF-Connecting-IP':prefix+':' +(client?.label??'create'),...(client?.token?{authorization:`Bearer ${client.token}`}:{origin:'https://qr.test',cookie:client?.cookie??''})},body:body?JSON.stringify(body):undefined});
}
async function create(label: string, mobile=false): Promise<Client> {
  const response=await SELF.fetch('https://qr.test/api/v2/device',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':prefix+label,...(mobile?{}:{origin:'https://qr.test'})},body:JSON.stringify({label,kind:mobile?'mobile':'web'})});expect(response.status).toBe(201);const result=await response.json<any>();
  if(!mobile){expect(response.headers.get('set-cookie')).toContain('HttpOnly; Secure; SameSite=Strict');expect(result.token).toBeUndefined();}
  return {id:result.device.id,token:result.token,cookie:response.headers.get('set-cookie')?.split(';')[0],label};
}
async function link(a:Client,b:Client) {
  const invitation=await (await call(a,'invitations',{})).json<any>();const code=invitation.code;
  expect((await call(b,`invitations/${code}/claim`,{})).status).toBe(200);
  expect((await (await call(a,`invitations/${code}/confirm`,{})).json<any>()).status).toBe('pending');
  expect((await (await call(b,`invitations/${code}/confirm`,{})).json<any>()).status).toBe('paired');return code;
}
const send=(from:Client,to:Client[],requestId=crypto.randomUUID(),data='https://example.com/synthetic')=>call(from,'handoffs',{data,targetIds:to.map(item=>item.id),requestId});
const events=async(client:Client)=>(await (await call(client,'events')).json<any>()).events;
describe('direct peer links',()=>{
  it('supports Web↔Web↔app with explicit multiple destinations and no transitive sharing or echo',async()=>{
    const a=await create('Web A'),b=await create('Web B'),c=await create('App C',true),d=await create('Stranger');await link(a,b);await link(a,c);
    expect((await (await call(a,'devices')).json<any>()).devices).toHaveLength(2);
    expect((await send(a,[b,c])).status).toBe(202);expect(await events(a)).toHaveLength(0);expect(await events(b)).toHaveLength(1);expect(await events(c)).toHaveLength(1);expect(await events(d)).toHaveLength(0);
    expect((await send(b,[c])).status).toBe(401);expect((await send(a,[a])).status).toBe(400);
    expect((await send(c,[a])).status).toBe(202);expect((await send(b,[a])).status).toBe(202);expect(await events(a)).toHaveLength(2);
  });
  it('requires two confirmations and prevents code takeover and unrelated status reads',async()=>{
    const a=await create('A'),b=await create('B'),c=await create('C');const invite=await(await call(a,'invitations',{})).json<any>();
    expect((await call(c,`invitations/${invite.code}`)).status).toBe(401);await call(b,`invitations/${invite.code}/claim`,{});
    expect((await call(c,`invitations/${invite.code}/claim`,{})).status).toBe(409);await call(a,`invitations/${invite.code}/confirm`,{});expect((await send(a,[b])).status).toBe(401);
  });
  it('deduplicates concurrent retry, keeps an ACK receipt, and rejects changed payload under the same ID',async()=>{
    const a=await create('A'),b=await create('B');await link(a,b);const requestId=crypto.randomUUID();
    const sent=await Promise.all([send(a,[b],requestId),send(a,[b],requestId)]);expect(sent.map(response=>response.status)).toEqual([202,202]);const incoming=await events(b);expect(incoming).toHaveLength(1);
    await call(b,'ack',{eventId:incoming[0].id});expect((await send(a,[b],requestId)).status).toBe(202);expect(await events(b)).toHaveLength(0);
    const receipt=await(await call(a,'handoffs/status',{handoffs:[{code:`peer:${b.id}`,eventId:incoming[0].id}]})).json<any>();expect(receipt.acknowledged).toBe(1);
    expect((await send(a,[b],requestId,'changed')).status).toBe(503);
  });
  it('fences revoked deliveries and old events after re-pair, while other devices remain linked',async()=>{
    const a=await create('A'),b=await create('B'),c=await create('C');await link(a,b);await link(a,c);await send(a,[b,c]);
    expect((await call(a,'revoke',{targetId:b.id})).status).toBe(200);expect((await send(a,[b])).status).toBe(401);await link(a,b);expect(await events(b)).toHaveLength(0);expect(await events(c)).toHaveLength(1);
  });
  it('expires pending invitations and unread offline events',async()=>{
    const a=await create('A'),b=await create('B');const invite=await(await call(a,'invitations',{})).json<any>();
    await runInDurableObject(env.PAIR_DO.get(env.PAIR_DO.idFromName(`peer:invite:${invite.code}`)),async(_instance,state)=>{const session=await state.storage.get<any>('invitation');session.expiresAt=Date.now()-1;await state.storage.put('invitation',session);});
    expect((await call(b,`invitations/${invite.code}/claim`,{})).status).toBe(410);
    await link(a,b);await send(a,[b]);await runInDurableObject(env.PAIR_DO.get(env.PAIR_DO.idFromName(`peer:inbox:${b.id}`)),async(_instance,state)=>{const queue=await state.storage.get<any[]>('peer-events');queue!.forEach(event=>event.expiresAt=Date.now()-1);await state.storage.put('peer-events',queue);});expect(await events(b)).toHaveLength(0);
    await runInDurableObject(env.PAIR_DO.get(env.PAIR_DO.idFromName(`peer:inbox:${b.id}`)),async(instance,state)=>{
      for(const key of ['peer-events','peer-receipts','peer-pushes']){const items=(await state.storage.get<any[]>(key))??[];items.forEach(item=>item.expiresAt=Date.now()-1);await state.storage.put(key,items);}
      await instance.alarm();
      for(const key of ['peer-events','peer-receipts','peer-pushes'])expect(await state.storage.get(key)).toEqual([]);
    });
  });
  it('recovers partial fanout with the same ID without redelivering accepted targets',async()=>{
    const a=await create('A'),b=await create('B'),c=await create('C');await link(a,b);const linkC=await link(a,c);
    await runInDurableObject(env.PAIR_DO.get(env.PAIR_DO.idFromName(`peer:inbox:${c.id}`)),async(_instance,state)=>{await state.storage.put('peer-events',Array.from({length:100},(_,index)=>({id:'seed-'+index,senderId:a.id,senderLabel:a.label,linkId:linkC,data:'fixture',createdAt:Date.now(),expiresAt:Date.now()+600000})));});
    const id=crypto.randomUUID();const failed=await send(a,[b,c],id);expect(failed.status).toBe(503);expect((await failed.json<any>()).deliveries.map((item:any)=>item.status)).toEqual(['accepted','failed']);
    await runInDurableObject(env.PAIR_DO.get(env.PAIR_DO.idFromName(`peer:inbox:${c.id}`)),async(_instance,state)=>{await state.storage.put('peer-events',[]);});
    expect((await send(a,[b,c],id)).status).toBe(202);expect(await events(b)).toHaveLength(1);expect(await events(c)).toHaveLength(1);
  });
  it('adopts an existing v1 browser without changing its mobile identity or revoking other peer links',async()=>{
    const created=await call(null,'/api/v1/pairs',{label:'Legacy browser'});const pair=await created.json<any>();const oldCookie=created.headers.get('set-cookie')!.split(';')[0];
    const claimed=await call(null,`/api/v1/pairs/${pair.code}/claim`,{label:'Legacy app'});const app=await claimed.json<any>();
    const web={id:pair.receiverId,cookie:oldCookie,label:'Legacy'};
    await call(web,`/api/v1/pairs/${pair.code}/confirm`,{});await call(null,`/api/v1/pairs/${pair.code}/confirm`,{role:'mobile',token:app.token});
    const adopted=await call(web,`/api/v1/pairs/${pair.code}/device`,{});expect(adopted.status).toBe(200);web.cookie=adopted.headers.get('set-cookie')!.split(';')[0];
    const peer=await create('New Web');await link(web,peer);
    await env.DB.prepare("INSERT INTO receiver_delivery_channels(id,receiver_id,kind,endpoint,p256dh,auth,created_at,updated_at) VALUES ('fixture-push',?,'web_push','https://fcm.googleapis.com/synthetic','key','auth',1,1)").bind(web.id).run();expect((await(await call(web,'devices')).json<any>()).devices).toHaveLength(2);
    expect((await send({id:app.receiverId,token:app.token,label:'Legacy app'},[web])).status).toBe(202);expect(await events(web)).toHaveLength(1);
    await call({id:web.id,cookie:oldCookie,label:web.label},`/api/v1/pairs/${pair.code}/revoke`,{});
    expect((await(await call(web,'devices')).json<any>()).devices).toHaveLength(1);expect((await send(peer,[web])).status).toBe(202);expect((await env.DB.prepare("SELECT revoked_at FROM receiver_delivery_channels WHERE id = 'fixture-push'").first<any>()).revoked_at).toBeNull();
  });
  it('disconnects both legacy and peer relations between the same devices',async()=>{
    const created=await call(null,'/api/v1/pairs',{label:'Legacy'});const pair=await created.json<any>();const oldCookie=created.headers.get('set-cookie')!.split(';')[0];
    const claimed=await call(null,`/api/v1/pairs/${pair.code}/claim`,{label:'App'});const app=await claimed.json<any>();const web={id:pair.receiverId,cookie:oldCookie,label:'Legacy'};
    await call(web,`/api/v1/pairs/${pair.code}/confirm`,{});await call(null,`/api/v1/pairs/${pair.code}/confirm`,{role:'mobile',token:app.token});
    const adopted=await call(web,`/api/v1/pairs/${pair.code}/device`,{});web.cookie=adopted.headers.get('set-cookie')!.split(';')[0];const mobile={id:app.receiverId,token:app.token,label:'App'};
    await link(web,mobile);expect((await call(web,'revoke',{targetId:mobile.id})).status).toBe(200);
    expect((await(await call(web,'devices')).json<any>()).devices).toHaveLength(0);expect((await send(mobile,[web])).status).toBe(401);
    expect((await env.DB.prepare('SELECT revoked_at FROM pairings WHERE id = ?').bind(pair.code).first<any>()).revoked_at).not.toBeNull();
  });
  it('rejects invalid identity and cross-origin writes; filters unsafe URL actions',async()=>{
    expect((await call(null,'devices')).status).toBe(401);
    const a=await create('A'),b=await create('B');await link(a,b);await send(a,[b],crypto.randomUUID(),'javascript:alert(1)');expect((await events(b))[0].openUrl).toBeNull();
    const denied=await SELF.fetch('https://qr.test/api/v2/invitations',{method:'POST',headers:{origin:'https://evil.test',cookie:a.cookie!},body:'{}'});expect(denied.status).toBe(403);
  });
});
