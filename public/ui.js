export const escapeText = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const paths = {
  home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  classes:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 4h2m4 0h2"/>',
  bookings:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 12 3 3 5-6M9 3v3h6V3"/>',
  membership:
    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20m-16 5h4m5 0h3"/>',
  pass: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6M7 7h3v3H7zm7 0h3v3h-3zM7 14h3v3H7zm7 0h3v3h-3z"/>',
  inbox: '<path d="m3 10 14-6v16L3 14zm14-2h4v8h-4M5 15l2 6h4l-2-5"/>',
  account:
    '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/>',
  publish:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7v10m-5-5h10"/>',
  desk: '<path d="M7 3H3v4m14-4h4v4m0 10v4h-4M7 21H3v-4m3-7v4m4-6v8m4-8v8m4-6v4"/>',
  members:
    '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
  dashboard: '<path d="M3 21V3m0 18h18M7 17v-5m5 5V8m5 9V5"/>',
  manage:
    '<path d="m9 4 1-2h4l1 2 3 1 2 3-1 3v2l1 3-2 3-3 1-1 2h-4l-1-2-3-1-2-3 1-3v-2L4 8l2-3z"/><circle cx="12" cy="12" r="3"/>',
  audit: '<path d="M5 3h14v18H5zm3 5h8m-8 4h8m-8 4h5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  bell: '<path d="M5 17h14l-2-4V8a5 5 0 0 0-10 0v5zm5 3h4M12 1v2"/>',
  logout: '<path d="M10 3H3v18h7m4-14 5 5-5 5m-6-5h11"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.account}</svg>`;
export const brand = () =>
  '<a class="brand" href="/"><img src="/just-logo.png" alt="شعار جامعة العلوم والتكنولوجيا الأردنية"><span><strong lang="en">GymPassJUST</strong><small>جامعة العلوم والتكنولوجيا الأردنية</small></span></a>';
export function loginMarkup() {
  return `<main id="main" class="auth-page"><header class="auth-brand">${brand()}</header><section class="auth-card"><div class="auth-intro"><img src="/just-logo.png" alt="" width="88" height="88"><h1>تسجيل الدخول</h1><p>المركز الرياضي · جامعة العلوم والتكنولوجيا الأردنية</p></div><a class="button auth-submit" href="/auth/login">الدخول بالحساب الجامعي</a><p class="field-hint">OIDC محاكاة محلية للتقييم. اختر هوية تجريبية من الصفحة التالية. لا تستخدم حساب الجامعة الحقيقي.</p></section></main>`;
}
export function shellMarkup(session, items, roleNames) {
  const user = session.user;
  const navigationMarkup = () =>
    `<nav class="nav" aria-label="صفحات النظام">${items
      .map(
        ([
          id,
          ,
          label,
        ]) => `<button data-nav="${id}">${icon(id)}<span>${label}</span>
    </button>`,
      )
      .join("")}<button data-nav="account">${icon("account")}<span>حسابي</span>
    </button>
    </nav>`;
  const profileMarkup = () =>
    `<div class="drawer-profile">
    <span class="profile-avatar">${icon("account")}</span>
    <strong>${escapeText(user.name)}</strong>
    <span>${roleNames[user.role]}</span>
    <bdi>${escapeText(user.email)}</bdi>
    </div>`;
  return `<div class="shell">
    <aside class="sidebar">${profileMarkup()}${navigationMarkup()}<button class="drawer-logout" data-action="logout">${icon("logout")} خروج</button>
    <small class="sidebar-version">GymPassJUST · 2.0.0</small>
    </aside>
    <div class="app-body">
    <header class="university-header">${brand()}</header>
    <header class="topbar">
    <button class="top-icon menu-toggle" data-action="open-menu" aria-label="فتح القائمة">${icon("menu")}</button>
    <strong id="page-title">الرئيسية</strong>
    <button class="top-icon" data-nav="inbox" aria-label="الإشعارات">${icon("bell")}<span id="unread">${session.unread || ""}</span>
    </button>
    </header>
    <main class="content" id="main" tabindex="-1">
    </main>
    <nav class="bottom-nav" aria-label="التنقل السريع">
    <button data-nav="home">${icon("home")}<span>الرئيسية</span>
    </button>
    <button data-nav="classes">${icon("inbox")}<span>${user.role === "instructor" ? "حصصي" : "الحصص"}</span>
    </button>
    <button data-nav="inbox">${icon("bell")}<span>الإشعارات</span>
    </button>
    </nav>
    </div>
    </div>
    <dialog class="menu-dialog" id="menu-panel" aria-label="القائمة الجانبية">
    <button class="menu-close" data-action="close-menu" aria-label="إغلاق القائمة">×</button>${profileMarkup()}${navigationMarkup()}<button class="drawer-logout" data-action="logout">${icon("logout")} خروج</button>
    <small class="sidebar-version">GymPassJUST · 2.0.0</small>
    </dialog>`;
}
export function portalMarkup(session, items, roleNames) {
  const role = session.user.role;
  let attendanceButton =
    '<button class="button attendance-button" data-nav="classes">جدول الحصص</button>';
  if (role === "member") {
    attendanceButton =
      '<button class="button attendance-button" data-nav="pass">عرض بطاقة الاشتراك</button>';
  } else if (role === "instructor") {
    attendanceButton =
      '<button class="button attendance-button" data-nav="verify">فحص QR وتسجيل الحضور</button>';
  }
  if (role === "desk")
    attendanceButton =
      '<button class="button" data-nav="gate">بوابة الدخول / Gate entry</button>';
  const labels = {
    gate: "بوابة الدخول / Gate entry",
    attendance: "سجل الحضور / Attendance history",
    classes: role === "instructor" ? "حصصي" : "جدول الحصص",
    membership: "الاشتراكات",
    pass: "بطاقة الاشتراك",
    verify: "فحص QR وتسجيل الحضور",
    bookings: "حجوزاتي",

    inbox: "الإشعارات",

    members: "الأعضاء",
    dashboard: "إحصائيات المركز",
    manage: "الحصص والباقات",
    publish: "نشر حصة جديدة",
    accounts: "إدارة الحسابات",
    audit: "سجل التدقيق",
    account: "معلومات الحساب",
  };
  return `<div class="welcome-line">
    <div>
    <h1>أهلاً، ${escapeText(session.user.name.split(" ")[0])}</h1>
    <p>${roleNames[role]} · خدمات المركز الرياضي</p>
    </div>
    <span class="opening-badge">يومياً <bdi>06:00–23:00</bdi>
    </span>
    </div>
    <section class="service-grid" aria-label="خدمات المركز">${items
      .filter(([id]) => id !== "home")
      .concat([["account", "", "حسابي"]])
      .map(
        ([id, , label]) =>
          `<button class="service-card" data-nav="${id}">${icon(id)}<span>${labels[id] || label}</span>
    </button>`,
      )
      .join("")}</section>${attendanceButton}`;
}
export function classFormMarkup(session, typeNames) {
  return `<section class="panel">
    <h2>نشر حصة جديدة</h2>
    <p class="muted">تظهر الحصة للطلاب مباشرة بعد نشرها. كل المواعيد بتوقيت عمّان.</p>
    <form id="class-form">
    <div class="form-grid">
    <div>
    <label for="title">اسم الحصة</label>
    <input id="title" name="title" required minlength="2" maxlength="100">
    </div>
    <div>
    <label for="type">نوع الحصة</label>
    <select id="type" name="type">${Object.entries(typeNames)
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join("")}</select>
    </div>${
      session.user.role === "manager"
        ? `<div>
    <label for="instructor">المدرب</label>
    <select id="instructor" name="instructorId">${session.instructors.map((instructor) => `<option value="${escapeText(instructor.id)}">${escapeText(instructor.name)}</option>`).join("")}</select>
    </div>`
        : `<div>
    <label>المدرب</label>
    <p class="readonly-value">${escapeText(session.user.name)}</p>
    </div>`
    }<div>
    <label for="studio">القاعة</label>
    <input id="studio" name="studio" required maxlength="100">
    </div>
    <div>
    <label for="starts">التاريخ ووقت البداية</label>
    <input id="starts" name="starts" type="datetime-local" required>
    </div>
    <div>
    <label for="ends">التاريخ ووقت النهاية</label>
    <input id="ends" name="ends" type="datetime-local" required>
    </div>
    <div>
    <label for="capacity">عدد المقاعد</label>
    <input id="capacity" name="capacity" type="number" min="1" max="500" value="20" required>
    </div>
    </div>
    <p id="class-error" role="alert" class="form-error" hidden>
    </p>
    <div class="form-actions">
    <button class="button" type="submit">نشر الحصة</button>
    </div>
    </form>
    </section>`;
}
