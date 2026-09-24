// ============================================================
// ShortURL - Frontend JavaScript
// ============================================================

// -------------------------
// Helpers
// -------------------------

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];


// -------------------------
// API Helper
// -------------------------

const API_BASE = "http://localhost:3000";

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // JWT expired / invalid
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html";

    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  return response;
}


// -------------------------
// Elements
// -------------------------

const els = {

  // Shortener
  form: $("#shortenerForm"),
  input: $("#urlInput"),
  customCode: $("#customCode"),
  shortenBtn: $("#shortenBtn"),
  btnText: $(".btn-text"),
  spinner: $(".spinner"),
  error: $("#urlError"),

  // Result
  resultCard: $("#resultCard"),
  resultUrl: $("#resultUrl"),
  resultOriginal: $("#resultOriginal"),
  copyResultBtn: $("#copyResultBtn"),
  qrResultBtn: $("#qrResultBtn"),
  shareResultBtn: $("#shareResultBtn"),

  // Navigation
  menuToggle: $("#menuToggle"),
  mainNav: $("#mainNav"),
  themeToggle: $("#themeToggle"),
  userName: $("#userName"),
  logoutBtn: $("#logoutBtn"),

  // Dashboard preview
  previewLinks: $("#previewLinks"),
  previewClicks: $("#previewClicks"),
  previewBars: $("#previewBars"),
  previewLinksList: $("#previewLinksList"),

  // Analytics
  analyticsBars: $("#analyticsBars"),
  topLinksList: $("#topLinksList"),

  // Links
  linksList: $("#linksList"),
  searchInput: $("#searchInput"),
  linkCount: $("#linkCount"),
  clearLinksBtn: $("#clearLinksBtn"),

  // Modals
  qrModal: $("#qrModal"),
  qrClose: $("#qrClose"),
  qrBox: $("#qrBox"),
  qrSubtitle: $("#qrSubtitle"),
  downloadQrBtn: $("#downloadQrBtn"),

  confirmModal: $("#confirmModal"),
  cancelDelete: $("#cancelDelete"),
  confirmDelete: $("#confirmDelete"),

  // Toast
  toastStack: $("#toastStack"),

  // Counters
  counters: $$("[data-counter]"),

  // Footer
  year: $("#year")
};


// -------------------------
// State
// -------------------------

const state = {
  links: [],
  pendingDeleteId: null
};


// -------------------------
// Utility Functions
// -------------------------

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}


function formatDate(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}


function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    return parsed.href;
  } catch {
    return url;
  }
}


// -------------------------
// Toast
// -------------------------

function toast(message, type = "info") {
  if (!els.toastStack) return;

  const item = document.createElement("div");

  item.className = `toast ${type}`;

  item.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;

  els.toastStack.appendChild(item);

  setTimeout(() => {
    item.classList.add("show");
  }, 10);

  setTimeout(() => {
    item.classList.remove("show");

    setTimeout(() => {
      item.remove();
    }, 250);

  }, 3000);
}


// -------------------------
// Login Check
// -------------------------

function checkLogin() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return false;
  }

  return true;
}


// -------------------------
// Theme
// -------------------------

function initTheme() {
  const savedTheme =
    localStorage.getItem("theme") || "dark";

  document.documentElement.dataset.theme =
    savedTheme;

  updateThemeButton();
}


function updateThemeButton() {
  if (!els.themeToggle) return;

  const theme =
    document.documentElement.dataset.theme || "dark";

  const icon =
    els.themeToggle.querySelector(".theme-icon");

  const label =
    els.themeToggle.querySelector(".theme-label");

  if (theme === "light") {

    if (icon) icon.textContent = "☾";
    if (label) label.textContent = "Dark";

  } else {

    if (icon) icon.textContent = "☼";
    if (label) label.textContent = "Light";

  }
}


