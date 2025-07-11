// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// HTML Elementleri
const projectList = document.getElementById('projectList');
const loadingIndicator = document.getElementById('loadingIndicator');
const projectModal = new bootstrap.Modal(document.getElementById('projectModal'));
const projectForm = document.getElementById('projectForm');
const projectNameInput = document.getElementById('projectName');
const projectDescriptionInput = document.getElementById('projectDescription');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const logoutButton = document.getElementById('logoutButton');

let currentUser = null;

// Oturum kontrolü
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        fetchProjects(user.uid);
    } else {
        window.location.href = 'index.html';
    }
});

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

// Projeleri Firestore'dan çek ve listele
const fetchProjects = (userId) => {
    loadingIndicator.classList.remove('d-none');
    const q = query(
        collection(db, 'projects'), 
        where('userId', '==', userId), 
        orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
        loadingIndicator.classList.add('d-none');
        projectList.innerHTML = '';
        if (snapshot.empty) {
            projectList.innerHTML = '<p class="text-center text-muted">Henüz hiç proje oluşturmadınız.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const project = doc.data();
            const projectId = doc.id;
            const projectElement = `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <a href="project-detail.html?id=${projectId}" class="text-dark text-decoration-none flex-grow-1">
                        <h5 class="mb-1">${project.name}</h5>
                        <p class="mb-1 text-muted">${project.description || ''}</p>
                    </a>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.deleteProject('${projectId}')">Sil</button>
                </div>
            `;
            projectList.innerHTML += projectElement;
        });
    }, (error) => {
        console.error("Projeler getirilirken hata: ", error);
        alert("Projeler yüklenirken bir hata oluştu.");
    });
};

// Yeni proje kaydet
saveProjectBtn.addEventListener('click', async () => {
    const name = projectNameInput.value.trim();
    const description = projectDescriptionInput.value.trim();

    if (!name) {
        alert("Proje adı boş olamaz.");
        return;
    }

    try {
        await addDoc(collection(db, 'projects'), {
            name,
            description,
            userId: currentUser.uid,
            createdAt: serverTimestamp()
        });
        projectForm.reset();
        projectModal.hide();
    } catch (error) {
        console.error("Proje kaydedilirken hata: ", error);
        alert("Proje kaydedilirken bir hata oluştu.");
    }
});

// Proje Silme Fonksiyonu
window.deleteProject = async (projectId) => {
    if (confirm("Bu projeyi ve içindeki tüm verileri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
        try {
            await deleteDoc(doc(db, 'projects', projectId));
            console.log("Proje başarıyla silindi.");
        } catch (error) {
            console.error("Proje silinirken hata: ", error);
            alert("Proje silinirken bir hata oluştu.");
        }
    }
};
