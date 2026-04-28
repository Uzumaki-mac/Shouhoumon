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

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.14 }
  );

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
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
  const BLOG_FEED_URL = "assets/data/ameblo-feed.json";
  const BLOG_ARCHIVE_URL = "https://ameblo.jp/lily-1410/";
  const BLOG_DEFAULT_IMAGE = "assets/images/photos/tarot-candle-soft-wide.png";

  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const truncateText = (value, maxLength) => {
    const text = normalizeText(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).replace(/[。、,.!！?？\s]+$/u, "")}…`;
  };

  const safeUrl = (value, fallback) => {
    try {
      const url = new URL(String(value || "").trim(), window.location.href);
      return url.href;
    } catch {
      return fallback;
    }
  };

  const createBlogLink = (label, href, className) => {
    const link = document.createElement("a");
    link.className = className;
    link.href = safeUrl(href, BLOG_ARCHIVE_URL);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  };

  const createBlogCard = (post) => {
    const card = document.createElement("article");
    card.className = "blog-card";

    const imageWrap = document.createElement("a");
    imageWrap.className = "blog-card__image";
    imageWrap.href = safeUrl(post.link, BLOG_ARCHIVE_URL);
    imageWrap.target = "_blank";
    imageWrap.rel = "noopener noreferrer";
    imageWrap.setAttribute("aria-label", `${normalizeText(post.title)} をアメブロで開く`);

    const image = document.createElement("img");
    const defaultImageSrc = safeUrl(BLOG_DEFAULT_IMAGE, BLOG_DEFAULT_IMAGE);
    image.src = safeUrl(post.thumbnail || BLOG_DEFAULT_IMAGE, defaultImageSrc);
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      if (image.src !== defaultImageSrc) {
        image.src = defaultImageSrc;
      }
    });
    imageWrap.append(image);

    const body = document.createElement("div");
    body.className = "blog-card__body";

    const date = document.createElement("p");
    date.className = "blog-card__date";
    date.textContent = normalizeText(post.date);

    const title = document.createElement("h3");
    title.className = "blog-card__title";
    title.textContent = normalizeText(post.title);

    const excerpt = document.createElement("p");
    excerpt.className = "blog-card__excerpt";
    excerpt.textContent = truncateText(post.excerpt || "詳しくはアメブロをご覧ください。", 84);

    const link = createBlogLink("アメブロで続きを読む", post.link, "blog-card__link");

    body.append(date, title, excerpt, link);
    card.append(imageWrap, body);
    return card;
  };

  const renderBlogFallback = (container) => {
    const fallback = document.createElement("div");
    fallback.className = "blog-fallback";

    const text = document.createElement("p");
    text.textContent = "最新記事はアメブロにてご覧いただけます。";

    fallback.append(text);
    container.replaceChildren(fallback);
  };

  const renderBlogFeed = (container, posts) => {
    const limit = Number.parseInt(container.dataset.limit || "3", 10);
    const visiblePosts = posts.slice(0, Number.isNaN(limit) ? 3 : limit);

    if (!visiblePosts.length) {
      renderBlogFallback(container);
      return;
    }

    container.replaceChildren(...visiblePosts.map((post) => createBlogCard(post)));
  };

  const initializeBlogFeed = async () => {
    try {
      const response = await fetch(BLOG_FEED_URL, { credentials: "same-origin" });
      if (!response.ok) throw new Error("Feed request failed");

      const feed = await response.json();
      if (!Array.isArray(feed)) throw new Error("Feed payload is invalid");

      blogFeedContainers.forEach((container) => renderBlogFeed(container, feed));
    } catch {
      blogFeedContainers.forEach((container) => renderBlogFallback(container));
    }
  };

  initializeBlogFeed();
}
