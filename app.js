(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const els = {
    map: $('map'), search: $('search'), clearSearch: $('clear-search'), searchSuggestions: $('search-suggestions'), clues: $('clues-filter'), state: $('state-filter'), level: $('level-filter'), status: $('status-filter'),
    statusText: $('map-status'), nearbySearch: $('nearby-search'), suggestions: $('suggestions'),
    radius: $('radius'), nearbyButton: $('nearby-button'), downloadCsv: $('download-csv'), nearbyResults: $('nearby-results'), reset: $('reset-map')
  };
  const map = L.map(els.map, { zoomControl: false, preferCanvas: true }).setView([23.7, -102.2], 5);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const esriAttribution = 'Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, and the GIS User Community';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 16, attribution: esriAttribution
  }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 16, attribution: esriAttribution, pane: 'overlayPane'
  }).addTo(map);
  const unitLayer = L.layerGroup().addTo(map);
  let allUnits = [];
  let visibleUnits = [];
  let selectedUnit = null;
  let radiusLayer = null;
  let referenceMarker = null;
  let suggestionsNow = [];
  const numberFormat = new Intl.NumberFormat('es-MX');
  const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim();
  const escapeText = (s) => String(s ?? '—');
  const levelColor = (level) => level === 'SEGUNDO NIVEL' ? '#235B4E' : level === 'TERCER NIVEL' ? '#9F2241' : '#BC955C';
  const popup = (u) => {
    const root = document.createElement('div');
    const title = document.createElement('div'); title.className = 'popup-title'; title.textContent = u.nombre || 'Unidad sin nombre'; root.append(title);
    const commercial = document.createElement('div'); commercial.className = 'popup-commercial'; commercial.textContent = u.comercial || ''; root.append(commercial);
    const details = document.createElement('div'); details.className = 'popup-details';
    [['CLUES', u.clues], ['Nivel', u.nivel], ['Entidad', u.entidad], ['Municipio', u.municipio], ['Localidad', u.localidad], ['Tipología', u.tipologia]].forEach(([label, value]) => {
      const item = document.createElement('div'); item.className = 'popup-detail';
      const k = document.createElement('span'); k.textContent = label;
      const v = document.createElement('strong'); v.textContent = escapeText(value);
      item.append(k, v); details.append(item);
    });
    root.append(details);
    const badge = document.createElement('span'); badge.className = `popup-status${u.estatus === 'EN OPERACION' ? '' : ' off'}`; badge.textContent = u.estatus || 'Estatus no disponible'; root.append(badge);
    return root;
  };
  const iconFor = (u, isReference = false) => {
    const size = u.nivel === 'TERCER NIVEL' ? 21 : u.nivel === 'SEGUNDO NIVEL' ? 18 : 14;
    const outer = isReference ? 24 : size + 4;
    return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${isReference ? 18 : size}px;height:${isReference ? 18 : size}px;border-radius:50%;background:${isReference ? '#123f35' : levelColor(u.nivel)};border:${isReference ? '3px solid #fff' : '2px solid white'};box-shadow:0 1px 5px #1c3d2e80;${isReference ? 'outline:3px solid #123f3540;' : ''}"></span>`,
    iconSize: [outer, outer], iconAnchor: [outer / 2, outer / 2]
  }); };
  const distanceKm = (a, b) => {
    const rad = (v) => v * Math.PI / 180;
    const dx = 6371 * rad(b.lng - a.lng) * Math.cos(rad(a.lat));
    const dy = 6371 * rad(b.lat - a.lat);
    return Math.hypot(dx, dy);
  };
  const optionList = (select, values) => values.forEach((value) => { const opt = document.createElement('option'); opt.value = value; opt.textContent = value; select.append(opt); });
  function filtered() {
    const q = normalize(els.search.value);
    const clues = els.clues.value;
    return allUnits.filter((u) => (!els.state.value || u.entidad === els.state.value)
      && (!els.level.value || u.nivel === els.level.value)
      && (!els.status.value || u.estatus === els.status.value)
      && (!clues || u.clues === clues)
      && (!q || u._search.includes(q)));
  }
  function applyFilters() {
    visibleUnits = filtered().sort((a, b) => {
      const rank = (u) => u.nivel === 'PRIMER NIVEL' ? 1 : u.nivel === 'SEGUNDO NIVEL' ? 2 : u.nivel === 'TERCER NIVEL' ? 3 : 0;
      return rank(a) - rank(b);
    });
    unitLayer.clearLayers();
    visibleUnits.forEach((u) => {
      const radius = u.nivel === 'TERCER NIVEL' ? 6.5 : u.nivel === 'SEGUNDO NIVEL' ? 5.25 : 4;
      const opacity = u.nivel === 'PRIMER NIVEL' ? 0.82 : 0.96;
      const marker = L.circleMarker([u.lat, u.lng], {
        radius, color: '#ffffff', weight: 1.2, opacity: 0.95,
        fillColor: levelColor(u.nivel), fillOpacity: opacity
      });
      marker.bindPopup(popup(u), { maxWidth: 330 });
      marker.addTo(unitLayer);
    });
    if (els.statusText) els.statusText.hidden = true;
    els.clearSearch.hidden = !els.search.value;
  }
  function showSuggestions() {
    const q = normalize(els.nearbySearch.value);
    els.nearbySearch.value = els.nearbySearch.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const clueQuery = normalize(els.nearbySearch.value);
    els.suggestions.replaceChildren();
    suggestionsNow = clueQuery.length < 2 ? [] : allUnits.filter((u) => normalize(u.clues).includes(clueQuery)).slice(0, 8);
    suggestionsNow.forEach((u, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion'; button.setAttribute('role', 'option'); button.dataset.index = String(index);
      const name = document.createElement('strong'); name.textContent = u.clues;
      const detail = document.createElement('small'); detail.textContent = `${u.nombre} · ${u.municipio}, ${u.entidad}`;
      button.append(name, detail); els.suggestions.append(button);
    });
    els.suggestions.hidden = !suggestionsNow.length;
    els.nearbySearch.setAttribute('aria-expanded', String(Boolean(suggestionsNow.length)));
  }
  function selectUnit(u) {
    selectedUnit = u;
    els.nearbySearch.value = u.clues;
    els.nearbyButton.disabled = false;
    els.suggestions.hidden = true;
    els.nearbySearch.setAttribute('aria-expanded', 'false');
    els.nearbyResults.replaceChildren();
  }
  function clearNearby() {
    if (radiusLayer) map.removeLayer(radiusLayer);
    if (referenceMarker) map.removeLayer(referenceMarker);
    radiusLayer = referenceMarker = null;
    els.nearbyResults.replaceChildren();
    els.downloadCsv.hidden = true;
  }
  function runNearby() {
    const radius = Number(els.radius.value);
    if (!selectedUnit || !Number.isFinite(radius) || radius < 1 || radius > 25) {
      els.nearbyResults.textContent = 'Selecciona una CLUES de referencia e indica un radio entre 1 y 25 km.'; return;
    }
    clearNearby();
    const center = L.latLng(selectedUnit.lat, selectedUnit.lng);
    radiusLayer = L.circle(center, { radius: radius * 1000, color: '#155444', weight: 2, fillColor: '#55a27d', fillOpacity: 0.09 }).addTo(map);
    referenceMarker = L.marker(center, { icon: iconFor(selectedUnit, true), zIndexOffset: 1000 }).addTo(map).bindPopup(popup(selectedUnit));
    const near = allUnits.filter((u) => u.clues !== selectedUnit.clues).map((u) => ({ u, d: distanceKm(selectedUnit, u) })).filter((x) => x.d <= radius).sort((a, b) => a.d - b.d);
    els.downloadCsv.hidden = false;
    els.downloadCsv.onclick = () => {
      const columns = [['CLUES','clues'],['Nombre de la unidad','nombre'],['Nombre comercial','comercial'],['Nivel de atención','nivel'],['Estatus de operación','estatus'],['Entidad','entidad'],['Municipio','municipio'],['Localidad','localidad'],['Latitud','lat'],['Longitud','lng']];
      const rows = [ [...columns.map(([label]) => label), 'Distancia euclidiana (km)'].join(','), ...near.map(({u,d}) => [...columns.map(([,key]) => u[key] ?? ''), d.toFixed(2)].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')) ];
      const blob = new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `unidades_cercanas_${selectedUnit.clues}_${radius}km.csv`; link.click(); URL.revokeObjectURL(url);
    };
    const summary = document.createElement('p'); summary.className = 'nearby-summary';
    summary.textContent = `${near.length ? numberFormat.format(near.length) : 'Ninguna'} unidad${near.length === 1 ? '' : 'es'} en ${radius} km`;
    els.nearbyResults.append(summary);
    if (near.length) {
      const list = document.createElement('ol'); list.className = 'nearby-list';
      near.slice(0, 50).forEach(({ u, d }) => {
        const li = document.createElement('li'); const button = document.createElement('button'); button.type = 'button';
        const title = document.createElement('strong'); title.textContent = u.nombre;
        const meta = document.createElement('small'); meta.textContent = `${d.toFixed(1)} km · ${u.nivel} · ${u.municipio}, ${u.entidad}`;
        button.append(title, meta); button.addEventListener('click', () => { map.setView([u.lat, u.lng], Math.max(map.getZoom(), 12)); const marker = L.marker([u.lat, u.lng], { icon: iconFor(u) }).addTo(map).bindPopup(popup(u)); marker.openPopup(); marker.once('popupclose', () => map.removeLayer(marker)); });
        li.append(button); list.append(li);
      });
      els.nearbyResults.append(list);
      if (near.length > 50) { const note = document.createElement('div'); note.textContent = `Mostrando las 50 más próximas de ${numberFormat.format(near.length)}.`; els.nearbyResults.append(note); }
    }
    map.fitBounds(radiusLayer.getBounds(), { padding: [35, 35], maxZoom: 10 });
    els.statusText.textContent = `${numberFormat.format(near.length)} unidades dentro de ${radius} km`;
  }
  function showSearchSuggestions() {
    const q = normalize(els.search.value);
    els.searchSuggestions.replaceChildren();
    const matches = q.length < 2 ? [] : allUnits.filter((u) => u._search.includes(q)).slice(0, 7);
    matches.forEach((u) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion';
      const name = document.createElement('strong'); name.textContent = u.nombre;
      const detail = document.createElement('small'); detail.textContent = `${u.clues} · ${u.municipio}, ${u.entidad}`;
      button.append(name, detail); button.addEventListener('click', () => { els.search.value = u.clues; els.searchSuggestions.hidden = true; els.search.setAttribute('aria-expanded', 'false'); applyFilters(); });
      els.searchSuggestions.append(button);
    });
    els.searchSuggestions.hidden = matches.length === 0;
    els.search.setAttribute('aria-expanded', String(matches.length > 0));
  }
  els.search.addEventListener('input', () => { showSearchSuggestions(); applyFilters(); });
  els.search.addEventListener('focus', showSearchSuggestions);
  els.search.addEventListener('keydown', (event) => { if (event.key === 'Escape') { els.searchSuggestions.hidden = true; els.search.setAttribute('aria-expanded', 'false'); } if (event.key === 'Enter' && !els.searchSuggestions.hidden) { event.preventDefault(); els.searchSuggestions.querySelector('button')?.click(); } });
  els.clearSearch.addEventListener('click', () => { els.search.value = ''; els.searchSuggestions.hidden = true; applyFilters(); els.search.focus(); });
  [els.state, els.level, els.status].forEach((el) => el.addEventListener('change', applyFilters));
  els.clues.addEventListener('change', applyFilters);
  els.nearbySearch.addEventListener('input', () => { selectedUnit = null; els.nearbyButton.disabled = true; clearNearby(); showSuggestions(); });
  els.nearbySearch.addEventListener('focus', showSuggestions);
  els.suggestions.addEventListener('click', (event) => { const button = event.target.closest('button[data-index]'); if (button) selectUnit(suggestionsNow[Number(button.dataset.index)]); });
  els.nearbySearch.addEventListener('keydown', (event) => { if (event.key === 'Escape') { els.suggestions.hidden = true; els.nearbySearch.setAttribute('aria-expanded', 'false'); } if (event.key === 'Enter' && suggestionsNow.length) { event.preventDefault(); selectUnit(suggestionsNow[0]); } });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete-wrap')) { els.suggestions.hidden = true; els.nearbySearch.setAttribute('aria-expanded', 'false'); }
    if (!event.target.closest('.search-wrap')) { els.searchSuggestions.hidden = true; els.search.setAttribute('aria-expanded', 'false'); }
  });
  els.nearbyButton.addEventListener('click', runNearby);
  els.radius.addEventListener('keydown', (event) => { if (event.key === 'Enter') runNearby(); });
  els.reset.addEventListener('click', () => { clearNearby(); map.setView([23.7, -102.2], 5); applyFilters(); });
  els.radius.max = '25';
  fetch('./data/unidades.json').then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((data) => {
    allUnits = data.filter((u) => Number.isFinite(u.lat) && Number.isFinite(u.lng)).map((u) => ({ ...u, _search: normalize([u.nombre, u.clues, u.entidad, u.municipio, u.localidad, u.comercial].join(' ')) }));
    optionList(els.state, [...new Set(allUnits.map((u) => u.entidad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
    optionList(els.level, [...new Set(allUnits.map((u) => u.nivel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
    optionList(els.status, [...new Set(allUnits.map((u) => u.estatus).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
    [...allUnits].sort((a, b) => a.clues.localeCompare(b.clues, 'es')).forEach((u) => {
      const option = document.createElement('option'); option.value = u.clues; option.textContent = `${u.clues} — ${u.nombre}`; els.clues.append(option);
    });
    applyFilters();
  }).catch((error) => {
    console.error(error); els.statusText.hidden = false; els.statusText.textContent = 'No se pudo cargar la base de establecimientos.';
  });
})();
