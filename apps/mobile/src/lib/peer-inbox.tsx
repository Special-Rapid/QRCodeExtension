import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { loadMobileIdentity } from './handoff';
import { peerDevices, peerEvents, peerRequest, type PeerEvent } from './peers';
const InboxContext = createContext<PeerEvent[]>([]);
export function PeerInboxProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<PeerEvent[]>([]); const seen = useRef(new Map<string, number>());
  useEffect(() => {
    let active=true,busy=false;
    const poll=async()=>{
      if(!active || busy || AppState.currentState!=='active')return;busy=true;
      try {
        if(!await loadMobileIdentity())return;
        const linked=await peerDevices();const incoming=await peerEvents();if(!active)return;const now=Date.now();
        for(const [id,expiry]of seen.current)if(expiry<=now)seen.current.delete(id);
        setEvents(current=>current.filter(event=>event.expiresAt>now && linked.some(device=>device.id===event.senderId && device.linkId===event.linkId)));
        for(const event of incoming){if(!seen.current.has(event.id)){seen.current.set(event.id,event.expiresAt);setEvents(current=>[event,...current].slice(0,100));}await peerRequest('ack',{eventId:event.id});}
      }catch (error) { if(error instanceof Error && (error as Error & {code?:string}).code==='unauthorized'){seen.current.clear();setEvents([]);} /* The device screen offers explicit refresh; no system notification is emitted. */ }finally{busy=false;}
    };
    const timer=setInterval(()=>void poll(),2000);const lifecycle=AppState.addEventListener('change',state=>{if(state==='active')void poll();});void poll();
    return()=>{active=false;clearInterval(timer);lifecycle.remove();};
  },[]);
  return <InboxContext.Provider value={events}>{children}</InboxContext.Provider>;
}
export function usePeerInbox(){return useContext(InboxContext);}
