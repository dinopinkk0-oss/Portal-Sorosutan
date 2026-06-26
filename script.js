/* ═══════════════════════════════════════════════════════════
   WebGIS Sorosutan v2 — script.js
   Ilma Nugraheni | NIM: 117230021 | SIG Internet UPN Jogja
   Tema: Batik Keraton Yogyakarta
═══════════════════════════════════════════════════════════ */

/* ─── MAPBOX TOKEN ────────────────────────────────────────── */
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZGhybjIxIiwiYSI6ImNtbm9meDNxcTI0Y2sycXEyaG43dnJqajIifQ.p1s6U3VJQR6jJu0kSN2WLQ';
mapboxgl.accessToken = MAPBOX_TOKEN;

/* ─── CONSTANTS ───────────────────────────────────────────── */
const CENTER = [110.3853, -7.8360];
const ZOOM   = 15;

/* Kategori → warna & icon */
const KATEGORI_CONFIG = {
  'Pendidikan'   : { color: '#2196F3', icon: 'fas fa-graduation-cap' },
  'Kesehatan'    : { color: '#F44336', icon: 'fas fa-plus-circle'    },
  'Bisnis/UMKM'  : { color: '#FF9800', icon: 'fas fa-store'          },
  'Ibadah'       : { color: '#9C27B0', icon: 'fas fa-mosque'         },
  'Fasilitas Umum':{ color: '#00BCD4', icon: 'fas fa-building'       },
  'default'      : { color: '#78909C', icon: 'fas fa-map-pin'        },
};

/* Panel → kategori GeoJSON yang ditampilkan */
const PANEL_FILTER = {
  pendidikan: ['Pendidikan'],
  kesehatan : ['Kesehatan'],
  umkm      : ['Bisnis/UMKM'],
};


/* ═══════════════════════════════════════════════════════════
   AUTH / LOGIN SYSTEM
═══════════════════════════════════════════════════════════ */
const USERS = {
  admin : { password: 'admin123',  role: 'admin'  },
  publik: { password: 'publik123', role: 'publik' },
};

let currentUser = null;

function doLogin() {
  const uname = document.getElementById('login-username').value.trim();
  const pw    = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  if (USERS[uname] && USERS[uname].password === pw) {
    currentUser = { username: uname, role: USERS[uname].role };
    errEl.style.display = 'none';

    // Fade out login screen
    const ls = document.getElementById('login-screen');
    ls.style.transition = 'opacity 0.5s';
    ls.style.opacity = '0';
    setTimeout(() => {
      ls.style.display = 'none';
      document.getElementById('main-app').style.display = 'flex';
      document.getElementById('main-app').style.flexDirection = 'column';
      onAfterLogin();
    }, 500);
  } else {
    errEl.style.display = 'flex';
    document.getElementById('login-password').value = '';
  }
}

function onAfterLogin() {
  // Set user badge
  document.getElementById('user-label').textContent =
    currentUser.username + ' (' + currentUser.role + ')';

  // PROTEKSI UI: Hanya tampilkan bar admin jika role adalah admin
  const adminBar = document.getElementById('admin-bar');
  if (currentUser.role === 'admin') {
    adminBar.style.display = 'flex';
  } else {
    adminBar.style.display = 'none'; // WAJIB: Sembunyikan jika user adalah publik
  }

  // Update badge feedback
  updateFeedbackBadge();
  // Load custom titik dari localStorage
  setTimeout(loadCustomTitikFromStorage, 2000);
  // Show beranda
  showPage('beranda');
}

function doLogout() {
  currentUser = null;
  // Sembunyikan bar admin saat logout agar tidak terlihat di layar login
  document.getElementById('admin-bar').style.display = 'none'; 
  
  document.getElementById('main-app').style.display = 'none';
  const ls = document.getElementById('login-screen');
  ls.style.display = 'flex';
  ls.style.opacity = '0';
  setTimeout(() => { ls.style.transition = 'opacity 0.4s'; ls.style.opacity = '1'; }, 10);
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  // Destroy maps
  destroyMaps();
}

function togglePw() {
  const inp  = document.getElementById('login-password');
  const eye  = document.getElementById('pw-eye');
  if (inp.type === 'password') {
    inp.type = 'text';
    eye.className = 'fas fa-eye-slash';
  } else {
    inp.type = 'password';
    eye.className = 'fas fa-eye';
  }
}

// Allow Enter key in login form
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    doLogin();
  }
});


/* ═══════════════════════════════════════════════════════════
   PAGE NAVIGATION
═══════════════════════════════════════════════════════════ */
let activePage   = null;
let initializedMaps = {};

function showPage(name) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const page = document.getElementById('page-' + name);
  if (page) {
    page.classList.add('active');
    activePage = name;
  }

  // Highlight nav link
  document.querySelectorAll('.nav-link').forEach(l => {
    if (l.getAttribute('href') === '#' + name) l.classList.add('active');
  });

  // Close hamburger menu
  document.getElementById('nav-links').classList.remove('open');

  // Initialize map for this panel if not yet done
  if (['pendidikan','kesehatan','umkm'].includes(name)) {
    if (!initializedMaps[name]) {
      setTimeout(() => initPanelMap(name), 100);
    }
  }
  if (name === 'view3d' && !initializedMaps['3d']) {
    setTimeout(() => init3DMap(), 100);
  }

  // Scroll to top
  window.scrollTo(0, 0);
}

