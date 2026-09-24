// VANTA XP SYSTEM
// Firebase Compat

const db = firebase.firestore();
const auth = firebase.auth();


// ================================
// XP SETTINGS
// ================================

const XP_REWARDS = {
  correctAnswer: 10,
  lessonCompleted: 50,
  quizCompleted: 100,
  labCompleted: 75,
  challengeCompleted: 30
};


// ================================
// LEVEL SYSTEM
// ================================

function calculateLevel(xp) {
  xp = Math.max(0, Number(xp) || 0);

  let level = 1;
  let required = 100;
  let remaining = xp;

  while (remaining >= required && level < 100) {
    remaining -= required;
    level++;

    required = Math.floor(
      100 * Math.pow(level, 1.15)
    );
  }

  return level;
}


// ================================
// LEVEL INFORMATION
// ================================

function getLevelInfo(xp) {
  xp = Math.max(0, Number(xp) || 0);

  let level = 1;
  let required = 100;
  let remaining = xp;

  while (remaining >= required && level < 100) {
    remaining -= required;
    level++;

    required = Math.floor(
      100 * Math.pow(level, 1.15)
    );
  }

  return {
    level: level,
    xp: xp,
    xpIntoLevel: remaining,
    xpForLevel: required,
    xpToNextLevel: required - remaining,
    progress: Math.floor(
      (remaining / required) * 100
    )
  };
}


// ================================
// GET USER XP
// ================================

async function getXPData() {

  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  const ref = db
    .collection("users")
    .doc(user.uid);

  const snapshot = await ref.get();

  if (!snapshot.exists) {

    const data = {
      xp: 0,
      level: 1,
      lessonsCompleted: 0,
      quizzesCompleted: 0,
      correctAnswers: 0,
      labsCompleted: 0,
      challengesCompleted: 0,
      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    };

    await ref.set(data);

    return data;
  }

  const data = snapshot.data();

  return {
    xp: Number(data.xp) || 0,
    level: Number(data.level) || 1,
    lessonsCompleted:
      Number(data.lessonsCompleted) || 0,
    quizzesCompleted:
      Number(data.quizzesCompleted) || 0,
    correctAnswers:
      Number(data.correctAnswers) || 0,
    labsCompleted:
      Number(data.labsCompleted) || 0,
    challengesCompleted:
      Number(data.challengesCompleted) || 0
  };
}


// ================================
// ADD XP
// ================================

async function addXP(amount, reason = "activity") {

  const user = auth.currentUser;

  if (!user) {
    throw new Error("User is not logged in.");
  }

  amount = Number(amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error("Invalid XP amount.");
  }

  const ref = db
    .collection("users")
    .doc(user.uid);

  const snapshot = await ref.get();

  const oldData =
    snapshot.exists
      ? snapshot.data()
      : {};

  const oldXP =
    Number(oldData.xp) || 0;

  const newXP =
    oldXP + amount;

  const oldLevel =
    calculateLevel(oldXP);

  const newLevel =
    calculateLevel(newXP);

  await ref.set(
    {
      xp: newXP,
      level: newLevel,

      lastXPAmount: amount,
      lastXPReason: reason,

      lastXPAt:
        firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      merge: true
    }
  );

  return {
    gained: amount,
    xp: newXP,
    level: newLevel,

    levelUp:
      newLevel > oldLevel
  };
}


// ================================
// CORRECT ANSWER
// ================================

async function rewardCorrectAnswer() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref = db
    .collection("users")
    .doc(user.uid);

  await ref.set(
    {
      correctAnswers:
        firebase.firestore.FieldValue.increment(1)
    },
    {
      merge: true
    }
  );

  return addXP(
    XP_REWARDS.correctAnswer,
    "correct_answer"
  );
}


// ================================
// LESSON COMPLETED
// ================================

async function rewardLessonCompleted() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref = db
    .collection("users")
    .doc(user.uid);

  await ref.set(
    {
      lessonsCompleted:
        firebase.firestore.FieldValue.increment(1)
    },
    {
      merge: true
    }
  );

  return addXP(
    XP_REWARDS.lessonCompleted,
    "lesson_completed"
  );
}


// ================================
// QUIZ COMPLETED
// ================================

async function rewardQuizCompleted() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref = db
    .collection("users")
    .doc(user.uid);

  await ref.set(
    {
      quizzesCompleted:
        firebase.firestore.FieldValue.increment(1)
    },
    {
      merge: true
    }
  );

  return addXP(
    XP_REWARDS.quizCompleted,
    "quiz_completed"
  );
}


// ================================
// LAB COMPLETED
// ================================

async function rewardLabCompleted() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref = db
    .collection("users")
    .doc(user.uid);

  await ref.set(
    {
      labsCompleted:
        firebase.firestore.FieldValue.increment(1)
    },
    {
      merge: true
    }
  );

  return addXP(
    XP_REWARDS.labCompleted,
    "lab_completed"
  );
}


// ================================
// CHALLENGE COMPLETED
// ================================

async function rewardChallengeCompleted() {

  const user = auth.currentUser;

  if (!user) return null;

  const ref = db
    .collection("users")
    .doc(user.uid);

  await ref.set(
    {
      challengesCompleted:
        firebase.firestore.FieldValue.increment(1)
    },
    {
      merge: true
    }
  );

  return addXP(
    XP_REWARDS.challengeCompleted,
    "challenge_completed"
  );
}


// ================================
// GLOBAL VANTA API
// ================================

window.VANTA_XP = {

  getXPData,

  addXP,

  calculateLevel,

  getLevelInfo,

  rewardCorrectAnswer,

  rewardLessonCompleted,

  rewardQuizCompleted,

  rewardLabCompleted,

  rewardChallengeCompleted

};
