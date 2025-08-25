// Remove all import statements
// All OpenLayers components are now accessed via the global `ol` namespace

// Generate unique report_id
function generateReportID() {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 999) + 1;
    const paddedNum = String(randomNum).padStart(3, '0');
    return `KLA-${year}-ACC-${paddedNum}`;
}

// Initialize map layers
const osmLayer = new ol.layer.Tile({
    source: new ol.source.OSM(),
    title: 'OSM',
    type: 'base',
    visible: true
});

const googleSatelliteLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
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
        case 'Collision':
            color = '#E74C3C';
            break;
        case 'Overturn':
            color = '#E67E22';
            break;
        case 'Pedestrian Hit':
            color = '#F1C40F';
            break;
        case 'Animal Hit':
            color = '#27AE60';
            break;
        case 'Others':
            color = '#2980B9';
            break;
    }

    switch (severity) {
        case 'Minor':
            radius = 6;
            break;
        case 'Moderate':
            radius = 10;
            break;
        case 'Severe':
            radius = 14;
            break;
    }

    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius,
            fill: new ol.style.Fill({ color: color }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
        })
    });
};

// Style for boundary
const boundaryStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#2980B9',
        width: 2
    }),
    fill: new ol.style.Fill({
        color: 'rgba(41,128,185,0.1)'
    })
});

// Load boundary layer
const boundaryLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
        url: 'data/kampala_boundary.geojson',
        format: new ol.format.GeoJSON()
    }),
    style: boundaryStyle
});

// Get filter elements from the DOM
const filterType = document.getElementById('filter-type');
const filterSeverity = document.getElementById('filter-severity');

// Create the accident layer with a style function that applies filters
const accidentLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
        url: 'data/kampala_accidents.geojson',
        format: new ol.format.GeoJSON()
    }),
    style: function(feature) {
        const selectedType = filterType.value;
        const selectedSeverity = filterSeverity.value;

        const featureType = feature.get('accident_type');
        const featureSeverity = feature.get('severity');

        const typeMatch = selectedType === 'All' || featureType === selectedType;
        const severityMatch = selectedSeverity === 'All' || featureSeverity === selectedSeverity;

        // Apply style only if both filters match
        if (typeMatch && severityMatch) {
            return accidentStyleFunction(feature);
        } else {
            return null; // Don't show the feature
        }
    }
});

// Map initialization
const map = new ol.Map({
    target: 'map',
    layers: [osmLayer, googleSatelliteLayer, boundaryLayer, accidentLayer],
    view: new ol.View({
        center: ol.proj.fromLonLat([32.5825, 0.3476]), // Kampala coordinates
        zoom: 12
    }),
    controls: ol.control.defaults().extend([new ol.control.FullScreen(), new ol.control.ScaleLine()])
});

// Popup for accident points
const popupContainer = document.createElement('div');
popupContainer.className = 'popup';
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

// Layer switcher
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

// NEW: Filtering logic
function updateMapFilters() {
    // Re-render the layer to apply the new style function
    accidentLayer.changed();
}

filterType.addEventListener('change', updateMapFilters);
filterSeverity.addEventListener('change', updateMapFilters);

// Form and form panel
const formPanel = document.getElementById('form-panel');
const showFormButton = document.getElementById('show-form');
const accidentForm = document.getElementById('accident-form');

// --- MODIFICATION STARTS HERE ---
const reportLocationInput = document.createElement('input');
reportLocationInput.type = 'hidden';
reportLocationInput.name = 'report_location';
accidentForm.appendChild(reportLocationInput);

showFormButton.addEventListener('click', function() {
    // Check if the Geolocation API is available
    if ("geolocation" in navigator) {
        alert("Fetching your current location...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lonLat = [position.coords.longitude, position.coords.latitude];
                const coordinate = ol.proj.fromLonLat(lonLat);

                // Set the hidden input value with the coordinates
                reportLocationInput.value = JSON.stringify(coordinate);

                // Update the form panel and map view
                formPanel.style.display = 'block';
                map.getView().animate({
                    center: coordinate,
                    zoom: 16,
                    duration: 500
                });

                alert(`Location found at: ${lonLat[1].toFixed(5)}, ${lonLat[0].toFixed(5)}`);
            },
            (error) => {
                // Handle various errors
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        alert("Please grant location permission to submit a report.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        alert("Location information is unavailable. Please try again later.");
                        break;
                    case error.TIMEOUT:
                        alert("Request to get user location timed out.");
                        break;
                    default:
                        alert("An unknown error occurred while getting your location.");
                        break;
                }
            }
        );
    } else {
        alert("Geolocation is not supported by your browser. Please use a different browser or device.");
    }
});

// On form submit
accidentForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const reportLocation = reportLocationInput.value;
    if (!reportLocation) {
        alert("Location data is missing. Please click 'Add Report' to get your location first.");
        return;
    }

    const coordinate = JSON.parse(reportLocation);
    const form = new FormData(accidentForm);
    const reportID = generateReportID();

    const feature = new ol.Feature({
        geometry: new ol.geom.Point(coordinate),
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
    reportLocationInput.value = ''; // Clear the hidden input
    formPanel.style.display = 'none'; // Hide form after submission
    updateMapFilters(); // Re-apply filters for the newly added feature
});
