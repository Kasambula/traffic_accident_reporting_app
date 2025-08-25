// Generate unique report_id
function generateReportID() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 999) + 1;
  const paddedNum = String(randomNum).padStart(3, '0');
  return `KLA-${year}-ACC-${paddedNum}`;
}

// Basemaps
const osmLayer = new ol.layer.Tile({
  source: new ol.source.OSM(),
  visible: true
});

const googleSatelliteLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
  }),
  visible: false
});

// Accident style
function accidentStyleFunction(feature) {
  const type = feature.get('accident_type');
  const severity = feature.get('severity');
  let color = '#E74C3C';
  let radius = 7;

  switch (type) {
    case 'Overturn': color = '#E67E22'; break;
    case 'Pedestrian Hit': color = '#F1C40F'; break;
    case 'Animal Hit': color = '#27AE60'; break;
    case 'Others': color = '#2980B9'; break;
  }

  switch (severity) {
    case 'Minor': radius = 6; break;
    case 'Moderate': radius = 10; break;
    case 'Severe': radius = 14; break;
  }

  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: radius,
      fill: new ol.style.Fill({ color: color }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
    })
  });
}

// Boundary style
const boundaryStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: '#2980B9', width: 2 }),
  fill: new ol.style.Fill({ color: 'rgba(41,128,185,0.1)' })
});

// Layers
const boundaryLayer = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'data/kampala_boundary.geojson',
    format: new ol.format.GeoJSON()
  }),
  style: boundaryStyle
});

const filterType = document.getElementById('filter-type');
const filterSeverity = document.getElementById('filter-severity');

const accidentLayer = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'data/kampala_accidents.geojson',
    format: new ol.format.GeoJSON()
  }),
  style: function(feature) {
    const typeMatch = filterType.value === 'All' || feature.get('accident_type') === filterType.value;
    const sevMatch = filterSeverity.value === 'All' || feature.get('severity') === filterSeverity.value;
    return (typeMatch && sevMatch) ? accidentStyleFunction(feature) : null;
  }
});

// Map
const map = new ol.Map({
  target: 'map',
  layers: [osmLayer, googleSatelliteLayer, boundaryLayer, accidentLayer],
  view: new ol.View({
    center: ol.proj.fromLonLat([32.5825, 0.3476]),
    zoom: 12
  }),
  controls: ol.control.defaults().extend([new ol.control.FullScreen(), new ol.control.ScaleLine()])
});

// Popup
const popupContainer = document.createElement('div');
popupContainer.className = 'ol-popup';
const overlay = new ol.Overlay({
  element: popupContainer,
  positioning: 'bottom-center',
  stopEvent: false
});
map.addOverlay(overlay);

map.on('click', function(evt) {
  map.forEachFeatureAtPixel(evt.pixel, function(feature) {
    const props = feature.getProperties();
    if (props.accident_type) {
      overlay.setPosition(evt.coordinate);
      popupContainer.innerHTML = `
        <b>${props.accident_type} (${props.severity})</b><br>
        Vehicles: ${props.num_vehicles}<br>
        Casualties: ${props.num_casualties}<br>
        Time: ${props.timestamp || 'N/A'}<br>
        Description: ${props.description || 'N/A'}<br>
      `;
    }
  });
});

// Switchers
document.getElementById('osm').addEventListener('change', function() {
  osmLayer.setVisible(this.checked);
});
document.getElementById('google-sat').addEventListener('change', function() {
  googleSatelliteLayer.setVisible(this.checked);
});
document.getElementById('boundary').addEventListener('change', function() {
  boundaryLayer.setVisible(this.checked);
});
document.getElementById('accidents').addEventListener('change', function() {
  accidentLayer.setVisible(this.checked);
});

function updateMapFilters() { accidentLayer.changed(); }
filterType.addEventListener('change', updateMapFilters);
filterSeverity.addEventListener('change', updateMapFilters);

// Form
const formPanel = document.getElementById('form-panel');
const showFormButton = document.getElementById('show-form');
const accidentForm = document.getElementById('accident-form');

const reportLocationInput = document.createElement('input');
reportLocationInput.type = 'hidden';
reportLocationInput.name = 'report_location';
accidentForm.appendChild(reportLocationInput);

showFormButton.addEventListener('click', function() {
  if ("geolocation" in navigator) {
    alert("Fetching your current location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lonLat = [pos.coords.longitude, pos.coords.latitude];
        const coordinate = ol.proj.fromLonLat(lonLat);
        reportLocationInput.value = JSON.stringify(coordinate);

        formPanel.style.display = 'block';
        map.getView().animate({ center: coordinate, zoom: 16, duration: 500 });

        alert(`Location found at: ${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`);
      },
      (error) => alert("Location error: " + error.message)
    );
  } else {
    alert("Geolocation not supported.");
  }
});

accidentForm.addEventListener('submit', function(e) {
  e.preventDefault();
  if (!reportLocationInput.value) {
    alert("Click 'Add Report' to get your location first.");
    return;
  }
  const coord = JSON.parse(reportLocationInput.value);
  const form = new FormData(accidentForm);
  const reportID = generateReportID();

  const feature = new ol.Feature({
    geometry: new ol.geom.Point(coord),
    report_id: reportID,
    accident_type: form.get('accident_type'),
    severity: form.get('severity'),
    num_vehicles: form.get('num_vehicles'),
    num_casualties: form.get('num_casualties'),
    description: form.get('description'),
    timestamp: form.get('timestamp')
  });

  accidentLayer.getSource().addFeature(feature);
  alert('✅ Accident Report Submitted!');
  accidentForm.reset();
  reportLocationInput.value = '';
  formPanel.style.display = 'none';
  updateMapFilters();
});
