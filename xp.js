// VANTA XP SYSTEM
// Firebase Firestore

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();


// ================================
// XP SETTINGS
// ================================

const XP_PER_CORRECT_ANSWER = 10;
const XP_PER_LESSON = 50;
const XP_PER_QUIZ = 100;


// ================================
// GET USER DATA
// ================================

export async function getXPData() {

  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {

    const initialData = {
      xp: 0,
      level: 1,
      lessonsCompleted: 0,
      quizzesCompleted: 0,
      correctAnswers: 0
    };

    await setDoc(ref, initialData);

    return initialData;
  }

  return snapshot.data();
}


// ================================
// CALCULATE LEVEL
// ================================

export function calculateLevel(xp) {

  xp = Math.max(0, Number(xp) || 0);

  // كل مستوى يحتاج XP أكثر تدريجيًا
  let level = 1;
  let requiredXP = 100;
  let remainingXP = xp;

  while (remainingXP >= requiredXP) {

    remainingXP -= requiredXP;
    level++;

    requiredXP =
      Math.floor(100 * Math.pow(level, 1.15));
  }

  return level;
}


// ================================
// XP REQUIRED FOR NEXT LEVEL
// ================================

export function getLevelInfo(xp) {

  xp = Math.max(0, Number(xp) || 0);

  let level = 1;
  let remainingXP = xp;
  let requiredXP = 100;

  while (remainingXP >= requiredXP) {

    remainingXP -= requiredXP;
    level++;

    requiredXP =
      Math.floor(100 * Math.pow(level, 1.15));
  }

  return {

    level,

    currentXP: xp,

    xpIntoLevel: remainingXP,

    xpForLevel: requiredXP,

    xpToNextLevel:
      requiredXP - remainingXP,

    progress:
      Math.min(
        100,
        Math.floor(
          (remainingXP / requiredXP) * 100
        )
      )
  };
}


// ================================
// ADD XP
// ================================

export async function addXP(amount, reason = "activity") {

  const user = auth.currentUser;

  if (!user) {
    throw new Error("User is not logged in.");
  }

  amount = Number(amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid XP amount.");
  }

  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);

  let data;

  if (!snapshot.exists()) {

    data = {
      xp: 0,
      level: 1,
      lessonsCompleted: 0,
      quizzesCompleted: 0,
      correctAnswers: 0
    };

    await setDoc(ref, data);

  } else {

    data = snapshot.data();
  }

  const oldXP =
    Number(data.xp) || 0;

  const newXP =
    oldXP + amount;

  const oldLevel =
    calculateLevel(oldXP);

  const newLevel =
    calculateLevel(newXP);

  await updateDoc(ref, {

    xp: newXP,

    level: newLevel,

    lastXPReason: reason,

    lastXPAmount: amount,

    lastXPAt: new Date().toISOString()
  });

  return {

    xp: newXP,

    level: newLevel,

    gained: amount,

    reason,

    levelUp:
      newLevel > oldLevel
  };
}


// ================================
// CORRECT ANSWER
// ================================

export async function rewardCorrectAnswer() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref =
    doc(db, "users", user.uid);

  const snapshot =
    await getDoc(ref);

  const data =
    snapshot.exists()
      ? snapshot.data()
      : {};

  await updateDoc(ref, {

    correctAnswers:
      (Number(data.correctAnswers) || 0) + 1
  });

  return addXP(
    XP_PER_CORRECT_ANSWER,
    "correct_answer"
  );
}


// ================================
// LESSON COMPLETED
// ================================

export async function rewardLessonCompleted() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref =
    doc(db, "users", user.uid);

  const snapshot =
    await getDoc(ref);

  const data =
    snapshot.exists()
      ? snapshot.data()
      : {};

  await updateDoc(ref, {

    lessonsCompleted:
      (Number(data.lessonsCompleted) || 0) + 1
  });

  return addXP(
    XP_PER_LESSON,
    "lesson_completed"
  );
}


// ================================
// QUIZ COMPLETED
// ================================

export async function rewardQuizCompleted() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref =
    doc(db, "users", user.uid);

  const snapshot =
    await getDoc(ref);

  const data =
    snapshot.exists()
      ? snapshot.data()
      : {};

  await updateDoc(ref, {

    quizzesCompleted:
      (Number(data.quizzesCompleted) || 0) + 1
  });

  return addXP(
    XP_PER_QUIZ,
    "quiz_completed"
  );
}