function toggleTheme() {
  const current =
    document.documentElement.dataset.theme || "dark";

  const next =
    current === "dark"
      ? "light"
      : "dark";

  document.documentElement.dataset.theme =
    next;

  localStorage.setItem(
    "theme",
    next
  );

  updateThemeButton();
}


// -------------------------
// Mobile Menu
// -------------------------

function closeMenu() {
  if (!els.mainNav) return;

  els.mainNav.classList.remove("open");

  if (els.menuToggle) {
    els.menuToggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}


function toggleMenu() {
  if (!els.mainNav) return;

  const isOpen =
    els.mainNav.classList.toggle("open");

  if (els.menuToggle) {
    els.menuToggle.setAttribute(
      "aria-expanded",
      String(isOpen)
    );
  }
}


// -------------------------
// Loading State
// -------------------------

function setLoading(isLoading) {

  if (!els.shortenBtn) return;

  els.shortenBtn.disabled = isLoading;

  if (els.btnText) {
    els.btnText.textContent =
      isLoading
        ? "Creating..."
        : "Shorten URL";
  }

  if (els.spinner) {
    els.spinner.hidden = !isLoading;
  }
}


// -------------------------
// URL Validation
// -------------------------

function validateUrl(value) {

  if (!value) {
    return "Please enter a URL.";
  }

  try {

    const url = new URL(value);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "Only HTTP and HTTPS URLs are supported.";
    }

  } catch {
    return "Please enter a valid URL.";
  }

  return "";
}


// -------------------------
// Result Card
// -------------------------

function showResult(link) {

  if (!els.resultCard) return;

  els.resultCard.hidden = false;

  if (els.resultUrl) {
    els.resultUrl.href = link.shortUrl;
    els.resultUrl.textContent = link.shortUrl;
  }

  if (els.resultOriginal) {
    els.resultOriginal.textContent =
      link.originalUrl;
  }

  els.resultCard.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


// -------------------------
// Copy
// -------------------------

async function copyText(text) {

  try {

    await navigator.clipboard.writeText(text);

    toast(
      "Copied to clipboard.",
      "success"
    );

    return true;

  } catch {

    try {

      const textarea =
        document.createElement("textarea");

      textarea.value = text;

      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);

      textarea.select();

      document.execCommand("copy");

      textarea.remove();

      toast(
        "Copied to clipboard.",
        "success"
      );

      return true;

    } catch {

      toast(
        "Could not copy the link.",
        "error"
      );

      return false;
    }
  }
}


// -------------------------
// QR Code
// -------------------------

function openQrModal(url) {

  if (!els.qrModal || !els.qrBox) return;

  state.currentQrUrl = url;

  els.qrBox.innerHTML = "";

  if (els.qrSubtitle) {
    els.qrSubtitle.textContent = url;
  }

  if (typeof QRCode !== "undefined") {

    new QRCode(els.qrBox, {
      text: url,
      width: 220,
      height: 220
    });

  } else {

    toast(
      "QR code library is not loaded.",
      "error"
    );

    return;
  }

  els.qrModal.hidden = false;
}


function closeQrModal() {

  if (!els.qrModal) return;

  els.qrModal.hidden = true;
}


function downloadQr() {

  if (!els.qrBox) return;

  const canvas =
    els.qrBox.querySelector("canvas");

  const image =
    els.qrBox.querySelector("img");

  let url = "";

  if (canvas) {
    url = canvas.toDataURL("image/png");
  } else if (image) {
    url = image.src;
  }

  if (!url) {
    toast(
      "QR code is not ready.",
      "error"
    );

    return;
  }

  const link =
    document.createElement("a");

  link.href = url;
  link.download = "shorturl-qr.png";

  link.click();
}


// -------------------------
// Share
// -------------------------

async function shareUrl(url) {

  if (
    navigator.share &&
    typeof navigator.share === "function"
  ) {

    try {

      await navigator.share({
        title: "ShortURL",
        url
      });

      return;

    } catch {
      // User cancelled sharing.
    }
  }

  await copyText(url);
}