/* ─── Hamburger ──────────────────────────────────────────── */
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});


/* ═══════════════════════════════════════════════════════════
   GEOJSON DATA (shared cache)
═══════════════════════════════════════════════════════════ */
let geojsonCache = { bangunan: null, batas: null };

async function loadGeoJSON() {
  if (!geojsonCache.bangunan) {
    try {
      const res = await fetch('data/bangunan-sorosutan.geojson');
      geojsonCache.bangunan = await res.json();
    } catch(e) { console.warn('GeoJSON bangunan tidak ditemukan:', e); }
  }
  if (!geojsonCache.batas) {
    try {
      const res = await fetch('data/batas-administrasi.geojson');
      geojsonCache.batas = await res.json();
    } catch(e) { console.warn('GeoJSON batas tidak ditemukan:', e); }
  }
}


/* ═══════════════════════════════════════════════════════════
   PER-PANEL MAPS (Pendidikan / Kesehatan / UMKM)
═══════════════════════════════════════════════════════════ */
const panelMaps  = {};
const panelPopup = {};

async function initPanelMap(panel) {
  if (initializedMaps[panel]) return;
  initializedMaps[panel] = true;

  await loadGeoJSON();

  const cats   = PANEL_FILTER[panel];
  const mapDiv = 'map-' + panel;

  const map = new mapboxgl.Map({
    container: mapDiv,
    style    : 'mapbox://styles/mapbox/streets-v12',
    center   : CENTER,
    zoom     : ZOOM,
    preserveDrawingBuffer: true,
    attributionControl: false,
  });
  panelMaps[panel] = map;

  map.addControl(new mapboxgl.NavigationControl(),    'top-right');
  map.addControl(new mapboxgl.FullscreenControl(),    'top-right');
  map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

  map.on('load', () => {
    // Batas administrasi
    if (geojsonCache.batas) {
      map.addSource('batas-administrasi', { type: 'geojson', data: geojsonCache.batas });
      map.addLayer({ id: 'batas-fill',    type: 'fill',   source: 'batas-administrasi', paint: { 'fill-color': '#8B5E3C', 'fill-opacity': 0.05 }});
      map.addLayer({ id: 'batas-outline', type: 'line',   source: 'batas-administrasi', paint: { 'line-color': '#4A2C0A', 'line-width': 2.5, 'line-dasharray': [4,2] }});
    }

    // Filter data per panel
    if (geojsonCache.bangunan) {
      const filtered = {
        type: 'FeatureCollection',
        features: geojsonCache.bangunan.features.filter(f =>
          cats.includes(f.properties.kategori)
        ),
      };

      // Update stat
      animateCount('stat-' + panel, filtered.features.length);

      map.addSource('titik-info', { type: 'geojson', data: filtered });

      // Circle layer
      const circleColors = buildColorExpression(cats);
      map.addLayer({
        id: 'titik-circle', type: 'circle', source: 'titik-info',
        paint: {
          'circle-radius': ['interpolate',['linear'],['zoom'], 12,6, 16,11, 20,16],
          'circle-color' : circleColors,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.92,
        }
      });

      // Label layer
      map.addLayer({
        id: 'titik-label', type: 'symbol', source: 'titik-info', minzoom: 15.5,
        layout: {
          'text-field'       : ['get','nama'],
          'text-font'        : ['Open Sans Regular'],
          'text-size'        : 11,
          'text-offset'      : [0, 1.6],
          'text-anchor'      : 'top',
          'text-max-width'   : 8,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color'     : '#1C1C1C',
          'text-halo-color': '#FAF6F0',
          'text-halo-width': 1.5,
        }
      });

      // Tooltip
      addTooltip(map, mapDiv);

      // Popup on click
      map.on('click', 'titik-circle', (e) => {
        const props  = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        showPopup(map, panel, coords, props);
      });

      map.on('mouseenter', 'titik-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'titik-circle', () => { map.getCanvas().style.cursor = ''; });
    }
  });
}

function buildColorExpression(cats) {
  const expr = ['match', ['get', 'kategori']];
  cats.forEach(cat => {
    const cfg = KATEGORI_CONFIG[cat] || KATEGORI_CONFIG['default'];
    expr.push(cat, cfg.color);
  });
  expr.push(KATEGORI_CONFIG['default'].color);
  return expr;
}

function showPopup(map, panel, coords, props) {
  const cat   = props.kategori || '-';
  const color = (KATEGORI_CONFIG[cat] || KATEGORI_CONFIG['default']).color;

  const html = `
    <div class="popup-inner">
      <div class="popup-header" style="background:${color}">
        <div class="popup-cat">${cat}</div>
        <h4>${props.nama || 'Tanpa Nama'}</h4>
      </div>
      <div class="popup-body">
        <div class="popup-row"><span class="lbl">Kondisi</span><span class="val">${props.kondisi||'-'}</span></div>
        <div class="popup-row"><span class="lbl">Jumlah Lantai</span><span class="val">${props.jumlah_lantai||'-'}</span></div>
        <div class="popup-row"><span class="lbl">Status</span><span class="val">${props.status||'-'}</span></div>
        <div class="popup-row"><span class="lbl">Jam Operasional</span><span class="val">${props.jam_operasional||'-'}</span></div>
        ${props.deskripsi ? `<div class="popup-desc">${props.deskripsi}</div>` : ''}
      </div>
    </div>`;

  if (panelPopup[panel]) panelPopup[panel].remove();
  panelPopup[panel] = new mapboxgl.Popup({ offset: 12, maxWidth: '290px' })
    .setLngLat(coords).setHTML(html).addTo(map);
}

function addTooltip(map, containerId) {
  const tt = document.createElement('div');
  tt.className = 'mapbox-tooltip';
  document.getElementById(containerId).appendChild(tt);

  map.on('mousemove', 'titik-circle', (e) => {
    tt.textContent   = e.features[0].properties.nama || '?';
    tt.style.display = 'block';
    tt.style.left    = (e.point.x + 12) + 'px';
    tt.style.top     = (e.point.y - 10) + 'px';
  });
  map.on('mouseleave', 'titik-circle', () => { tt.style.display = 'none'; });
  map.on('mousemove', (e) => {
    tt.style.left = (e.point.x + 12) + 'px';
    tt.style.top  = (e.point.y - 10) + 'px';
  });
}

/* ─── Sidebar Toggle ─────────────────────────────────────── */
function toggleSidebar(panel) {
  const sb   = document.getElementById('sidebar-' + panel);
  const icon = document.getElementById('sb-icon-' + panel);
  const collapsed = sb.classList.toggle('collapsed');
  icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
  // Resize map after sidebar animation
  setTimeout(() => {
    const map = panelMaps[panel];
    if (map) map.resize();
  }, 320);
}

/* ─── Basemap Switcher ───────────────────────────────────── */
function setMapStyle(mapId, style, btn) {
  const panel = mapId.replace('map-','');
  const map   = panelMaps[panel];
  if (!map) return;

  map.setStyle('mapbox://styles/mapbox/' + style);
  map.once('style.load', () => {
    // Re-add layers after style change
    initializedMaps[panel] = false;
    // Remove then re-init
    if (geojsonCache.batas) {
      map.addSource('batas-administrasi', { type: 'geojson', data: geojsonCache.batas });
      map.addLayer({ id: 'batas-fill',    type: 'fill',   source: 'batas-administrasi', paint: { 'fill-color': '#8B5E3C', 'fill-opacity': 0.05 }});
      map.addLayer({ id: 'batas-outline', type: 'line',   source: 'batas-administrasi', paint: { 'line-color': '#4A2C0A', 'line-width': 2.5, 'line-dasharray': [4,2] }});
    }
    if (geojsonCache.bangunan) {
      const cats = PANEL_FILTER[panel];
      const filtered = { type:'FeatureCollection', features: geojsonCache.bangunan.features.filter(f => cats.includes(f.properties.kategori)) };
      map.addSource('titik-info', { type: 'geojson', data: filtered });
      map.addLayer({ id:'titik-circle', type:'circle', source:'titik-info', paint:{ 'circle-radius':['interpolate',['linear'],['zoom'],12,6,16,11,20,16], 'circle-color':buildColorExpression(cats), 'circle-stroke-width':2.5, 'circle-stroke-color':'#fff', 'circle-opacity':0.92 }});
      map.addLayer({ id:'titik-label', type:'symbol', source:'titik-info', minzoom:15.5, layout:{'text-field':['get','nama'],'text-font':['Open Sans Regular'],'text-size':11,'text-offset':[0,1.6],'text-anchor':'top','text-max-width':8,'text-allow-overlap':false}, paint:{'text-color':'#1C1C1C','text-halo-color':'#FAF6F0','text-halo-width':1.5}});
      map.on('click','titik-circle',(e)=>{ const p=e.features[0].properties; showPopup(map,panel,e.features[0].geometry.coordinates.slice(),p); });
      map.on('mouseenter','titik-circle',()=>{map.getCanvas().style.cursor='pointer';});
      map.on('mouseleave','titik-circle',()=>{map.getCanvas().style.cursor='';});
    }
  });

  // Update button
  document.querySelectorAll(`#sidebar-${panel} .bm-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ─── Layer Toggle ───────────────────────────────────────── */
function toggleLayer(mapId, layerIds, visible) {
  const panel = mapId.replace('map-','');
  const map   = panelMaps[panel];
  if (!map) return;
  const vis = visible ? 'visible' : 'none';
  layerIds.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis); });
}

/* ─── Search ─────────────────────────────────────────────── */
function searchMap(panel, keyword) {
  const map = panelMaps[panel];
  if (!map || !map.getLayer('titik-circle')) return;

  if (!keyword.trim()) {
    map.setFilter('titik-circle', null);
    if (map.getLayer('titik-label')) map.setFilter('titik-label', null);
    return;
  }

  const kw = keyword.toLowerCase();
  const cats = PANEL_FILTER[panel];
  const src  = map.getSource('titik-info');
  if (src && src._data && src._data.features) {
    const matched = src._data.features
      .filter(f => cats.includes(f.properties.kategori) && (f.properties.nama||'').toLowerCase().includes(kw))
      .map(f => f.properties.nama);
    const expr = matched.length > 0
      ? ['in', ['get','nama'], ['literal', matched]]
      : ['==', ['get','nama'], '__none__'];
    map.setFilter('titik-circle', expr);
    if (map.getLayer('titik-label')) map.setFilter('titik-label', expr);
  }
}

/* ─── Reset View ─────────────────────────────────────────── */
function resetMapView(panel) {
  const map = panelMaps[panel];
  if (map) map.flyTo({ center: CENTER, zoom: ZOOM, duration: 1200 });
}

/* ─── Counter Animasi ────────────────────────────────────── */
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step  = Math.max(1, Math.ceil(target / 30));
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = current;
  }, 40);
}


/* ═══════════════════════════════════════════════════════════
   3D VIEW MAP
═══════════════════════════════════════════════════════════ */
let map3d = null;
let rotating = false;
let rotateTimer = null;

const THEMES_3D = {
  batik: {
    style       : 'mapbox://styles/mapbox/light-v11',
    extrudeColor: '#C4894F',
    roofColor   : '#8B5E3C',
  },
  malam: {
    style       : 'mapbox://styles/mapbox/dark-v11',
    extrudeColor: '#1e4d8c',
    roofColor   : '#0d2b52',
  },
  alam: {
    style       : 'mapbox://styles/mapbox/outdoors-v12',
    extrudeColor: '#4CAF50',
    roofColor   : '#2e7d32',
  },
};
let current3DTheme = 'batik';

function init3DMap() {
  if (initializedMaps['3d']) return;
  initializedMaps['3d'] = true;

  map3d = new mapboxgl.Map({
    container : 'map3d',
    style     : THEMES_3D.batik.style,
    center    : CENTER,
    zoom      : 15.5,
    pitch     : 55,
    bearing   : -20,
    preserveDrawingBuffer: true, 
    attributionControl: false,
  });

  map3d.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map3d.addControl(new mapboxgl.FullscreenControl(), 'top-right');
  map3d.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

  map3d.on('load', () => {
    // Batas administrasi
    if (geojsonCache.batas) {
      map3d.addSource('batas3d', { type:'geojson', data: geojsonCache.batas });
      map3d.addLayer({ id:'batas3d-fill', type:'fill', source:'batas3d', paint:{ 'fill-color':'#8B5E3C','fill-opacity':0.06 }});
      map3d.addLayer({ id:'batas3d-line', type:'line', source:'batas3d', paint:{ 'line-color':'#4A2C0A','line-width':2.5,'line-dasharray':[4,2] }});
    }

    // Add OSM buildings layer (built-in Mapbox)
    const layers = map3d.getStyle().layers;
    let labelLayerId = '';
    for (const layer of layers) {
      if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
        labelLayerId = layer.id;
        break;
      }
    }

    // Extrude buildings from Mapbox built-in
    map3d.addLayer({
      id    : 'building-extrude',
      source: 'composite',
      'source-layer': 'building',
      filter:['all',['==','extrude','true'],['within', geojsonCache.batas]],
      type  : 'fill-extrusion',
      minzoom: 14,
      paint : {
        'fill-extrusion-color'  : THEMES_3D.batik.extrudeColor,
        'fill-extrusion-height' : ['interpolate',['linear'],['zoom'], 14,0, 14.05,['*',['get','height'],1]],
        'fill-extrusion-base'   : ['interpolate',['linear'],['zoom'], 14,0, 14.05,['get','min_height']],
        'fill-extrusion-opacity': 0.85,
      }
    }, labelLayerId);

    // Titik data sebagai ekstrusi custom (jika ada koordinat)
    loadGeoJSON().then(() => {
      if (geojsonCache.bangunan) {
        map3d.addSource('titik3d', { type:'geojson', data: geojsonCache.bangunan });
        map3d.addLayer({
          id:'titik3d-circle', type:'circle', source:'titik3d',
          paint:{
            'circle-radius':8, 'circle-color':['match',['get','kategori'],
              'Pendidikan','#2196F3','Kesehatan','#F44336','Bisnis/UMKM','#FF9800',
              'Ibadah','#9C27B0','Fasilitas Umum','#00BCD4','#78909C'],
            'circle-stroke-width':2,'circle-stroke-color':'#fff','circle-opacity':0.9
          }
        });
        map3d.on('click','titik3d-circle',(e)=>{
          const p=e.features[0].properties;
          const cat=p.kategori||'';
          const color=(KATEGORI_CONFIG[cat]||KATEGORI_CONFIG['default']).color;
          const html=`<div class="popup-inner"><div class="popup-header" style="background:${color}"><div class="popup-cat">${cat}</div><h4>${p.nama||'?'}</h4></div><div class="popup-body"><div class="popup-row"><span class="lbl">Kondisi</span><span class="val">${p.kondisi||'-'}</span></div><div class="popup-row"><span class="lbl">Lantai</span><span class="val">${p.jumlah_lantai||'-'}</span></div>${p.deskripsi?`<div class="popup-desc">${p.deskripsi}</div>`:''}</div></div>`;
          new mapboxgl.Popup({offset:12,maxWidth:'260px'}).setLngLat(e.features[0].geometry.coordinates.slice()).setHTML(html).addTo(map3d);
        });
      }
    });
  });
}

/* ─── 3D Controls ────────────────────────────────────────── */
function update3D() {
  if (!map3d || !map3d.getLayer('building-extrude')) return;
  const heightMult = parseFloat(document.getElementById('extru-height').value);
  const opacity    = parseFloat(document.getElementById('extru-opacity').value);

  document.getElementById('extru-val').textContent   = heightMult + '×';
  document.getElementById('opacity-val').textContent = Math.round(opacity * 100) + '%';

  map3d.setPaintProperty('building-extrude','fill-extrusion-height',
    ['interpolate',['linear'],['zoom'], 14,0, 14.05, ['*',['get','height'], heightMult]]
  );
  map3d.setPaintProperty('building-extrude','fill-extrusion-opacity', opacity);
}

function updatePitch() {
  if (!map3d) return;
  const pitch = parseInt(document.getElementById('pitch-ctrl').value);
  document.getElementById('pitch-val').textContent = pitch + '°';
  map3d.setPitch(pitch);
}

function setTheme3D(theme, btn) {
  if (!map3d) return;
  current3DTheme = theme;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const t = THEMES_3D[theme];
  map3d.setStyle(t.style);
  map3d.once('style.load', () => {
    const layers = map3d.getStyle().layers;
    let labelLayerId = '';
    for (const layer of layers) {
      if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
        labelLayerId = layer.id; break;
      }
    }
    map3d.addLayer({
      id:'building-extrude', source:'composite', 'source-layer':'building',
      filter:['==','extrude','true'], type:'fill-extrusion', minzoom:14,
      paint:{
        'fill-extrusion-color'  : t.extrudeColor,
        'fill-extrusion-height' : ['interpolate',['linear'],['zoom'],14,0,14.05,['get','height']],
        'fill-extrusion-base'   : ['interpolate',['linear'],['zoom'],14,0,14.05,['get','min_height']],
        'fill-extrusion-opacity': 0.85,
      }
    }, labelLayerId);

    // Re-add batas
    if (geojsonCache.batas) {
      if (!map3d.getSource('batas3d')) map3d.addSource('batas3d',{type:'geojson',data:geojsonCache.batas});
      map3d.addLayer({id:'batas3d-fill',type:'fill',source:'batas3d',paint:{'fill-color':'#8B5E3C','fill-opacity':0.06}});
      map3d.addLayer({id:'batas3d-line',type:'line',source:'batas3d',paint:{'line-color':'#4A2C0A','line-width':2.5,'line-dasharray':[4,2]}});
    }
    // Re-add titik
    if (geojsonCache.bangunan) {
      if (!map3d.getSource('titik3d')) map3d.addSource('titik3d',{type:'geojson',data:geojsonCache.bangunan});
      map3d.addLayer({id:'titik3d-circle',type:'circle',source:'titik3d',paint:{'circle-radius':8,'circle-color':['match',['get','kategori'],'Pendidikan','#2196F3','Kesehatan','#F44336','Bisnis/UMKM','#FF9800','Ibadah','#9C27B0','Fasilitas Umum','#00BCD4','#78909C'],'circle-stroke-width':2,'circle-stroke-color':'#fff','circle-opacity':0.9}});
    }
  });
}

function toggleRotate() {
  rotating = document.getElementById('auto-rotate').checked;
  if (rotating) {
    function rotateFn() {
      if (!rotating || !map3d) return;
      map3d.setBearing(map3d.getBearing() + 0.3);
      rotateTimer = requestAnimationFrame(rotateFn);
    }
    rotateTimer = requestAnimationFrame(rotateFn);
  } else {
    if (rotateTimer) cancelAnimationFrame(rotateTimer);
  }
}

function reset3DView() {
  if (!map3d) return;
  document.getElementById('auto-rotate').checked = false;
  rotating = false;
  if (rotateTimer) cancelAnimationFrame(rotateTimer);
  map3d.flyTo({ center: CENTER, zoom: 15.5, pitch: 55, bearing: -20, duration: 1500 });
  document.getElementById('extru-height').value  = 4;
  document.getElementById('extru-opacity').value = 0.85;
  document.getElementById('pitch-ctrl').value    = 55;
  document.getElementById('extru-val').textContent   = '4×';
  document.getElementById('opacity-val').textContent = '85%';
  document.getElementById('pitch-val').textContent   = '55°';
}


/* ═══════════════════════════════════════════════════════════
   DESTROY MAPS (logout)
═══════════════════════════════════════════════════════════ */
function destroyMaps() {
  Object.values(panelMaps).forEach(m => m.remove());
  for (const k in panelMaps) delete panelMaps[k];
  if (map3d) { map3d.remove(); map3d = null; }
  for (const k in initializedMaps) delete initializedMaps[k];
  geojsonCache = { bangunan: null, batas: null };
}


/* ═══════════════════════════════════════════════════════════
   FEEDBACK FORM
═══════════════════════════════════════════════════════════ */
function submitFeedback(e) {
  e.preventDefault();
  const entry = {
    nama    : document.getElementById('f-nama').value,
    instansi: document.getElementById('f-instansi').value,
    saran   : document.getElementById('f-saran').value,
    waktu   : new Date().toLocaleString('id-ID'),
  };
  // Simpan ke localStorage (simulasi DB)
  const existing = JSON.parse(localStorage.getItem('feedback-sorosutan') || '[]');
  existing.push(entry);
  localStorage.setItem('feedback-sorosutan', JSON.stringify(existing));
  updateFeedbackBadge();

  document.getElementById('feedback-form').style.display  = 'none';
  document.getElementById('form-success').style.display   = 'block';
}

function resetFeedback() {
  document.getElementById('f-nama').value     = '';
  document.getElementById('f-instansi').value = '';
  document.getElementById('f-saran').value    = '';
  document.getElementById('feedback-form').style.display = 'block';
  document.getElementById('form-success').style.display  = 'none';
}

// Update feedback badge setiap kali feedback disimpan
function updateFeedbackBadge() {
  const list = JSON.parse(localStorage.getItem('feedback-sorosutan') || '[]');
  const badge = document.getElementById('feedback-badge');
  if (!badge) return;
  if (list.length > 0) {
    badge.textContent = list.length;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}


/* ═══════════════════════════════════════════════════════════
   ADMIN PANEL — TAMBAH TITIK BARU
═══════════════════════════════════════════════════════════ */

function openTambahTitik() {
  // SATPAM: Cek apakah user benar-benar admin
  if (!currentUser || currentUser.role !== 'admin') {
    alert("Akses ditolak! Fitur ini hanya untuk Admin.");
    return;
  }
  ['at-nama','at-lng','at-lat','at-jam','at-lantai','at-deskripsi'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['at-kategori','at-status','at-kondisi'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('at-error').style.display = 'none';
  document.getElementById('modal-tambah').style.display = 'flex';
}

function closeTambahTitik() {
  document.getElementById('modal-tambah').style.display = 'none';
}

function simpanTitikBaru() {
  const nama      = document.getElementById('at-nama').value.trim();
  const kategori  = document.getElementById('at-kategori').value;
  const lngVal    = document.getElementById('at-lng').value.trim();
  const latVal    = document.getElementById('at-lat').value.trim();
  const errEl     = document.getElementById('at-error');

  if (!nama || !kategori || !lngVal || !latVal) {
    errEl.textContent = '⚠ Nama, Kategori, Longitude, dan Latitude wajib diisi.';
    errEl.style.display = 'block';
    return;
  }
  const lng = parseFloat(lngVal);
  const lat = parseFloat(latVal);
  if (isNaN(lng) || isNaN(lat) || lng < 105 || lng > 115 || lat < -9 || lat > -6) {
    errEl.textContent = '⚠ Koordinat tidak valid. Pastikan dalam rentang wilayah DIY.';
    errEl.style.display = 'block';
    return;
  }

  const newFeature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      nama            : nama,
      kategori        : kategori,
      status          : document.getElementById('at-status').value || '-',
      jumlah_lantai   : parseInt(document.getElementById('at-lantai').value) || null,
      jam_operasional : document.getElementById('at-jam').value.trim() || '-',
      kondisi         : document.getElementById('at-kondisi').value || '-',
      deskripsi       : document.getElementById('at-deskripsi').value.trim() || '',
      _custom         : true,
    }
  };

  const existing = JSON.parse(localStorage.getItem('admin-titik-custom') || '[]');
  existing.push(newFeature);
  localStorage.setItem('admin-titik-custom', JSON.stringify(existing));

  injectCustomTitikKeMap(newFeature);
  closeTambahTitik();
  showToastAdmin('✓ Titik "' + nama + '" berhasil ditambahkan!');
}

function injectCustomTitikKeMap(feature) {
  [map1, map2].forEach(function(m) {
    if (!m) return;
    try {
      ['titik-info','titik-info-3d'].forEach(function(srcId) {
        const src = m.getSource(srcId);
        if (!src) return;
        const data = src._data || { type:'FeatureCollection', features:[] };
        if (!data.features) data.features = [];
        data.features.push(feature);
        src.setData(data);
      });
    } catch(e) {}
  });
  if (geojsonCache.bangunan) {
    geojsonCache.bangunan.features.push(feature);
  }
}

function loadCustomTitikFromStorage() {
  const list = JSON.parse(localStorage.getItem('admin-titik-custom') || '[]');
  list.forEach(function(f) { injectCustomTitikKeMap(f); });
}


/* ═══════════════════════════════════════════════════════════
   ADMIN PANEL — LIHAT FEEDBACK
═══════════════════════════════════════════════════════════ */

function openLihatFeedback() {
  renderFeedbackList();
  document.getElementById('modal-feedback').style.display = 'flex';
}

function closeLihatFeedback() {
  document.getElementById('modal-feedback').style.display = 'none';
}

function renderFeedbackList() {
  const list = JSON.parse(localStorage.getItem('feedback-sorosutan') || '[]');
  const container = document.getElementById('feedback-list-container');

  if (list.length === 0) {
    container.innerHTML = '<div class="feedback-empty"><i class="fas fa-inbox"></i><p>Belum ada feedback yang masuk.</p></div>';
    return;
  }

  const sorted = list.slice().reverse();
  let rows = '';
  sorted.forEach(function(f, i) {
    rows += '<tr>' +
      '<td>' + (sorted.length - i) + '</td>' +
      '<td>' + escHtml(f.nama || '-') + '</td>' +
      '<td>' + escHtml(f.instansi || '-') + '</td>' +
      '<td class="feedback-saran">' + escHtml(f.saran || '-') + '</td>' +
      '<td class="feedback-waktu">' + escHtml(f.waktu || '-') + '</td>' +
      '<td><button class="btn-hapus-row" onclick="hapusFeedbackByIndex(' + (list.length - 1 - i) + ')" title="Hapus"><i class="fas fa-trash-alt"></i></button></td>' +
      '</tr>';
  });

  container.innerHTML = '<p class="feedback-count">Total: <b>' + list.length + '</b> feedback</p>' +
    '<div class="feedback-table-wrap"><table class="feedback-table">' +
    '<thead><tr><th>#</th><th>Nama</th><th>Instansi</th><th>Saran / Masukan</th><th>Waktu</th><th></th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
}

function hapusFeedbackByIndex(idx) {
  const list = JSON.parse(localStorage.getItem('feedback-sorosutan') || '[]');
  list.splice(idx, 1);
  localStorage.setItem('feedback-sorosutan', JSON.stringify(list));
  updateFeedbackBadge();
  renderFeedbackList();
}

function hapusSemuaFeedback() {
  if (!confirm('Yakin ingin menghapus SEMUA feedback? Tindakan ini tidak bisa dibatalkan.')) return;
  localStorage.removeItem('feedback-sorosutan');
  updateFeedbackBadge();
  renderFeedbackList();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToastAdmin(msg) {
  var toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = 'admin-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 3000);
}



/* ═══════════════════════════════════════════════════════════
   AI CHATBOT — OpenRouter Integration
═══════════════════════════════════════════════════════════ */

// ⚙️ API KEY OPENROUTER — diambil dari localStorage
// Dapatkan gratis di: https://openrouter.ai/keys
// Set API Key via tombol ⚙️ di chatbot, atau langsung di console:
// localStorage.setItem('or_api_key', 'sk-or-v1-...')

// ─── Default OpenRouter API Key ───
const DEFAULT_OPENROUTER_KEY = "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";

function getOpenRouterKey() {
  return localStorage.getItem('or_api_key') || DEFAULT_OPENROUTER_KEY;
}

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk WebGIS Sorosutan — sebuah Sistem Informasi Geografis berbasis web untuk Kelurahan Sorosutan, Kecamatan Umbulharjo, Kota Yogyakarta.

Berikut data GeoJSON bangunan di Sorosutan:
{NAMA_DATA}

Setiap fitur punya properties: nama, kategori (Bisnis/UMKM, Pendidikan, Kesehatan, Ibadah, Fasilitas Umum), kondisi, jumlah_lantai, status, jam_operasional, deskripsi.

Petunjuk:
- Jawab dalam Bahasa Indonesia
- Jika pengguna bertanya soal data, gunakan data di atas untuk menjawab
- Jika ada hitungan (misal "ada berapa"), LAKUKAN hitungan dari data yang diberikan
- Berikan jawaban yang informatif tapi ringkas
- Jika tidak bisa menjawab dari data, bilang dengan sopan
- Jika pengguna meminta list semua titik kategori tertentu, BUAT LIST LENGKAP dari data
- Tampilkan jawaban dengan format yang rapi (Gunakan emoji 🎯📊🏫🏥🕌🏪💡)
- Jangan pakai ** atau *  karena kita belum integrasikan font bold, ketik dalam format pada umumnya tanpa simbol (WAJIB)`;

let currentModel = localStorage.getItem('or_model') || 'openrouter/free';
let chatHistory = [];
let isTyping = false;

function toggleChatbot() {
  const panel  = document.getElementById('chatbot-panel');
  const fab    = document.getElementById('chatbot-fab');
  const isOpen = panel.classList.contains('open');

  if (isOpen) {
    panel.classList.remove('open');
    fab.classList.remove('open');
  } else {
    panel.classList.add('open');
    fab.classList.add('open');
    // Auto-focus input
    setTimeout(() => document.getElementById('chatbot-input').focus(), 350);
    // Check API key
    if (!getOpenRouterKey()) {
      document.getElementById('chatbot-api-notice').style.display = 'flex';
    } else {
      document.getElementById('chatbot-api-notice').style.display = 'none';
    }
    // Restore model select
    document.getElementById('model-select').value = currentModel;
  }
}

function changeModel(model) {
  currentModel = model;
  localStorage.setItem('or_model', model);
}

// Set initial model from localStorage & attach model select listener
const modelSel = document.getElementById('model-select');
if (modelSel) {
  modelSel.value = currentModel;
  modelSel.addEventListener('change', function () {
    changeModel(this.value);
  });
}

function showTyping() {
  const msgs = document.getElementById('chatbot-messages');
  const typing = document.createElement('div');
  typing.id = 'typing-msg';
  typing.className = 'chat-msg bot';
  typing.innerHTML = `
    <div class="chat-msg-avatar"><i class="fas fa-robot"></i></div>
    <div class="chat-msg-bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  msgs.appendChild(typing);
  scrollChat();
  isTyping = true;
}

function removeTyping() {
  const t = document.getElementById('typing-msg');
  if (t) t.remove();
  isTyping = false;
}

function scrollChat() {
  const msgs = document.getElementById('chatbot-messages');
  msgs.scrollTop = msgs.scrollHeight;
}

function addMessage(text, isUser = false) {
  const msgs  = document.getElementById('chatbot-messages');
  const div   = document.createElement('div');
  div.className = 'chat-msg ' + (isUser ? 'user' : 'bot');

  const avatar = isUser
    ? '<i class="fas fa-user"></i>'
    : '<i class="fas fa-robot"></i>';

  div.innerHTML = `
    <div class="chat-msg-avatar">${avatar}</div>
    <div class="chat-msg-bubble"><p>${text.replace(/\n/g, '<br>')}</p></div>`;

  msgs.appendChild(div);
  scrollChat();
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

function sendQuickAction(text) {
  document.getElementById('chatbot-input').value = text;
  sendChatMessage();
}

async function sendChatMessage() {
  if (isTyping) return;

  const input  = document.getElementById('chatbot-input');
  const sendBtn = document.getElementById('chatbot-send-btn');
  const text   = input.value.trim();
  if (!text) return;

  if (!getOpenRouterKey()) {
    addMessage('⚠️ API Key belum diset. Klik tombol ⚙️ di bawah untuk menambahkan OpenRouter API Key Anda.', false);
    return;
  }

  // Add user message
  addMessage(text, true);
  input.value = '';
  sendBtn.disabled = true;

  // Show typing
  showTyping();

  try {
    // Load data if not loaded
    await loadGeoJSON();

    // Build data summary for the AI
    const dataSummary = buildDataSummary();

    // Build system prompt with data
    const systemWithData = SYSTEM_PROMPT.replace('{NAMA_DATA}', dataSummary);

    // Build messages
    const messages = [
      { role: 'system', content: systemWithData },
      ...chatHistory,
      { role: 'user', content: text },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getOpenRouterKey()}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'WebGIS Sorosutan AI Assist',
      },
      body: JSON.stringify({
        model: currentModel,
        messages: messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Maaf, saya tidak bisa menjawab saat ini.';

    // Save to history
    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    removeTyping();
    addMessage(reply, false);

  } catch (err) {
    removeTyping();
    console.error('AI Chat Error:', err);
    addMessage(`❌ Gagal mendapatkan respons dari AI.<br><small>Error: ${err.message}</small><br><br>💡 Pastikan API Key valid dan kuota masih tersedia.`, false);
  } finally {
    sendBtn.disabled = false;
  }
}

function buildDataSummary() {
  if (!geojsonCache.bangunan || !geojsonCache.bangunan.features) {
    return 'Data GeoJSON belum tersedia.';
  }

  const features = geojsonCache.bangunan.features;

  // Stats per kategori
  const stats = {};
  features.forEach(f => {
    const cat = f.properties?.kategori || 'Unknown';
    if (!stats[cat]) stats[cat] = [];
    stats[cat].push(f.properties);
  });

  let summary = `TOTAL BANGUNAN: ${features.length}\n\n`;

  const catLabels = {
    'Bisnis/UMKM': 'Bisnis/UMKM',
    'Pendidikan': 'Pendidikan',
    'Kesehatan': 'Kesehatan',
    'Ibadah': 'Ibadah',
    'Fasilitas Umum': 'Fasilitas Umum',
  };

  for (const [cat, items] of Object.entries(stats)) {
    summary += `[${catLabels[cat] || cat}] — ${items.length} titik\n`;
    items.forEach(item => {
      summary += `  - ${item.nama || 'Tanpa Nama'} (${item.status || '-'}, ${item.jumlah_lantai || '?'} lantai)\n`;
    });
    summary += '\n';
  }

  return summary;
}


/* ─── API Key Modal ─────────────────────────────────────── */
function showApiKeyModal() {
  document.getElementById('api-key-modal').style.display = 'flex';
  document.getElementById('api-key-input').value = getOpenRouterKey();
}

function closeApiKeyModal(e) {
  if (!e || e.target === document.getElementById('api-key-modal')) {
    document.getElementById('api-key-modal').style.display = 'none';
  }
}

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) {
    alert('Mohon masukkan API Key yang valid.');
    return;
  }
  localStorage.setItem('or_api_key', key);
  document.getElementById('chatbot-api-notice').style.display = 'none';
  document.getElementById('api-key-modal').style.display = 'none';
  addMessage('✅ API Key berhasil disimpan! Sekarang kamu bisa menggunakan AI Chatbot.', false);
}

function clearApiKey() {
  if (confirm('Hapus API Key?')) {
    localStorage.removeItem('or_api_key');
    document.getElementById('chatbot-api-notice').style.display = 'flex';
  }
}
/* ═══════════════════════════════════════════════════════════
   FITUR EXPORT & SCREENSHOT
═══════════════════════════════════════════════════════════ */
function exportMapImage(panel) {
  let map;
  if (panel === '3d') {
    map = map3d;
  } else {
    map = panelMaps[panel];
  }

  if (!map) {
    alert("Peta belum siap!");
    return;
  }

  // Gunakan try-catch untuk antisipasi error browser
  try {
    const canvas = map.getCanvas();
    const imgData = canvas.toDataURL("image/png");
    
    const link = document.createElement('a');
    link.download = `WebGIS_Sorosutan_${panel}_${Date.now()}.png`;
    link.href = imgData;
    link.click();
  } catch (e) {
    alert("Gagal mengambil gambar. Pastikan Mapbox sudah dimuat sempurna.");
    console.error(e);
  }
}