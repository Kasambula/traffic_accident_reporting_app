// Import OpenLayers components directly from CDN
import 'https://cdn.jsdelivr.net/npm/ol@latest/ol.css';
import Map from 'https://cdn.jsdelivr.net/npm/ol@latest/Map.js';
import View from 'https://cdn.jsdelivr.net/npm/ol@latest/View.js';
import TileLayer from 'https://cdn.jsdelivr.net/npm/ol@latest/layer/Tile.js';
import OSM from 'https://cdn.jsdelivr.net/npm/ol@latest/source/OSM.js';
import XYZ from 'https://cdn.jsdelivr.net/npm/ol@latest/source/XYZ.js';
import VectorLayer from 'https://cdn.jsdelivr.net/npm/ol@latest/layer/Vector.js';
import VectorSource from 'https://cdn.jsdelivr.net/npm/ol@latest/source/Vector.js';
import GeoJSON from 'https://cdn.jsdelivr.net/npm/ol@latest/format/GeoJSON.js';
import Style from 'https://cdn.jsdelivr.net/npm/ol@latest/style/Style.js';
import CircleStyle from 'https://cdn.jsdelivr.net/npm/ol@latest/style/Circle.js';
import Fill from 'https://cdn.jsdelivr.net/npm/ol@latest/style/Fill.js';
import Stroke from 'https://cdn.jsdelivr.net/npm/ol@latest/style/Stroke.js';
import Point from 'https://cdn.jsdelivr.net/npm/ol@latest/geom/Point.js';
import Feature from 'https://cdn.jsdelivr.net/npm/ol@latest/Feature.js';
import { fromLonLat, toLonLat } from 'https://cdn.jsdelivr.net/npm/ol@latest/proj.js';
import Overlay from 'https://cdn.jsdelivr.net/npm/ol@latest/Overlay.js';
import { defaults as defaultControls, FullScreen, ScaleLine } from 'https://cdn.jsdelivr.net/npm/ol@latest/control.js';

// ----------------------- YOUR LOGIC STARTS -----------------------

// Generate unique report_id
function generateReportID() {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 999) + 1;
    const paddedNum = String(randomNum).padStart(3, '0');
    return `KLA-${year}-ACC-${paddedNum}`;
}

// Initialize map layers
const osmLayer = new TileLayer({
    source: new OSM(),
    title: 'OSM',
    type: 'base',
    visible: true
});

const googleSatelliteLayer = new TileLayer({
    source: new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
    }),
    title: 'Google Satellite',
    type: 'base',
    visible: false
});

// Function to determine style based on accident type and severity
const accidentStyleFunction = function(feature) {
    const type = feature.get('accident_type');
    const severity = feature.get('severity');
    let color = '#E74C3C'; // Default color
    let radius = 7; // Default radius

    switch (type) {
        case 'Collision': color = '#E74C3C'; break;
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

    return new Style({
        image: new CircleStyle({
            radius: radius,
            fill: new Fill({ color: color }),
            stroke: new Stroke({ color: '#fff', width: 2 })
        })
    });
};

// Style for boundary
const boundaryStyle = new Style({
    stroke: new Stroke({ color: '#2980B9', width: 2 }),
    fill: new Fill({ color: 'rgba(41,128,185,0.1)' })
});

// Load boundary layer
const boundaryLayer = new VectorLayer({
    source: new VectorSource({
        url: './data/kampala_boundary.geojson',
        format: new GeoJSON()
    }),
    style: boundaryStyle
});

// Filters
const filterType = document.getElementById('filter-type');
const filterSeverity = document.getElementById('filter-severity');

// Accidents layer
const accidentLayer = new VectorLayer({
    source: new VectorSource({
        url: './data/kampala_accidents.geojson',
        format: new GeoJSON()
    }),
    style: function(feature) {
        const selectedType = filterType.value;
        const selectedSeverity = filterSeverity.value;
        const featureType = feature.get('accident_type');
        const featureSeverity = feature.get('severity');

        const typeMatch = selectedType === 'All' || featureType === selectedType;
        const severityMatch = selectedSeverity === 'All' || featureSeverity === selectedSeverity;

        if (typeMatch && severityMatch) {
            return accidentStyleFunction(feature);
        } else {
            return null;
        }
    }
});

// Map init
const map = new Map({
    target: 'map',
    layers: [osmLayer, googleSatelliteLayer, boundaryLayer, accidentLayer],
    view: new View({
        center: fromLonLat([32.5825, 0.3476]), // Kampala
        zoom: 12
    }),
    controls: defaultControls().extend([new FullScreen(), new ScaleLine()])
});

// Popup
const popupContainer = document.createElement('div');
popupContainer.className = 'popup';
const overlay = new Overlay({
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

// Layer switcher
document.getElementById('osm').addEventListener('change', e => osmLayer.setVisible(e.target.checked));
document.getElementById('google-sat').addEventListener('change', e => googleSatelliteLayer.setVisible(e.target.checked));
document.getElementById('boundary').addEventListener('change', e => boundaryLayer.setVisible(e.target.checked));
document.getElementById('accidents').addEventListener('change', e => accidentLayer.setVisible(e.target.checked));

// Filtering logic
function updateMapFilters() {
    accidentLayer.changed();
}
filterType.addEventListener('change', updateMapFilters);
filterSeverity.addEventListener('change', updateMapFilters);

// Form handling
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
            (position) => {
                const lonLat = [position.coords.longitude, position.coords.latitude];
                const coordinate = fromLonLat(lonLat);
                reportLocationInput.value = JSON.stringify(coordinate);

                formPanel.style.display = 'block';
                map.getView().animate({ center: coordinate, zoom: 16, duration: 500 });
                alert(`Location: ${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`);
            },
            (error) => {
                switch(error.code) {
                    case error.PERMISSION_DENIED: alert("Please grant location permission."); break;
                    case error.POSITION_UNAVAILABLE: alert("Location unavailable."); break;
                    case error.TIMEOUT: alert("Location request timed out."); break;
                    default: alert("An unknown error occurred."); break;
                }
            }
        );
    } else {
        alert("Geolocation not supported.");
    }
});

// Form submit
accidentForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const reportLocation = reportLocationInput.value;
    if (!reportLocation) {
        alert("Missing location. Click 'Add Report' first.");
        return;
    }

    const coordinate = JSON.parse(reportLocation);
    const form = new FormData(accidentForm);
    const reportID = generateReportID();

    const feature = new Feature({
        geometry: new Point(coordinate),
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
