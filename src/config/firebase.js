import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD6zRLO0tFMxsY7Ywf7OxDegGlt85DQyFE",
  authDomain: "omg-clinic.firebaseapp.com",
  databaseURL: "https://omg-clinic-default-rtdb.firebaseio.com",
  projectId: "omg-clinic",
  storageBucket: "omg-clinic.firebasestorage.app",
  messagingSenderId: "1070920920868",
  appId: "1:1070920920868:web:1ee0b1845fa94c6ad38db1",
  measurementId: "G-VW2GGHV63S",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);

export default app;