(function () {
  "use strict";

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const MIN_YEAR = 1900;
  const STYLE_ID = "kagie-dob-wheel-style";
  let activeInput = null;
  let selected = null;
  let sheet = null;
  let installed = false;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function todayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function dateToIso(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDateParts(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3])
      };
    }

    match = raw.match(/^(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{4})$/);
    if (match) {
      return {
        day: Number(match[1]),
        month: Number(match[2]),
        year: Number(match[3])
      };
    }

    match = raw.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
    if (match) {
      const monthIndex = MONTHS.findIndex((month) => month.toLowerCase().startsWith(match[2].toLowerCase()));
      if (monthIndex >= 0) {
        return {
          day: Number(match[1]),
          month: monthIndex + 1,
          year: Number(match[3])
        };
      }
    }

    return null;
  }

  function partsToDate(parts) {
    if (!parts) return null;
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < MIN_YEAR || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function parseDate(value) {
    return partsToDate(parseDateParts(value));
  }

  function getMaxDate(input) {
    const today = todayLocal();
    const minAge = Number(input?.dataset?.minAge || input?.getAttribute?.("data-min-age") || 0);
    if (!Number.isFinite(minAge) || minAge <= 0) return today;
    return new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  }

  function normalize(value) {
    const date = parseDate(value);
    if (!date) return null;
    return {
      iso: dateToIso(date),
      display: formatDisplay(date),
      date
    };
  }

  function formatDisplay(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return "";
    return `${pad(date.getDate())} / ${pad(date.getMonth() + 1)} / ${date.getFullYear()}`;
  }

  function validateValue(value, options) {
    const minAge = Number(options?.minAge || 0);
    const date = parseDate(value);
    if (!date) return { ok: false, message: "Choose a valid date of birth." };

    const today = todayLocal();
    if (date > today) return { ok: false, message: "Date of birth cannot be in the future." };

    if (Number.isFinite(minAge) && minAge > 0) {
      const maxBirthDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
      if (date > maxBirthDate) {
        return { ok: false, message: `Learner must be at least ${minAge} years old.` };
      }
    }

    return { ok: true, message: "", iso: dateToIso(date), display: formatDisplay(date) };
  }

  function daysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
  }

  function initialSelection(input) {
    const existing = normalize(input?.dataset?.isoValue || input?.value);
    const max = getMaxDate(input);
    const base = existing?.date && existing.date <= todayLocal() ? existing.date : max;
    return {
      day: base.getDate(),
      month: base.getMonth() + 1,
      year: base.getFullYear()
    };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .kdob-field {
        cursor: pointer;
        caret-color: transparent;
        background-image: linear-gradient(135deg, rgba(229,57,53,.08), rgba(255,106,61,.08));
      }
      .kdob-field::placeholder {
        color: #8e9aaf;
      }
      .kdob-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: flex-end;
        justify-content: center;
        background: rgba(15, 23, 42, .38);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .kdob-overlay.open {
        display: flex;
        animation: kdobFade .16s ease;
      }
      .kdob-sheet {
        width: min(430px, calc(100% - 22px));
        margin: 0 auto 12px;
        border-radius: 28px;
        background: #fff;
        border: 1px solid rgba(15,23,42,.08);
        box-shadow: 0 28px 70px rgba(15, 23, 42, .24);
        overflow: hidden;
        transform: translateY(8px);
        animation: kdobRise .22s ease forwards;
      }
      .kdob-head {
        padding: 18px 18px 12px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        border-bottom: 1px solid rgba(15,23,42,.08);
      }
      .kdob-head strong {
        display: block;
        color: #333;
        font-size: 18px;
        line-height: 1.2;
      }
      .kdob-head span {
        display: block;
        margin-top: 4px;
        color: #777;
        font-size: 12px;
        line-height: 1.4;
      }
      .kdob-close {
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 50%;
        background: #f5f5f5;
        color: #333;
        font-size: 22px;
        line-height: 1;
      }
      .kdob-wheels {
        position: relative;
        display: grid;
        grid-template-columns: .9fr 1.35fr 1fr;
        gap: 8px;
        padding: 18px 14px 12px;
        background:
          linear-gradient(180deg, rgba(255,255,255,.94), transparent 34%),
          linear-gradient(0deg, rgba(255,255,255,.94), transparent 34%);
      }
      .kdob-wheels::before {
        content: "";
        position: absolute;
        left: 14px;
        right: 14px;
        top: 50%;
        height: 44px;
        transform: translateY(-50%);
        border-radius: 15px;
        background: linear-gradient(135deg, rgba(229,57,53,.10), rgba(255,106,61,.12));
        border: 1px solid rgba(229,57,53,.12);
        pointer-events: none;
      }
      .kdob-wheel {
        position: relative;
        z-index: 1;
        height: 188px;
        overflow-y: auto;
        scroll-snap-type: y mandatory;
        padding: 72px 0;
        border-radius: 18px;
        scrollbar-width: none;
      }
      .kdob-wheel::-webkit-scrollbar {
        display: none;
      }
      .kdob-option {
        width: 100%;
        height: 44px;
        border: none;
        border-radius: 14px;
        background: transparent;
        color: #777;
        font: 700 16px/1.1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        scroll-snap-align: center;
        transition: .16s ease;
      }
      .kdob-option.selected {
        color: #333;
        font-size: 18px;
        background: rgba(255,255,255,.74);
        box-shadow: 0 8px 20px rgba(15,23,42,.08);
      }
      .kdob-error {
        min-height: 20px;
        padding: 0 18px;
        color: #b00020;
        font-size: 12px;
        font-weight: 700;
      }
      .kdob-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        padding: 14px 18px 18px;
      }
      .kdob-action {
        min-height: 48px;
        border: none;
        border-radius: 16px;
        font: 800 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .kdob-action.cancel {
        background: #f5f5f5;
        color: #333;
      }
      .kdob-action.confirm {
        background: linear-gradient(135deg, #E53935, #FF6A3D);
        color: #fff;
        box-shadow: 0 14px 28px rgba(229,57,53,.22);
      }
      @keyframes kdobFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes kdobRise { to { transform: translateY(0); } }
      @media (min-width: 720px) {
        .kdob-overlay {
          align-items: center;
        }
        .kdob-sheet {
          margin-bottom: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderWheel(kind, values) {
    return `
      <div class="kdob-wheel" data-wheel="${kind}">
        ${values.map((item) => {
          const value = typeof item === "object" ? item.value : item;
          const label = typeof item === "object" ? item.label : item;
          const isSelected = Number(value) === Number(selected?.[kind]);
          return `<button class="kdob-option${isSelected ? " selected" : ""}" type="button" data-wheel-value="${value}">${label}</button>`;
        }).join("")}
      </div>
    `;
  }

  function buildSheet() {
    if (sheet) return sheet;
    sheet = document.createElement("div");
    sheet.className = "kdob-overlay";
    sheet.innerHTML = `
      <div class="kdob-sheet" role="dialog" aria-modal="true" aria-label="Choose date of birth">
        <div class="kdob-head">
          <div>
            <strong>Date of birth</strong>
            <span>Scroll or tap Day / Month / Year.</span>
          </div>
          <button class="kdob-close" type="button" aria-label="Close date picker">&times;</button>
        </div>
        <div class="kdob-wheels"></div>
        <div class="kdob-error" role="alert"></div>
        <div class="kdob-actions">
          <button class="kdob-action cancel" type="button">Cancel</button>
          <button class="kdob-action confirm" type="button">Use date</button>
        </div>
      </div>
    `;
    document.body.appendChild(sheet);

    sheet.addEventListener("click", (event) => {
      if (event.target === sheet || event.target.closest(".kdob-close") || event.target.closest(".kdob-action.cancel")) {
        close();
        return;
      }

      const option = event.target.closest(".kdob-option");
      if (option) {
        const wheel = option.closest("[data-wheel]")?.getAttribute("data-wheel");
        const value = Number(option.getAttribute("data-wheel-value"));
        if (wheel && Number.isFinite(value)) {
          selected[wheel] = value;
          clampSelectedDay();
          render();
        }
        return;
      }

      if (event.target.closest(".kdob-action.confirm")) {
        confirm();
      }
    });

    sheet.addEventListener("scroll", (event) => {
      const wheel = event.target.closest?.("[data-wheel]");
      if (!wheel) return;
      const kind = wheel.getAttribute("data-wheel");
      const itemHeight = 44;
      const index = Math.round(wheel.scrollTop / itemHeight);
      const button = wheel.querySelectorAll(".kdob-option")[index];
      const value = Number(button?.getAttribute("data-wheel-value"));
      if (kind && Number.isFinite(value) && selected[kind] !== value) {
        selected[kind] = value;
        clampSelectedDay();
        wheel.querySelectorAll(".kdob-option").forEach((option) => {
          option.classList.toggle("selected", Number(option.getAttribute("data-wheel-value")) === selected[kind]);
        });
        if (kind !== "day") {
          window.clearTimeout(wheel._kdobRenderTimer);
          wheel._kdobRenderTimer = window.setTimeout(() => render(), 120);
        }
      }
    }, true);

    return sheet;
  }

  function clampSelectedDay() {
    const maxDay = daysInMonth(selected.year, selected.month);
    if (selected.day > maxDay) selected.day = maxDay;
  }

  function render(options) {
    const overlay = buildSheet();
    const wheels = overlay.querySelector(".kdob-wheels");
    const maxDate = getMaxDate(activeInput);
    const maxYear = maxDate.getFullYear();
    const years = [];
    for (let year = maxYear; year >= MIN_YEAR; year -= 1) years.push(year);
    const days = [];
    for (let day = 1; day <= daysInMonth(selected.year, selected.month); day += 1) days.push({ value: day, label: pad(day) });
    const months = MONTHS.map((month, index) => ({ value: index + 1, label: month.slice(0, 3) }));

    wheels.innerHTML = [
      renderWheel("day", days),
      renderWheel("month", months),
      renderWheel("year", years)
    ].join("");

    if (!options?.preserveScroll) {
      window.requestAnimationFrame(() => {
        wheels.querySelectorAll(".kdob-wheel").forEach((wheel) => {
          const selectedOption = wheel.querySelector(".kdob-option.selected");
          if (selectedOption) {
            wheel.scrollTop = Math.max(0, selectedOption.offsetTop - 72);
          }
        });
      });
    }
  }

  function setError(message) {
    const error = sheet?.querySelector(".kdob-error");
    if (error) error.textContent = message || "";
  }

  function confirm() {
    if (!activeInput || !selected) return close();
    const date = partsToDate(selected);
    const iso = date ? dateToIso(date) : "";
    const minAge = Number(activeInput.dataset.minAge || 0);
    const result = validateValue(iso, { minAge });
    if (!result.ok) {
      setError(result.message);
      return;
    }

    activeInput.dataset.isoValue = result.iso;
    activeInput.value = result.display;
    activeInput.classList.add("kdob-field");
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeInput.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }

  function open(input) {
    if (!input) return;
    injectStyle();
    activeInput = input;
    activeInput.classList.add("kdob-field");
    activeInput.readOnly = true;
    selected = initialSelection(input);
    const overlay = buildSheet();
    setError("");
    render();
    overlay.classList.add("open");
  }

  function close() {
    if (sheet) sheet.classList.remove("open");
    activeInput = null;
    selected = null;
  }

  function syncField(input) {
    if (!input) return;
    injectStyle();
    input.classList.add("kdob-field");
    input.readOnly = true;
    const normalized = normalize(input.dataset.isoValue || input.value);
    if (normalized) {
      input.dataset.isoValue = normalized.iso;
      input.value = normalized.display;
    }
  }

  function attachAll(root) {
    injectStyle();
    (root || document).querySelectorAll("[data-dob-wheel]").forEach(syncField);
    installDelegates();
  }

  function installDelegates() {
    if (installed) return;
    installed = true;
    document.addEventListener("click", (event) => {
      const input = event.target.closest?.("[data-dob-wheel]");
      if (input) open(input);
    });
    document.addEventListener("focusin", (event) => {
      const input = event.target.closest?.("[data-dob-wheel]");
      if (input) open(input);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  window.KagieDobWheel = {
    attachAll,
    syncField,
    open,
    close,
    normalize,
    formatDisplay,
    validateValue
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => attachAll(document));
  } else {
    attachAll(document);
  }
})();