// -------------------------
// Counter Animation
// -------------------------

function animateCounter(element, target) {

  if (!element) return;

  const finalValue =
    Number(target) || 0;

  const duration = 500;

  const start =
    Number(element.dataset.value || 0);

  const startTime = performance.now();

  function update(now) {

    const progress =
      Math.min(
        (now - startTime) / duration,
        1
      );

    const eased =
      1 - Math.pow(1 - progress, 3);

    const value =
      Math.round(
        start +
        (finalValue - start) * eased
      );

    element.textContent =
      value.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }

  }

  element.dataset.value =
    String(finalValue);

  requestAnimationFrame(update);
}


// -------------------------
// Render Bars
// -------------------------

function renderBars(
  target,
  values = [],
  labels = []
) {

  if (!target) return;

  const numbers =
    values.map(
      value => Number(value) || 0
    );

  const max =
    Math.max(...numbers, 1);

  target.innerHTML =
    numbers.map((value, index) => {

      const label =
        labels[index] || "";

      const height =
        value === 0
          ? 0
          : Math.max(
              (value / max) * 100,
              6
            );

      return `
        <div class="bar-item">

          <div class="bar-value">
            ${value}
          </div>

          <div class="bar-track">

            <span
              class="bar-fill"
              style="height:${height}%"
              title="${escapeHtml(label)}: ${value} clicks"
            ></span>

          </div>

          <div class="bar-label">
            ${escapeHtml(label)}
          </div>

        </div>
      `;

    }).join("");
}


// -------------------------
// Update Dashboard Counters
// -------------------------

function updateDashboard() {

  const totalLinks =
    state.links.length;

  const totalClicks =
    state.links.reduce(
      (sum, link) =>
        sum + Number(link.clicks || 0),
      0
    );

  const activeLinks =
    state.links.filter(
      link => link.active !== false
    ).length;

  if (els.previewLinks) {
    els.previewLinks.textContent =
      totalLinks;
  }

  if (els.previewClicks) {
    els.previewClicks.textContent =
      totalClicks;
  }

  els.counters.forEach(element => {

    const key =
      element.dataset.counter;

    let target = 0;

    if (key === "links") {
      target = totalLinks;
    } else if (key === "clicks") {
      target = totalClicks;
    } else if (key === "active") {
      target = activeLinks;
    }

    animateCounter(
      element,
      target
    );

  });
}


// -------------------------
// Preview Links
// -------------------------

function renderPreviewLinks() {

  if (!els.previewLinksList) return;

  const links =
    [...state.links]
      .sort(
        (a, b) =>
          b.createdAt - a.createdAt
      )
      .slice(0, 2);

  if (!links.length) {

    els.previewLinksList.innerHTML = `
      <div>

        <span class="link-dot"></span>

        <span>
          No links created yet
        </span>

        <b>
          Ready
        </b>

      </div>
    `;

    return;
  }

  els.previewLinksList.innerHTML =
    links.map(link => `
      <div>

        <span class="link-dot"></span>

        <span
          title="${escapeHtml(link.originalUrl)}"
        >
          /${escapeHtml(link.code)}
        </span>

        <b>
          ${Number(link.clicks || 0)} clicks
        </b>

      </div>
    `).join("");
}


// -------------------------
// Render Links
// -------------------------

