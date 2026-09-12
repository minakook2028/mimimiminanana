// ===================================================
// 우리 반 담벼락 - 시작점
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// 데이터는 Firestore의 "memos" 컬렉션에 저장되어,
// 새로고침해도 그대로 남아 있습니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase 콘솔 > 프로젝트 설정 > 일반 에서 발급받은 값입니다.
const firebaseConfig = {
  apiKey: "AIzaSyBgdaqMCd1ClMlkaRGhaiO7agtDHSF_E6I",
  authDomain: "miminanana-fd4cb.firebaseapp.com",
  projectId: "miminanana-fd4cb",
  storageBucket: "miminanana-fd4cb.firebasestorage.app",
  messagingSenderId: "448897742863",
  appId: "1:448897742863:web:e2dbb938bb5059b4644b7a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const memosCol = collection(db, "memos");


// ===================================================
// 구글 로그인
// 로그인/로그아웃 버튼을 #userArea에 그립니다.
// ===================================================

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;

const userArea = document.getElementById("userArea");

function renderUserArea() {
  userArea.innerHTML = "";

  if (currentUser) {
    const name = document.createElement("span");
    name.textContent = currentUser.displayName + "님";
    userArea.appendChild(name);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.onclick = function () {
      signOut(auth);
    };
    userArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "구글로 로그인";
    loginBtn.onclick = function () {
      signInWithPopup(auth, googleProvider).catch(function (err) {
        console.error("로그인에 실패했습니다.", err);
      });
    };
    userArea.appendChild(loginBtn);
  }
}

onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
  refreshTeacherStatus();
});


// --- 교사 여부 확인 ---
// roles/{uid} 문서의 role 필드가 "teacher"면 교사로 취급합니다.
// (Firestore 규칙에서도 같은 방식으로 교사 여부를 확인합니다.)
let isTeacher = false;

function refreshTeacherStatus() {
  if (!currentUser) {
    isTeacher = false;
    render();
    return;
  }

  getDoc(doc(db, "roles", currentUser.uid))
    .then(function (snap) {
      isTeacher = snap.exists() && snap.data().role === "teacher";
      render();
    })
    .catch(function (err) {
      console.error("교사 여부를 확인하지 못했습니다.", err);
      isTeacher = false;
      render();
    });
}


// --- 메모 목록 ---
// createdAt 은 메모를 쓴 시각(밀리초)입니다. 이 값으로 순서를 정합니다.
// 아래 onSnapshot이 Firestore와 실시간으로 동기화하며 이 배열을 채웁니다.
let memos = [];

const memosQuery = query(memosCol, orderBy("createdAt"));
onSnapshot(memosQuery, function (snapshot) {
  memos = snapshot.docs.map(function (docSnap) {
    return Object.assign({ id: docSnap.id }, docSnap.data());
  });
  render();
});


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore를 쓰는 코드입니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore 쿼리(orderBy("createdAt"))가 이미 순서를 맞춰 주므로 그대로 반환합니다.
function loadMemos() {
  return memos;
}

// 메모를 새로 씁니다.
// 누가 썼는지 알 수 있도록 로그인한 사용자의 uid를 함께 저장합니다.
function addMemo(text) {
  if (text.trim().length < 5) return;
  if (!currentUser) {
    console.error("로그인 후에 메모를 쓸 수 있습니다.");
    return;
  }

  addDoc(memosCol, {
    text: text,
    uid: currentUser.uid,
    createdAt: Date.now()
  }).catch(function (err) {
    console.error("메모를 저장하지 못했습니다.", err);
  });
}

// 메모를 지웁니다.
// 본인 메모가 아니거나 교사가 아니면 Firestore 규칙이 막아 줍니다.
function deleteMemo(id) {
  deleteDoc(doc(db, "memos", id)).catch(function (err) {
    console.error("메모를 지우지 못했습니다.", err);
  });
}

// 교사가 버튼을 누르면 Gemini에게 이 메모에 대한 코멘트를 요청하고,
// 결과를 memo 문서의 aiComment 필드에 저장합니다.
function addAiComment(memo) {
  askGemini(memo.text)
    .then(function (comment) {
      return updateDoc(doc(db, "memos", memo.id), { aiComment: comment });
    })
    .catch(function (err) {
      console.error("AI 댓글을 생성하지 못했습니다.", err);
      alert("AI 댓글을 만들지 못했습니다. 콘솔(F12)을 확인해 주세요.");
    });
}

// Vercel 서버리스 함수(/api/gemini)를 통해 Gemini에게 코멘트를 요청합니다.
// API 키는 서버(api/gemini.js)에만 있고, 브라우저에는 노출되지 않습니다.
function askGemini(memoText) {
  return fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: memoText })
  })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Gemini 서버 요청이 실패했습니다. (status " + res.status + ")");
      }
      return res.json();
    })
    .then(function (data) {
      return data.comment;
    });
}


// ===================================================
// 화면 그리기
// ===================================================

function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  loadMemos().forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  const del = document.createElement("button");
  del.textContent = "×";
  del.onclick = function () {
    // Firestore에서 지워지면 onSnapshot이 자동으로 다시 그려 줍니다.
    deleteMemo(memo.id);
  };
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  if (memo.aiComment) {
    const ai = document.createElement("div");
    ai.className = "ai-comment";
    ai.textContent = "🤖 " + memo.aiComment;
    div.appendChild(ai);
  }

  if (isTeacher) {
    const aiBtn = document.createElement("button");
    aiBtn.className = "ai-btn";
    aiBtn.textContent = "AI 댓글";
    aiBtn.onclick = function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "생성 중…";
      addAiComment(memo);
    };
    div.appendChild(aiBtn);
  }

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.onkeydown = function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text.length < 5) return;

    // Firestore에 저장되면 onSnapshot이 자동으로 다시 그려 줍니다.
    addMemo(text);
    input.value = "";
  }
};


// 첫 화면 그리기
render();
input.focus();
