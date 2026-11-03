/** Measure only what is visible while consent is active, including late opt-in. */
export function observeCatalogImpression(
  element:Element, record:()=>void, consented:()=>boolean,
  events:Pick<EventTarget,'addEventListener'|'removeEventListener'>=window,
  Observer:typeof IntersectionObserver=IntersectionObserver,
  consentEvent='chicky:analytics-consent',
) {
  let visible=false;let recorded=false;let disposed=false;
  const measure=()=>{if(!disposed && visible && !recorded && consented()){recorded=true;record();}};
  const observer=new Observer(entries=>{visible=entries.some(entry=>entry.isIntersecting);measure();},{threshold:0.1});
  const change=()=>{if(!consented())recorded=false;else measure();};
  observer.observe(element);events.addEventListener(consentEvent,change);
  return ()=>{disposed=true;observer.disconnect();events.removeEventListener(consentEvent,change);};
}
