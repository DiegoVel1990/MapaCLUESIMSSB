(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const els = {
    map: $('map'), search: $('search'), clearSearch: $('clear-search'), state: $('state-filter'), level: $('level-filter'), status: $('status-filter'),
    count: $('result-count'), states: $('state-count'), statusText: $('map-status'), nearbySearch: $('nearby-search'), suggestions: $('suggestions'),
    radius: $('radius'), nearbyButton: $('nearby-button'), nearbyResults: $('nearby-results'), reset: $('reset-map')
  };
  const map = L.map(els.map, { zoomControl: false, preferCanvas: true }).setView([23.7, -102.2], 5);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  const clusters = L.markerClusterGroup({
    chunkedLoading: true, maxClusterRadius: 48, showCoverageOnHover: false,
    iconCreateFunction(cluster) {
      const n = cluster.getChildCount();
      const size = n < 100 ? 'small' : n < 1000 ? 'medium' : 'large';
      return L.divIcon({ html: `<div>${n.toLocaleString('es-MX')}</div>`, className: `cluster-${size}`, iconSize: null });
    }
  }).addTo(map);
  let allUnits = [];
  let visibleUnits = [];
  let selectedUnit = null;
  let radiusLayer = null;
  let referenceMarker = null;
  let suggestionsNow = [];
  const numberFormat = new Intl.NumberFormat('es-MX');
  const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim();
  const escapeText = (s) => String(s ?? '—');
  const levelColor = (level) => level === 'SEGUNDO NIVEL' ? '#4387c6' : level === 'TERCER NIVEL' ? '#9a65bd' : '#26956a';
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
  const iconFor = (u, isReference = false) => L.divIcon({
    className: '',
    html: `<span style="display:block;width:${isReference ? 18 : 13}px;height:${isReference ? 18 : 13}px;border-radius:50%;background:${isReference ? '#123f35' : levelColor(u.nivel)};border:${isReference ? '3px solid #fff' : '2px solid white'};box-shadow:0 1px 5px #1c3d2e80;${isReference ? 'outline:3px solid #123f3540;' : ''}"></span>`,
    iconSize: [isReference ? 24 : 17, isReference ? 24 : 17], iconAnchor: [isReference ? 12 : 8, isReference ? 12 : 8]
  });
  const distanceKm = (a, b) => {
    const rad = (v) => v * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const optionList = (select, values) => values.forEach((value) => { const opt = document.createElement('option'); opt.value = value; opt.textContent = value; select.append(opt); });
  function filtered() {
    const q = normalize(els.search.value);
    return allUnits.filter((u) => (!els.state.value || u.entidad === els.state.value)
      && (!els.level.value || u.nivel === els.level.value)
      && (!els.status.value || u.estatus === els.status.value)
      && (!q || u._search.includes(q)));
  }
  function applyFilters() {
    visibleUnits = filtered();
    clusters.clearLayers();
    const markers = visibleUnits.map((u) => {
      const marker = L.marker([u.lat, u.lng], { icon: iconFor(u), title: `${u.nombre} — ${u.clues}` });
      marker.bindPopup(popup(u), { maxWidth: 330 });
      return marker;
    });
    clusters.addLayers(markers);
    els.count.textContent = numberFormat.format(visibleUnits.length);
    els.states.textContent = numberFormat.format(new Set(visibleUnits.map((u) => u.entidad)).size);
    els.statusText.textContent = `${numberFormat.format(visibleUnits.length)} unidades en el mapa`;
    els.clearSearch.hidden = !els.search.value;
  }
  function showSuggestions() {
    const q = normalize(els.nearbySearch.value);
    els.suggestions.replaceChildren();
    suggestionsNow = q.length < 2 ? [] : allUnits.filter((u) => u._search.includes(q)).slice(0, 8);
    suggestionsNow.forEach((u, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion'; button.setAttribute('role', 'option'); button.dataset.index = String(index);
      const name = document.createElement('strong'); name.textContent = u.nombre;
      const detail = document.createElement('small'); detail.textContent = `${u.clues} · ${u.municipio}, ${u.entidad}`;
      button.append(name, detail); els.suggestions.append(button);
    });
    els.suggestions.hidden = !suggestionsNow.length;
    els.nearbySearch.setAttribute('aria-expanded', String(Boolean(suggestionsNow.length)));
  }
  function selectUnit(u) {
    selectedUnit = u;
    els.nearbySearch.value = `${u.nombre} · ${u.clues}`;
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
  }
  function runNearby() {
    const radius = Number(els.radius.value);
    if (!selectedUnit || !Number.isFinite(radius) || radius < 1 || radius > 500) {
      els.nearbyResults.textContent = 'Indica un radio entre 1 y 500 km.'; return;
    }
    clearNearby();
    const center = L.latLng(selectedUnit.lat, selectedUnit.lng);
    radiusLayer = L.circle(center, { radius: radius * 1000, color: '#155444', weight: 2, fillColor: '#55a27d', fillOpacity: 0.09 }).addTo(map);
    referenceMarker = L.marker(center, { icon: iconFor(selectedUnit, true), zIndexOffset: 1000 }).addTo(map).bindPopup(popup(selectedUnit));
    const near = allUnits.filter((u) => u.clues !== selectedUnit.clues).map((u) => ({ u, d: distanceKm(selectedUnit, u) })).filter((x) => x.d <= radius).sort((a, b) => a.d - b.d);
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
    els.statusText.textContent = `${numberFormat.format(near.length)} unidades en el radio seleccionado`;
  }
  els.search.addEventListener('input', applyFilters);
  els.clearSearch.addEventListener('click', () => { els.search.value = ''; applyFilters(); els.search.focus(); });
  [els.state, els.level, els.status].forEach((el) => el.addEventListener('change', applyFilters));
  els.nearbySearch.addEventListener('input', showSuggestions);
  els.nearbySearch.addEventListener('focus', showSuggestions);
  els.suggestions.addEventListener('click', (event) => { const button = event.target.closest('button[data-index]'); if (button) selectUnit(suggestionsNow[Number(button.dataset.index)]); });
  els.nearbySearch.addEventListener('keydown', (event) => { if (event.key === 'Escape') { els.suggestions.hidden = true; els.nearbySearch.setAttribute('aria-expanded', 'false'); } if (event.key === 'Enter' && suggestionsNow.length) { event.preventDefault(); selectUnit(suggestionsNow[0]); } });
  document.addEventListener('click', (event) => { if (!event.target.closest('.autocomplete-wrap')) { els.suggestions.hidden = true; els.nearbySearch.setAttribute('aria-expanded', 'false'); } });
  els.nearbyButton.addEventListener('click', runNearby);
  els.radius.addEventListener('keydown', (event) => { if (event.key === 'Enter') runNearby(); });
  els.reset.addEventListener('click', () => { clearNearby(); map.setView([23.7, -102.2], 5); applyFilters(); });
  fetch('./data/unidades.json').then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((data) => {
    allUnits = data.filter((u) => Number.isFinite(u.lat) && Number.isFinite(u.lng)).map((u) => ({ ...u, _search: normalize([u.nombre, u.clues, u.entidad, u.municipio, u.localidad, u.comercial].join(' ')) }));
    optionList(els.state, [...new Set(allUnits.map((u) => u.entidad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
    optionList(els.level, [...new Set(allUnits.map((u) => u.nivel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
    optionList(els.status, [...new Set(allUnits.map((u) => u.estatus).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
    applyFilters();
  }).catch((error) => {
    console.error(error); els.statusText.textContent = 'No se pudo cargar la base de establecimientos.';
  });
})();
