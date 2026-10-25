const body = document.body;
const header = document.querySelector(".site-header");
const nav = document.querySelector(".site-nav");
const navToggle = document.querySelector(".nav-toggle");
const backToTop = document.querySelector(".back-to-top");

const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

if (nav && navToggle) {
  navToggle.addEventListener("click", () => {
    const willOpen = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", willOpen);
    body.classList.toggle("nav-open", willOpen);
    navToggle.setAttribute("aria-expanded", String(willOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove("is-pending");
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -48px 0px", threshold: 0 }
  );

  document.querySelectorAll(".reveal").forEach((element) => {
    if (element.getBoundingClientRect().top >= window.innerHeight) {
      observer.observe(element);
      element.classList.add("is-pending");
    }
  });
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
}

if (backToTop) {
  const setBackToTopState = () => {
    backToTop.classList.toggle("is-visible", window.scrollY > 620);
  };

  setBackToTopState();
  window.addEventListener("scroll", setBackToTopState, { passive: true });
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

const bookingForm = document.querySelector("[data-booking-form]");

const normalizeFormValue = (form, name) => {
  const field = form.elements[name];
  if (!field) return "";
  if (field instanceof RadioNodeList) return String(field.value || "").trim();
  if (field.type === "checkbox") return field.checked;
  return String(field.value || "").trim();
};

const hasNonAscii = (value) => /[^\x00-\x7F]/.test(String(value || ""));
const isValidEmailValue = (value) => /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value);
const isValidPhoneValue = (value) => !value || /^[0-9]{10,11}$/.test(value);
const sanitizeAscii = (value) => String(value || "").replace(/[^\x00-\x7F]/g, "");
const sanitizePhone = (value) => sanitizeAscii(value).replace(/[^0-9]/g, "");

const prepareEmailField = (form, name, messageElement) => {
  const field = form.elements[name];
  if (!field || field instanceof RadioNodeList) return true;

  const rawEmail = String(normalizeFormValue(form, name) || "");
  field.setCustomValidity("");
  removeInvalidState(field);

  if (!rawEmail) return true;
  if (hasNonAscii(rawEmail)) {
    field.setCustomValidity("メールアドレスは半角で入力してください。");
    addInvalidState(field);
    setFormMessage(messageElement, "メールアドレスは半角で入力してください。\n例：sample@example.com", "error");
    field.focus();
    return false;
  }

  if (isValidEmailValue(rawEmail)) return true;

  field.setCustomValidity("メールアドレスの形式をご確認ください。");
  addInvalidState(field);
  setFormMessage(messageElement, "メールアドレスの形式をご確認ください。\n例：sample@example.com", "error");
  field.focus();
  return false;
};

const preparePhoneField = (form, name, messageElement) => {
  const field = form.elements[name];
  if (!field || field instanceof RadioNodeList) return true;

  const phone = String(normalizeFormValue(form, name) || "");
  field.value = phone;
  field.setCustomValidity("");
  removeInvalidState(field);

  if (!phone) return true;
  if (hasNonAscii(phone) || !isValidPhoneValue(phone)) {
    field.setCustomValidity("電話番号は半角数字10〜11桁で入力してください。");
    addInvalidState(field);
    setFormMessage(messageElement, "電話番号は半角数字10〜11桁で入力してください。\n例：09000000000", "error");
    field.focus();
    return false;
  }

  return true;
};

const resetFieldValidityOnInput = (form, name, messageElement) => {
  const field = form.elements[name];
  if (!field || field instanceof RadioNodeList) return;

  field.addEventListener("input", () => {
    field.setCustomValidity("");
    removeInvalidState(field);
    if (messageElement?.dataset.state === "error") {
      setFormMessage(messageElement, "", "");
    }
  });
};

const enforceAsciiInput = (form, name, messageElement, options = {}) => {
  const field = form.elements[name];
  if (!field || field instanceof RadioNodeList) return;

  const sanitize = () => {
    const originalValue = field.value;
    const nextValue = options.digitsOnly ? sanitizePhone(originalValue) : sanitizeAscii(originalValue);
    if (originalValue !== nextValue) {
      field.value = nextValue;
      setFormMessage(messageElement, options.message, "error");
      addInvalidState(field);
      window.setTimeout(() => removeInvalidState(field), 900);
    }
  };

  field.addEventListener("input", sanitize);
  field.addEventListener("compositionend", sanitize);
};

const setFormMessage = (messageElement, text, state = "") => {
  if (!messageElement) return;
  messageElement.textContent = text;
  messageElement.dataset.state = state;
};

const submitFormPayload = async ({ form, payload, messageElement, successIntro }) => {
  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton ? submitButton.textContent : "";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "送信中...";
  }
  setFormMessage(messageElement, "送信中です。しばらくお待ちください。", "pending");

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error("Submit failed");

    const managementLine = result.managementId ? `\n管理番号：${result.managementId}` : "";
    setFormMessage(
      messageElement,
      `${successIntro}${managementLine}\n内容を確認のうえ、鑑定室より折り返しご案内いたします。\nト術 奏亨門 / 富永祥玲の鑑定室`,
      "success"
    );
    form.reset();
    clearRequiredHighlights(form);
    return true;
  } catch {
    setFormMessage(messageElement, "送信できませんでした。\n時間をおいて再度お試しください。", "error");
    return false;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = defaultButtonText;
      submitButton.blur();
    }
  }
};