function renderLinks() {

  if (!els.linksList) return;

  const search =
    (els.searchInput?.value || "")
      .trim()
      .toLowerCase();

  const filtered =
    state.links.filter(link => {

      const shortCode =
        String(link.code || "")
          .toLowerCase();

      const original =
        String(link.originalUrl || "")
          .toLowerCase();

      return (
        !search ||
        shortCode.includes(search) ||
        original.includes(search)
      );
    });

  if (els.linkCount) {

    els.linkCount.textContent =
      `${filtered.length} ${
        filtered.length === 1
          ? "link"
          : "links"
      }`;

  }

  if (!filtered.length) {

    els.linksList.innerHTML = `
      <div class="empty-state glass">

        <h3>
          ${
            search
              ? "No matching links"
              : "No links yet"
          }
        </h3>

        <p>
          ${
            search
              ? "Try a different search."
              : "Create your first short link above."
          }
        </p>

      </div>
    `;

    return;
  }

  els.linksList.innerHTML =
    filtered.map(link => {

      const shortUrl =
        escapeHtml(link.shortUrl);

      const originalUrl =
        escapeHtml(link.originalUrl);

      const code =
        escapeHtml(link.code);

      const clicks =
        Number(link.clicks || 0);

      return `
        <article
          class="link-item glass"
          data-id="${escapeHtml(link.id)}"
        >

          <div class="link-item-main">

            <div class="link-item-code">

              <span class="link-dot"></span>

              <a
                href="${shortUrl}"
                target="_blank"
                rel="noopener"
              >
                /${code}
              </a>

            </div>

            <div
              class="link-item-original"
              title="${originalUrl}"
            >
              ${originalUrl}
            </div>

            <div class="link-item-meta">

              <span>
                ${clicks} clicks
              </span>

              <span>
                ${formatDate(link.createdAt)}
              </span>

            </div>

          </div>


          <div class="link-item-actions">

            <button
              class="icon-btn"
              type="button"
              data-action="copy"
              data-id="${escapeHtml(link.id)}"
              title="Copy"
            >
              ⧉
            </button>

            <button
              class="icon-btn"
              type="button"
              data-action="qr"
              data-id="${escapeHtml(link.id)}"
              title="QR code"
            >
              ▦
            </button>

            <button
              class="icon-btn"
              type="button"
              data-action="share"
              data-id="${escapeHtml(link.id)}"
              title="Share"
            >
              ↗
            </button>

            <button
              class="icon-btn danger"
              type="button"
              data-action="delete"
              data-id="${escapeHtml(link.id)}"
              title="Delete"
            >
              ×
            </button>

          </div>

        </article>
      `;
    }).join("");
}


// -------------------------
// Load User Links
// -------------------------

async function loadLinksFromBackend() {

  try {

    const response =
      await apiFetch(
        "http://localhost:3000/api/urls"
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Failed to load links."
      );
    }

    state.links =
      data.map(item => ({

        id: String(item.id),

        code: item.short_code,

        shortUrl:
          `http://localhost:3000/${item.short_code}`,

        originalUrl:
          item.original_url,

        createdAt:
          new Date(item.created_at).getTime(),

        clicks:
          Number(item.clicks || 0),

        active: true,

        clickDates: []

      }));

    renderLinks();

    updateDashboard();

    renderPreviewLinks();

  } catch (error) {

    console.error(
      "Load links error:",
      error
    );

    // apiFetch handles expired tokens.
    if (
      error.message.includes(
        "session has expired"
      )
    ) {
      return;
    }

    toast(
      error.message ||
      "Failed to load links.",
      "error"
    );
  }
}


// -------------------------
// Load Analytics Summary
// -------------------------

async function loadAnalytics() {

  try {

    const response =
      await apiFetch(
        "http://localhost:3000/api/analytics"
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Failed to load analytics."
      );
    }

    if (els.previewLinks) {
      els.previewLinks.textContent =
        Number(data.totalLinks || 0);
    }

    if (els.previewClicks) {
      els.previewClicks.textContent =
        Number(data.totalClicks || 0);
    }

    els.counters.forEach(element => {

      const key =
        element.dataset.counter;

      let value = 0;

      if (key === "links") {
        value =
          Number(data.totalLinks || 0);
      }

      if (key === "clicks") {
        value =
          Number(data.totalClicks || 0);
      }

      if (key === "active") {
        value =
          Number(data.activeLinks || 0);
      }

      animateCounter(
        element,
        value
      );

    });

  } catch (error) {

    console.error(
      "Analytics error:",
      error
    );

    if (
      error.message.includes(
        "session has expired"
      )
    ) {
      return;
    }

    toast(
      error.message ||
      "Failed to load analytics.",
      "error"
    );
  }
}


