import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const ADMIN_EMAIL = "isao5271@gmail.com";
const STATUS_OPTIONS = ["未対応", "返信済み", "日程調整中", "確定", "完了", "キャンセル"];

const firebaseConfig = {
  apiKey: "AIzaSyCLXcCFGgAXiKbrzwAFog67d95Y_Tt_9wA",
  authDomain: "shouhoumon-20260424-214632.firebaseapp.com",
  projectId: "shouhoumon-20260424-214632",
  storageBucket: "shouhoumon-20260424-214632.firebasestorage.app",
  messagingSenderId: "829607892948",
  appId: "1:829607892948:web:026f3398398b5d74ae6841",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const elements = {
  loginView: document.querySelector("[data-login-view]"),
  dashboard: document.querySelector("[data-dashboard]"),
  loginButton: document.querySelector("[data-login-button]"),
  logoutButton: document.querySelector("[data-logout-button]"),
  loginMessage: document.querySelector("[data-login-message]"),
  userEmail: document.querySelector("[data-user-email]"),
  list: document.querySelector("[data-submission-list]"),
  detail: document.querySelector("[data-detail-pane]"),
  filterType: document.querySelector("[data-filter-type]"),
  filterStatus: document.querySelector("[data-filter-status]"),
  filterDate: document.querySelector("[data-filter-date]"),
  sortOrder: document.querySelector("[data-sort-order]"),
  searchInput: document.querySelector("[data-search-input]"),
  countOpen: document.querySelector("[data-count-open]"),
  countToday: document.querySelector("[data-count-today]"),
  countTotal: document.querySelector("[data-count-total]"),
};

let submissions = [];
let selectedId = "";
let unsubscribeSubmissions = null;
let checkedIds = new Set();
let filteredCache = [];

const setLoginMessage = (message) => {
  elements.loginMessage.textContent = message;
};

const showDashboard = (user) => {
  elements.loginView.classList.add("is-hidden");
  elements.dashboard.classList.remove("is-hidden");
  elements.userEmail.textContent = user.email;
};

const showLogin = () => {
  elements.dashboard.classList.add("is-hidden");
  elements.loginView.classList.remove("is-hidden");
  elements.userEmail.textContent = "";
};

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(timestamp.toDate());
};

const isToday = (timestamp) => {
  if (!timestamp?.toDate) return false;
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(timestamp.toDate()) === formatter.format(new Date());
};

const normalizeSearch = (value) => String(value || "").toLowerCase().trim();

const getDateRange = (period) => {
  if (!period) return null;
  const JST = 9 * 60 * 60 * 1000;
  const now = new Date();
  const jst = new Date(now.getTime() + JST);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const d = jst.getUTCDate();
  const dow = jst.getUTCDay();
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(Date.UTC(y, m, d) - JST);

  switch (period) {
    case "today":
      return { start: todayStart, end: new Date(todayStart.getTime() + dayMs) };
    case "yesterday":
      return { start: new Date(todayStart.getTime() - dayMs), end: todayStart };
    case "this-week": {
      const daysFromMon = (dow + 6) % 7;
      return { start: new Date(todayStart.getTime() - daysFromMon * dayMs), end: null };
    }
    case "last-week": {
      const daysFromMon = (dow + 6) % 7;
      const thisWeek = new Date(todayStart.getTime() - daysFromMon * dayMs);
      return { start: new Date(thisWeek.getTime() - 7 * dayMs), end: thisWeek };
    }
    case "this-month":
      return { start: new Date(Date.UTC(y, m, 1) - JST), end: null };
    case "last-month":
      return { start: new Date(Date.UTC(y, m - 1, 1) - JST), end: new Date(Date.UTC(y, m, 1) - JST) };
    case "this-year":
      return { start: new Date(Date.UTC(y, 0, 1) - JST), end: null };
    case "last-year":
      return { start: new Date(Date.UTC(y - 1, 0, 1) - JST), end: new Date(Date.UTC(y, 0, 1) - JST) };
    default:
      return null;
  }
};

