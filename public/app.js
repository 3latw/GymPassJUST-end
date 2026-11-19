import { classTypeNames as typeNames } from "/class-types.js";
import { installLanguageSwitcher } from "/i18n.js";
import {
  icon,
  escapeText as escape,
  loginMarkup,
  shellMarkup,
  portalMarkup,
  classFormMarkup,
} from "/ui.js";
installLanguageSwitcher();
const root = document.querySelector("#root");
const modal = document.querySelector("#modal");
const modalBody = document.querySelector("#modal-body");
const roleNames = {
  desk: "موظف الاستقبال",
  member: "طالب",
  instructor: "مدرب الحصص",
  manager: "مدير المركز",
};
const stateNames = {
  confirmed: "مؤكد",
  checked_in: "تم تسجيل الحضور",
  attended: "حضر",
  no_show: "غائب",
  waitlisted: "قائمة الانتظار",
  cancelled: "ملغى",
  not_promoted: "انتهى الانتظار",
};
const errors = {
  ALREADY_SUBSCRIBED:
    "أنت مشترك بالفعل في هذه الباقة. يمكنك الاشتراك مجدداً بعد انتهائها.",
  NOT_BOOKED: "الطالب غير مسجّل بحجز مؤكد في هذه الحصة.",
  INVALID_LOGIN: "الإيميل أو كلمة المرور غير صحيحة.",
  INVALID_ACCOUNT: "تأكد من الاسم والبريد الإلكتروني.",
  WEAK_PASSWORD: "كلمة المرور لازم تكون من 12 إلى 128 حرفاً.",
  EMAIL_EXISTS: "هذا الإيميل مسجّل مسبقاً. جرّب تسجيل الدخول.",
  INVALID_CLASS:
    "تأكد من بيانات الحصة. الموعد لازم يكون بالمستقبل والمدة أقل من 4 ساعات.",
  BOOKING_WINDOW: "يفتح الحجز قبل موعد الحصة بـ48 ساعة.",
  MEMBERSHIP_REQUIRED: "تحتاج عضوية فعالة تشمل هذه الحصة وتغطي مدتها.",
  SUSPENDED: "حجز الحصص موقوف مؤقتاً لهذا الحساب.",
  DUPLICATE: "عندك حجز سابق لهذه الحصة.",
  OVERLAP: "يوجد تعارض في الوقت مع حجز أو موعد آخر.",
  CANCELLATION_CUTOFF: "يمكن الإلغاء قبل الحصة بساعتين على الأقل.",
  CLASS_CLOSED: "الحجز لهذه الحصة مغلق.",
  CLASS_STARTED: "بدأت الحصة ولا يمكن إلغاؤها.",
  CLASS_ENDED: "انتهت الحصة ولا يمكن إلغاؤها.",
  CHECKIN_WINDOW:
    "تسجيل الحضور خلال أول عشر دقائق، أو عشر دقائق بعد ترقية الانتظار.",
  INVALID_STATE: "لا يمكن تنفيذ العملية على حالة الحجز الحالية.",
  FORBIDDEN: "هذه العملية غير متاحة لحسابك.",
  REPLAY: "تم استخدام الرمز. انتظر ظهور الرمز الجديد.",
  EXPIRED_TOKEN:
    "انتهت صلاحية QR. افتح بطاقة الطالب أو حدّثها، ثم امسح الرمز الجديد.",
  INVALID_TOKEN: "الرمز غير صحيح.",
  REASON_REQUIRED: "اكتب سبباً واضحاً من 5 أحرف على الأقل.",
  NOT_FOUND: "لم يتم العثور على السجل المطلوب.",
  CSRF: "انتهت صلاحية الطلب. حدّث الصفحة وحاول مرة ثانية.",
  RATE_LIMIT: "طلبات كثيرة. انتظر دقيقة وحاول مجدداً.",
};
let session = null;
let view = "home";
let authMode = "oidc";
let classPage = 1;
let classFilter = "";
let listPage = 1;
let offset = 0;
let refreshTimer;
let passExpiresAt = 0;
let toastTimer;
let cameraStream;
let cameraFrame;
const now = () => Date.now() + offset;
const date = (time, options = {}) =>
  new Intl.DateTimeFormat("ar-JO", {
    timeZone: "Asia/Amman",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(time));
const time = (t) =>
  date(t, {
    month: undefined,
    day: undefined,
    hour: "numeric",
    minute: "2-digit",
  });
const money = (cents) =>
  (cents / 100).toLocaleString("ar-JO", { maximumFractionDigits: 2 }) + " د.أ";
const button = (text, action, id = "", style = "") =>
  `<button class="button ${style}" data-action="${action}" data-id="${escape(id)}">${text}</button>`;
function badge(state) {
  let style = "neutral";
  if (state === "waitlisted") {
    style = "warn";
  } else if (state === "no_show" || state === "cancelled") {
    style = "error";
  }
  return `<span class="badge ${style}">${escape(stateNames[state] || state)}</span>`;
}
function toast(message, error = false) {
  const toastElement = document.querySelector("#toast");
  toastElement.textContent = message;
  toastElement.className = error ? "error" : "";
  toastElement.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastElement.hidden = true), 6500);
}
async function api(path, options = {}) {
  const { headers = {}, ...rest } = options;
  const response = await fetch("/api" + path, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(session ? { "x-csrf-token": session.csrf } : {}),
      ...headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("تعذر قراءة استجابة الخادم. حاول مجدداً.");
  }
  if (!response.ok) {
    if (response.status === 401) {
      session = null;
      login();
    }
    const error = new Error(
      errors[data.error?.code] || data.error?.message || "تعذر إكمال الطلب.",
    );
    error.code = data.error?.code;
    throw error;
  }
  return data;
}
const post = (path, data = {}, headers = {}) =>
  api(path, { method: "POST", body: JSON.stringify(data), headers });
