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
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
function addMemo(text) {
  addDoc(memosCol, {
    text: text,
    createdAt: Date.now()
  }).catch(function (err) {
    console.error("메모를 저장하지 못했습니다.", err);
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
function deleteMemo(id) {
  deleteDoc(doc(db, "memos", id)).catch(function (err) {
    console.error("메모를 지우지 못했습니다.", err);
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
    if (text === "") return;

    // Firestore에 저장되면 onSnapshot이 자동으로 다시 그려 줍니다.
    addMemo(text);
    input.value = "";
  }
};


// 첫 화면 그리기
render();
input.focus();
