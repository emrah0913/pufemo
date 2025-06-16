// Firebase yapılandırması ve başlatma
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔧 Kendi firebaseConfig bilgilerinle değiştir
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "XXXXXXXXXX",
  appId: "APP_ID"
};

// Başlat
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Ürün ekleme formu
const productForm = document.getElementById("product-form");
if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("productTitle").value;
    const description = document.getElementById("productDescription").value;
    const imageUrl = document.getElementById("productImage").value;
    const price = parseFloat(document.getElementById("productPrice").value);

    try {
      await addDoc(collection(db, "products"), {
        title,
        description,
        imageUrl,
        price,
        createdAt: new Date()
      });
      alert("Ürün başarıyla eklendi!");
      productForm.reset();
    } catch (error) {
      console.error("Hata:", error);
      alert("Bir hata oluştu.");
    }
  });
}