const getFilteredSubmissions = () => {
  const type = elements.filterType.value;
  const status = elements.filterStatus.value;
  const search = normalizeSearch(elements.searchInput.value);
  const dateRange = getDateRange(elements.filterDate?.value);
  const ascending = elements.sortOrder?.value === "asc";

  const filtered = submissions.filter((item) => {
    if (type && item.formType !== type) return false;
    if (status && item.status !== status) return false;
    if (dateRange) {
      const ts = item.createdAt?.toDate?.();
      if (!ts || ts < dateRange.start) return false;
      if (dateRange.end && ts >= dateRange.end) return false;
    }
    if (!search) return true;
    return [item.managementId, item.name, item.email, item.phone, item.message]
      .map(normalizeSearch)
      .some((value) => value.includes(search));
  });

  if (ascending) {
    filtered.sort((a, b) => {
      const at = a.createdAt?.toDate?.()?.getTime() ?? 0;
      const bt = b.createdAt?.toDate?.()?.getTime() ?? 0;
      return at - bt;
    });
  }

  return filtered;
};

const updateCounts = () => {
  elements.countOpen.textContent = submissions.filter((item) => item.status === "未対応").length;
  elements.countToday.textContent = submissions.filter((item) => isToday(item.createdAt)).length;
  elements.countTotal.textContent = submissions.length;
};

const renderList = () => {
  updateCounts();
  const filtered = getFilteredSubmissions();
  filteredCache = filtered;

  const checkedInFiltered = filtered.filter((item) => checkedIds.has(item.managementId));

  // List action header (sticky)
  const header = document.createElement("div");
  header.className = "list-actions";

  const selectAllLabel = document.createElement("label");
  selectAllLabel.className = "select-all-label";
  const selectAllCheckbox = document.createElement("input");
  selectAllCheckbox.type = "checkbox";
  selectAllCheckbox.checked = filtered.length > 0 && checkedInFiltered.length === filtered.length;
  selectAllCheckbox.indeterminate = checkedInFiltered.length > 0 && checkedInFiltered.length < filtered.length;
  selectAllCheckbox.addEventListener("change", () => {
    if (selectAllCheckbox.checked) {
      filtered.forEach((item) => checkedIds.add(item.managementId));
    } else {
      filtered.forEach((item) => checkedIds.delete(item.managementId));
    }
    renderList();
  });
  const selectAllText = document.createElement("span");
  selectAllText.textContent = filtered.length ? `全選択（${filtered.length}件）` : "全選択";
  selectAllLabel.appendChild(selectAllCheckbox);
  selectAllLabel.appendChild(selectAllText);

  const deleteButton = document.createElement("button");
  deleteButton.className = "danger-button";
  deleteButton.textContent = checkedInFiltered.length > 0 ? `削除（${checkedInFiltered.length}件）` : "削除";
  deleteButton.disabled = checkedInFiltered.length === 0;
  deleteButton.addEventListener("click", deleteSelected);

  header.appendChild(selectAllLabel);
  header.appendChild(deleteButton);

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.style.padding = "16px";
    empty.textContent = "該当する申込みはありません。";
    elements.list.replaceChildren(header, empty);
    renderDetail();
    return;
  }

  const rows = filtered.map((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "submission-row";

    const checkLabel = document.createElement("label");
    checkLabel.className = "item-check";
    checkLabel.addEventListener("click", (e) => e.stopPropagation());
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checkedIds.has(item.managementId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        checkedIds.add(item.managementId);
      } else {
        checkedIds.delete(item.managementId);
      }
      renderList();
    });
    checkLabel.appendChild(checkbox);

    const button = document.createElement("button");
    button.type = "button";
    button.className = `submission-item${item.managementId === selectedId ? " is-selected" : ""}`;
    button.innerHTML = `
      <div class="item-top">
        <span class="management-id">${item.managementId || ""}</span>
        <span class="status-pill">${item.status || "未対応"}</span>
      </div>
      <div class="submission-name">${item.name || "名前なし"}</div>
      <div class="item-meta">
        <span>${item.typeLabel || ""}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
    `;
    button.addEventListener("click", () => {
      selectedId = item.managementId;
      renderList();
      renderDetail();
    });

    wrapper.appendChild(checkLabel);
    wrapper.appendChild(button);
    return wrapper;
  });

  elements.list.replaceChildren(header, ...rows);

  if (!filtered.some((item) => item.managementId === selectedId)) {
    selectedId = filtered[0].managementId;
    renderList();
    renderDetail();
  }
};

const deleteSelected = async () => {
  const toDelete = filteredCache.filter((item) => checkedIds.has(item.managementId));
  if (!toDelete.length) return;

  if (!confirm(`選択した ${toDelete.length} 件を削除しますか？\nこの操作は元に戻せません。`)) return;

  try {
    await Promise.all(toDelete.map((item) => deleteDoc(doc(db, "submissions", item.managementId))));
    toDelete.forEach((item) => {
      checkedIds.delete(item.managementId);
      if (item.managementId === selectedId) selectedId = "";
    });
  } catch (error) {
    console.error(error);
    alert("削除できませんでした。");
  }
};

