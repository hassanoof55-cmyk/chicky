export function disposeLeafletMap(mapRef: { current: any }, ...layerRefs: { current: any }[]) {
  mapRef.current?.remove();
  mapRef.current = null;
  for (const ref of layerRefs) ref.current = null;
}