const blurSubmitButton = (form) => {
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.blur();
};

const addInvalidState = (field) => {
  field.classList.add("is-required-missing");
  const fieldWrap = field.closest(".form-field");
  if (fieldWrap) fieldWrap.classList.add("is-required-missing");
  const checkboxLabel = field.closest(".form-checkbox");
  if (checkboxLabel) checkboxLabel.classList.add("is-required-missing");
};

const removeInvalidState = (field) => {
  field.classList.remove("is-required-missing");
  const fieldWrap = field.closest(".form-field");
  if (fieldWrap) fieldWrap.classList.remove("is-required-missing");
  const checkboxLabel = field.closest(".form-checkbox");
  if (checkboxLabel) checkboxLabel.classList.remove("is-required-missing");
};

const clearRequiredHighlights = (form) => {
  form.querySelectorAll(".is-required-missing").forEach((element) => {
    element.classList.remove("is-required-missing");
  });
};

const markRequiredHighlights = (form) => {
  clearRequiredHighlights(form);
  const missingFields = [];
  form.querySelectorAll("input[required], select[required], textarea[required]").forEach((field) => {
    const isMissingCheckbox = field.type === "checkbox" && !field.checked;
    const isMissingValue = field.type !== "checkbox" && !String(field.value || "").trim();
    if (!isMissingCheckbox && !isMissingValue) return;

    addInvalidState(field);
    missingFields.push(field);
  });
  return missingFields;
};

const initializeRequiredHighlightReset = (form, messageElement) => {
  form.querySelectorAll("input[required], select[required], textarea[required]").forEach((field) => {
    const eventName = field.tagName === "SELECT" || field.type === "checkbox" ? "change" : "input";
    field.addEventListener(eventName, () => {
      removeInvalidState(field);
      const hasMissingFields = form.querySelector(".is-required-missing");
      if (!hasMissingFields && messageElement?.dataset.state === "error") {
        setFormMessage(messageElement, "", "");
      }
    });
  });
};

const validateFormBeforeSubmit = (form, messageElement) => {
  const missingFields = markRequiredHighlights(form);
  if (!missingFields.length) return true;

  blurSubmitButton(form);
  const countText = missingFields.length === 1 ? "1件" : `${missingFields.length}件`;
  setFormMessage(messageElement, `未入力または未選択の必須項目が${countText}あります。\n赤枠の項目をご確認ください。`, "error");
  missingFields[0].focus({ preventScroll: true });
  missingFields[0].scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
};