// -------------------------
// Load Click Analytics
// -------------------------

async function loadClickAnalytics() {

  try {

    const response =
      await apiFetch(
        "http://localhost:3000/api/analytics/clicks"
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Failed to load click analytics."
      );
    }

    const clicksByDate = {};

    data.forEach(item => {

      clicksByDate[item.click_date] =
        Number(item.clicks || 0);

    });


    const values = [];
    const labels = [];


    // Last 7 local days
    for (let i = 6; i >= 0; i--) {

      const date = new Date();

      date.setDate(
        date.getDate() - i
      );

      const key =
        localDateKey(date);

      const label =
        date.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric"
          }
        );

      labels.push(label);

      values.push(
        clicksByDate[key] || 0
      );
    }


    renderBars(
      els.analyticsBars,
      values,
      labels
    );

    renderBars(
      els.previewBars,
      values,
      labels
    );

  } catch (error) {

    console.error(
      "Click analytics error:",
      error
    );

    if (
      error.message.includes(
        "session has expired"
      )
    ) {
      return;
    }

    toast(
      error.message ||
      "Failed to load click analytics.",
      "error"
    );
  }
}


// -------------------------
// Load Per-Link Analytics
// -------------------------

async function loadLinkAnalytics() {

  try {

    const response =
      await apiFetch(
        "http://localhost:3000/api/analytics/links"
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Failed to load link analytics."
      );
    }

    if (!els.topLinksList) return;

    if (!data.length) {

      els.topLinksList.innerHTML = `
        <p class="analytics-empty">
          No link analytics available yet.
        </p>
      `;

      return;
    }

    els.topLinksList.innerHTML =
      data.map(item => {

        const clicks =
          Number(item.clicks || 0);

        return `
          <div class="analytics-link">

            <div class="analytics-link-info">

              <strong>
                /${escapeHtml(item.short_code)}
              </strong>

              <span
                title="${escapeHtml(item.original_url)}"
              >
                ${escapeHtml(item.original_url)}
              </span>

            </div>


            <div class="analytics-link-clicks">

              <strong>
                ${clicks}
              </strong>

              <span>
                clicks
              </span>

            </div>

          </div>
        `;
      }).join("");

  } catch (error) {

    console.error(
      "Link analytics error:",
      error
    );

    if (
      error.message.includes(
        "session has expired"
      )
    ) {
      return;
    }

    if (els.topLinksList) {

      els.topLinksList.innerHTML = `
        <p class="analytics-empty">
          Failed to load link analytics.
        </p>
      `;
    }
  }
}


// -------------------------
// Create Short URL
// -------------------------

async function createShortUrl() {

  const url =
    els.input.value.trim();

  const customCode =
    els.customCode.value.trim();


  const validationError =
    validateUrl(url);

  if (validationError) {

    if (els.error) {
      els.error.textContent =
        validationError;
    }

    return;
  }


  if (els.error) {
    els.error.textContent = "";
  }


  setLoading(true);


  try {

    const response =
      await apiFetch(
        "http://localhost:3000/api/urls",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            originalUrl:
              normalizeUrl(url),

            customCode:
              customCode || null

          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Failed to create short URL."
      );
    }


    const link = {

      id:
        String(data.id),

      code:
        data.shortCode,

      shortUrl:
        `http://localhost:3000/${data.shortCode}`,

      originalUrl:
        data.originalUrl,

      createdAt:
        Date.now(),

      clicks: 0,

      active: true,

      clickDates: []

    };


    showResult(link);


    await loadLinksFromBackend();
    await loadAnalytics();
    await loadClickAnalytics();
    await loadLinkAnalytics();


    toast(
      "Your short link is ready.",
      "success"
    );


    els.input.value = "";

    if (els.customCode) {
      els.customCode.value = "";
    }

  } catch (error) {

    console.error(
      "Create URL error:",
      error
    );

    if (
      error.message.includes(
        "session has expired"
      )
    ) {
      return;
    }

    if (els.error) {
      els.error.textContent =
        error.message;
    }

    toast(
      error.message ||
      "Failed to create short URL.",
      "error"
    );

  } finally {

    setLoading(false);
  }
}