function login() {
  document.title =
    (location.pathname === "/register" ? "إنشاء حساب" : "تسجيل الدخول") +
    " | GymPassJUST";
  root.innerHTML = loginMarkup(
    location.pathname === "/register",
    authMode === "oidc",
  );
  window.scrollTo(0, 0);
}
function navItems() {
  const common = [["home", "", "الرئيسية"]];
  const byRole = {
    desk: [
      ["gate", "", "بوابة الدخول / Gate entry"],
      ["members", "", "الأعضاء / Members"],
      ["inbox", "", "الإشعارات / Notifications"],
    ],
    member: [
      ["classes", "", "جدول الحصص"],
      ["membership", "", "الاشتراكات"],
      ["attendance", "", "Attendance history / سجل الحضور"],
      ["bookings", "", "حجوزاتي"],
      ["pass", "", "بطاقة الاشتراك"],
      ["inbox", "", "الإشعارات"],
    ],
    instructor: [
      ["classes", "", "حصصي"],
      ["verify", "", "فحص QR وتسجيل الحضور"],

      ["inbox", "", "الإشعارات"],
    ],
    manager: [
      ["dashboard", "", "إحصائيات المركز"],
      ["classes", "", "جدول الحصص"],
      ["manage", "", "الحصص والباقات"],

      ["members", "", "الأعضاء"],
      ["audit", "", "سجل التدقيق"],
    ],
  };
  return common.concat(byRole[session.user.role] || []);
}
function shell() {
  root.innerHTML = shellMarkup(session, navItems(), roleNames);
}
function pagePath() {
  if (view === "account") {
    return "/account";
  }

  const prefix = {
    desk: "desk",
    member: "student",
    instructor: "instructor",
    manager: "manager",
  }[session.user.role];
  if (view === "home") {
    return "/" + prefix;
  }
  return "/" + prefix + "/" + view;
}
function locationView() {
  if (location.pathname === "/account") {
    return "account";
  }

  const candidate = location.pathname.split("/")[2] || "home";
  const availablePages = navItems().map(([id]) => id);
  availablePages.push("account", "inbox");
  if (availablePages.includes(candidate)) {
    return candidate;
  }
  return "home";
}
async function enterApp() {
  session = await api("/bootstrap");
  offset = session.now - Date.now();
  view = locationView();
  shell();
  history.replaceState({}, "", pagePath());
  await render();
  window.scrollTo(0, 0);
}
window.addEventListener("popstate", () => {
  if (session) {
    view = locationView();
    render();
  } else {
    login();
  }
});

const heading = (title, subtitle, extra = "") =>
  `<header class="page-heading">
    <div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    </div>${extra}</header>`;
const empty = (title, text) =>
  `<div class="empty">
    <h2>${title}</h2>
    <p>${text}</p>
    </div>`;
const stat = (label, value, note) =>
  `<div class="stat">
    <small>${label}</small>
    <strong>${escape(value)}</strong>
    <small>${note}</small>
    </div>`;
function classCard(gymClass) {
  const isStudent = session.user.role === "member";
  const bookingOpen =
    gymClass.state === "published" &&
    now() >= gymClass.starts - 48 * 3600000 &&
    now() < gymClass.starts;
  const alreadyBooked = ["confirmed", "waitlisted", "checked_in"].includes(
    gymClass.myState,
  );
  let action = "";

  if (isStudent) {
    if (alreadyBooked) {
      action = badge(gymClass.myState);
    } else if (bookingOpen || gymClass.myState) {
      const label =
        gymClass.booked >= gymClass.capacity ? "انضم للانتظار" : "احجز مكانك";
      action = button(
        label,
        "book",
        gymClass.id,
        bookingOpen ? "small" : "small secondary",
      );
    }
  } else if (["manager", "instructor"].includes(session.user.role)) {
    action = button(
      "المسجلون والتفاصيل",
      "roster",
      gymClass.id,
      "small secondary",
    );
  }

  let status = "";
  if (gymClass.state === "cancelled") {
    status = '<span class="badge error">الحصة ملغاة</span>';
    action = "";
  } else if (!bookingOpen && isStudent) {
    let message = "بدأت الحصة";
    if (now() < gymClass.starts) {
      const opensAt = gymClass.starts - 48 * 3600000;
      message = "يفتح الحجز " + date(opensAt) + " " + time(opensAt);
    }
    status = "<small>" + message + "</small>";
  }

  const artLabels = {
    strength: "POWER",
    yoga: "FLOW",
    fitness: "MOVE",
    swimming: "SWIM",
    cardio: "CARDIO",
    weightlifting: "LIFT",
    team_sports: "TEAM",
  };
  const duration = Math.round((gymClass.ends - gymClass.starts) / 60000);
  const waiting = gymClass.waiting ? " · انتظار " + gymClass.waiting : "";
  return `<article class="class-card">
    <div class="class-art ${escape(gymClass.type)}" aria-hidden="true">
      <span class="art-label">${artLabels[gymClass.type]}</span>
    </div>
    <div class="class-info">
      <small>${date(gymClass.starts, { weekday: "long" })} · ${time(gymClass.starts)}</small>
      <h3>${escape(gymClass.title)}</h3>
      <div class="class-meta">
        <span>${escape(gymClass.instructor)}</span>
        <span>${escape(gymClass.studio)}</span>
        <span>${duration} دقيقة</span>
      </div>
      ${status}
      <div class="class-bottom">
        <small>${gymClass.booked} / ${gymClass.capacity} مقعد${waiting}</small>
        ${action}
      </div>
    </div>
  </article>`;
}
function pager(pagination, target) {
  if (pagination.totalPages <= 1) {
    return "";
  }

  let previousButton = "";
  let nextButton = "";
  if (pagination.page > 1) {
    previousButton = button(
      "السابق",
      target,
      pagination.page - 1,
      "secondary small",
    );
  }
  if (pagination.page < pagination.totalPages) {
    nextButton = button(
      "التالي",
      target,
      pagination.page + 1,
      "secondary small",
    );
  }

  return `<div class="pagination">${previousButton}<span>صفحة ${pagination.page} من ${pagination.totalPages}</span>${nextButton}</div>`;
}
async function home() {
  return portalMarkup(session, navItems(), roleNames);
}
function publishView() {
  return (
    heading("نشر حصة جديدة", "حدد تفاصيل حصتك وموعدها للطلاب.") +
    classFormMarkup(session, typeNames)
  );
}

