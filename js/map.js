let map            = null;
let travelerMarker = null;

const DEFAULT_LAT  = 19.076;
const DEFAULT_LNG  = 72.8777;
const CITY_ZOOM    = 13;    
const STREET_ZOOM  = 16;    

export function initMap() {
  if (map) return; 

  map = L.map("map", {
    zoomControl:       false,
    attributionControl: false
  }).setView([DEFAULT_LAT, DEFAULT_LNG], CITY_ZOOM);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19
  }).addTo(map);

  travelerMarker = L.circleMarker([DEFAULT_LAT, DEFAULT_LNG], {
    radius:      11,
    fillColor:   "#1E3A8A",   
    color:       "#ffffff",   
    weight:      3,
    opacity:     0,           
    fillOpacity: 0
  }).addTo(map);

  travelerMarker.bindPopup("📍 You are here");
}

/**
 * Called from tracking.js every time a new GPS position arrives.
 * Makes the dot visible on first call, then moves it every update.
 *
 * @param {number} lat
 * @param {number} lng
 */
export function updateMapMarker(lat, lng) {
  if (!map) initMap();

  travelerMarker.setStyle({ opacity: 1, fillOpacity: 1 });

  travelerMarker.setLatLng([lat, lng]);

  if (map.getZoom() < STREET_ZOOM) {
    map.setView([lat, lng], STREET_ZOOM);
  } else {
    map.panTo([lat, lng]);
  }
}