// -------------------------
// Delete One Link
// -------------------------

async function deleteLink(id) {

  try {

    const response =
      await apiFetch(
        `http://localhost:3000/api/urls/${encodeURIComponent(id)}`,
        {
          method: "DELETE"
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Failed to delete link."
      );
    }


    state.links =
      state.links.filter(
        link => String(link.id) !== String(id)
      );


    renderLinks();

    updateDashboard();

    renderPreviewLinks();

    await loadAnalytics();
    await loadClickAnalytics();
    await loadLinkAnalytics();


    toast(
      "Link deleted.",
      "success"
    );

  } catch (error) {

    console.error(
      "Delete link error:",
      error
    );

    if (
      error.message.includes(
        "session has expired"
      )
    ) {
      return;
    }

    toast(
      error.message ||
      "Failed to delete link.",
      "error"
    );
  }
}


// -------------------------
// Delete All Links
// -------------------------

async function deleteAllLinks() {

  try {

    const response =
      await apiFetch(
        "http://localhost:3000/api/urls",
        {
          method: "DELETE"
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Failed to delete links."
      );
    }


    state.links = [];

    renderLinks();

    updateDashboard();

    renderPreviewLinks();

    await loadAnalytics();
    await loadClickAnalytics();
    await loadLinkAnalytics();


    toast(
      "All links deleted.",
      "success"
    );

  } catch (error) {

    console.error(
      "Delete all links error:",
      error
    );

    if (
      error.message.includes(
        "session has expired"
      )
    ) {
      return;
    }

    toast(
      error.message ||
      "Failed to delete links.",
      "error"
    );
  }
}


// -------------------------
// Confirm Delete Modal
// -------------------------

function openDeleteConfirm(id) {

  state.pendingDeleteId = id;

  if (els.confirmModal) {
    els.confirmModal.hidden = false;
  }
}


function closeDeleteConfirm() {

  state.pendingDeleteId = null;

  if (els.confirmModal) {
    els.confirmModal.hidden = true;
  }
}


// -------------------------
// Link Actions
// -------------------------

function getLinkById(id) {

  return state.links.find(
    link =>
      String(link.id) === String(id)
  );
}


async function handleLinkAction(action, id) {

  const link =
    getLinkById(id);

  if (!link) return;


  if (action === "copy") {

    await copyText(link.shortUrl);

    return;
  }


  if (action === "qr") {

    openQrModal(
      link.shortUrl
    );

    return;
  }


  if (action === "share") {

    await shareUrl(
      link.shortUrl
    );

    return;
  }


  if (action === "delete") {

    openDeleteConfirm(id);

  }
}


// -------------------------
// Logout
// -------------------------

function logout() {

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.href =
    "login.html";
}


// -------------------------
// User Display
// -------------------------

function loadUserInfo() {

  if (!els.userName) return;

  try {

    const rawUser =
      localStorage.getItem("user");

    if (!rawUser) return;

    const user =
      JSON.parse(rawUser);

    els.userName.textContent =
      user.name ||
      user.email ||
      "";

  } catch {
    els.userName.textContent = "";
  }
}


// -------------------------
// Reveal Animations
// -------------------------

function initRevealAnimations() {
  const elements = $$(".reveal");

  if (!elements.length) return;

  if (!("IntersectionObserver" in window)) {
    elements.forEach(element => {
      element.classList.add("is-visible");
    });

    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");

          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12
    }
  );

  elements.forEach(element => {
    observer.observe(element);
  });
}


// -------------------------
// Event Listeners
// -------------------------

