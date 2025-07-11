// Güncellenmiş: Gerçek Satır Bazlı Guillotine Kesim Algoritması
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYkzZzNXB22U4oEXxOoPh-puwuE8kz0g4",
  authDomain: "pufemo-com.firebaseapp.com",
  projectId: "pufemo-com",
  storageBucket: "pufemo-com.appspot.com",
  messagingSenderId: "983352837227",
  appId: "1:983352837227:web:defaa8dae215776e2e1d2e",
  measurementId: "G-RH8XHC7P91"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const projectNameEl = document.getElementById('projectName');
const backButton = document.getElementById('backButton');
const logoutButton = document.getElementById('logoutButton');
const runOptimizationBtn = document.getElementById('runOptimizationBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const materialTabs = document.getElementById('materialTabs');
const materialTabContent = document.getElementById('materialTabContent');
const panelSummary = document.getElementById('panelSummary');
const bandingSummary = document.getElementById('bandingSummary');
const materialGrainSettings = document.getElementById('materialGrainSettings');
const unpackedContainer = document.getElementById('unpackedContainer');
const unpackedList = document.getElementById('unpackedList');

let currentUser = null;
let projectId = null;
let projectData = {};
let allMaterials = new Map();

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  projectId = params.get('id');
  if (!projectId) {
    alert("Proje ID'si bulunamadı!");
    window.location.href = 'projects.html';
    return;
  }
  backButton.href = `project-detail.html?id=${projectId}`;
  onAuthStateChanged(auth, user => {
    if (user) {
      currentUser = user;
      loadProjectData();
    } else {
      window.location.href = 'index.html';
    }
  });
  runOptimizationBtn.addEventListener('click', runOptimization);
});

async function loadProjectData() {
  const matQuery = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
  const matSnapshot = await getDocs(matQuery);
  matSnapshot.forEach(doc => allMaterials.set(doc.id, { id: doc.id, ...doc.data() }));

  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  if (projectSnap.exists()) {
    projectData = projectSnap.data();
    projectNameEl.textContent = projectData.name;
    renderGrainSettings();
  } else {
    alert("Proje bulunamadı.");
    window.location.href = 'projects.html';
  }
}

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
  bandingSummary.innerHTML = '';
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

logoutButton.addEventListener('click', () => signOut(auth));
