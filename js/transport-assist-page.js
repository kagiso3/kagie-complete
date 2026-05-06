(function () {
  const $ = (id) => document.getElementById(id);
  const safe = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uniq = (items) => [...new Set((items || []).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const money = (v) => `R ${Number(v || 0).toLocaleString("en-ZA")}`;
  const PEOPLE = [
    { key: "adult", label: "Adult" },
    { key: "senior", label: "Senior" },
    { key: "child", label: "Child" },
    { key: "student", label: "Student" },
    { key: "sapsandf", label: "SAPSANDF" }
  ];
  let actor = null;
  let routes = [];
  let learners = [];
  let tripType = "One Way";
  let ticketMode = "current";
  let selectedRoute = null;
  let searchedRoutes = [];
  let hasSearched = false;
  let operatorFilter = "all";
  let activeDateField = "travel";
  let calendarCursor = null;
  let searchTimer = null;
  let passengerDetailsOpen = false;
  let savingTransportToCart = false;
  let sendingTicket = false;
  let passengers = { adult: 1, senior: 0, child: 0, student: 0, sapsandf: 0 };
  let passengerDetails = [];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function parseDate(value) {
    const [y, m, d] = String(value || "").split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d, 12, 0, 0, 0) : null;
  }
  function dateKey(date) {
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : "";
  }
  function startMonth(date) {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
  }
  function addDays(date, n) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }
  function addMonths(date, n) {
    return new Date(date.getFullYear(), date.getMonth() + n, 1, 12, 0, 0, 0);
  }
  function longDate(value) {
    const d = parseDate(value);
    return d ? d.toLocaleDateString("en-ZA", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Select departure date";
  }
  function monthLabel(date) {
    return date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  }
  function dayChip(value) {
    const d = parseDate(value);
    return d ? { day: d.toLocaleDateString("en-ZA", { weekday: "short" }), date: d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) } : { day: "", date: "" };
  }
  function nextWeekend() {
    const base = parseDate(todayKey()) || new Date();
    const diff = (6 - base.getDay() + 7) % 7 || 7;
    return addDays(base, diff);
  }

  function passengerMeta(type) {
    const meta = {
      adult: { label: "Adult", subtitle: "12 years and older", needsStudentFields: false },
      senior: { label: "Senior", subtitle: "Older than 60 years", needsStudentFields: false },
      child: { label: "Child", subtitle: "Younger than 12 years", needsStudentFields: false },
      student: { label: "Student", subtitle: "Registered student details are required", needsStudentFields: true },
      sapsandf: { label: "SAPSANDF", subtitle: "Official SAPS or SANDF details are required", needsStudentFields: false }
    };
    return meta[type] || { label: "Passenger", subtitle: "", needsStudentFields: false };
  }

  function deriveSouthAfricanIdMeta(idNumber) {
    const digits = String(idNumber || "").replace(/\D/g, "");
    if (digits.length !== 13) return null;
    const yearShort = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const day = Number(digits.slice(4, 6));
    if (Number.isNaN(yearShort) || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const currentYear = new Date().getFullYear() % 100;
    const year = yearShort <= currentYear ? 2000 + yearShort : 1900 + yearShort;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;
    const serial = Number(digits.slice(6, 10));
    return {
      dateOfBirth: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      gender: serial >= 5000 ? "Male" : "Female"
    };
  }

  function passengerManifest() {
    const list = [];
    PEOPLE.forEach((person) => {
      const count = Number(passengers[person.key] || 0);
      for (let i = 0; i < count; i += 1) {
        list.push({ type: person.key, ...passengerMeta(person.key) });
      }
    });
    return list;
  }

  function defaultPassenger(type, sequence) {
    return {
      type,
      sequence,
      title: "",
      firstName: "",
      surname: "",
      mobile: "",
      emergencyContact: "",
      idType: "SA ID",
      idNumber: "",
      dateOfBirth: "",
      gender: "",
      withBaby: false,
      institutionName: "",
      studentNumber: ""
    };
  }

  function syncPassengerDetailsState() {
    const manifest = passengerManifest();
    const buckets = passengerDetails.reduce((acc, detail) => {
      const key = detail?.type || "adult";
      acc[key] = acc[key] || [];
      acc[key].push(detail);
      return acc;
    }, {});
    passengerDetails = manifest.map((item, index) => {
      const bucket = buckets[item.type] || [];
      const existing = bucket.shift();
      return {
        ...defaultPassenger(item.type, index + 1),
        ...(existing || {}),
        type: item.type,
        sequence: index + 1
      };
    });
  }

  function transportCartMsg(text, tone) {
    const node = $("transportCartMessage");
    if (!node) return;
    node.textContent = text || "";
    node.className = tone ? `transport-cart-message ${tone}` : "transport-cart-message";
  }

  function passengerFormMarkup(detail, index) {
    const meta = passengerMeta(detail.type);
    const titles = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof"];
    const genders = ["Male", "Female", "Other"];
    return `
      <article class="transport-passenger-card">
        <div class="transport-passenger-head">
          <div class="transport-passenger-head-main">
            <span class="transport-user-badge">👤</span>
            <div class="transport-passenger-copy">
              <strong>Passenger ${index + 1}</strong>
              <span>${safe(meta.subtitle)}</span>
            </div>
          </div>
          <span class="passenger-type-pill">${safe(meta.label)}</span>
        </div>

        <div class="transport-passenger-grid three">
          <label class="passenger-field">
            <span class="required-label">Title</span>
            <select data-passenger-index="${index}" data-passenger-field="title">
              <option value="">Select</option>
              ${titles.map((option) => `<option value="${safe(option)}" ${detail.title === option ? "selected" : ""}>${safe(option)}</option>`).join("")}
            </select>
          </label>
          <label class="passenger-field">
            <span class="required-label">Name</span>
            <input data-passenger-index="${index}" data-passenger-field="firstName" value="${safe(detail.firstName)}" placeholder="Enter name" />
          </label>
          <label class="passenger-field">
            <span class="required-label">Surname</span>
            <input data-passenger-index="${index}" data-passenger-field="surname" value="${safe(detail.surname)}" placeholder="Enter surname" />
          </label>
        </div>

        <div class="transport-passenger-grid two">
          <label class="passenger-field">
            <span class="required-label">Mobile number</span>
            <span class="transport-phone-shell">
              <span class="transport-phone-prefix">ZA +27</span>
              <input type="tel" data-passenger-index="${index}" data-passenger-field="mobile" value="${safe(detail.mobile)}" placeholder="Enter mobile number" />
            </span>
          </label>
          <label class="passenger-field">
            <span class="required-label">Emergency telephone number</span>
            <span class="transport-phone-shell">
              <span class="transport-phone-prefix">ZA +27</span>
              <input type="tel" data-passenger-index="${index}" data-passenger-field="emergencyContact" value="${safe(detail.emergencyContact)}" placeholder="Enter emergency contact number" />
            </span>
          </label>
        </div>

        <label class="passenger-field passenger-field-full">
          <span class="required-label">Identification type</span>
          <div class="passenger-toggle-row">
            <button class="passenger-choice ${detail.idType === "SA ID" ? "active" : ""}" type="button" data-passenger-index="${index}" data-passenger-field="idType" data-passenger-value="SA ID">SA ID</button>
            <button class="passenger-choice ${detail.idType === "Passport" ? "active" : ""}" type="button" data-passenger-index="${index}" data-passenger-field="idType" data-passenger-value="Passport">Passport</button>
          </div>
        </label>

        <div class="transport-passenger-grid two">
          <label class="passenger-field">
            <span class="required-label">${detail.idType === "Passport" ? "Passport number" : "SA ID number"}</span>
            <input data-passenger-index="${index}" data-passenger-field="idNumber" value="${safe(detail.idNumber)}" placeholder="Enter document number" />
            <small class="passenger-hint">${detail.idType === "SA ID" ? "A valid South African ID can fill the date of birth and gender for you." : "Use the same passport information shown on the travel document."}</small>
          </label>
          <label class="passenger-field">
            <span class="required-label">Date of birth</span>
            <input type="date" data-passenger-index="${index}" data-passenger-field="dateOfBirth" value="${safe(detail.dateOfBirth)}" />
            <small class="passenger-hint">${detail.idType === "SA ID" ? "Check the filled date and update it if needed." : "Use the date of birth exactly as it appears on the passport."}</small>
          </label>
        </div>

        <div class="transport-passenger-grid two">
          <div class="passenger-field">
            <span class="required-label">Gender</span>
            <div class="passenger-toggle-row">
              ${genders.map((option) => `<button class="passenger-choice ${detail.gender === option ? "active" : ""}" type="button" data-passenger-index="${index}" data-passenger-field="gender" data-passenger-value="${safe(option)}">${safe(option)}</button>`).join("")}
            </div>
          </div>
          <label class="passenger-field passenger-field-switch">
            <span>With baby</span>
            <span class="passenger-switch-row">
              <small class="passenger-switch-copy">Select yes if traveling with an infant</small>
              <span class="passenger-switch">
                <input type="checkbox" data-passenger-index="${index}" data-passenger-field="withBaby" ${detail.withBaby ? "checked" : ""} />
                <span class="passenger-switch-slider"></span>
              </span>
            </span>
          </label>
        </div>

        ${meta.needsStudentFields ? `
          <div class="transport-student-grid">
            <label class="passenger-field">
              <span class="required-label">Institution</span>
              <input data-passenger-index="${index}" data-passenger-field="institutionName" value="${safe(detail.institutionName)}" placeholder="Enter university or college" />
            </label>
            <label class="passenger-field">
              <span class="required-label">Student number</span>
              <input data-passenger-index="${index}" data-passenger-field="studentNumber" value="${safe(detail.studentNumber)}" placeholder="Enter student number" />
            </label>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderPassengerForms() {
    const panel = $("transportCartSection");
    const wrap = $("transportPassengerForms");
    if (!panel || !wrap) return;
    if (actor?.role !== "user" || !selectedRoute || !passengerDetailsOpen) {
      panel.classList.add("hidden");
      wrap.innerHTML = "";
      transportCartMsg("");
      return;
    }
    syncPassengerDetailsState();
    panel.classList.remove("hidden");
    wrap.innerHTML = passengerDetails.map((detail, index) => passengerFormMarkup(detail, index)).join("");
    transportCartMsg("");
  }

  function validatePassengerDetails() {
    const required = [
      ["title", "title"],
      ["firstName", "name"],
      ["surname", "surname"],
      ["mobile", "mobile number"],
      ["emergencyContact", "emergency number"],
      ["idType", "ID type"],
      ["idNumber", "ID or passport number"],
      ["dateOfBirth", "date of birth"],
      ["gender", "gender"]
    ];
    for (let i = 0; i < passengerDetails.length; i += 1) {
      const passenger = passengerDetails[i];
      for (const [field, label] of required) {
        if (!String(passenger?.[field] || "").trim()) return `Passenger ${i + 1} still needs ${label}.`;
      }
      if (passenger.type === "student") {
        if (!String(passenger.institutionName || "").trim()) return `Passenger ${i + 1} still needs the institution name.`;
        if (!String(passenger.studentNumber || "").trim()) return `Passenger ${i + 1} still needs the student number.`;
      }
    }
    return "";
  }

  function buildTransportCartItem() {
    const studentPassengers = passengerDetails.filter((entry) => entry.type === "student");
    const studentSummary = studentPassengers.length
      ? studentPassengers.map((entry) => `${entry.firstName || "Student"} ${entry.surname || ""} | ${entry.institutionName || "Institution"} | ${entry.studentNumber || "Student number"}`).join(" ; ")
      : "";
    const routeLabel = `${selectedRoute.departureCity} to ${selectedRoute.destinationCity}`;
    return {
      id: `transport_cart_${Date.now()}`,
      clientKey: `transport_assist:${actor.id}`,
      type: "service",
      serviceCode: "transport_assist",
      serviceName: `Transport | ${routeLabel}`,
      name: `Transport | ${routeLabel}`,
      institution: routeLabel,
      price: totalFare(selectedRoute),
      quantity: 1,
      status: "Saved in cart",
      paymentStatus: "Awaiting payment",
      tripType,
      company: selectedRoute.company,
      departureCity: selectedRoute.departureCity,
      destinationCity: selectedRoute.destinationCity,
      departureTime: selectedRoute.departureTime,
      arrivalTime: selectedRoute.arrivalTime,
      travelDate: travelDate(),
      returnDate: tripType === "Round Trip" ? returnDate() : "",
      passengers: String(paxTotal()),
      passengerMix: paxBreakdown(),
      passengerDetails: passengerDetails.map((entry) => ({ ...entry })),
      note: studentSummary
        ? `Passenger details captured. Student travellers: ${studentSummary}.`
        : `Passenger details captured for ${paxBreakdown()}.`,
      transportDetails: {
        routeId: selectedRoute.id,
        routeType: selectedRoute.routeType || "Intercity coach",
        company: selectedRoute.company,
        departureCity: selectedRoute.departureCity,
        destinationCity: selectedRoute.destinationCity,
        departureTime: selectedRoute.departureTime,
        arrivalTime: selectedRoute.arrivalTime,
        duration: selectedRoute.duration,
        travelDate: travelDate(),
        returnDate: tripType === "Round Trip" ? returnDate() : "",
        tripType,
        totalFare: totalFare(selectedRoute),
        passengerCount: paxTotal(),
        passengerMix: paxBreakdown(),
        passengerDetails: passengerDetails.map((entry) => ({ ...entry })),
        routeStatus: "Saved in cart"
      }
    };
  }

  function renderTransportSummary() {
    if (!$("transportSummaryCompany")) return;
    if (!selectedRoute) {
      $("transportSummaryHeaderCount").textContent = "0";
      $("transportSummaryCompany").textContent = "Transport company";
      $("transportSummaryCode").textContent = "Route code";
      $("transportSummaryTripType").textContent = "One Way";
      $("transportSummaryFrom").textContent = "Departure";
      $("transportSummaryTo").textContent = "Destination";
      $("transportSummaryDepartAt").textContent = "Date and time";
      $("transportSummaryArriveAt").textContent = "Arrival time";
      $("transportSummaryDuration").textContent = "Travel time";
      $("transportSummaryPassengerMix").textContent = "1 Adult";
      $("transportSummaryPassengerCount").textContent = "1 passenger";
      $("transportSummaryPriceNote").textContent = "Including Kagie support fees";
      $("transportSummaryTotal").textContent = "R0";
      return;
    }
    $("transportSummaryHeaderCount").textContent = String(paxTotal());
    $("transportSummaryCompany").textContent = selectedRoute.company || "Kagie transport";
    $("transportSummaryCode").textContent = `Service ${String(selectedRoute.id || "").replace(/^trans_/, "#").toUpperCase()}`;
    $("transportSummaryTripType").textContent = tripType;
    $("transportSummaryFrom").textContent = selectedRoute.departureCity || "Departure";
    $("transportSummaryTo").textContent = selectedRoute.destinationCity || "Destination";
    $("transportSummaryDepartAt").textContent = `${longDate(travelDate())} | ${selectedRoute.departureTime || "TBC"}`;
    $("transportSummaryArriveAt").textContent = `${longDate(travelDate())} | ${selectedRoute.arrivalTime || "TBC"}`;
    $("transportSummaryDuration").textContent = selectedRoute.duration || "Travel time pending";
    $("transportSummaryPassengerMix").textContent = paxBreakdown();
    $("transportSummaryPassengerCount").textContent = `${paxTotal()} passenger${paxTotal() === 1 ? "" : "s"}`;
    $("transportSummaryPriceNote").textContent = tripType === "Round Trip" ? "Round trip total in your cart" : "One-way total in your cart";
    $("transportSummaryTotal").textContent = money(totalFare(selectedRoute));
  }

  function resetPassengerDetails() {
    passengerDetails = passengerManifest().map((item, index) => defaultPassenger(item.type, index + 1));
    renderPassengerForms();
  }

  function updatePassengerField(target) {
    const index = Number(target?.dataset?.passengerIndex);
    const field = String(target?.dataset?.passengerField || "").trim();
    if (!Number.isInteger(index) || index < 0 || !field || !passengerDetails[index]) return;
    passengerDetails[index][field] = target.type === "checkbox" ? Boolean(target.checked) : target.value;
    if (field === "idNumber" && passengerDetails[index].idType === "SA ID") {
      const derived = deriveSouthAfricanIdMeta(target.value);
      if (derived) {
        passengerDetails[index].dateOfBirth = derived.dateOfBirth;
        passengerDetails[index].gender = passengerDetails[index].gender || derived.gender;
        const scope = $("transportPassengerForms");
        const dobInput = scope?.querySelector(`[data-passenger-index="${index}"][data-passenger-field="dateOfBirth"]`);
        if (dobInput && dobInput.value !== derived.dateOfBirth) dobInput.value = derived.dateOfBirth;
        const resolvedGender = passengerDetails[index].gender || derived.gender;
        scope?.querySelectorAll(`[data-passenger-index="${index}"][data-passenger-field="gender"][data-passenger-value]`)
          .forEach((button) => button.classList.toggle("active", button.dataset.passengerValue === resolvedGender));
      }
    }
    transportCartMsg("");
  }

  function choosePassengerValue(target) {
    const index = Number(target?.dataset?.passengerIndex);
    const field = String(target?.dataset?.passengerField || "").trim();
    const value = String(target?.dataset?.passengerValue || "").trim();
    if (!Number.isInteger(index) || index < 0 || !field || !value || !passengerDetails[index]) return;
    passengerDetails[index][field] = value;
    if (field === "idType" && value === "SA ID") {
      const derived = deriveSouthAfricanIdMeta(passengerDetails[index].idNumber);
      if (derived) {
        passengerDetails[index].dateOfBirth = derived.dateOfBirth;
        passengerDetails[index].gender = passengerDetails[index].gender || derived.gender;
      }
    }
    transportCartMsg("");
    renderPassengerForms();
  }

  function msg(text, tone) {
    const n = $("adminMessage");
    if (!n) return;
    n.textContent = text || "";
    n.className = tone ? `page-message ${tone}` : "page-message";
  }
  function paxTotal() {
    return Math.max(1, Object.values(passengers).reduce((t, v) => t + Number(v || 0), 0));
  }
  function ensurePassengers() {
    if (Object.values(passengers).every((v) => Number(v || 0) <= 0)) passengers.adult = 1;
  }
  function paxSummary() {
    const filled = PEOPLE.map((p) => ({ label: p.label, value: Number(passengers[p.key] || 0) })).filter((p) => p.value > 0);
    if (!filled.length) return "1 Adult";
    if (filled.length === 1) return `${filled[0].value} ${filled[0].label}${filled[0].value === 1 ? "" : "s"}`;
    return `${paxTotal()} Passengers`;
  }
  function paxBreakdown() {
    const text = PEOPLE.map((p) => ({ label: p.label, value: Number(passengers[p.key] || 0) }))
      .filter((p) => p.value > 0)
      .map((p) => `${p.value} ${p.label}${p.value === 1 ? "" : "s"}`)
      .join(", ");
    return text || "1 passenger";
  }
  function syncPassengers() {
    ensurePassengers();
    $("passengerSummary").textContent = paxSummary();
    $("passengerBreakdown").textContent = `${paxBreakdown()} total`;
    PEOPLE.forEach((p) => { const n = $(`count-${p.key}`); if (n) n.textContent = String(passengers[p.key] || 0); });
    syncPassengerDetailsState();
    renderPassengerForms();
    renderSelected();
    if (hasSearched) renderResults();
  }
  function fill(node, placeholder, items, selected) {
    if (!node) return;
    node.innerHTML = [`<option value="">${safe(placeholder)}</option>`].concat(items.map((item) => {
      const value = item.value || item;
      const label = item.label || item;
      return `<option value="${safe(value)}" ${String(value) === String(selected || "") ? "selected" : ""}>${safe(label)}</option>`;
    })).join("");
  }
  function selectedLearner() {
    return learners.find((item) => String(item.id) === String($("learnerSelect")?.value || "")) || null;
  }
  function travelDate() { return $("travelDate")?.value || todayKey(); }
  function returnDate() { return $("returnDate")?.value || ""; }
  function priceDelta(dateValue) {
    const d = parseDate(dateValue);
    const map = { 0: 28, 1: -18, 2: -10, 3: 0, 4: 12, 5: 24, 6: 32 };
    return d ? (map[d.getDay()] || 0) : 0;
  }
  function routeFare(route, dateValue) {
    return Math.max(150, Number(route?.estimatedPrice || 0) + priceDelta(dateValue));
  }
  function totalFare(route) {
    return route ? routeFare(route, travelDate()) * paxTotal() * (tripType === "Round Trip" ? 2 : 1) : 0;
  }
  function isStaffActor() {
    return actor?.role === "master_admin" || actor?.role === "assistant_admin";
  }
  function durationMins(route) {
    const text = String(route?.duration || "");
    const h = Number((text.match(/(\d+)\s*h/i) || [])[1] || 0);
    const m = Number((text.match(/(\d+)\s*m/i) || [])[1] || 0);
    return (h * 60) + m;
  }
  function setLinks() {
    if (!actor) return;
    if (actor.role === "master_admin") {
      $("dashboardLink").href = "../master-admin/dashboard.html";
      $("dashboardLink").textContent = "Master Dashboard";
      $("homeLink").href = "../master-admin/dashboard.html";
      $("homeLink").textContent = "Control";
      $("accessBackLink").href = "../master-admin/dashboard.html";
    } else if (actor.role === "assistant_admin") {
      $("dashboardLink").href = "../assistant/dashboard.html";
      $("dashboardLink").textContent = "Assistant Dashboard";
      $("homeLink").href = "../assistant/dashboard.html";
      $("homeLink").textContent = "Back";
      $("accessBackLink").href = "../assistant/dashboard.html";
    }
  }
  function setTripType(next) {
    tripType = next === "Round Trip" ? "Round Trip" : "One Way";
    document.querySelectorAll("[data-trip-type]").forEach((btn) => btn.classList.toggle("active", btn.dataset.tripType === tripType));
    $("returnDateField").classList.toggle("hidden", tripType !== "Round Trip");
    if (tripType !== "Round Trip") $("returnDate").value = "";
    $("selectedTripType").textContent = tripType;
    syncDates();
  }
  function openModal(id) { $(id)?.classList.remove("hidden"); }
  function closeModal(id) { $(id)?.classList.add("hidden"); }
  function syncDates() {
    $("travelDateText").textContent = longDate(travelDate());
    $("returnDateText").textContent = returnDate() ? longDate(returnDate()) : "Select return date";
    renderDateRail();
    renderSelected();
    if (hasSearched) renderResults();
  }
  function renderMonth(date) {
    const first = startMonth(date);
    const offset = first.getDay();
    const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const selected = activeDateField === "return" ? returnDate() : travelDate();
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push('<span class="calendar-day empty" aria-hidden="true"></span>');
    for (let day = 1; day <= total; day += 1) {
      const key = dateKey(new Date(first.getFullYear(), first.getMonth(), day, 12, 0, 0, 0));
      const past = key < todayKey();
      cells.push(`<button class="calendar-day${key === selected ? " active" : ""}${past ? " muted" : ""}" type="button" data-calendar-date="${safe(key)}"${past ? " disabled" : ""}>${day}</button>`);
    }
    return `<section class="calendar-month"><div class="month-head">${safe(monthLabel(first))}</div><div class="weekday-row"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div><div class="day-grid">${cells.join("")}</div></section>`;
  }
  function renderCalendar() {
    $("datePickerTitle").textContent = activeDateField === "return" ? "Select return date" : "Select departure date";
    $("calendarMonths").innerHTML = renderMonth(calendarCursor) + renderMonth(addMonths(calendarCursor, 1));
  }
  function setDate(field, value) {
    if (field === "return") $("returnDate").value = value;
    else $("travelDate").value = value;
    if (field === "travel" && returnDate() && returnDate() < value) $("returnDate").value = "";
    syncDates();
  }
  function openDate(field) {
    activeDateField = field === "return" ? "return" : "travel";
    calendarCursor = startMonth(parseDate(activeDateField === "return" ? (returnDate() || travelDate()) : travelDate()) || parseDate(todayKey()));
    renderCalendar();
    openModal("datePickerModal");
  }
  function quickDate(type) {
    let d = parseDate(todayKey()) || new Date();
    if (type === "tomorrow") d = addDays(d, 1);
    if (type === "weekend") d = nextWeekend();
    setDate(activeDateField, dateKey(d));
    closeModal("datePickerModal");
  }

  function renderDateRail() {
    const wrap = $("dateChipRail");
    if (!wrap) return;
    const center = parseDate(travelDate()) || parseDate(todayKey()) || new Date();
    const best = searchedRoutes.reduce((lowest, route) => !lowest || totalFare(route) < totalFare(lowest) ? route : lowest, null);
    const chips = [];
    for (let i = -2; i <= 2; i += 1) {
      const key = dateKey(addDays(center, i));
      if (key < todayKey()) continue;
      const info = dayChip(key);
      chips.push(`<button class="date-chip ${key === travelDate() ? "active" : ""}" type="button" data-date-chip="${safe(key)}"><span>${safe(info.day)}</span><strong>${safe(info.date)}</strong><span>${safe(best ? money(routeFare(best, key)) : "Search")}</span></button>`);
    }
    wrap.innerHTML = chips.join("");
  }
  function visibleRoutes() {
    const filtered = searchedRoutes.filter((route) => operatorFilter === "all" || route.company === operatorFilter);
    const sortMode = $("sortMode")?.value || "recommended";
    return filtered.slice().sort((a, b) => {
      if (sortMode === "price") return totalFare(a) - totalFare(b);
      if (sortMode === "fastest") return durationMins(a) - durationMins(b);
      return ((routeFare(a, travelDate()) * 0.8) + (durationMins(a) * 0.35)) - ((routeFare(b, travelDate()) * 0.8) + (durationMins(b) * 0.35));
    });
  }
  function renderOperators() {
    const node = $("operatorList");
    if (!node) return;
    if (!searchedRoutes.length) {
      node.innerHTML = '<div class="empty-state"><h3>No operators yet</h3><p>Search a route first to load bus operators.</p></div>';
      return;
    }
    const grouped = searchedRoutes.reduce((acc, route) => ((acc[route.company] = acc[route.company] || []).push(route), acc), {});
    node.innerHTML = [`<button class="operator-card ${operatorFilter === "all" ? "active" : ""}" type="button" data-operator="all"><strong>All operators</strong><span>Show every result</span><em>Search wide</em></button>`]
      .concat(Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([company, items]) => `<button class="operator-card ${operatorFilter === company ? "active" : ""}" type="button" data-operator="${safe(company)}"><strong>${safe(company)}</strong><span>${safe(`${items.length} service${items.length === 1 ? "" : "s"} available`)}</span><em>${safe(money(items.reduce((low, item) => Math.min(low, totalFare(item)), Number.POSITIVE_INFINITY)))}</em></button>`))
      .join("");
  }
  function renderRecommendations() {
    const node = $("recommendationList");
    if (!node) return;
    const list = visibleRoutes();
    if (!list.length) { node.innerHTML = ""; return; }
    const cheapest = list.reduce((low, route) => !low || totalFare(route) < totalFare(low) ? route : low, null);
    const fastest = list.reduce((fast, route) => !fast || durationMins(route) < durationMins(fast) ? route : fast, null);
    node.innerHTML = [
      cheapest ? `<article class="recommendation-card"><div class="recommendation-icon green">$</div><div><div class="recommendation-title">Best Price</div><div class="recommendation-copy">Lowest total fare for this learner trip.</div></div><div class="recommendation-meta">${safe(cheapest.company)}<br>${safe(cheapest.departureTime)} - ${safe(cheapest.arrivalTime)}</div><div><div class="recommendation-price">${safe(money(totalFare(cheapest)))}</div><button class="primary-btn" type="button" data-recommend-route="${safe(cheapest.id)}">Choose</button></div></article>` : "",
      fastest ? `<article class="recommendation-card"><div class="recommendation-icon gold">!</div><div><div class="recommendation-title">Fastest Journey</div><div class="recommendation-copy">Shortest travel time on the current route search.</div></div><div class="recommendation-meta">${safe(fastest.company)}<br>${safe(fastest.departureTime)} - ${safe(fastest.arrivalTime)}</div><div><div class="recommendation-price">${safe(money(totalFare(fastest)))}</div><button class="primary-btn" type="button" data-recommend-route="${safe(fastest.id)}">Choose</button></div></article>` : ""
    ].join("");
  }
  function renderRouteCards() {
    const node = $("routeList");
    if (!node) return;
    const list = visibleRoutes();
    $("routeCountMeta").textContent = `${list.length} Service${list.length === 1 ? "" : "s"}`;
    if (!list.length) {
      node.innerHTML = '<div class="empty-state"><h3>No buses found</h3><p>Try another city pair, operator, or travel date.</p></div>';
      return;
    }
    node.innerHTML = list.map((route) => {
      const isActive = Boolean(selectedRoute && String(selectedRoute.id) === String(route.id));
      return `<article class="route-card ${isActive ? "active" : ""}"><div class="route-card-head"><div><div class="route-company">${safe(route.company)}</div><div class="route-subcopy">Service ${safe(route.id.replace(/^trans_/, "#").toUpperCase())}</div></div><div class="route-side"><strong>${safe(money(totalFare(route)))}</strong><span>Total for ${safe(String(paxTotal()))} passenger${paxTotal() === 1 ? "" : "s"}</span></div></div><div class="route-time-strip"><div class="time-block"><strong>${safe(route.departureTime || "TBC")}</strong><span>${safe(route.departureCity)}</span><small>${safe(longDate(travelDate()))}</small></div><div class="journey-line"><span class="journey-pill">${safe(route.duration || "Travel time")}</span></div><div class="time-block"><strong>${safe(route.arrivalTime || "TBC")}</strong><span>${safe(route.destinationCity)}</span><small>${safe(tripType === "Round Trip" && returnDate() ? `Return ${longDate(returnDate())}` : "Direct coach service")}</small></div></div><div class="route-meta"><span class="meta-chip blue">${safe(route.routeType || "Intercity coach")}</span><span class="meta-chip neutral">${safe(route.luggage || "Luggage included")}</span><span class="meta-chip ${String(route.bookingStatus || "").toLowerCase().includes("limit") ? "red" : "green"}">${safe(route.bookingStatus || "Available")}</span></div><div class="route-helper">${safe(route.description || "Kagie student transport route.")}</div><div class="route-actions"><button class="primary-btn" type="button" data-route-id="${safe(route.id)}">${isActive ? "Chosen Route" : "Choose Route"}</button><button class="secondary-btn" type="button" data-prefill-route="${safe(route.id)}">${isActive ? "Loaded" : "Load Details"}</button></div></article>`;
    }).join("");
  }
  function renderSelected() {
    const card = $("selectedTicketCard");
    if (!card) return;
    if (!selectedRoute) {
      card.classList.add("hidden");
      $("transportCartSection")?.classList.add("hidden");
      transportCartMsg("");
      renderTransportSummary();
      return;
    }
    const learner = selectedLearner();
    const previewMode = actor?.role === "user";
    $("selectedRouteTitle").textContent = `${selectedRoute.company} | ${selectedRoute.departureCity} to ${selectedRoute.destinationCity}`;
    $("selectedRouteCopy").textContent = previewMode
      ? `${selectedRoute.departureTime || "TBC"} departure | ${selectedRoute.arrivalTime || "TBC"} arrival | ${selectedRoute.duration || "Travel time pending"} | ${passengerDetailsOpen ? "Complete the passenger details below, then continue to cart." : "Tap Choose Route to open passenger details and continue."}`
      : `${selectedRoute.departureTime || "TBC"} departure | ${selectedRoute.arrivalTime || "TBC"} arrival | ${selectedRoute.duration || "Travel time pending"}`;
    $("selectedLearnerPill").textContent = previewMode ? (passengerDetailsOpen ? "Passenger details" : "Route preview") : (learner ? learner.fullName || learner.email || "Learner selected" : "Learner needed");
    $("selectedFare").textContent = money(totalFare(selectedRoute));
    $("selectedTripType").textContent = tripType;
    $("selectedPassengerCount").textContent = String(paxTotal());
    $("selectedFromTime").textContent = selectedRoute.departureTime || "TBC";
    $("selectedToTime").textContent = selectedRoute.arrivalTime || "TBC";
    $("selectedFromMeta").textContent = `${selectedRoute.departureCity || "Departure"} | ${longDate(travelDate())}`;
    $("selectedToMeta").textContent = selectedRoute.destinationCity || "Destination";
    $("selectedJourneyDuration").textContent = selectedRoute.duration || "Travel time";
    card.classList.toggle("preview-mode", previewMode);
    card.classList.remove("hidden");
    transportCartMsg("");
    renderTransportSummary();
    renderPassengerForms();
  }
  function renderResults() {
    if (!hasSearched) { $("routeResultsSection").classList.add("hidden"); return; }
    $("routeResultsSection").classList.remove("hidden");
    $("resultsJourneyTitle").textContent = `${$("departureFilter").value || "Departure"} to ${$("destinationFilter").value || "Destination"}`;
    $("resultsJourneyMeta").textContent = `${tripType} | ${paxBreakdown()} | ${longDate(travelDate())}${tripType === "Round Trip" && returnDate() ? ` | Return ${longDate(returnDate())}` : ""}`;
    renderDateRail();
    renderOperators();
    renderRecommendations();
    renderRouteCards();
    renderSelected();
  }
  function overlay(routesForSearch) {
    $("searchOverlayRoute").textContent = `${$("departureFilter").value || "Departure"} to ${$("destinationFilter").value || "Destination"}`;
    $("searchOverlayDate").textContent = longDate(travelDate());
    $("searchOverlayPassengers").textContent = paxBreakdown();
    $("overlayRouteCount").textContent = String(routesForSearch.length);
    $("overlayOperatorCount").textContent = String(uniq(routesForSearch.map((route) => route.company)).length);
    $("searchOverlayProgress").style.width = "18%";
    $("searchOverlay").classList.remove("hidden");
    requestAnimationFrame(() => { $("searchOverlayProgress").style.width = "100%"; });
  }
  function hideOverlay() {
    $("searchOverlay").classList.add("hidden");
    $("searchOverlayProgress").style.width = "18%";
  }
  function search(withOverlay) {
    if (isStaffActor() && !$("learnerSelect").value) return msg("Choose the learner first before searching buses.", "err");
    if (!$("departureFilter").value || !$("destinationFilter").value) return msg("Choose both departure and destination first.", "err");
    if (!travelDate()) return msg("Choose the travel date first.", "err");
    if (tripType === "Round Trip" && !returnDate()) return msg("Choose the return date for a round trip.", "err");
    msg("");
    hasSearched = true;
    operatorFilter = "all";
    if ($("sortMode")) $("sortMode").value = "recommended";
    selectedRoute = null;
    passengerDetailsOpen = false;
    searchedRoutes = routes.filter((route) => route.departureCity === $("departureFilter").value && route.destinationCity === $("destinationFilter").value);
    if (searchTimer) clearTimeout(searchTimer);
    if (withOverlay) {
      overlay(searchedRoutes);
      searchTimer = setTimeout(() => { hideOverlay(); renderResults(); $("routeResultsSection").scrollIntoView({ behavior: "smooth", block: "start" }); }, 1250);
      return;
    }
    renderResults();
  }

  async function renderTickets(targetUserId) {
    const list = $("ticketList");
    const empty = $("ticketEmpty");
    if (!list || !empty) return;
    if (isStaffActor() && !String(targetUserId || "").trim()) {
      $("ticketsHeading").textContent = "Sent Tickets";
      $("ticketsCopy").textContent = "Choose a learner first to view tickets already sent.";
      $("emptyCopy").textContent = "Select a learner to load ticket history.";
      list.innerHTML = "";
      list.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }
    if (isStaffActor()) {
      const learner = learners.find((item) => String(item.id) === String(targetUserId)) || null;
      $("ticketsHeading").textContent = learner ? `Tickets for ${learner.fullName.split(/\s+/)[0]}` : "Sent Tickets";
      $("ticketsCopy").textContent = learner ? "Track and repeat tickets already sent to this learner." : "Choose a learner first to view ticket history.";
      $("emptyCopy").textContent = learner ? `No transport tickets have been sent to ${learner.fullName.split(/\s+/)[0]} yet.` : "Select a learner to load ticket history.";
    }
    const api = window.KagieAPI;
    const rows = api.getTransportRequestsAsync ? await api.getTransportRequestsAsync(targetUserId) : (api.getTransportRequests ? api.getTransportRequests(targetUserId) : []);
    const visible = (rows || []).filter((item) => {
      const cutoff = item.returnDate || item.travelDate || "";
      return ticketMode === "past" ? cutoff && cutoff < todayKey() : !cutoff || cutoff >= todayKey();
    });
    empty.classList.toggle("hidden", visible.length > 0);
    list.classList.toggle("hidden", visible.length === 0);
    if (!visible.length) { list.innerHTML = ""; return; }
    list.innerHTML = visible.map((item) => `<article class="ticket-card"><div class="ticket-head"><div><div class="ticket-title">${safe(item.departureCity || "Departure")} to ${safe(item.destinationCity || "Destination")}</div><div class="ticket-copy">${safe(item.company || "Kagie transport")} | Ticket code ${safe(item.ticketCode || "Pending")}</div></div><span class="meta-chip ${String(item.ticketStatus || item.status || "").toLowerCase().includes("sent") ? "green" : "neutral"}">${safe(item.ticketStatus || item.status || "Ticket sent")}</span></div><div class="ticket-meta"><span class="meta-chip blue">${safe(item.travelDate || "Travel date pending")}</span><span class="meta-chip neutral">${safe(item.tripType || "One Way")}</span><span class="meta-chip neutral">${safe(`${item.passengers || "1"} passenger${String(item.passengers || "1") === "1" ? "" : "s"}`)}</span><span class="meta-chip red">${safe(money(item.estimatedPrice || 0))}</span></div><div class="ticket-copy">${safe(item.departureTime || "TBC")} departure | ${safe(item.arrivalTime || "TBC")} arrival${item.returnDate ? ` | Return ${safe(item.returnDate)}` : ""}${item.note ? ` | ${safe(item.note)}` : ""}</div><div class="ticket-footer"><span class="ticket-copy">Sent ${safe(item.sentAt ? new Date(item.sentAt).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : "today")}</span>${isStaffActor() ? `<button class="secondary-btn" type="button" data-repeat-route="${safe(item.optionId || "")}" data-repeat-from="${safe(item.departureCity || "")}" data-repeat-to="${safe(item.destinationCity || "")}" data-repeat-date="${safe(item.travelDate || "")}" data-repeat-return="${safe(item.returnDate || "")}" data-repeat-passengers="${safe(String(item.passengers || "1"))}">Book Again</button>` : ""}</div></article>`).join("");
  }
  function showStaff() {
    const isMaster = actor?.role === "master_admin";
    $("modeEyebrow").textContent = isMaster ? "Master admin transport desk" : "Assistant admin transport desk";
    $("pageTitle").textContent = "Find Your Perfect Bus";
    $("pageCopy").textContent = isMaster
      ? "Search buses in Kagie colors, choose the best route, and send the learner ticket directly into their account."
      : "Search buses in Kagie colors, choose the best route, and help Kagie send the learner ticket directly into their account.";
    $("adminBookingSection").classList.remove("hidden");
    document.body.dataset.transportRole = actor?.role || "staff";
    $("searchTripsBtn").textContent = "Search Bus Tickets";
    document.querySelector(".learner-strip")?.classList.remove("hidden");
    document.querySelector(".notes-field")?.classList.remove("hidden");
    document.querySelector(".selected-actions")?.classList.remove("hidden");
    document.querySelector(".search-overlay-card p")?.replaceChildren(document.createTextNode("Searching Kagie transport routes for your learner."));
  }
  function showUser() {
    $("modeEyebrow").textContent = "Kagie transport";
    $("pageTitle").textContent = "Find Your Perfect Bus";
    $("pageCopy").textContent = "Browse South African bus routes in Kagie, choose your ticket, complete passenger details, then continue to cart for payment.";
    $("adminBookingSection").classList.remove("hidden");
    document.body.dataset.transportRole = "user";
    $("searchTripsBtn").textContent = "Search South Africa Routes";
    document.querySelector(".learner-strip")?.classList.add("hidden");
    document.querySelector(".notes-field")?.classList.add("hidden");
    document.querySelector(".selected-actions")?.classList.add("hidden");
    $("ticketsHeading").textContent = "My Tickets";
    $("ticketsCopy").textContent = "Check the tickets Kagie has already arranged for you.";
    $("emptyCopy").textContent = "Kagie will send your transport ticket here once travel is arranged.";
    msg("Browse routes below, choose one, fill in the passenger details, then continue to cart.", "ok");
    document.querySelector(".search-overlay-card p")?.replaceChildren(document.createTextNode("Searching South African bus options for you."));
  }
  function showAccess() {
    $("modeEyebrow").textContent = "Transport access";
    $("pageTitle").textContent = "Transport Desk";
    $("pageCopy").textContent = "Only Kagie learners, assistant admins, and master admins can open this transport area.";
    $("ticketsSection").classList.add("hidden");
    $("accessSection").classList.remove("hidden");
  }

  async function init() {
    const api = window.KagieAPI;
    if (!api) return;
    try { if (api.restoreSession) await api.restoreSession(); } catch (_err) {}
    actor = api.currentUser ? api.currentUser() : null;
    if (!actor) { window.location.href = "../login.html"; return; }
    setLinks();
    routes = api.getTransportOptionsAsync ? await api.getTransportOptionsAsync() : (api.getTransportOptions ? api.getTransportOptions() : (window.KagieData?.transportOptions || []));
    if (isStaffActor()) {
      showStaff();
      const users = api.getUsersByRoleAsync ? await api.getUsersByRoleAsync("user") : api.getUsersByRole("user");
      learners = (users || []).map((u) => ({ id: u.id, fullName: u.fullName || u.name || "Learner", email: u.email || "" })).sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
      fill($("learnerSelect"), "Select learner", learners.map((u) => ({ value: u.id, label: `${u.fullName}${u.email ? ` | ${u.email}` : ""}` })));
      const q = new URLSearchParams(window.location.search).get("userId");
      if (q && learners.find((u) => String(u.id) === String(q))) $("learnerSelect").value = q;
      fill($("departureFilter"), "Enter city or bus stop", uniq(routes.map((r) => r.departureCity)));
      fill($("destinationFilter"), "Enter city or bus stop", uniq(routes.map((r) => r.destinationCity)));
      $("travelDate").value = todayKey();
      calendarCursor = startMonth(parseDate(todayKey()));
      syncDates();
      syncPassengers();
      setTripType("One Way");
      await renderTickets($("learnerSelect").value || "");
    } else if (actor.role === "user") {
      showUser();
      fill($("departureFilter"), "Enter city or bus stop", uniq(routes.map((r) => r.departureCity)));
      fill($("destinationFilter"), "Enter city or bus stop", uniq(routes.map((r) => r.destinationCity)));
      $("travelDate").value = todayKey();
      calendarCursor = startMonth(parseDate(todayKey()));
      syncDates();
      syncPassengers();
      setTripType("One Way");
      await renderTickets(actor.id);
    } else {
      showAccess();
      return;
    }
    $("travelDateTrigger")?.addEventListener("click", () => openDate("travel"));
    $("returnDateField")?.addEventListener("click", () => openDate("return"));
    $("passengerTrigger")?.addEventListener("click", () => { syncPassengers(); openModal("passengerModal"); });
    document.querySelectorAll("[data-trip-type]").forEach((btn) => btn.addEventListener("click", () => setTripType(btn.dataset.tripType)));
    document.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.closeModal)));
    $("calendarPrevBtn")?.addEventListener("click", () => { calendarCursor = addMonths(calendarCursor, -1); renderCalendar(); });
    $("calendarNextBtn")?.addEventListener("click", () => { calendarCursor = addMonths(calendarCursor, 1); renderCalendar(); });
    $("calendarMonths")?.addEventListener("click", (e) => { const btn = e.target.closest("[data-calendar-date]"); if (btn && !btn.disabled) { setDate(activeDateField, btn.dataset.calendarDate); closeModal("datePickerModal"); } });
    document.querySelectorAll("[data-quick-date]").forEach((btn) => btn.addEventListener("click", () => quickDate(btn.dataset.quickDate)));
    $("passengerModal")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-passenger-action]");
      if (!btn) return;
      const type = btn.dataset.passengerType;
      passengers[type] = Math.max(0, Number(passengers[type] || 0) + (btn.dataset.passengerAction === "increase" ? 1 : -1));
      syncPassengers();
    });
    $("applyPassengersBtn")?.addEventListener("click", () => closeModal("passengerModal"));
    $("searchTripsBtn")?.addEventListener("click", () => search(true));
    $("editSearchBtn")?.addEventListener("click", () => $("adminBookingSection").scrollIntoView({ behavior: "smooth", block: "start" }));
    $("learnerSelect")?.addEventListener("change", async () => { renderSelected(); await renderTickets($("learnerSelect").value || ""); });
    $("sortMode")?.addEventListener("change", renderResults);
    $("operatorList")?.addEventListener("click", (e) => { const btn = e.target.closest("[data-operator]"); if (btn) { operatorFilter = btn.dataset.operator || "all"; renderResults(); } });
    $("dateChipRail")?.addEventListener("click", (e) => { const btn = e.target.closest("[data-date-chip]"); if (btn) setDate("travel", btn.dataset.dateChip); });
    $("recommendationList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recommend-route]");
      if (btn) {
        selectedRoute = routes.find((r) => String(r.id) === String(btn.dataset.recommendRoute)) || null;
        passengerDetailsOpen = actor?.role === "user";
        renderRecommendations();
        renderRouteCards();
        renderSelected();
        (actor?.role === "user" ? $("transportCartSection") : $("selectedTicketCard"))?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    $("routeList")?.addEventListener("click", (e) => {
      const choose = e.target.closest("[data-route-id]");
      const prefill = e.target.closest("[data-prefill-route]");
      const routeId = choose?.dataset.routeId || prefill?.dataset.prefillRoute;
      if (!routeId) return;
      selectedRoute = routes.find((r) => String(r.id) === String(routeId)) || null;
      passengerDetailsOpen = Boolean(choose && actor?.role === "user");
      renderRecommendations();
      renderRouteCards();
      renderSelected();
      if (choose && actor?.role === "user") {
        $("transportCartSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      $("selectedTicketCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    $("transportPassengerForms")?.addEventListener("input", (e) => {
      const field = e.target.closest("[data-passenger-field]");
      if (field?.dataset?.passengerValue) return;
      if (!field) return;
      updatePassengerField(field);
    });
    $("transportPassengerForms")?.addEventListener("change", (e) => {
      const field = e.target.closest("[data-passenger-field]");
      const tagName = String(field?.tagName || "").toLowerCase();
      if (field?.dataset?.passengerValue) return;
      if (tagName === "input" && field.type !== "checkbox" && field.type !== "date") return;
      if (!field) return;
      updatePassengerField(field);
    });
    $("transportPassengerForms")?.addEventListener("click", (e) => {
      const choice = e.target.closest("[data-passenger-value]");
      if (!choice) return;
      choosePassengerValue(choice);
    });
    $("resetPassengerFormsBtn")?.addEventListener("click", () => {
      resetPassengerDetails();
      transportCartMsg("Passenger details reset. Add the travellers again when you are ready.", "ok");
    });
    $("transportBackBtn")?.addEventListener("click", () => {
      passengerDetailsOpen = false;
      selectedRoute = null;
      transportCartMsg("");
      renderRecommendations();
      renderRouteCards();
      renderSelected();
      $("routeResultsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("addTransportToCartBtn")?.addEventListener("click", async () => {
      if (actor?.role !== "user") return;
      if (savingTransportToCart) return;
      if (!selectedRoute) return transportCartMsg("Choose a route first before adding transport to the cart.", "err");
      syncPassengerDetailsState();
      const validationMessage = validatePassengerDetails();
      if (validationMessage) return transportCartMsg(validationMessage, "err");
      const payload = buildTransportCartItem();
      const button = $("addTransportToCartBtn");
      try {
        savingTransportToCart = true;
        if (button) {
          button.disabled = true;
          button.textContent = "Saving transport...";
        }
        const cartItems = api.getCartAsync ? await api.getCartAsync(actor.id) : (api.getCart ? api.getCart(actor.id) : []);
        const existing = (cartItems || []).find((item) => String(item?.serviceCode || "").trim().toLowerCase() === "transport_assist");
        if (existing) {
          const patch = {
            ...payload,
            id: existing.id,
            clientKey: existing.clientKey || payload.clientKey
          };
          if (api.updateCartItemAsync) await api.updateCartItemAsync(existing.id, patch, actor.id);
          else api.updateCartItem(existing.id, patch, actor.id);
        } else if (api.addCartItemAsync) {
          await api.addCartItemAsync(payload, actor.id);
        } else {
          api.addCartItem(payload, actor.id);
        }
        transportCartMsg("Transport saved. Opening your cart so you can continue to payment.", "ok");
        window.setTimeout(() => {
          window.location.href = "../cart.html";
        }, 180);
      } catch (error) {
        console.error(error);
        transportCartMsg(error.message || "Could not save this transport trip to the cart right now.", "err");
      } finally {
        savingTransportToCart = false;
        if (button) {
          button.disabled = false;
          button.textContent = "Continue to payment";
        }
      }
    });
    $("clearSelectionBtn")?.addEventListener("click", () => {
      passengerDetailsOpen = false;
      selectedRoute = null;
      $("ticketNote").value = "";
      renderRecommendations();
      renderRouteCards();
      renderSelected();
    });
    $("sendTicketBtn")?.addEventListener("click", async () => {
      if (sendingTicket) return;
      const learner = selectedLearner();
      if (!learner) return msg("Choose the learner first before sending the ticket.", "err");
      if (!selectedRoute) return msg("Choose a route first before sending the ticket.", "err");
      if (!travelDate()) return msg("Choose the travel date before sending the ticket.", "err");
      if (tripType === "Round Trip" && !returnDate()) return msg("Choose the return date before sending the ticket.", "err");
      const payload = { userId: learner.id, learnerName: learner.fullName, learnerEmail: learner.email, optionId: selectedRoute.id, tripType, company: selectedRoute.company, departureCity: selectedRoute.departureCity, destinationCity: selectedRoute.destinationCity, departureTime: selectedRoute.departureTime, arrivalTime: selectedRoute.arrivalTime, travelDate: travelDate(), returnDate: tripType === "Round Trip" ? returnDate() : "", passengers: String(paxTotal()), passengerMix: paxBreakdown(), note: $("ticketNote").value.trim(), estimatedPrice: totalFare(selectedRoute), supportFee: Number(selectedRoute.supportFee || 0), ticketStatus: "Ticket sent", status: "Ticket sent" };
      const button = $("sendTicketBtn");
      try {
        sendingTicket = true;
        if (button) {
          button.disabled = true;
          button.textContent = "Sending ticket...";
        }
        if (api.submitTransportRequestAsync) await api.submitTransportRequestAsync(payload, learner.id); else api.submitTransportRequest(payload, learner.id);
        msg(`Ticket sent to ${learner.fullName}.`, "ok");
        selectedRoute = null;
        $("ticketNote").value = "";
        renderSelected();
        await renderTickets(learner.id);
      } catch (err) {
        console.error(err);
        msg(err.message || "Could not send the transport ticket right now.", "err");
      } finally {
        sendingTicket = false;
        if (button) {
          button.disabled = false;
          button.textContent = "Send Ticket";
        }
      }
    });
    $("ticketList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-repeat-route]");
      if (!btn) return;
      if ($("departureFilter")) $("departureFilter").value = btn.dataset.repeatFrom || "";
      if ($("destinationFilter")) $("destinationFilter").value = btn.dataset.repeatTo || "";
      setDate("travel", btn.dataset.repeatDate || todayKey());
      if (btn.dataset.repeatReturn) setDate("return", btn.dataset.repeatReturn);
      passengers = { adult: Math.max(1, Number(btn.dataset.repeatPassengers || 1)), senior: 0, child: 0, student: 0, sapsandf: 0 };
      syncPassengers();
      search(false);
      selectedRoute = routes.find((r) => String(r.id) === String(btn.dataset.repeatRoute)) || null;
      passengerDetailsOpen = false;
      renderSelected();
      $("routeResultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("currentTicketsBtn")?.addEventListener("click", async () => { ticketMode = "current"; $("currentTicketsBtn").classList.add("active"); $("pastTicketsBtn").classList.remove("active"); await renderTickets(isStaffActor() ? ($("learnerSelect").value || "") : actor.id); });
    $("pastTicketsBtn")?.addEventListener("click", async () => { ticketMode = "past"; $("pastTicketsBtn").classList.add("active"); $("currentTicketsBtn").classList.remove("active"); await renderTickets(isStaffActor() ? ($("learnerSelect").value || "") : actor.id); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { void init(); }, { once: true });
  else void init();
})();
