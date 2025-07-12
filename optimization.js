// optimization.js
// Bu dosya Firebase, kesim optimizasyonu ve interaktif sürükleme/döndürme işlemlerini içerir.

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

let currentUser = null;
let projectId = null;
let projectData = {};
let allMaterials = new Map();

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

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    projectId = params.get('id');
    if (!projectId) return window.location.href = 'projects.html';
    backButton.href = `project-detail.html?id=${projectId}`;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadProjectAndMaterials();
        } else {
            window.location.href = 'index.html';
        }
    });

    runOptimizationBtn.addEventListener('click', runOptimization);
});

async function loadProjectAndMaterials() {
    const matQuery = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
    const matSnapshot = await getDocs(matQuery);
    allMaterials.clear();
    matSnapshot.forEach(doc => allMaterials.set(doc.id, { id: doc.id, ...doc.data() }));

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (projectSnap.exists()) {
        projectData = projectSnap.data();
        projectNameEl.textContent = projectData.name;
        createGrainSettingsUI();
    } else {
        window.location.href = 'projects.html';
    }
}

function createGrainSettingsUI() {
    materialGrainSettings.innerHTML = '';
    const uniquePanelIds = [...new Set((projectData.parts || []).map(p => p.materialId))];
    if (uniquePanelIds.length === 0) return materialGrainSettings.innerHTML = '<p class="text-muted">Panel malzemesi yok.</p>';

    uniquePanelIds.forEach(id => {
        const material = allMaterials.get(id);
        if (material && material.type === 'Panel') {
            const div = document.createElement('div');
            div.className = 'form-check form-check-inline';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="" id="grain-${id}">
                <label class="form-check-label" for="grain-${id}"><b>${material.name}</b> Döndürme</label>`;
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

    setTimeout(() => {
        const sheetWidth = parseInt(document.getElementById('sheetWidth').value);
        const sheetHeight = parseInt(document.getElementById('sheetHeight').value);
        const kerf = parseInt(document.getElementById('kerfValue').value) || 0;
        if (!sheetWidth || !sheetHeight) return alert("Geçerli plaka ölçüleri girin.");

        const partsByMaterial = {};
        (projectData.parts || []).forEach(part => {
            if (!partsByMaterial[part.materialId]) partsByMaterial[part.materialId] = [];
            for (let i = 0; i < part.qty; i++) {
                partsByMaterial[part.materialId].push({ w: part.width + kerf, h: part.height + kerf, name: part.name, originalW: part.width, originalH: part.height });
            }
        });

        let firstTab = true;
        for (const materialId in partsByMaterial) {
            const material = allMaterials.get(materialId);
            const materialName = material ? material.name : 'Bilinmeyen';
            const allowRotation = !(document.getElementById(`grain-${materialId}`)?.checked);

            const tabId = `tab-${materialId}`;
            const tabNavItem = document.createElement('li');
            tabNavItem.className = 'nav-item';
            tabNavItem.innerHTML = `<a class="nav-link ${firstTab ? 'active' : ''}" id="${tabId}-tab" data-bs-toggle="tab" href="#${tabId}" role="tab">${materialName}</a>`;
            materialTabs.appendChild(tabNavItem);

            const tabContentPane = document.createElement('div');
            tabContentPane.className = `tab-pane fade ${firstTab ? 'show active' : ''}`;
            tabContentPane.id = tabId;
            tabContentPane.role = 'tabpanel';

            const packer = new Packer();
            const { packedSheets, unpackedPieces } = packer.fit(partsByMaterial[materialId], sheetWidth, sheetHeight, allowRotation);
            const scale = 500 / sheetWidth;

            packedSheets.forEach((sheet, index) => {
                const sheetEl = document.createElement('div');
                sheetEl.className = 'sheet-container';
                sheetEl.style.width = `${sheetWidth * scale}px`;
                sheetEl.style.height = `${sheetHeight * scale}px`;
                sheetEl.dataset.scale = scale;
                sheetEl.innerHTML = `<h5 class="p-2">Plaka ${index + 1}</h5>`;

                sheet.pieces.forEach((p, pieceIndex) => {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.id = `piece-${materialId}-${index}-${pieceIndex}`;
                    pieceEl.style.left = `${p.fit.x * scale}px`;
                    pieceEl.style.top = `${p.fit.y * scale}px`;
                    pieceEl.style.width = `${(p.w - kerf) * scale}px`;
                    pieceEl.style.height = `${(p.h - kerf) * scale}px`;
                    pieceEl.dataset.allowRotation = allowRotation;
                    pieceEl.innerHTML = `<span>${p.name} (${p.originalH}x${p.originalW})</span><i class="bi bi-arrow-clockwise rotate-icon"></i>`;
                    sheetEl.appendChild(pieceEl);
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
    }, 500);
}

function renderUnpackedPieces(pieces) {
    unpackedContainer.classList.remove('d-none');
    unpackedList.innerHTML = '';
    pieces.forEach(p => unpackedList.innerHTML += `<tr><td>${p.name}</td><td>${p.originalH}</td><td>${p.originalW}</td></tr>`);
}

function calculateAndRenderBandingSummary() {
    const bandingTotals = {};
    (projectData.parts || []).forEach(part => {
        if (part.banding?.materialId) {
            const materialId = part.banding.materialId;
            if (!bandingTotals[materialId]) bandingTotals[materialId] = 0;
            let length = 0;
            if (part.banding.b1) length += part.height;
            if (part.banding.b2) length += part.height;
            if (part.banding.e1) length += part.width;
            if (part.banding.e2) length += part.width;
            bandingTotals[materialId] += length * part.qty;
        }
    });
    for (const materialId in bandingTotals) {
        const material = allMaterials.get(materialId);
        const name = material ? material.name : 'Bilinmeyen Bant';
        const totalMeters = (bandingTotals[materialId] / 1000).toFixed(2);
        bandingSummary.innerHTML += `<li class="list-group-item">${name}: <strong>${totalMeters} metre</strong></li>`;
    }
}

function makePiecesInteractive() {
    let activePiece = null;
    let offsetX = 0, offsetY = 0;

    const startDrag = (e) => {
        const piece = e.target.closest('.piece');
        if (!piece) return;
        if (e.target.classList.contains('rotate-icon')) return rotatePiece(e);
        e.preventDefault();
        activePiece = piece;
        const rect = piece.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        activePiece.classList.add('dragging');
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag, { once: true });
    };

    const drag = (e) => {
        if (!activePiece) return;
        activePiece.style.left = `${e.clientX - offsetX}px`;
        activePiece.style.top = `${e.clientY - offsetY}px`;
    };

    const stopDrag = (e) => {
        if (!activePiece) return;
        document.removeEventListener('mousemove', drag);
        activePiece.style.visibility = 'hidden';
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        activePiece.style.visibility = 'visible';
        const sheet = dropTarget?.closest('.sheet-container');

        if (sheet) {
            const rect = sheet.getBoundingClientRect();
            let left = Math.max(0, Math.min(e.clientX - rect.left - offsetX, rect.width - activePiece.offsetWidth));
            let top = Math.max(0, Math.min(e.clientY - rect.top - offsetY, rect.height - activePiece.offsetHeight));
            activePiece.style.left = `${left}px`;
            activePiece.style.top = `${top}px`;
            sheet.appendChild(activePiece);
            snapToNearby(activePiece, sheet);
        }
        activePiece.classList.remove('dragging');
        activePiece = null;
    };

    const rotatePiece = (e) => {
        const piece = e.target.closest('.piece');
        if (piece.dataset.allowRotation !== 'true') return alert("Yön kilitli.");
        const w = piece.offsetWidth, h = piece.offsetHeight;
        piece.style.width = `${h}px`; piece.style.height = `${w}px`;
        const rect = piece.parentElement.getBoundingClientRect();
        let left = parseFloat(piece.style.left);
        let top = parseFloat(piece.style.top);
        if (left + h > rect.width) piece.style.left = `${rect.width - h}px`;
        if (top + w > rect.height) piece.style.top = `${rect.height - w}px`;
    };

    materialTabContent.addEventListener('mousedown', startDrag);
}

function snapToNearby(piece, sheet) {
    const threshold = 15;
    const pieceLeft = parseFloat(piece.style.left);
    const pieceTop = parseFloat(piece.style.top);
    const pieceRight = pieceLeft + piece.offsetWidth;
    const pieceBottom = pieceTop + piece.offsetHeight;

    const parentWidth = sheet.offsetWidth;
    const parentHeight = sheet.offsetHeight;

    sheet.querySelectorAll('.piece').forEach(other => {
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
    if (Math.abs(parentWidth - pieceRight) < threshold) piece.style.left = `${parentWidth - piece.offsetWidth}px`;
    if (Math.abs(parentHeight - pieceBottom) < threshold) piece.style.top = `${parentHeight - piece.offsetHeight}px`;
}

logoutButton.addEventListener('click', () => signOut(auth));