function initEvents() {

  // Theme
  if (els.themeToggle) {
    els.themeToggle.addEventListener(
      "click",
      toggleTheme
    );
  }


  // Mobile menu
  if (els.menuToggle) {

    els.menuToggle.addEventListener(
      "click",
      toggleMenu
    );
  }


  // Close mobile menu after navigation
  if (els.mainNav) {

    els.mainNav.addEventListener(
      "click",
      event => {

        if (
          event.target.matches(
            "a"
          )
        ) {
          closeMenu();
        }

      }
    );
  }


  // Shortener form
  if (els.form) {

    els.form.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        createShortUrl();

      }
    );
  }


  // Result copy
  if (els.copyResultBtn) {

    els.copyResultBtn.addEventListener(
      "click",
      () => {

        if (!els.resultUrl) return;

        copyText(
          els.resultUrl.href
        );

      }
    );
  }


  // Result QR
  if (els.qrResultBtn) {

    els.qrResultBtn.addEventListener(
      "click",
      () => {

        if (!els.resultUrl) return;

        openQrModal(
          els.resultUrl.href
        );

      }
    );
  }


  // Result share
  if (els.shareResultBtn) {

    els.shareResultBtn.addEventListener(
      "click",
      () => {

        if (!els.resultUrl) return;

        shareUrl(
          els.resultUrl.href
        );

      }
    );
  }


  // Search
  if (els.searchInput) {

    els.searchInput.addEventListener(
      "input",
      renderLinks
    );
  }


  // Link actions
  if (els.linksList) {

    els.linksList.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-action]"
          );

        if (!button) return;

        const action =
          button.dataset.action;

        const id =
          button.dataset.id;

        handleLinkAction(
          action,
          id
        );

      }
    );
  }


  // Clear all
  if (els.clearLinksBtn) {

    els.clearLinksBtn.addEventListener(
      "click",
      () => {

        if (!state.links.length) {

          toast(
            "There are no links to delete.",
            "info"
          );

          return;
        }

        openDeleteConfirm(
          "all"
        );

      }
    );
  }


  // Confirm delete
  if (els.confirmDelete) {

    els.confirmDelete.addEventListener(
      "click",
      async () => {

        const id =
          state.pendingDeleteId;

        closeDeleteConfirm();

        if (id === "all") {

          await deleteAllLinks();

        } else if (id) {

          await deleteLink(id);

        }

      }
    );
  }


  // Cancel delete
  if (els.cancelDelete) {

    els.cancelDelete.addEventListener(
      "click",
      closeDeleteConfirm
    );
  }


  // QR close
  if (els.qrClose) {

    els.qrClose.addEventListener(
      "click",
      closeQrModal
    );
  }


  // QR download
  if (els.downloadQrBtn) {

    els.downloadQrBtn.addEventListener(
      "click",
      downloadQr
    );
  }


  // Logout
  if (els.logoutBtn) {

    els.logoutBtn.addEventListener(
      "click",
      logout
    );
  }


  // Close modals by clicking backdrop
  if (els.qrModal) {

    els.qrModal.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          els.qrModal
        ) {
          closeQrModal();
        }

      }
    );
  }


  if (els.confirmModal) {

    els.confirmModal.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          els.confirmModal
        ) {
          closeDeleteConfirm();
        }

      }
    );
  }


  // Escape key
  document.addEventListener(
    "keydown",
    event => {

      if (event.key !== "Escape") {
        return;
      }

      closeQrModal();
      closeDeleteConfirm();
      closeMenu();

    }
  );
}


// -------------------------
// Initial Load
// -------------------------

async function init() {

  if (!checkLogin()) {
    return;
  }

  initTheme();

  loadUserInfo();

  initEvents();

  initRevealAnimations();

  if (els.year) {
    els.year.textContent =
      new Date().getFullYear();
  }


  await loadLinksFromBackend();

  await loadAnalytics();

  await loadClickAnalytics();

  await loadLinkAnalytics();

}


// -------------------------
// Start
// -------------------------

init();