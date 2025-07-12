// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Firebase Konfigürasyonu
const firebaseConfig = {
    apiKey: "AIzaSyDYkzZzNXB22U4oEXxOoPh-puwuE8kz0g4",
    authDomain: "pufemo-com.firebaseapp.com",
    projectId: "pufemo-com",
    storageBucket: "pufemo-com.appspot.com",
    messagingSenderId: "983352837227",
    appId: "1:983352837227:web:defaa8dae215776e2e1d2e",
    measurementId: "G-RH8XHC7P91"
};

// Firebase'i ve Servisleri Başlatma
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Değişkenler
let currentUser = null;
let projectId = null;
let projectData = {};
let allMaterials = new Map();

// HTML Elementleri
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

// Sayfa Yüklendiğinde
onAuthStateChanged(auth, user => {
    const params = new URLSearchParams(window.location.search);
    projectId = params.get('id');
    if (!projectId) return (window.location.href = 'projects.html');

    backButton.href = `project-detail.html?id=${projectId}`;
    if (user) {
        currentUser = user;
        loadProjectAndMaterials();
    } else {
        window.location.href = 'index.html';
    }
});

runOptimizationBtn.addEventListener('click', runOptimization);
logoutButton.addEventListener('click', () => signOut(auth));

async function loadProjectAndMaterials() {
    const matQuery = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
    const matSnapshot = await getDocs(matQuery);
    allMaterials.clear();
    matSnapshot.forEach(doc => allMaterials.set(doc.id, { id: doc.id, ...doc.data() }));

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) return alert("Proje bulunamadı.");

    projectData = projectSnap.data();
    projectNameEl.textContent = projectData.name;
    createGrainSettingsUI();
}

