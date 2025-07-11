// TEST ORTAMI: Firebase olmadan çalışan mock veriyle kesim planı

const projectNameEl = document.getElementById('projectName');
const runOptimizationBtn = document.getElementById('runOptimizationBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const materialTabs = document.getElementById('materialTabs');
const materialTabContent = document.getElementById('materialTabContent');
const panelSummary = document.getElementById('panelSummary');
const materialGrainSettings = document.getElementById('materialGrainSettings');
const unpackedContainer = document.getElementById('unpackedContainer');
const unpackedList = document.getElementById('unpackedList');

let projectData = {}; 
let allMaterials = new Map();

window.addEventListener('DOMContentLoaded', () => {
  // ÖRNEK MALZEME ve PROJE TANIMI
  allMaterials.set("malzeme-1", {
    id: "malzeme-1",
    name: "18 MM BEYAZ MDFLAM",
    type: "Panel",
    patterned: false
  });

  projectData = {
    name: "Test Proje",
    parts: [
      { name: "YAN PANEL", materialId: "malzeme-1", width: 2200, height: 550, qty: 1 },
      { name: "Alt Tabla", materialId: "malzeme-1", width: 900, height: 560, qty: 1 },
      { name: "RAF", materialId: "malzeme-1", width: 864, height: 540, qty: 2 },
      { name: "Yan", materialId: "malzeme-1", width: 702, height: 560, qty: 4 },
      { name: "LUNBAZ L", materialId: "malzeme-1", width: 700, height: 330, qty: 2 },
      { name: "Alt Tabla", materialId: "malzeme-1", width: 600, height: 560, qty: 1 },
      { name: "RAF", materialId: "malzeme-1", width: 564, height: 540, qty: 1 }
    ]
  };

  projectNameEl.textContent = projectData.name;
  renderGrainSettings();
  runOptimizationBtn.addEventListener('click', runOptimization);
});

function renderGrainSettings() {
  materialGrainSettings.innerHTML = '';
  const panelIds = [...new Set((projectData.parts || []).map(p => p.materialId))];
  panelIds.forEach(id => {
    const material = allMaterials.get(id);
    if (material && material.type === 'Panel') {
      const div = document.createElement('div');
      div.className = 'form-check';
      div.innerHTML = `
        <input class="form-check-input" type="checkbox" id="grain-${id}" ${material.patterned ? 'checked disabled' : ''}>
        <label class="form-check-label" for="grain-${id}"><b>${material.name}</b> için döndürme ${material.patterned ? 'ZORUNLU KAPALI' : 'isteğe bağlı'}</label>
      `;
      materialGrainSettings.appendChild(div);
    }
  });
}

function runOptimization() {
  loadingIndicator.classList.remove('d-none');
  materialTabs.innerHTML = '';
  materialTabContent.innerHTML = '';
  panelSummary.innerHTML = '';
  unpackedContainer.classList.add('d-none');
  unpackedList.innerHTML = '';

  const sheetWidth = parseInt(document.getElementById('sheetWidth').value);
  const sheetHeight = parseInt(document.getElementById('sheetHeight').value);
  const kerf = parseFloat(document.getElementById('kerfValue')?.value || 0);

  if (!sheetWidth || !sheetHeight) {
    alert("Lütfen geçerli plaka ölçüleri girin.");
    loadingIndicator.classList.add('d-none');
    return;
  }

  setTimeout(() => {
    const materialGroups = {};
    (projectData.parts || []).forEach(part => {
      if (!materialGroups[part.materialId]) materialGroups[part.materialId] = [];
      for (let i = 0; i < part.qty; i++) {
        materialGroups[part.materialId].push({ name: part.name, w: part.width, h: part.height });
      }
    });

    const allUnpacked = [];
    let firstTab = true;

    for (const matId in materialGroups) {
      const material = allMaterials.get(matId);
      const rotationAllowed = material.patterned !== true;
      const tabId = `tab-${matId}`;

      const { packedSheets, unpacked } = trueGuillotinePack(materialGroups[matId], sheetWidth, sheetHeight, kerf, rotationAllowed);

      const tabNav = document.createElement('li');
      tabNav.className = 'nav-item';
      tabNav.innerHTML = `<a class="nav-link ${firstTab ? 'active' : ''}" data-bs-toggle="tab" href="#${tabId}">${material?.name || 'Malzeme'}</a>`;
      materialTabs.appendChild(tabNav);

      const tabPane = document.createElement('div');
      tabPane.className = `tab-pane fade ${firstTab ? 'show active' : ''}`;
      tabPane.id = tabId;

      const scale = 500 / sheetWidth;
      packedSheets.forEach((sheet, i) => {
        const sheetEl = document.createElement('div');
        sheetEl.className = 'sheet-container';
        sheetEl.style.width = `${sheetWidth * scale}px`;
        sheetEl.style.height = `${sheetHeight * scale}px`;
        sheetEl.innerHTML = `<h6 class="p-2">Plaka ${i + 1}</h6>`;

        sheet.pieces.forEach(p => {
          const el = document.createElement('div');
          el.className = 'piece';
          el.style.left = `${p.x * scale}px`;
          el.style.top = `${p.y * scale}px`;
          el.style.width = `${p.w * scale}px`;
          el.style.height = `${p.h * scale}px`;
          el.innerHTML = `<span>${p.name}<br>(${p.w}x${p.h})</span>`;
          sheetEl.appendChild(el);
        });

        tabPane.appendChild(sheetEl);
      });

      materialTabContent.appendChild(tabPane);
      panelSummary.innerHTML += `<li class="list-group-item">${material?.name}: <strong>${packedSheets.length} plaka</strong></li>`;
      allUnpacked.push(...unpacked);
      firstTab = false;
    }

    if (allUnpacked.length > 0) {
      unpackedContainer.classList.remove('d-none');
      allUnpacked.forEach(p => {
        unpackedList.innerHTML += `<tr><td>${p.name}</td><td>${p.h}</td><td>${p.w}</td></tr>`;
      });
    }

    loadingIndicator.classList.add('d-none');
  }, 300);
}

function trueGuillotinePack(pieces, sw, sh, kerf, allowRotation) {
  const packedSheets = [];
  const unpacked = [];
  let items = [...pieces].sort((a, b) => b.h - a.h);

  while (items.length > 0) {
    let sheet = { pieces: [] };
    let y = 0;

    while (y < sh) {
      let rowHeight = 0;
      let rowX = 0;
      for (let i = 0; i < items.length;) {
        let p = items[i];
        let rotated = false;
        if (allowRotation && p.w > p.h && p.w <= sh && p.h <= sw) {
          [p.w, p.h] = [p.h, p.w];
          rotated = true;
        }
        if (rowX + p.w + kerf > sw) {
          i++;
          continue;
        }
        if (y + p.h + kerf > sh) {
          i++;
          continue;
        }
        sheet.pieces.push({ ...p, x: rowX, y });
        rowX += p.w + kerf;
        rowHeight = Math.max(rowHeight, p.h);
        items.splice(i, 1);
      }
      if (rowHeight === 0) break;
      y += rowHeight + kerf;
    }
    packedSheets.push(sheet);
  }
  return { packedSheets, unpacked: items };
}