if (bookingForm) {
  bookingForm.noValidate = true;
  const birthHour = bookingForm.querySelector("[data-birth-hour]");
  const birthMinute = bookingForm.querySelector("[data-birth-minute]");
  const birthTimeUnknown = bookingForm.querySelector("[data-birth-time-unknown]");

  const syncBirthTimeState = () => {
    if (!birthHour || !birthMinute || !birthTimeUnknown) return;
    const isUnknown = birthTimeUnknown.checked;
    birthHour.disabled = isUnknown;
    birthMinute.disabled = isUnknown;

    if (isUnknown) {
      birthHour.value = "";
      birthMinute.value = "";
    }
  };

  if (birthTimeUnknown) {
    syncBirthTimeState();
    birthTimeUnknown.addEventListener("change", syncBirthTimeState);
  }

  const message = bookingForm.querySelector("[data-form-message]");
  initializeRequiredHighlightReset(bookingForm, message);
  resetFieldValidityOnInput(bookingForm, "email", message);
  resetFieldValidityOnInput(bookingForm, "contact", message);
  enforceAsciiInput(bookingForm, "email", message, {
    message: "メールアドレスは半角で入力してください。\n例：sample@example.com",
  });
  enforceAsciiInput(bookingForm, "contact", message, {
    digitsOnly: true,
    message: "電話番号は半角数字のみで入力してください。\n例：09000000000",
  });

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!prepareEmailField(bookingForm, "email", message)) return;
    if (!preparePhoneField(bookingForm, "contact", message)) return;
    if (!validateFormBeforeSubmit(bookingForm, message)) return;

    const hour = normalizeFormValue(bookingForm, "birth_hour");
    const minute = normalizeFormValue(bookingForm, "birth_minute");
    const birthTimeUnknownChecked = Boolean(normalizeFormValue(bookingForm, "birth_time_unknown"));
    const birthTime = birthTimeUnknownChecked || (!hour && !minute) ? "" : `${hour || "--"}:${minute || "--"}`;

    await submitFormPayload({
      form: bookingForm,
      messageElement: message,
      successIntro: "送信が完了しました。",
      payload: {
        formType: "reserve",
        name: normalizeFormValue(bookingForm, "name"),
        email: normalizeFormValue(bookingForm, "email"),
        phone: normalizeFormValue(bookingForm, "contact"),
        birthDate: normalizeFormValue(bookingForm, "birth_date"),
        birthTime,
        birthTimeUnknown: birthTimeUnknownChecked,
        birthPlace: normalizeFormValue(bookingForm, "birth_place"),
        consultationType: normalizeFormValue(bookingForm, "type"),
        message: normalizeFormValue(bookingForm, "message"),
        disclaimerChecked: Boolean(normalizeFormValue(bookingForm, "agreement")),
        honeypot: normalizeFormValue(bookingForm, "website"),
      },
    });
    syncBirthTimeState();
  });
}

const courseForm = document.querySelector("[data-course-form]");

if (courseForm) {
  courseForm.noValidate = true;
  const message = courseForm.querySelector("[data-course-message]");
  initializeRequiredHighlightReset(courseForm, message);
  resetFieldValidityOnInput(courseForm, "email", message);
  resetFieldValidityOnInput(courseForm, "contact", message);
  enforceAsciiInput(courseForm, "email", message, {
    message: "メールアドレスは半角で入力してください。\n例：sample@example.com",
  });
  enforceAsciiInput(courseForm, "contact", message, {
    digitsOnly: true,
    message: "電話番号は半角数字のみで入力してください。\n例：09000000000",
  });

  courseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!prepareEmailField(courseForm, "email", message)) return;
    if (!preparePhoneField(courseForm, "contact", message)) return;
    if (!validateFormBeforeSubmit(courseForm, message)) return;

    await submitFormPayload({
      form: courseForm,
      messageElement: message,
      successIntro: "送信が完了しました。",
      payload: {
        formType: "kouza",
        name: normalizeFormValue(courseForm, "name"),
        email: normalizeFormValue(courseForm, "email"),
        phone: normalizeFormValue(courseForm, "contact"),
        courseName: normalizeFormValue(courseForm, "course_type"),
        preferredSchedule: normalizeFormValue(courseForm, "start_timing"),
        learningExperience: normalizeFormValue(courseForm, "experience"),
        message: normalizeFormValue(courseForm, "message"),
        honeypot: normalizeFormValue(courseForm, "website"),
      },
    });
  });
}

