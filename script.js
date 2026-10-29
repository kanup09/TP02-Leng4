/** @typedef {import('leaflet')} */

// 1. Inicializar mapa 
const map = L.map('map').setView([-24.7859, -65.4116], 14);

// 2. Capa base OpenStreetMap (Genera la imagen del mapa)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Estructuras de datos
const historialPosiciones = [];
let userMarker = null;
let ultimaPosicionUsuario = null;

// Marcador del Destino (Pin rojo)
let destinoMarker = null;
const iconoRojo = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Capas vectoriales
const recorridoLinea = L.polyline([], { color: 'red', weight: 4, opacity: 0.8 }).addTo(map);
const grupoCapasRutas = L.layerGroup().addTo(map); // Grupo para borrar/dibujar las rutas encontradas

const listaPosicionesDOM = document.getElementById('posiciones-lista');
const contenedorRutasDOM = document.getElementById('rutas-info');

// 4. Registrar nueva posición (GPS o Manual)
function registrarNuevaPosicion(lat, lng) {
  ultimaPosicionUsuario = [lat, lng];
  historialPosiciones.push(ultimaPosicionUsuario);

  // Agregar al historial lateral
  const item = document.createElement('li');
  item.textContent = `- Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  listaPosicionesDOM.appendChild(item);

  // Extender polilínea
  recorridoLinea.addLatLng(ultimaPosicionUsuario);

  // Actualizar marcador de usuario
  if (!userMarker) {
    userMarker = L.marker(ultimaPosicionUsuario).addTo(map);
  } else {
    userMarker.setLatLng(ultimaPosicionUsuario);
  }

  map.panTo(ultimaPosicionUsuario);
}

// 5. Función para calcular rutas con OSRM y Fetch API
async function calcularRutasHaciaDestino(destinoLat, destinoLng) {
  if (!ultimaPosicionUsuario) {
    alert('Aún no se detectó tu ubicación. Ingresa una coordenada o activa el GPS.');
    return;
  }

  const [origenLat, origenLng] = ultimaPosicionUsuario;
  // OSRM espera el formato: {lng},{lat};{lng},{lat}
  const url = `https://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destinoLng},${destinoLat}?overview=full&geometries=geojson&alternatives=true`;

  try {
    contenedorRutasDOM.innerHTML = '<p>Calculando rutas...</p>';
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    if (!datos.routes || datos.routes.length === 0) {
      contenedorRutasDOM.innerHTML = '<p>No se encontraron rutas disponibles.</p>';
      return;
    }

    // Limpiar rutas previas del mapa y del panel
    grupoCapasRutas.clearLayers();
    contenedorRutasDOM.innerHTML = '';

    const colores = ['#007bff', '#28a745', '#fd7e14']; // Azul (principal), Verde, Naranja

    datos.routes.forEach((ruta, index) => {
      // Invertir coordenadas de GeoJSON [lng, lat] a Leaflet [lat, lng]
      const coordenadasLeaflet = ruta.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      const colorActual = colores[index] || '#6c757d';

      // Dibujar la ruta en el mapa
      const lineaRuta = L.polyline(coordenadasLeaflet, {
        color: colorActual,
        weight: index === 0 ? 6 : 4,
        opacity: index === 0 ? 0.9 : 0.6,
        dashArray: index === 0 ? null : '6, 8'
      }).addTo(grupoCapasRutas);

      // Calcular distancia en km y tiempo estimado en minutos
      const distanciaKm = (ruta.distance / 1000).toFixed(2);
      const duracionMin = (ruta.duration / 60).toFixed(0);

      lineaRuta.bindPopup(`<b>Opción ${index + 1}</b><br>Distancia: ${distanciaKm} km<br>Tiempo: ${duracionMin} min`);

      // Agregar tarjeta de información al panel
      const divInfo = document.createElement('div');
      divInfo.className = 'ruta-item';
      divInfo.style.borderLeftColor = colorActual;
      divInfo.innerHTML = `<strong>Ruta ${index + 1} ${index === 0 ? '(Recomendada)' : ''}:</strong><br>${distanciaKm} km — ~${duracionMin} min`;
      contenedorRutasDOM.appendChild(divInfo);
    });

  } catch (error) {
    console.error('Error al obtener rutas de OSRM:', error);
    contenedorRutasDOM.innerHTML = '<p>Error al conectar con el servicio de rutas.</p>';
  }
}

// 6. Evento de clic en el mapa para colocar el pin rojo y buscar rutas
map.on('click', (e) => {
  const { lat, lng } = e.latlng;

  // Crear o mover el pin rojo de destino
  if (!destinoMarker) {
    destinoMarker = L.marker([lat, lng], { icon: iconoRojo }).addTo(map);
  } else {
    destinoMarker.setLatLng([lat, lng]);
  }

  destinoMarker.bindPopup(`<b>Destino</b><br>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`).openPopup();

  // Calcular las rutas desde la ubicación actual hasta este punto
  calcularRutasHaciaDestino(lat, lng);
});

// 7. Formulario manual
const formCoordenadas = document.getElementById('form-coordenadas');
formCoordenadas.addEventListener('submit', (e) => {
  e.preventDefault();
  const latInput = parseFloat(document.getElementById('input-lat').value);
  const lngInput = parseFloat(document.getElementById('input-lng').value);

  if (!isNaN(latInput) && !isNaN(lngInput)) {
    registrarNuevaPosicion(latInput, lngInput);
    formCoordenadas.reset();
  }
});

// 8. Geolocalización automática en tiempo real
if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(
    (posicion) => {
      registrarNuevaPosicion(posicion.coords.latitude, posicion.coords.longitude);
    },
    (error) => {
      console.warn(`Error de geolocalización (${error.code}): ${error.message}`);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}