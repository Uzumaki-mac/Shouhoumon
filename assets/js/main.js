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

if (bookingForm) {
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

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = bookingForm.querySelector("[data-form-message]");
    if (message) {
      message.textContent = "送信機能は公開時に接続します。現在は入力確認用の画面です。";
    }
  });
}

const courseForm = document.querySelector("[data-course-form]");

if (courseForm) {
  courseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = courseForm.querySelector("[data-course-message]");
    if (message) {
      message.textContent = "送信機能は公開時に接続します。現在は入力確認用の画面です。";
    }
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