const blogFeedContainers = document.querySelectorAll("[data-blog-feed]");

if (blogFeedContainers.length) {
  const sources = {
    ameblo: { name: "アメブロ", url: "https://ameblo.jp/lily-1410/", endpoint: "/api/blog-feed", images: ["assets/images/photos/tarot-candle-soft-wide.png"] },
    note: { name: "note", url: "https://note.com/magic_auklet8531", endpoint: "/api/note-feed", images: ["assets/images/photos/marble-crystal-wide.png", "assets/images/photos/tarot-candle-soft-wide.png"] },
  };
  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const safeUrl = (value, fallback) => {
    try {
      const url = new URL(String(value || "").trim(), window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
    } catch { return fallback; }
  };
  const link = (text, url, className) => {
    const el = document.createElement("a");
    el.className = className;
    el.textContent = text;
    el.href = url;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
    return el;
  };
  const textElement = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = normalizeText(text);
    return el;
  };
  const createCard = (post, source, index) => {
    const card = document.createElement("article");
    card.className = "blog-card";
    const url = safeUrl(post.link, source.url);
    const imageWrap = link("", url, "blog-card__image");
    imageWrap.setAttribute("aria-label", `${normalizeText(post.title)} を${source.name}で開く`);
    const img = document.createElement("img");
    const fallback = new URL(source.images[index % source.images.length], window.location.href).href;
    img.src = post.thumbnail ? safeUrl(post.thumbnail, fallback) : fallback;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => { if (img.src !== fallback) img.src = fallback; });
    imageWrap.append(img);
    if (!post.thumbnail && source === sources.note) imageWrap.append(textElement("span", "journal-image-label", "note / 富永祥玲"));
    const body = document.createElement("div");
    body.className = "blog-card__body";
    const title = textElement("h3", "blog-card__title", "");
    title.append(link(post.title, url, "journal-title-link"));
    const excerpt = normalizeText(post.excerpt || `記事の続きは${source.name}でご覧いただけます。`);
    body.append(textElement("p", "blog-card__date", post.date), title,
      textElement("p", "blog-card__excerpt", excerpt.length > 84 ? excerpt.slice(0,84)+"…" : excerpt),
      link(`${source.name}で続きを読む`, url, "blog-card__link"));
    card.append(imageWrap, body);
    return card;
  };
  const noteInvitation = () => {
    const card = document.createElement("aside");
    card.className = "blog-card journal-invitation";
    card.append(textElement("span", "journal-invitation__word", "note"),
      textElement("p", "journal-invitation__eyebrow", "富永祥玲のnote"),
      textElement("h3", "journal-invitation__title", "もう少し、ことばの先へ。"),
      textElement("p", "journal-invitation__text", "これまでの文章やプロフィールは、noteでご覧いただけます。"),
      link("noteを訪ねる", sources.note.url, "blog-card__link"));
    return card;
  };
  const fallback = (container, source) => {
    const el = document.createElement("div");
    el.className = "blog-fallback";
    el.append(textElement("p", "", "記事を取得できませんでした。"), link(`${source.name}で最新記事を見る`, source.url, "blog-card__link"));
    container.replaceChildren(el);
  };
  const loadFeed = async (container) => {
    const source = sources[container.dataset.blogFeed] || sources.ameblo;
    try {
      const response = await fetch(source.endpoint, { credentials: "same-origin", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Feed request failed");
      const posts = await response.json();
      if (!Array.isArray(posts) || !posts.length) throw new Error("Empty feed");
      const limit = Number.parseInt(container.dataset.limit || "3", 10) || 3;
      container.replaceChildren(...posts.slice(0,limit).map((post,i) => createCard(post, source, i)));
      if (source === sources.note && posts.length === 2 && limit === 3) container.append(noteInvitation());
    } catch { fallback(container, source); }
  };
  blogFeedContainers.forEach(loadFeed);
}
