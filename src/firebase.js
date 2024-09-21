import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyDlnQQAuyIRzu_rphz3FpNAdf4ee-q4YzU",
    authDomain: "autoservicesreact.firebaseapp.com",
    databaseURL: "https://autoservicesreact-default-rtdb.firebaseio.com",
    projectId: "autoservicesreact",
    storageBucket: "autoservicesreact.appspot.com",
    messagingSenderId: "385076818849",
    appId: "1:385076818849:web:ed787b70965c551c5611e0",
    measurementId: "G-9903DWERL1"
  };

const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

// Firebase services
const storage = getStorage(app);
const database = getDatabase(app);

export { storage, database };