function accountView() {
  return (
    heading(
      "University account / الحساب الجامعي",
      "OIDC test provider / مزود هوية تجريبي",
    ) +
    `<section class="panel"><h2>${escape(session.user.name)}</h2><p><bdi>${escape(session.user.email)}</bdi></p><p>${escape(roleNames[session.user.role])}</p><p>Managed by the identity provider. No password is stored in GymPassJUST.</p></section>`
  );
}

async function classesView() {
  const result = await api(
    "/classes?page=" + classPage + (classFilter ? "&type=" + classFilter : ""),
  );
  return (
    heading(
      session.user.role === "instructor" ? "حصصك" : "جدول الحصص",
      "كل المواعيد بتوقيت عمّان. الحجز متاح قبل الحصة بـ48 ساعة.",
      session.user.role === "manager"
        ? '<button class="button" data-nav="publish">نشر حصة جديدة</button>'
        : "",
    ) +
    `<div class="filters">
    <div>
    <label for="class-type">نوع الحصة</label>
    <select id="class-type">
    <option value="">كل الأنواع</option>${Object.entries(typeNames)
      .map(
        ([key, label]) =>
          `<option value="${key}" ${key === classFilter ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select>
    </div>
    <div>
    <strong>الحجوزات</strong>
    <p class="muted">${result.pagination.totalItems} حصة ضمن الجدول</p>
    </div>
    </div>
    <h2 class="sr-only">الحصص المتاحة</h2>
    <section class="class-list">${result.data.map(classCard).join("")}</section>${result.data.length ? "" : empty("ما في حصص بهالتصنيف", "جرّب نوع حصة آخر.")}${pager(result.pagination, "class-page")}`
  );
}
async function bookingsView() {
  const bookings = await api("/bookings");
  const title = heading(
    "حجوزاتي",
    "الحضور يُسجّل بمسح QR عند المدرب أثناء الحصة. عدم المسح يُحسب غياباً بعد نهايتها.",
  );
  if (bookings.length === 0) {
    return (
      title + empty("لسه ما عندك حجوزات", "روح لجدول الحصص واحجز أول تمرين.")
    );
  }

  const rows = bookings.map((booking) => {
    // الإلغاء متاح للحجز المؤكد أو الانتظار قبل الحصة بساعتين.
    const canCancel =
      ["confirmed", "waitlisted"].includes(booking.state) &&
      booking.starts - now() >= 2 * 3600000;
    let action = "—";
    if (canCancel) {
      action = button("إلغاء الحجز", "cancel", booking.id, "danger small");
    }
    let waitingPosition = "";
    if (booking.position) {
      waitingPosition = "<br>ترتيبك " + booking.position;
    }

    return `<tr>
    <td>${escape(booking.title)}<br>
    <small>${escape(booking.instructor)} · ${escape(booking.studio)}</small>
    </td>
    <td>${date(booking.starts)}<br>${time(booking.starts)}</td>
    <td>${badge(booking.state)}${waitingPosition}</td>
    <td>${action}</td>
    </tr>`;
  });

  return (
    title +
    `<div class="table-wrap">
    <table>
    <thead>
    <tr>
    <th>الحصة</th>
    <th>الموعد</th>
    <th>الحالة</th>
    <th>الإجراء</th>
    </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
    </table>
    </div>`
  );
}
async function membershipView() {
  const [plans, history] = await Promise.all([
    api("/plans"),
    api("/memberships"),
  ]);
  return (
    heading(
      "عضويتك بالمركز",
      "اختَر الباقة المناسبة. الدفع في نسخة المشروع محاكاة فقط.",
    ) +
    '<section class="plans">' +
    plans
      .map((plan) => {
        const subscribed = history.some(
          (subscription) =>
            subscription.plan_id === plan.id && subscription.ends > now(),
        );
        const includedClasses = plan.types
          .map((classType) => "<li>" + typeNames[classType] + "</li>")
          .join("");
        let purchaseButton;
        if (subscribed) {
          purchaseButton = button(
            "تجديد العضوية / Renew membership",
            "purchase",
            plan.id,
          );
        } else {
          purchaseButton = button("اختيار الباقة", "purchase", plan.id);
        }
        return `<article class="plan ${subscribed ? "subscribed-plan" : ""}">
    <small>${plan.days} يوم</small>
    <h2>${escape(plan.name)}</h2>
    <div class="price">${money(plan.price)}</div>
    <ul class="check-list">${includedClasses}</ul>${purchaseButton}</article>`;
      })
      .join("") +
    '</section><section class="panel"><h2>سجل العضويات</h2>' +
    history
      .map(
        (subscription) =>
          "<p><strong>" +
          escape(subscription.name) +
          "</strong> — " +
          date(subscription.starts) +
          " — " +
          date(subscription.ends, { year: "numeric" }) +
          "</p>",
      )
      .join("") +
    "</section>"
  );
}
async function passView() {
  const [entry, attendance] = await Promise.all([
    api("/entry-pass"),
    api("/membership-pass"),
  ]);
  passExpiresAt = Math.min(entry.expiresAt, attendance.expiresAt);
  const card = (title, description, p) =>
    `<section class="panel"><h2>${title}</h2><p>${description}</p><img class="qr" src="${p.image}" alt="${title}"><label for="token-${title.includes("Gate") ? "entry" : "class"}">Manual token / الرمز اليدوي</label><textarea id="token-${title.includes("Gate") ? "entry" : "class"}" class="token-field" rows="4" readonly dir="ltr">${p.token}</textarea></section>`;
  return (
    heading(
      "بطاقة الاشتراك",
      "QR يتغير كل 60 ثانية. استخدم بطاقة البوابة للدخول وبطاقة الحصة مع المدرب.",
    ) +
    `<div class="split">${card("Gate entry / دخول البوابة", "Active membership required. No class booking needed. / اشتراك فعال دون حجز حصة.", entry)}${card("Class attendance / حضور الحصة", "Assigned instructor, confirmed booking, first ten minutes. / حجز مؤكد مع المدرب خلال أول عشر دقائق.", attendance)}</div>`
  );
}
async function verifyView() {
  const result = await api("/classes");
  const classes = result.data.filter(
    (gymClass) => gymClass.state === "published" && gymClass.ends > now(),
  );
  const currentClassId = classes.find(
    (gymClass) => gymClass.starts <= now() && gymClass.ends > now(),
  )?.id;
  return (
    heading(
      "فحص QR وتسجيل الحضور",
      "اختَر حصتك ثم امسح بطاقة حضور الحصة خلال أول عشر دقائق.",
    ) +
    `<section class="panel">
    <h2>فحص بطاقة الطالب</h2>
    <p>لا يُقبل المسح بدون اشتراك فعّال وحجز مؤكد في الحصة المختارة.</p>${
      classes.length
        ? `<form id="verify-form">
    <label for="verify-class">الحصة المختارة</label>
    <select id="verify-class" name="classId" required>${classes.map((gymClass) => `<option value="${gymClass.id}" ${gymClass.id === currentClassId ? "selected" : ""}>${escape(gymClass.title)} — ${date(gymClass.starts)} ${time(gymClass.starts)}</option>`).join("")}</select>
    <label for="verify-token">رمز بطاقة الطالب</label>
    <textarea id="verify-token" name="token" dir="ltr" rows="4" required placeholder="الصق الرمز أو استخدم الكاميرا"></textarea>
    <div class="form-actions">
    <button class="button" type="submit">فحص وتسجيل الحضور</button>${button("فتح الكاميرا", "camera", "", "secondary")}</div>
    </form>`
        : empty(
            "لا توجد حصص قادمة",
            "ينشر المدير الحصص. سجّل الحضور خلال أول عشر دقائق.",
          )
    }<video id="camera" autoplay playsinline hidden>
    </video>
    <div id="verify-result" role="status" aria-live="polite">
    </div>
    </section>`
  );
}
async function inboxView() {
  const rows = await api("/notifications?page=" + listPage);
  return (
    heading(
      "الإشعارات",
      "تأكيدات الحجز، ترقية الانتظار، وتذكيرات العضوية.",
      button("تحديد الكل كمقروء", "read", "", "secondary"),
    ) +
    (rows.data.length
      ? `<section class="panel">${rows.data
          .map(
            (notification) => `<article class="activity">
    <span class="activity-dot" aria-hidden="true">
    </span>
    <div>
    <p>${escape(notification.message)}</p>
    <small>${date(notification.created)} · ${time(notification.created)} ${notification.read_at ? "" : "· جديد"}</small>
    </div>
    </article>`,
          )
          .join("")}</section>${pager(rows.pagination, "list-page")}`
      : empty(
          "ما في إشعارات حالياً",
          "أي تحديث على حجزك أو عضويتك رح يظهر هون.",
        ))
  );
}
async function dashboard() {
  const report = await api("/dashboard");
  const gateRows = report.entriesByHour
    .map(
      (row) =>
        `<tr><td><bdi>${escape(row.hour)}</bdi></td><td>${row.count}</td></tr>`,
    )
    .join("");
  const weekly = report.weekly
    .map((week) => {
      const capacity =
        report.capacityByWeek.find(
          (capacityRow) =>
            capacityRow.week === week.week && capacityRow.type === week.type,
        )?.capacity || 0;
      return `<tr>
    <td>
    <bdi>${escape(week.week)}</bdi>
    </td>
    <td>${typeNames[week.type]}</td>
    <td>${week.classes}</td><td>${week.completed ? Math.round((week.noShows / week.completed) * 100) : 0}% no-show</td>
    <td>${capacity ? Math.round((week.allocated / capacity) * 100) : 0}%</td>
    </tr>`;
    })
    .join("");
  return (
    heading(
      "المركز بنظرة واحدة",
      "مؤشرات العضوية والحجز من بيانات النظام الحالية.",
    ) +
    `<section class="stats">${stat("الأعضاء الفعالون", report.activeMembers, "عضويات صالحة الآن")}${stat("الحجوزات القادمة", report.confirmed, "حجز مؤكد")}${stat("بانتظار مكان", report.waitlisted, "طلب على قوائم الانتظار")}</section>
    <section class="panel"><h2>Gate entries by hour / دخول البوابة بالساعة</h2><p>Asia/Amman</p><table><thead><tr><th>Hour / الساعة</th><th>Entries / الدخول</th></tr></thead><tbody>${gateRows}</tbody></table></section>
    <section class="split">
    <div class="panel">
    <h2>إشغال الحصص</h2>
    <div class="table-wrap">
    <table>
    <thead>
    <tr>
    <th>الأسبوع</th>
    <th>النوع</th>
    <th>الحصص</th><th>No-show rate / نسبة الغياب</th>
    <th>الإشغال</th>
    </tr>
    </thead>
    <tbody>${weekly}</tbody>
    </table>
    </div>
    </div>
    <div class="panel">
    <h2>العضويات حسب الباقة</h2>
    <div class="bar-chart">${report.activeByPlan
      .map(
        (plan) => `<div class="bar-row">
    <span>${escape(plan.name)}</span>
    <meter min="0" max="${Math.max(1, report.activeMembers)}" value="${plan.count}" aria-label="${escape(plan.name)}">
    </meter>
    <strong>${plan.count}</strong>
    </div>`,
      )
      .join("")}</div>
    </div>
    </section>`
  );
}
async function members() {
  return (
    heading("الأعضاء", "افحص عضويات الطلاب وسجّل اشتراكاً تجريبياً.") +
    `<form id="member-search" class="filters">
    <div>
    <label for="member-query">اسم العضو أو البريد أو المعرّف</label>
    <input id="member-query" name="q" placeholder="مثال: member-1">
    </div>
    <button class="button">بحث</button>
    </form>
    <div id="member-results">${empty("ابحث عن عضو", "النتائج تعرض البيانات اللازمة للاستقبال فقط.")}</div>`
  );
}
async function manage() {
  const plans = await api("/plans");
  return (
    heading("إدارة المركز", "انشر حصة جديدة أو أضف باقة عضوية.") +
    `<div class="split">${classFormMarkup(session, typeNames)}<section class="panel">
    <h2>إضافة باقة</h2>
    <form id="plan-form">
    <label for="plan-name">اسم الباقة</label>
    <input id="plan-name" name="name" required maxlength="100">
    <label for="price">السعر بالدينار الأردني</label>
    <input id="price" name="price" type="number" min="0" step="0.01" required>
    <label for="days">المدة بالأيام</label>
    <input id="days" name="days" type="number" min="1" max="366" required>
    <fieldset>
    <legend>الحصص المشمولة</legend>${Object.entries(typeNames)
      .map(
        ([key, label]) =>
          `<label>
    <input class="type-checkbox" type="checkbox" name="types" value="${key}" checked> ${label}</label>`,
      )
      .join("")}</fieldset>
    <div class="form-actions">
    <button class="button">إضافة الباقة</button>
    </div>
    </form>
    <p class="footnote">الباقات الحالية: ${plans.map((p) => escape(p.name)).join("، ")}</p>
    </section>
    </div>`
  );
}
async function auditView() {
  const result = await api("/audit?page=" + listPage);
  return (
    heading("سجل التدقيق", "تغييرات العضوية والجدول وسجل قرارات الإدارة.") +
    (result.data.length
      ? `<div class="table-wrap">
    <table>
    <thead>
    <tr>
    <th>الوقت</th>
    <th>الفاعل</th>
    <th>العملية</th>
    <th>السجل</th>
    <th>التفاصيل</th>
    </tr>
    </thead>
    <tbody>${result.data
      .map(
        (entry) => `<tr>
    <td>${date(entry.created)}<br>${time(entry.created)}</td>
    <td>
    <bdi>${escape(entry.actor)}</bdi>
    </td>
    <td>
    <bdi>${escape(entry.action)}</bdi>
    </td>
    <td>
    <bdi>${escape(entry.target)}</bdi>
    </td>
    <td>${escape(entry.detail)}</td>
    </tr>`,
      )
      .join("")}</tbody>
    </table>
    </div>${pager(result.pagination, "list-page")}`
      : empty("السجل فارغ", "ستظهر هنا العمليات التي يجريها المستخدمون."))
  );
}
async function gateView() {
  return (
    heading(
      "بوابة الدخول / Gate entry",
      "Membership entry only. A class booking is not required. / يتطلب اشتراكاً فعالاً ولا يتطلب حجز حصة.",
    ) +
    `<section class="panel"><form id="gate-form"><label for="gate-name">Gate / البوابة</label><input id="gate-name" name="gate" value="main" maxlength="80" required><label for="verify-token">Entry QR / رمز الدخول</label><textarea id="verify-token" name="token" rows="4" dir="ltr" required></textarea><div class="form-actions"><button class="button" type="submit">Verify entry / فحص الدخول</button>${button("Camera / الكاميرا", "camera", "", "secondary")}</div></form><video id="camera" autoplay playsinline hidden></video><div id="verify-result" role="status" aria-live="polite"></div></section>`
  );
}
async function historyView() {
  const data = await api("/attendance-history");
  return (
    heading(
      "Attendance history / سجل الحضور",
      "Your own completed classes / حصصك المكتملة",
    ) +
    `<section class="stats">${stat("Current streak / سلسلة الحضور الحالية", data.currentStreak, "")}${stat("Best streak / أفضل سلسلة", data.bestStreak, "")}</section><section class="panel"><table><thead><tr><th>Class / الحصة</th><th>Date / التاريخ</th><th>Status / الحالة</th></tr></thead><tbody>${data.rows.map((row) => `<tr><td>${escape(row.title)}</td><td>${date(row.starts)}</td><td>${badge(row.state)}</td></tr>`).join("")}</tbody></table></section>`
  );
}
const views = {
  gate: gateView,
  attendance: historyView,

  home,
  classes: classesView,
  bookings: bookingsView,
  pass: passView,
  verify: verifyView,
  membership: membershipView,
  inbox: inboxView,
  dashboard,
  members,
  manage,
  audit: auditView,
  publish: publishView,

  account: accountView,
};
let renderSerial = 0;
async function render(moveFocus = false) {
  if (!session) {
    return;
  }
  const serial = ++renderSerial;
  if (moveFocus) {
    history.pushState({}, "", pagePath());
  }
  const title =
    navItems().find(([id]) => id === view)?.[2] ||
    (view === "account" ? "حسابي" : "الإشعارات");
  document.querySelector("#page-title").textContent = title;
  document.title = title + " | GymPassJUST";
  stopCamera();
  clearTimeout(refreshTimer);
  const main = document.querySelector("#main");
  main.setAttribute("aria-busy", "true");
  document.querySelectorAll("[data-nav]").forEach((navButton) => {
    navButton.classList.toggle("active", navButton.dataset.nav === view);
    if (navButton.dataset.nav === view) {
      navButton.setAttribute("aria-current", "page");
    } else {
      navButton.removeAttribute("aria-current");
    }
  });
  try {
    const html = await (views[view] || home)();
    if (serial !== renderSerial) {
      return;
    }
    main.innerHTML = html;
    main.removeAttribute("aria-busy");
    if (moveFocus) {
      main.focus();
    }
    if (view === "pass" || view === "classes") {
      refreshTimer = setTimeout(
        () => render(),
        view === "pass" ? Math.max(250, passExpiresAt - now() + 50) : 60000,
      );
    }
  } catch (error) {
    main.removeAttribute("aria-busy");
    main.innerHTML =
      empty("تعذر تحميل الصفحة", escape(error.message)) +
      button("حاول مجدداً", "refresh");
  }
}
function showModal(html) {
  modalBody.innerHTML = html;
  modal.showModal();
}
async function refreshSession() {
  session = await api("/bootstrap");
  offset = session.now - Date.now();
  document.querySelector("#unread").textContent = session.unread || "";
}
async function roster(id) {
  const [bookings, gymClass] = await Promise.all([
    api(`/classes/${id}/roster`),
    api(`/classes/${id}`),
  ]);
  let classAction;
  if (gymClass.state === "published" && gymClass.ends > now()) {
    classAction = button("إلغاء الحصة", "cancel-class", id, "danger");
  } else if (gymClass.state === "cancelled") {
    classAction = badge("cancelled");
  } else {
    classAction = badge("attended");
  }

  let bookingList = empty("لا توجد حجوزات", "لم يسجل أعضاء في هذه الحصة.");
  if (bookings.length > 0) {
    const rows = bookings
      .map(
        (booking) =>
          "<tr><td>" +
          escape(booking.name) +
          "</td><td><bdi>" +
          escape(booking.email) +
          "</bdi></td><td>" +
          badge(booking.state) +
          (session.user.role === "instructor" && booking.state === "confirmed"
            ? `<button class="button small" data-csp-action="check-in" data-class="${gymClass.id}" data-user="${escape(booking.user_id)}">Check in / تسجيل الحضور</button>`
            : "") +
          "</td></tr>",
      )
      .join("");
    bookingList =
      '<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الحالة</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>";
  }

  showModal(`<h2>المسجلون في الحصة</h2>${classAction}${bookingList}`);
}
async function purchase(planId, userId) {
  const plans = await api("/plans");
  const plan = plans.find(
    (availablePlan) => availablePlan.id === Number(planId),
  );
  showModal(
    `<h2>تأكيد الاشتراك</h2>
    <p>${escape(plan.name)} — ${money(plan.price)} لمدة ${plan.days} يوم.</p>
    <div class="notice">عملية تجريبية فقط. لا يتم خصم أي مبلغ.</div>
    <button class="button" data-action="confirm-purchase" data-id="${plan.id}" data-user="${escape(userId || "")}" data-key="${crypto.randomUUID()}">تأكيد الدفع التجريبي</button>`,
  );
}
async function memberSearch(query, pageNumber = 1) {
  const result = await api(
    "/members?q=" + encodeURIComponent(query) + "&page=" + pageNumber,
  );
  const resultsElement = document.querySelector("#member-results");
  resultsElement.dataset.query = query;
  resultsElement.innerHTML = result.data.length
    ? '<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>العضوية</th></tr></thead><tbody>' +
      result.data
        .map(
          (member) =>
            "<tr><td>" +
            escape(member.name) +
            "</td><td><bdi>" +
            escape(member.email) +
            "</bdi></td><td>" +
            (member.membership
              ? "فعالة حتى " + date(member.membership.ends)
              : "غير فعالة") +
            `<br>${member.suspension ? "Suspended until / موقوف حتى " + date(member.suspension.ends) : "Not suspended / غير موقوف"}<div><button class="button small" data-csp-action="sell-plan" data-user="${escape(member.id)}">Membership sale / اشتراك</button>${member.suspension ? `<button class="button small" data-csp-action="override" data-user="${escape(member.id)}">Review suspension / رفع الإيقاف</button>` : ""}</div></td></tr>`,
        )
        .join("") +
      "</tbody></table></div>" +
      pager(result.pagination, "member-page")
    : empty("لا توجد نتائج", "جرّب اسم أو بريد آخر.");
}
root.addEventListener("change", (event) => {
  if (event.target.id === "class-type") {
    classFilter = event.target.value;
    classPage = 1;
    render();
  }
});
document.addEventListener("click", async (event) => {
  const authLink = event.target.closest("[data-auth]");
  if (authLink) {
    event.preventDefault();
    history.pushState({}, "", authLink.href);
    login();
    return;
  }
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    document.querySelector("#menu-panel")?.close();
    view = nav.dataset.nav;
    listPage = 1;
    await render(true);
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  const action = target.dataset.action;
  const id = target.dataset.id;
  target.disabled = true;
  try {
    if (action === "open-menu") {
      document.querySelector("#menu-panel").showModal();
    } else if (action === "close-menu") {
      document.querySelector("#menu-panel").close();
    } else if (action === "logout") {
      await post("/logout");
      session = null;
      clearTimeout(refreshTimer);
      history.replaceState({}, "", "/login");
      login();
    } else if (action === "book") {
      await post("/bookings", { classId: Number(id) });
      toast("تم تسجيل طلبك. حالة الحجز ظاهرة على الحصة.");
      await refreshSession();
      await render();
    } else if (action === "cancel") {
      showModal(
        `<h2>إلغاء الحجز</h2>
    <p>المقعد رح ينتقل لأول عضو مؤهل بقائمة الانتظار.</p>${button("تأكيد الإلغاء", "confirm-cancel", id, "danger")}`,
      );
    } else if (action === "confirm-cancel") {
      await post(`/bookings/${id}/cancellation`);
      modal.close();
      toast("تم إلغاء الحجز.");
      await render();
    } else if (action === "purchase") {
      await purchase(id);
    } else if (action === "confirm-purchase") {
      await post(
        "/memberships",
        {
          planId: Number(id),
          ...(target.dataset.user ? { userId: target.dataset.user } : {}),
        },
        { "Idempotency-Key": target.dataset.key },
      );
      modal.close();
      toast("تم الاشتراك التجريبي بنجاح.");
      await refreshSession();
      await render();
    } else if (action === "class-page") {
      classPage = Number(id);
      await render(true);
    } else if (action === "list-page") {
      listPage = Number(id);
      await render(true);
    } else if (action === "member-page") {
      await memberSearch(
        document.querySelector("#member-results").dataset.query,
        Number(id),
      );
    } else if (action === "read") {
      await post("/notifications/read");
      await refreshSession();
      await render();
    } else if (action === "refresh") {
      await render();
    } else if (action === "copy-token") {
      await navigator.clipboard.writeText(
        document.querySelector("#pass-token").value,
      );
      toast("تم نسخ الرمز.");
    } else if (action === "roster") {
      await roster(id);
    } else if (action === "cancel-class") {
      modalBody.innerHTML = `<h2>تأكيد إلغاء الحصة</h2>
    <p>سيتم إلغاء الحجوزات وإشعار جميع المسجلين.</p>${button("تأكيد إلغاء الحصة", "confirm-class-cancel", id, "danger")}`;
    } else if (action === "confirm-class-cancel") {
      await post(`/classes/${id}/cancellation`);
      modal.close();
      toast("أُلغيت الحصة وأُرسلت الإشعارات.");
      await render();
    } else if (action === "camera") {
      await startCamera();
    } else if (action === "camera-stop") {
      stopCamera();
    }
  } catch (error) {
    toast(error.message, true);
  } finally {
    if (target.isConnected) {
      target.disabled = false;
    }
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (
    !["verify-form", "member-search", "class-form", "plan-form"].includes(
      form.id,
    )
  ) {
    return;
  }
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"],button:not([type])');
  if (submit) {
    submit.disabled = true;
  }
  const data = Object.fromEntries(new FormData(form));
  try {
    if (form.id === "verify-form") {
      stopCamera();
      document.querySelector("#verify-result").innerHTML =
        "<p>جارٍ فحص QR وتسجيل الحضور…</p>";
      const attendance = await post("/class-qr-check-ins", {
        ...data,
        classId: Number(data.classId),
      });
      document.querySelector("#verify-result").innerHTML =
        `<div class="notice ${attendance.allowed ? "" : "error"}">
    <h2>${escape(attendance.message)}</h2>
    <strong>${escape(attendance.member.name)}</strong>
    <p>
    <bdi>${escape(attendance.member.email)}</bdi>
    </p><p>${escape(attendance.membership.name)} — صالحة حتى ${date(attendance.membership.ends, { year: "numeric" })}</p></div>`;
      form.reset();
      form.elements.classId.value = data.classId;
    }
    if (form.id === "member-search") {
      await memberSearch(data.q);
    }
    if (form.id === "class-form") {
      await post("/classes", {
        ...data,
        starts: Date.parse(data.starts + ":00+03:00"),
        ends: Date.parse(data.ends + ":00+03:00"),
        capacity: Number(data.capacity),
      });
      form.reset();
      toast("تم نشر الحصة وظهرت في جدول الطلاب.");
      if (session.user.role === "instructor") {
        view = "classes";
        await render(true);
      }
    }
    if (form.id === "plan-form") {
      await post("/plans", {
        ...data,
        price: Math.round(Number(data.price) * 100),
        days: Number(data.days),
        types: new FormData(form).getAll("types"),
      });
      toast("تمت إضافة الباقة.");
      await render();
    }
  } catch (error) {
    if (form.id === "verify-form") {
      document.querySelector("#verify-result").innerHTML =
        '<div class="notice error">' + escape(error.message) + "</div>";
    }
    const inline = form.querySelector("#auth-error, #class-error");
    if (inline) {
      inline.textContent = error.message;
      inline.hidden = false;
    } else {
      toast(error.message, true);
    }
  } finally {
    if (submit?.isConnected) {
      submit.disabled = false;
    }
  }
});
function stopCamera() {
  const video = document.querySelector("#camera");
  if (video) {
    video.hidden = true;
  }
  cancelAnimationFrame(cameraFrame);
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("الكاميرا تحتاج متصفحاً يدعمها واتصال HTTPS أو localhost.", true);
    return;
  }
  stopCamera();
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  const video = document.querySelector("#camera");
  video.hidden = false;
  video.srcObject = cameraStream;
  const qrDetector =
    "BarcodeDetector" in window
      ? new BarcodeDetector({ formats: ["qr_code"] })
      : null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let lastScan = 0;
  async function scan(frameTime) {
    if (!cameraStream) {
      return;
    }
    if (video.readyState >= 2 && frameTime - lastScan > 140) {
      lastScan = frameTime;
      let token;
      if (qrDetector) {
        try {
          token = (await qrDetector.detect(video))[0]?.rawValue;
        } catch {}
      }
      if (!token && window.jsQR) {
        canvas.width = Math.min(video.videoWidth, 720);
        canvas.height = Math.round(
          (video.videoHeight * canvas.width) / video.videoWidth,
        );
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        token = window.jsQR(pixels.data, pixels.width, pixels.height, {
          inversionAttempts: "dontInvert",
        })?.data;
      }
      if (token) {
        document.querySelector("#verify-token").value = token;
        stopCamera();
        document.querySelector("#gate-form,#verify-form").requestSubmit();
        return;
      }
    }
    if (cameraStream) {
      cameraFrame = requestAnimationFrame(scan);
    }
  }
  video.onloadeddata = () => {
    cameraFrame = requestAnimationFrame(scan);
  };
}
root.addEventListener("input", (event) => {
  if (["verify-token", "verify-class"].includes(event.target.id)) {
    const result = document.querySelector("#verify-result");
    if (result) {
      result.innerHTML = "";
    }
  }
});
window.addEventListener("pagehide", stopCamera);
// Browsers throttle background timers. Refresh a displayed pass on returning.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && session && ["pass", "classes"].includes(view)) {
    render();
  }
});
try {
  const config = await (await fetch("/auth/config")).json();
  authMode = config.mode;
  await enterApp();
} catch (error) {
  if (!session) {
    login();
  } else {
    toast(error.message, true);
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-csp-action]");
  if (!target) return;
  const user = target.dataset.user;
  try {
    if (target.dataset.cspAction === "check-in") {
      await post(`/classes/${target.dataset.class}/check-ins`, {
        userId: user,
      });
      toast("Attendance saved / تم تسجيل الحضور");
      modal.close();
      await roster(target.dataset.class);
    } else if (target.dataset.cspAction === "override") {
      showModal(
        `<h2>Review suspension / رفع الإيقاف</h2><form id="override-form"><input name="userId" type="hidden" value="${escape(user)}"><label for="override-reason">Reason / السبب</label><textarea id="override-reason" name="reason" minlength="5" maxlength="500" required></textarea><button class="button" type="submit">Save / حفظ</button></form>`,
      );
    } else if (target.dataset.cspAction === "sell-plan") {
      const plans = await api("/plans");
      showModal(
        `<h2>Front desk sale / اشتراك من الاستقبال</h2><form id="desk-sale"><input type="hidden" name="userId" value="${escape(user)}"><label for="desk-plan">Plan / الباقة</label><select id="desk-plan" name="planId">${plans.map((p) => `<option value="${p.id}">${escape(p.name)} - ${money(p.price)}</option>`).join("")}</select><p>Simulated payment / الدفع محاكاة</p><button type="submit" class="button">Confirm / تأكيد</button></form>`,
      );
    }
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!["gate-form", "override-form", "desk-sale"].includes(form.id)) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    if (form.id === "gate-form") {
      const result = await post("/gate-entries", data);
      document.querySelector("#verify-result").textContent = result.allowed
        ? "Entry allowed / يسمح بالدخول"
        : "Entry refused / يمنع الدخول";
      document.querySelector("#verify-token").value = "";
    } else if (form.id === "override-form") {
      await post(
        `/members/${encodeURIComponent(data.userId)}/suspension-override`,
        { reason: data.reason },
      );
      modal.close();
      toast("Suspension lifted / تم رفع الإيقاف");
      await memberSearch(
        document.querySelector("#member-results").dataset.query || data.userId,
      );
    } else {
      await post(
        "/memberships",
        { userId: data.userId, planId: Number(data.planId) },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      modal.close();
      toast("Simulated purchase saved / تم حفظ الاشتراك");
      await memberSearch(
        document.querySelector("#member-results").dataset.query || data.userId,
      );
    }
  } catch (error) {
    if (form.id === "gate-form")
      document.querySelector("#verify-result").textContent = error.message;
    else toast(error.message, true);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
});
