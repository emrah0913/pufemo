import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, updateDoc, arrayUnion, 
    collection, query, where, getDocs, onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
let moduleTemplates = [];
let allMaterials = new Map();
let isGroupedView = false;
let currentProjectData = {};

document.addEventListener('DOMContentLoaded', () => {
    // Element tanımlamaları
    const getEl = (id) => document.getElementById(id);
    const elements = {
        projectName: getEl('projectName'),
        projectDescription: getEl('projectDescription'),
        totalCost: getEl('totalCost'),
        partsList: getEl('partsList'),
        accessoriesList: getEl('accessoriesList'),
        partsHeader: getEl('parts-table-header'),
        accHeader: getEl('accessories-table-header'),
        groupToggle: getEl('groupViewToggle'),
        loading: getEl('loadingIndicator'),
        logout: getEl('logoutButton'),
        optLink: getEl('optimizationLink'),
        recalculateBtn: getEl('recalculateCostBtn'),
        // Modallar ve Butonlar
        templateSelect: getEl('moduleTemplateSelect'),
        addModuleBtn: getEl('addModuleToProjectBtn'),
        savePartBtn: getEl('saveSinglePartBtn'),
        saveAccBtn: getEl('saveSingleAccessoryBtn'),
        // Single dropdownlar
        singlePartMat: getEl('singlePartMaterial'),
        singlePartBandingMat: getEl('singlePartBandingMaterial'),
        singleAccMat: getEl('singleAccessoryMaterial')
    };

    const params = new URLSearchParams(window.location.search);
    projectId = params.get('id');
    if (!projectId) { window.location.href = 'projects.html'; return; }
    if (elements.optLink) elements.optLink.href = `optimization.html?id=${projectId}`;

    const loadAllMaterials = async () => {
        const q = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
        const snap = await getDocs(q);
        allMaterials.clear();
        snap.forEach(d => allMaterials.set(d.id, { id: d.id, ...d.data() }));
        populateSingleDropdowns();
    };

    const populateSingleDropdowns = () => {
        const matArray = Array.from(allMaterials.values());
        const fill = (el, type) => {
            if (!el) return;
            el.innerHTML = '<option value="">Seçin...</option>';
            matArray.filter(m => m.type === type).forEach(m => {
                el.innerHTML += `<option value="${m.id}">${m.name}</option>`;
            });
        };
        fill(elements.singlePartMat, 'Panel');
        fill(elements.singlePartBandingMat, 'Kenar Bandı');
        fill(elements.singleAccMat, 'Aksesuar');
    };

    const loadProject = () => {
        if (elements.loading) elements.loading.classList.remove('d-none');
        onSnapshot(doc(db, 'projects', projectId), (snap) => {
            if (elements.loading) elements.loading.classList.add('d-none');
            if (snap.exists()) {
                currentProjectData = snap.data();
                if (elements.projectName) elements.projectName.textContent = currentProjectData.name;
                renderLists();
            }
        });
    };

    const renderLists = () => {
        if (!elements.partsList) return;
        elements.partsList.innerHTML = '';
        const parts = currentProjectData.parts || [];
        if (elements.partsHeader) elements.partsHeader.innerHTML = `<th>Parça</th><th>Boy</th><th>En</th><th>Adet</th><th>Modül</th><th>İşlem</th>`;
        parts.forEach(p => {
            elements.partsList.innerHTML += `<tr><td>${p.name}</td><td>${p.height}</td><td>${p.width}</td><td>${p.qty}</td><td>${p.moduleInstanceName}</td><td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${p.partId}', 'parçayı', 'parts')">Sil</button></td></tr>`;
        });
        // Benzer şekilde aksesuarlar...
        if (elements.totalCost) {
            let total = 0;
            [...parts, ...(currentProjectData.accessories || [])].forEach(i => total += (i.cost || 0));
            elements.totalCost.textContent = `${total.toFixed(2)} ₺`;
        }
    };

    const loadTemplates = async () => {
        if (!elements.templateSelect) return;
        const q = query(collection(db, 'moduleTemplates'), where('userId', '==', currentUser.uid));
        const snap = await getDocs(q);
        elements.templateSelect.innerHTML = '<option value="">Seçin...</option>';
        moduleTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        moduleTemplates.forEach(t => elements.templateSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`);
    };

    onAuthStateChanged(auth, (user) => {
        if (user) { currentUser = user; loadAllMaterials().then(() => { loadProject(); loadTemplates(); }); }
        else { window.location.href = 'index.html'; }
    });

    if (elements.addModuleBtn) {
        elements.addModuleBtn.addEventListener('click', async () => {
            const qty = parseInt(getEl('moduleQuantity').value) || 1;
            const template = moduleTemplates.find(t => t.id === elements.templateSelect.value);
            if (!template) return alert("Şablon seçin.");

            const calculatedParts = (template.parts || []).map(p => {
                const h = eval(p.heightFormula.toUpperCase().replace(/ /g, ''));
                const w = eval(p.widthFormula.toUpperCase().replace(/ /g, ''));
                const totalQty = p.qty * qty;
                const m = allMaterials.get(p.materialId);
                const cost = (h/1000)*(w/1000)*(m?.price || 0)*totalQty;
                return { partId: crypto.randomUUID(), name: p.name, height:h, width:w, qty: totalQty, cost, materialId: p.materialId, moduleInstanceName: getEl('moduleInstanceName').value || 'Modül' };
            });

            await updateDoc(doc(db, 'projects', projectId), { parts: arrayUnion(...calculatedParts) });
            bootstrap.Modal.getInstance(getEl('addModuleModal')).hide();
        });
    }

    if (elements.logout) elements.logout.addEventListener('click', () => signOut(auth));
});

window.deleteItem = async (id, type, field) => {
    const projectRef = doc(db, 'projects', projectId);
    const snap = await getDoc(projectRef);
    const items = snap.data()[field].filter(i => (field === 'parts' ? i.partId : i.accessoryId) !== id);
    await updateDoc(projectRef, { [field]: items });
};
