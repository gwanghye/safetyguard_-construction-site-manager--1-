import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import 'dotenv/config'; 

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDocs() {
  try {
    let base64Count = 0;
    const logsSnap = await getDocs(collection(db, "logs"));
    for (const doc of logsSnap.docs) {
      const data = doc.data();
      if (data.photos && data.photos.some(p => p.startsWith('data:image'))) base64Count++;
      if (data.action?.photoUrl?.startsWith('data:image')) base64Count++;
      if (data.action?.resolvedPhotos && data.action.resolvedPhotos.some(p => p.startsWith('data:image'))) base64Count++;
    }

    const assessSnap = await getDocs(collection(db, "riskAssessments"));
    for (const doc of assessSnap.docs) {
      const data = doc.data();
      if (data.photos) {
        data.photos.forEach(p => {
          if (p.before?.startsWith('data:image')) base64Count++;
          if (p.after?.startsWith('data:image')) base64Count++;
        });
      }
    }
    console.log(`Remaining Base64 images: ${base64Count}`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDocs();