function createGrainSettingsUI() {
    materialGrainSettings.innerHTML = '';
    const ids = [...new Set((projectData.parts || []).map(p => p.materialId))];
    ids.forEach(id => {
        const material = allMaterials.get(id);
        if (material?.type === 'Panel') {
            materialGrainSettings.innerHTML += `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" id="grain-${id}">
                    <label class="form-check-label" for="grain-${id}"><b>${material.name}</b> Döndürme</label>
                </div>`;
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

    setTimeout(() => {
        const sheetWidth = +document.getElementById('sheetWidth').value;
        const sheetHeight = +document.getElementById('sheetHeight').value;
        const kerf = +document.getElementById('kerfValue').value || 0;
        if (!sheetWidth || !sheetHeight) return alert("Plaka ölçüsü girin.");

        const partsByMaterial = {};
        (projectData.parts || []).forEach(p => {
            if (!partsByMaterial[p.materialId]) partsByMaterial[p.materialId] = [];
            for (let i = 0; i < p.qty; i++) {
                partsByMaterial[p.materialId].push({
                    w: p.width + kerf, h: p.height + kerf,
                    name: p.name, originalW: p.width, originalH: p.height
                });
            }
        });

        let firstTab = true;
        for (const materialId in partsByMaterial) {
            const material = allMaterials.get(materialId);
            const materialName = material ? material.name : 'Bilinmeyen';
            const allowRotation = !document.getElementById(`grain-${materialId}`)?.checked;
            const tabId = `tab-${materialId}`;

            materialTabs.innerHTML += `<li class="nav-item"><a class="nav-link ${firstTab ? 'active' : ''}" id="${tabId}-tab" data-bs-toggle="tab" href="#${tabId}" role="tab">${materialName}</a></li>`;
            const tabContentPane = document.createElement('div');
            tabContentPane.className = `tab-pane fade ${firstTab ? 'show active' : ''}`;
            tabContentPane.id = tabId;
            tabContentPane.role = 'tabpanel';

            const packer = new Packer();
            const { packedSheets, unpackedPieces } = packer.fit(partsByMaterial[materialId], sheetWidth, sheetHeight, allowRotation);
            const scale = 500 / sheetWidth;

            packedSheets.forEach((sheet, i) => {
                const sheetEl = document.createElement('div');
                sheetEl.className = 'sheet-container';
                sheetEl.style.width = `${sheetWidth * scale}px`;
                sheetEl.style.height = `${sheetHeight * scale}px`;
                sheetEl.dataset.scale = scale;
                sheetEl.innerHTML = `<h5 class="p-2">Plaka ${i + 1}</h5>`;

                sheet.pieces.forEach((p, j) => {
                    const el = document.createElement('div');
                    el.className = 'piece';
                    el.id = `piece-${materialId}-${i}-${j}`;
                    el.style.left = `${p.fit.x * scale}px`;
                    el.style.top = `${p.fit.y * scale}px`;
                    el.style.width = `${(p.w - kerf) * scale}px`;
                    el.style.height = `${(p.h - kerf) * scale}px`;
                    el.dataset.w = p.w;
                    el.dataset.h = p.h;
                    el.dataset.kerf = kerf;
                    el.dataset.allowRotation = allowRotation;
                    el.innerHTML = `<span class="piece-text">${p.name} (${p.originalH}x${p.originalW})</span><i class="bi bi-arrow-clockwise rotate-icon"></i>`;
                    sheetEl.appendChild(el);
                });
                tabContentPane.appendChild(sheetEl);
            });

            materialTabContent.appendChild(tabContentPane);
            panelSummary.innerHTML += `<li class="list-group-item">${materialName}: <strong>${packedSheets.length} plaka</strong></li>`;
            if (unpackedPieces.length > 0) renderUnpackedPieces(unpackedPieces);
            firstTab = false;
        }

        calculateAndRenderBandingSummary();
        loadingIndicator.classList.add('d-none');
        makePiecesInteractive();
    }, 300);
}

function renderUnpackedPieces(pieces) {
    unpackedContainer.classList.remove('d-none');
    unpackedList.innerHTML = '';
    pieces.forEach(p => {
        unpackedList.innerHTML += `<tr><td>${p.name}</td><td>${p.originalH}</td><td>${p.originalW}</td></tr>`;
    });
}

function calculateAndRenderBandingSummary() {
    const totals = {};
    (projectData.parts || []).forEach(p => {
        if (p.banding?.materialId) {
            if (!totals[p.banding.materialId]) totals[p.banding.materialId] = 0;
            let len = 0;
            if (p.banding.b1) len += p.height;
            if (p.banding.b2) len += p.height;
            if (p.banding.e1) len += p.width;
            if (p.banding.e2) len += p.width;
            totals[p.banding.materialId] += len * p.qty;
        }
    });
    for (const id in totals) {
        const m = allMaterials.get(id);
        const name = m ? m.name : 'Bilinmeyen Bant';
        const meters = (totals[id] / 1000).toFixed(2);
        bandingSummary.innerHTML += `<li class="list-group-item">${name}: <strong>${meters} m</strong></li>`;
    }
}

function makePiecesInteractive() {
    let activePiece = null, offsetX = 0, offsetY = 0;

    materialTabContent.addEventListener('mousedown', e => {
        const piece = e.target.closest('.piece');
        if (!piece) return;
        if (e.target.classList.contains('rotate-icon')) return rotatePiece(e);

        e.preventDefault();
        activePiece = piece;
        const rect = piece.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        piece.classList.add('dragging');
        piece.style.zIndex = 1000;
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag, { once: true });
    });

    function drag(e) {
        if (!activePiece) return;
        activePiece.style.left = `${e.clientX - offsetX}px`;
        activePiece.style.top = `${e.clientY - offsetY}px`;
    }

    function stopDrag(e) {
        if (!activePiece) return;
        document.removeEventListener('mousemove', drag);
        activePiece.style.visibility = 'hidden';
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        activePiece.style.visibility = 'visible';
        const targetSheet = dropTarget?.closest('.sheet-container');

        if (targetSheet) {
            const parentRect = targetSheet.getBoundingClientRect();
            let newLeft = e.clientX - parentRect.left - offsetX;
            let newTop = e.clientY - parentRect.top - offsetY;
            newLeft = Math.max(0, Math.min(newLeft, parentRect.width - activePiece.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, parentRect.height - activePiece.offsetHeight));
            activePiece.style.left = `${newLeft}px`;
            activePiece.style.top = `${newTop}px`;
            targetSheet.appendChild(activePiece);
            snapToNearby(activePiece, targetSheet);
        }

        activePiece.classList.remove('dragging');
        activePiece.style.zIndex = 'auto';
        activePiece = null;
    }
}

function rotatePiece(e) {
    e.stopPropagation();
    const piece = e.target.closest('.piece');
    if (piece.dataset.allowRotation !== 'true') return alert("Döndürme kilitli.");

    const w = piece.offsetWidth, h = piece.offsetHeight;
    piece.style.width = `${h}px`;
    piece.style.height = `${w}px`;

    const parentRect = piece.parentElement.getBoundingClientRect();
    let left = parseFloat(piece.style.left), top = parseFloat(piece.style.top);
    left = Math.max(0, Math.min(left, parentRect.width - h));
    top = Math.max(0, Math.min(top, parentRect.height - w));
    piece.style.left = `${left}px`;
    piece.style.top = `${top}px`;
}

function snapToNearby(piece, targetSheet) {
    const threshold = 15;
    const pieceLeft = parseFloat(piece.style.left);
    const pieceTop = parseFloat(piece.style.top);
    const pieceRight = pieceLeft + piece.offsetWidth;
    const pieceBottom = pieceTop + piece.offsetHeight;
    const pw = targetSheet.offsetWidth;
    const ph = targetSheet.offsetHeight;

    targetSheet.querySelectorAll('.piece').forEach(other => {
        if (other === piece) return;
        const oLeft = parseFloat(other.style.left);
        const oTop = parseFloat(other.style.top);
        const oRight = oLeft + other.offsetWidth;
        const oBottom = oTop + other.offsetHeight;

        if (Math.abs(pieceLeft - oRight) < threshold) piece.style.left = `${oRight}px`;
        if (Math.abs(pieceRight - oLeft) < threshold) piece.style.left = `${oLeft - piece.offsetWidth}px`;
        if (Math.abs(pieceTop - oBottom) < threshold) piece.style.top = `${oBottom}px`;
        if (Math.abs(pieceBottom - oTop) < threshold) piece.style.top = `${oTop - piece.offsetHeight}px`;
    });

    if (pieceLeft < threshold) piece.style.left = `0px`;
    if (pieceTop < threshold) piece.style.top = `0px`;
    if (Math.abs(pw - pieceRight) < threshold) piece.style.left = `${pw - piece.offsetWidth}px`;
    if (Math.abs(ph - pieceBottom) < threshold) piece.style.top = `${ph - piece.offsetHeight}px`;
}

class Packer {
    fit(pieces, binWidth, binHeight, allowRotation) {
        const sheets = [], unpacked = [];
        pieces.sort((a, b) => (b.w * b.h) - (a.w * a.h));
        for (const piece of pieces) {
            let placed = false;
            for (const sheet of sheets) {
                if (this.placeInSheet(piece, sheet, allowRotation)) {
                    placed = true; break;
                }
            }
            if (!placed) {
                const newSheet = { root: { x: 0, y: 0, w: binWidth, h: binHeight }, pieces: [] };
                if (this.placeInSheet(piece, newSheet, allowRotation)) {
                    sheets.push(newSheet); placed = true;
                }
            }
            if (!placed) unpacked.push(piece);
        }
        return { packedSheets: sheets, unpackedPieces: unpacked };
    }
    placeInSheet(piece, sheet, allowRotation) {
        let node = this.findNode(sheet.root, piece.w, piece.h);
        if (node) {
            piece.fit = this.splitNode(node, piece.w, piece.h);
            sheet.pieces.push(piece);
            return true;
        }
        if (allowRotation && piece.w !== piece.h) {
            node = this.findNode(sheet.root, piece.h, piece.w);
            if (node) {
                [piece.w, piece.h] = [piece.h, piece.w];
                piece.fit = this.splitNode(node, piece.w, piece.h);
                sheet.pieces.push(piece);
                return true;
            }
        }
        return false;
    }
    findNode(root, w, h) {
        if (root.used) {
            return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
        } else if (w <= root.w && h <= root.h) {
            return root;
        }
        return null;
    }
    splitNode(node, w, h) {
        node.used = true;
        node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
        node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h };
        return { x: node.x, y: node.y };
    }
}
