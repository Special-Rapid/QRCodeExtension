export function createPeerClient({ t, results, addEvent, browserLabel }) {
  const deviceName = (peer) => `${peer.label} · ${peer.id.slice(0,6)}`;
  const $ = (id) => document.getElementById(id);
  let device = null, devices = [], invitation = null, busy = false, sendBusy = false, timer = null, pollBusy = false;
  let statusKey = '', sendStatusKey = '', inboxStatusKey = '', notificationStatusKey = '', notificationBusy = false, generation = 0;
  let selection = new Set(), receipt = null;
  const seen = new Map();
  let graphSignature = "", resultSignature = "";
  const request = async (path, body) => {
    const response = await fetch('/api/v2/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json(); if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status }); return data;
  };
  function status(key) { statusKey = key; $('peer-status').textContent = t(key); }
  function controls() { for (const id of ['peer-add','peer-refresh','peer-claim','peer-confirm']) $(id).disabled = busy; }
  async function action(work) { if (busy) return; busy = true; controls(); status('peerPending'); try { await work(); } catch { status('peerFailed'); } finally { busy = false; controls(); } }
  async function ensure() { if (!device) device = (await request('device', { label: browserLabel() })).device; }
  function render() {
    const focused = document.activeElement?.dataset.peerId;
    const removeFocus = document.activeElement?.dataset.peerRemoveId;
    $('peer-devices').replaceChildren(); $('peer-target-options').replaceChildren();
    const active = new Set(devices.map(peer => peer.id)); selection = new Set([...selection].filter(id => active.has(id)));
    if (!devices.length) { const empty = document.createElement('li'); empty.textContent = t('peerEmpty'); $('peer-devices').append(empty); }
    for (const peer of devices) {
      const item = document.createElement('li'), name = document.createElement('span'); name.textContent = deviceName(peer);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'quiet-button'; remove.textContent = t('peerRemove'); remove.setAttribute('aria-label',`${deviceName(peer)}: ${t('peerRemove')}`); remove.disabled = busy || sendBusy;remove.dataset.peerRemoveId=peer.id;
      remove.addEventListener('click', () => { if (confirm(t('peerRemoveConfirm'))) void action(async () => {
        if (peer.transport === 'legacy') { const response = await fetch(`/api/v1/pairs/${peer.linkId}/revoke`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'}); if(!response.ok)throw Error('revoke'); }
        else await request('revoke',{targetId:peer.id});
        generation++; seen.clear(); $('peer-event-list').replaceChildren(); receipt=null; await refreshDevices(); status('peerRemoved');
      }); });
      item.append(name,remove); $('peer-devices').append(item);
      const label = document.createElement('label'), input = document.createElement('input'); input.type='checkbox'; input.checked=selection.has(peer.id); input.disabled=sendBusy; input.dataset.peerId=peer.id;
      input.addEventListener('change',()=>{if(input.checked)selection.add(peer.id);else selection.delete(peer.id);receipt=null;refreshSend();});
      label.append(input,document.createTextNode(deviceName(peer)));$('peer-target-options').append(label);
    }
    if(focused) $('peer-target-options').querySelector(`[data-peer-id="${CSS.escape(focused)}"]`)?.focus();
    if(removeFocus) $('peer-devices').querySelector(`[data-peer-remove-id="${CSS.escape(removeFocus)}"]`)?.focus();
    if(devices.length && document.getElementById('unpaired-panel'))document.getElementById('unpaired-panel').hidden=true;
    refreshSend();
  }
  async function refreshDevices() { await ensure(); const data=await request('devices'); device=data.device;devices=data.devices;render(); }
  function refreshSend() { const values=results(),signature=JSON.stringify(values);if(signature!==resultSignature){resultSignature=signature;$('peer-result').replaceChildren();values.forEach((value,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=value.slice(0,100);$('peer-result').append(option);});receipt=null;} $('peer-result').disabled=sendBusy; $('peer-send').disabled=sendBusy || !results().length || !selection.size; }
  function renderInvitation() {
    $('peer-confirmation').hidden=!invitation;
    if(!invitation)return;
    $('peer-code').textContent=invitation.code;
    $('peer-phrase').textContent=invitation.phrase;
    $('peer-counterparty').textContent=[deviceName(invitation.owner),invitation.claimant ? deviceName(invitation.claimant) : null].filter(Boolean).join(' ↔ ');
    const mine=device?.id===invitation.owner.id;
    $('peer-confirm').hidden=!invitation.claimant || invitation.status!=='pending';
    $('peer-confirm').disabled=busy || (mine ? invitation.ownerConfirmed : invitation.claimantConfirmed);
  }
  async function poll() {
    if(pollBusy || document.hidden)return;
    pollBusy=true; const current=generation;
    try {
      if(!device) { try { device=(await request('device')).device;await refreshDevices(); } catch {return;} }
      if(invitation?.status==='pending') {
        invitation=await request(`invitations/${invitation.code}`);renderInvitation();
        if(invitation.status==='paired'){status('peerPaired');await refreshDevices();}
        if(invitation.status==='expired')status('peerFailed');
      }
      const linked=await request('devices');if(current!==generation)return;
      const signature=linked.devices.map(peer=>peer.id+':'+peer.linkId).sort().join();
      if(signature!==graphSignature){graphSignature=signature;devices=linked.devices;seen.clear();$('peer-event-list').replaceChildren();render();}
      const now=Date.now();for(const [id,expiry]of seen){if(expiry<=now){seen.delete(id);$('peer-event-list').querySelector(`[data-peer-event="${CSS.escape(id)}"]`)?.remove();}}
      const data=await request('events');if(current!==generation)return;
      $('peer-inbox-panel').hidden=false;if(inboxStatusKey==='peerOffline')inboxStatusKey='';
      for(const event of data.events) {
        if(!seen.has(event.id)) {
          seen.set(event.id,event.expiresAt);const node=$('event-template').content.cloneNode(true);node.querySelector('.event').dataset.peerEvent=event.id;
          node.querySelector('.event-value').textContent=event.data;node.querySelector('.event-host').textContent=event.host || event.senderLabel;
          node.querySelector('.event-kind').textContent=deviceName({label:event.senderLabel,id:event.senderId});
          const copy=node.querySelector('.copy-event');copy.textContent=t('copy');copy.dataset.i18n='copy';copy.addEventListener('click',async()=>{if(copy.disabled)return;copy.disabled=true;copy.dataset.i18n='scanCopyPending';copy.textContent=t('scanCopyPending');inboxStatusKey='scanCopyPending';$('peer-inbox-status').textContent=t(inboxStatusKey);try{await navigator.clipboard.writeText(event.data);copy.dataset.i18n='copied';copy.textContent=t('copied');inboxStatusKey='copied';$('peer-inbox-status').textContent=t(inboxStatusKey);}catch{inboxStatusKey='scanCopyFailed';$('peer-inbox-status').textContent=t(inboxStatusKey);}finally{copy.disabled=false;}});
          const open=node.querySelector('.open-event');open.textContent=t('open');open.dataset.i18n='open';if(event.openUrl)open.addEventListener('click',()=>window.open(event.openUrl,'_blank','noopener,noreferrer'));else open.remove();
          $('peer-event-list').prepend(node);
          if('Notification' in window && Notification.permission==='granted') { try {new Notification('QR Scan',{body:t('peerForegroundNotification'),tag:`qr-scan-handoff:${event.id}`,renotify:false});}catch{} }
        }
        await request('ack',{eventId:event.id});
      }
      if(!inboxStatusKey)$('peer-inbox-status').textContent=$('peer-event-list').children.length?'':t('peerInboxEmpty');
    }catch(error){inboxStatusKey='peerOffline';$('peer-inbox-status').textContent=t(inboxStatusKey);if(error.status===401){generation++;device=null;devices=[];selection.clear();seen.clear();$('peer-event-list').replaceChildren();render();}}
    finally{pollBusy=false;}
  }
  $('peer-add').addEventListener('click',()=>void action(async()=>{await ensure();invitation=await request('invitations',{});renderInvitation();status('peerWaiting');}));
  $('peer-refresh').addEventListener('click',()=>void action(async()=>{await refreshDevices();status(devices.length?'peerRefreshed':'peerEmpty');}));
  $('peer-claim-form').addEventListener('submit',(event)=>{event.preventDefault();void action(async()=>{await ensure();const code=$('peer-code-input').value.toUpperCase().replace(/[^A-Z0-9]/g,'');invitation=await request(`invitations/${code}/claim`,{});renderInvitation();status('peerWaiting');});});
  $('peer-confirm').addEventListener('click',()=>void action(async()=>{if(!invitation)return;invitation=await request(`invitations/${invitation.code}/confirm`,{});renderInvitation();if(invitation.status==='paired')await refreshDevices();status(invitation.status==='paired'?'peerPaired':'peerWaiting');}));
  $('peer-result').addEventListener('change',()=>{receipt=null;});
  $('peer-send').addEventListener('click',async()=>{
    if(sendBusy)return;const data=results()[Number($('peer-result').value) || 0];if(!data || !selection.size){sendStatusKey='peerNeedTarget';$('peer-send-status').textContent=t(sendStatusKey);return;}
    const targets=[...selection].sort();if(!receipt || receipt.data!==data || receipt.targets.join()!==targets.join()) receipt={data,targets,requestId:crypto.randomUUID()};
    sendBusy=true;sendStatusKey='peerPending';$('peer-send-status').textContent=t(sendStatusKey);refreshSend();render();
    try{await request('handoffs',{data,requestId:receipt.requestId,targetIds:targets});sendStatusKey='peerSent';}catch{sendStatusKey='peerPartial';}
    finally{sendBusy=false;$('peer-send-status').textContent=t(sendStatusKey);render();}
  });
  function notificationStatus(key){notificationStatusKey=key;$('peer-notification-status').textContent=t(key);}
  $('peer-notifications').addEventListener('click',async()=>{
    if(notificationBusy)return;notificationBusy=true;$('peer-notifications').disabled=true;notificationStatus('peerPending');
    try{
      await ensure();if(!('Notification'in window) || !('serviceWorker'in navigator)){notificationStatus('peerNotificationUnsupported');return;}
      const permission=await Notification.requestPermission();if(permission!=='granted'){notificationStatus('peerNotificationDenied');return;}
      const keyResponse=await fetch('/api/v1/vapid-public-key');if(!keyResponse.ok){notificationStatus('peerNotificationUnavailable');return;}const {publicKey}=await keyResponse.json();
      const registration=await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;
      const raw=atob(publicKey.replaceAll('-','+').replaceAll('_','/'));const applicationServerKey=Uint8Array.from(raw,c=>c.charCodeAt(0));
      const subscription=await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
      await request('push-subscriptions',{subscription:subscription.toJSON()});notificationStatus('peerNotifications');
    }catch{notificationStatus('peerNotificationFailed');}finally{notificationBusy=false;$('peer-notifications').disabled=false;}
  });
  timer=setInterval(()=>void poll(),2000);void poll();
  window.addEventListener('pagehide',()=>{clearInterval(timer);generation++;device=null;});
  window.addEventListener('pageshow',()=>{clearInterval(timer);timer=setInterval(()=>void poll(),2000);void poll();});
  return {refreshSend,refreshCopy(){render();renderInvitation();if(statusKey)status(statusKey);if(notificationStatusKey)notificationStatus(notificationStatusKey);if(sendStatusKey)$('peer-send-status').textContent=t(sendStatusKey);if(inboxStatusKey)$('peer-inbox-status').textContent=t(inboxStatusKey);},async adopt(code){if(device)return;const response=await fetch(`/api/v1/pairs/${code}/device`,{method:'POST',credentials:'same-origin'});if(response.ok){device=(await response.json()).device;await refreshDevices();}}};
}
