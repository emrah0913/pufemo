// Firebase bağlantısı
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase yapılandırma
const firebaseConfig = {
  apiKey: "AIzaSyDYkzZzNXB22U4oEXxOoPh-puwuE8kz0g4",
  authDomain: "pufemo-com.firebaseapp.com",
  projectId: "pufemo-com",
  storageBucket: "pufemo-com.firebasestorage.app",
  messagingSenderId: "983352837227",
  appId: "1:983352837227:web:defaa8dae215776e2e1d2e",
  measurementId: "G-RH8XHC7P91"
};

// Başlat
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Ürün formunu Firestore'a yaz
const productForm = document.getElementById("product-form");
if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("productTitle").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const imageUrl = document.getElementById("productImage").value.trim();
    const price = parseFloat(document.getElementById("productPrice").value);

    if (!title || !description || !imageUrl || isNaN(price)) {
      alert("Tüm alanları doldurun.");
      return;
    }

    try {
      await addDoc(collection(db, "products"), {
        title,
        description,
        imageUrl,
        price,
        createdAt: new Date()
      });
      alert("✅ Ürün başarıyla eklendi!");
      productForm.reset();
    } catch (error) {
      console.error("❌ Hata:", error);
      alert("Ürün eklenemedi.");
    }
  });
}