const createDetailRow = (label, value) => `
  <dt>${label}</dt>
  <dd>${value || "未入力"}</dd>
`;

const renderDetail = () => {
  const item = submissions.find((submission) => submission.managementId === selectedId);
  if (!item) {
    elements.detail.innerHTML = '<p class="empty-state">左の一覧から申込みを選択してください。</p>';
    return;
  }

  const reserveRows =
    item.formType === "reserve"
      ? [
          createDetailRow("生年月日", item.birthDate),
          createDetailRow("出生時間", item.birthTimeUnknown ? "不明" : item.birthTime),
          createDetailRow("出生地", item.birthPlace),
          createDetailRow("鑑定種別", item.consultationType),
        ].join("")
      : [
          createDetailRow("希望講座", item.courseName),
          createDetailRow("希望時期", item.preferredSchedule),
          createDetailRow("経験", item.learningExperience),
        ].join("");

  elements.detail.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">${item.typeLabel || ""}</p>
        <h2>${item.managementId}</h2>
        <p>${formatDate(item.createdAt)}</p>
      </div>
      <span class="status-pill">${item.status || "未対応"}</span>
    </div>
    <dl class="detail-grid">
      ${createDetailRow("お名前", item.name)}
      ${createDetailRow("メール", item.email)}
      ${createDetailRow("電話番号", item.phone)}
      ${reserveRows}
    </dl>
    <h3>内容</h3>
    <div class="message-box">${item.message || "未入力"}</div>
    <form class="admin-form" data-admin-form>
      <label>
        <span>対応状況</span>
        <select name="status">
          ${STATUS_OPTIONS.map((status) => `<option value="${status}"${status === item.status ? " selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>管理メモ</span>
        <textarea name="adminMemo" maxlength="4000">${item.adminMemo || ""}</textarea>
      </label>
      <div class="save-row">
        <button class="primary-button" type="submit">保存</button>
        <span class="save-message" data-save-message></span>
      </div>
    </form>
  `;

  elements.detail.querySelector("[data-admin-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const saveMessage = form.querySelector("[data-save-message]");
    const submitButton = form.querySelector("button");
    submitButton.disabled = true;
    saveMessage.textContent = "保存中...";

    try {
      await updateDoc(doc(db, "submissions", item.managementId), {
        status: form.elements.status.value,
        adminMemo: form.elements.adminMemo.value.trim(),
        updatedAt: serverTimestamp(),
      });
      saveMessage.textContent = "保存しました。";
    } catch (error) {
      console.error(error);
      saveMessage.textContent = "保存できませんでした。";
    } finally {
      submitButton.disabled = false;
    }
  });
};

const subscribeSubmissions = () => {
  if (unsubscribeSubmissions) unsubscribeSubmissions();

  const submissionsQuery = query(collection(db, "submissions"), orderBy("createdAt", "desc"), limit(200));
  unsubscribeSubmissions = onSnapshot(
    submissionsQuery,
    (snapshot) => {
      submissions = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));
      if (!selectedId && submissions.length) selectedId = submissions[0].managementId;
      renderList();
      renderDetail();
    },
    (error) => {
      console.error(error);
      elements.list.innerHTML = '<p class="empty-state" style="padding: 16px;">申込みを読み込めませんでした。</p>';
    }
  );
};

elements.loginButton.addEventListener("click", async () => {
  setLoginMessage("");
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    setLoginMessage("ログインできませんでした。Firebase AuthenticationでGoogleログインが有効か確認してください。");
  }
});

elements.logoutButton.addEventListener("click", () => {
  signOut(auth);
});

[elements.filterType, elements.filterStatus, elements.filterDate, elements.sortOrder, elements.searchInput].forEach((element) => {
  if (!element) return;
  element.addEventListener("input", renderList);
  element.addEventListener("change", renderList);
});

onAuthStateChanged(auth, (user) => {
  if (unsubscribeSubmissions) {
    unsubscribeSubmissions();
    unsubscribeSubmissions = null;
  }

  if (!user) {
    showLogin();
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    showLogin();
    setLoginMessage("このGoogleアカウントには管理画面の権限がありません。");
    signOut(auth);
    return;
  }

  showDashboard(user);
  subscribeSubmissions();
});
