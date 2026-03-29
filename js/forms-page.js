(function () {
  window.KagieFormsPageLoaded = true;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const money = (v) => `R${Number(v || 0).toLocaleString("en-ZA")}`;
  const readStore = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const asArray = (value) => Array.isArray(value) ? value : [];
  const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const catalog = window.KagieData || {};
    const packs = asArray(catalog.applicationPacks);
    const institutions = asArray(catalog.institutions);
    const highSchools = asArray(catalog.highSchools);
    const subjectCatalog = asArray(catalog.nscSubjects).length ? asArray(catalog.nscSubjects) : (asArray(catalog.iebSubjects).length ? asArray(catalog.iebSubjects) : asArray(catalog.dbeSubjects));
    const searchableHighSchools = highSchools.map((school) => ({
      ...school,
      searchKey: normalizeText([school.name, school.province, school.district, school.town].filter(Boolean).join(" "))
    }));
    const schoolsByName = searchableHighSchools.reduce((acc, school) => {
      const key = normalizeText(school.name);
      if (!key) return acc;
      const list = acc.get(key) || [];
      list.push(school);
      acc.set(key, list);
      return acc;
    }, new Map());
    const fallbackFacultySet = new Set();
    const fallbackCourseMap = new Map();
    institutions.forEach((institution) => {
      asArray(institution.faculties).forEach((faculty) => {
        if (faculty?.name) fallbackFacultySet.add(faculty.name);
        const key = normalizeText(faculty?.name);
        if (!key) return;
        if (!fallbackCourseMap.has(key)) fallbackCourseMap.set(key, new Set());
        asArray(faculty.courses).forEach((course) => {
          if (course) fallbackCourseMap.get(key).add(course);
        });
      });
    });
    const fallbackFaculties = [...fallbackFacultySet].sort((a, b) => a.localeCompare(b));
    const stepKey = "kagie_forms_section";
    const workKey = `kagie_forms_work_${user.id}`;
    const steps = [
      { key: "learner", label: "Learner details", hint: "Add your personal and contact details." },
      { key: "parent", label: "Guardian details", hint: "Capture the responsible adult details." },
      { key: "school", label: "School details", hint: "Search and confirm your school details." },
      { key: "marks", label: "Marks", hint: "Capture NSC subjects and percentages." },
      { key: "pack", label: "Package", hint: "Choose the Kagie package you want." },
      { key: "apply", label: "Institutions", hint: "Build your shortlist and course choices." }
    ];
    const defs = {
      learner: [["idNumber", "ID number"], ["fullNames", "Full names"], ["surname", "Surname"], ["maidenName", "Maiden name"], ["cellphone", "Cellphone"], ["email", "Email", "email"], ["province", "Province", "select"], ["postalCode", "Postal code"], ["dob", "Date of birth", "date"], ["gender", "Gender", "select"], ["homeLanguage", "Home language", "select"], ["address", "Home address", "textarea"]],
      parent: [["guardianRelation", "Relation"], ["guardianId", "Guardian ID"], ["guardianFullNames", "Guardian full names"], ["guardianSurname", "Guardian surname"], ["guardianCell1", "Primary phone"], ["guardianCell2", "Alternative phone"], ["guardianEmail", "Email", "email"], ["guardianProvince", "Guardian province", "select"], ["guardianPostal", "Postal code"], ["guardianAddress", "Address", "textarea"]],
      school: [["schoolName", "School name"], ["confirmName", "Confirm school name"], ["schoolProvince", "School province", "select"], ["schoolType", "School type", "select"], ["completionYear", "Completion year", "number"], ["average", "Average percent", "number"]]
    };
    const fill = (id, list, selected, label) => {
      const items = [...new Set((list || []).filter(Boolean))];
      $(id).innerHTML = [`<option value="">${esc(label)}</option>`].concat(items.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`)).join("");
      $(id).value = items.includes(selected) ? selected : "";
    };
    const setDataList = (id, items) => {
      const node = $(id);
      if (!node) return;
      const seen = new Set();
      const records = [];
      (items || []).forEach((item) => {
        const entry = typeof item === "string"
          ? { value: item, label: "" }
          : { value: item?.value, label: item?.label || "" };
        const value = String(entry.value || "").trim();
        const labelText = String(entry.label || "").trim();
        const key = `${value}__${labelText}`;
        if (!value || seen.has(key)) return;
        seen.add(key);
        records.push({ value, label: labelText });
      });
      node.innerHTML = records.slice(0, 80).map((entry) => `<option value="${esc(entry.value)}"${entry.label ? ` label="${esc(entry.label)}"` : ""}></option>`).join("");
    };
    const normPack = (pack) => !pack ? null : (packs.find((item) => item.id === pack.id) || packs.find((item) => item.name === (pack.name || pack.packName)) || null);
    const normInst = (items) => (Array.isArray(items) ? items : []).map((item, i) => ({ id: item.id || `inst_${i + 1}`, province: item.province || "", institutionType: item.institutionType || "", institutionName: item.institutionName || item.institution || "", faculty: item.faculty || "", choice1: item.choice1 || "", choice2: item.choice2 || "", choice3: item.choice3 || "" }));
    const getSchoolMatch = (name, provinceHint) => {
      const matches = schoolsByName.get(normalizeText(name)) || [];
      if (!matches.length) return null;
      if (provinceHint) return matches.find((school) => school.province === provinceHint) || matches[0];
      return matches[0];
    };
    const getFallbackCourses = (facultyName) => {
      const key = normalizeText(facultyName);
      return key ? [...(fallbackCourseMap.get(key) || [])].sort((a, b) => a.localeCompare(b)) : [];
    };

    let noticeTimer = null;
    const showNotice = (msg, tone = "info") => {
      const n = $("notice");
      n.className = `notice ${tone} show`;
      n.textContent = msg;
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        n.className = "notice info";
        n.textContent = "";
      }, 3600);
    };

    const localProfile = api.getProfile ? (api.getProfile(user.id) || {}) : {};
    const localDraft = api.ensureDraft ? api.ensureDraft(user.id) : {};
    let profile = localProfile;
    let draft = localDraft;
    try {
      if (api.getProfileAsync) {
        profile = await api.getProfileAsync(user.id) || localProfile;
      }
    } catch (error) {
      console.warn("Falling back to local profile:", error);
      profile = localProfile;
    }
    try {
      if (api.ensureDraftAsync) {
        draft = await api.ensureDraftAsync(user.id) || localDraft;
      }
    } catch (error) {
      console.warn("Falling back to local draft:", error);
      draft = localDraft;
    }
    const saved = readStore(workKey, {});
    const forms = draft.forms || {};
    const pack = normPack(draft.package);
    const state = {
      current: steps.some((s) => s.key === saved.current) ? saved.current : (steps.some((s) => s.key === localStorage.getItem(stepKey)) ? localStorage.getItem(stepKey) : "learner"),
      learner: { idNumber: saved.learner?.idNumber ?? forms.learner?.idNumber ?? profile.idNumber ?? "", fullNames: saved.learner?.fullNames ?? forms.learner?.fullNames ?? profile.fullName ?? "", surname: saved.learner?.surname ?? forms.learner?.surname ?? profile.surname ?? "", maidenName: saved.learner?.maidenName ?? forms.learner?.maidenName ?? "", cellphone: saved.learner?.cellphone ?? forms.learner?.cellphone ?? profile.phone ?? "", email: saved.learner?.email ?? forms.learner?.email ?? profile.email ?? user.email ?? "", province: saved.learner?.province ?? forms.learner?.province ?? profile.province ?? "", postalCode: saved.learner?.postalCode ?? forms.learner?.postalCode ?? profile.postalCode ?? "", dob: saved.learner?.dob ?? forms.learner?.dob ?? profile.dob ?? "", gender: saved.learner?.gender ?? forms.learner?.gender ?? profile.gender ?? "", homeLanguage: saved.learner?.homeLanguage ?? forms.learner?.homeLanguage ?? profile.homeLanguage ?? "", address: saved.learner?.address ?? forms.learner?.address ?? profile.address ?? "" },
      parent: { guardianRelation: saved.parent?.guardianRelation ?? forms.parent?.guardianRelation ?? profile.guardianRelation ?? "", guardianId: saved.parent?.guardianId ?? forms.parent?.guardianId ?? profile.guardianId ?? "", guardianFullNames: saved.parent?.guardianFullNames ?? forms.parent?.guardianFullNames ?? profile.guardianName ?? "", guardianSurname: saved.parent?.guardianSurname ?? forms.parent?.guardianSurname ?? profile.guardianSurname ?? "", guardianCell1: saved.parent?.guardianCell1 ?? forms.parent?.guardianCell1 ?? profile.guardianPhone ?? "", guardianCell2: saved.parent?.guardianCell2 ?? forms.parent?.guardianCell2 ?? profile.guardianPhoneAlt ?? "", guardianEmail: saved.parent?.guardianEmail ?? forms.parent?.guardianEmail ?? profile.guardianEmail ?? "", guardianProvince: saved.parent?.guardianProvince ?? forms.parent?.guardianProvince ?? profile.guardianProvince ?? "", guardianPostal: saved.parent?.guardianPostal ?? forms.parent?.guardianPostal ?? profile.guardianPostal ?? "", guardianAddress: saved.parent?.guardianAddress ?? forms.parent?.guardianAddress ?? profile.guardianAddress ?? "" },
      school: { schoolName: saved.school?.schoolName ?? forms.school?.schoolName ?? profile.schoolName ?? profile.schoolAttended ?? "", confirmName: saved.school?.confirmName ?? forms.school?.confirmName ?? forms.school?.schoolName ?? profile.schoolName ?? profile.schoolAttended ?? "", schoolProvince: saved.school?.schoolProvince ?? forms.school?.schoolProvince ?? profile.schoolProvince ?? "", schoolType: saved.school?.schoolType ?? forms.school?.schoolType ?? profile.schoolType ?? "", completionYear: saved.school?.completionYear ?? forms.school?.completionYear ?? profile.completionYear ?? "", average: saved.school?.average ?? forms.school?.average ?? profile.average ?? "" },
      marks: Array.isArray(saved.marks) ? clone(saved.marks) : (Array.isArray(forms.marks?.subjects) ? clone(forms.marks.subjects) : clone(profile.marks || [])),
      selectedPackId: saved.selectedPackId ?? pack?.id ?? "",
      institutions: Array.isArray(saved.institutions) && saved.institutions.length ? normInst(saved.institutions) : normInst(draft.institutions),
      apply: { province: saved.apply?.province ?? "", institutionType: saved.apply?.institutionType ?? "", institutionName: saved.apply?.institutionName ?? "", facultyName: saved.apply?.facultyName ?? "", choice1: saved.apply?.choice1 ?? "", choice2: saved.apply?.choice2 ?? "", choice3: saved.apply?.choice3 ?? "" }
    };

    const saveWork = () => {
      localStorage.setItem(stepKey, state.current);
      localStorage.setItem(workKey, JSON.stringify({ current: state.current, learner: state.learner, parent: state.parent, school: state.school, marks: state.marks, selectedPackId: state.selectedPackId, institutions: state.institutions, apply: state.apply }));
    };
    const selectedPack = () => packs.find((item) => item.id === state.selectedPackId) || null;
    const markAvg = () => !state.marks.length ? null : Math.round(state.marks.reduce((s, m) => s + Number(m.percent || 0), 0) / state.marks.length);
    const workingAvg = () => {
      const schoolAvg = Number(state.school.average);
      return !Number.isNaN(schoolAvg) && schoolAvg > 0 ? Math.round(schoolAvg) : markAvg();
    };
    const complete = (key) => ({ learner: Boolean(state.learner.fullNames && state.learner.surname && (state.learner.cellphone || state.learner.email)), parent: Boolean(state.parent.guardianFullNames && state.parent.guardianCell1), school: Boolean(state.school.schoolName && state.school.schoolProvince && state.school.completionYear), marks: state.marks.length > 0, pack: Boolean(selectedPack()), apply: state.institutions.length > 0 }[key] || false);
    const readiness = () => Math.round(steps.filter((step) => complete(step.key)).length / steps.length * 100);
    const profilePatch = () => ({ fullName: state.learner.fullNames || user.fullName || "", fullNames: state.learner.fullNames || "", surname: state.learner.surname || "", email: state.learner.email || user.email || "", phone: state.learner.cellphone || user.phone || "", cellphone: state.learner.cellphone || user.phone || "", province: state.learner.province || "", postalCode: state.learner.postalCode || "", address: state.learner.address || "", dob: state.learner.dob || "", gender: state.learner.gender || "", homeLanguage: state.learner.homeLanguage || "", idNumber: state.learner.idNumber || "", guardianRelation: state.parent.guardianRelation || "", guardianId: state.parent.guardianId || "", guardianName: state.parent.guardianFullNames || "", guardianFullNames: state.parent.guardianFullNames || "", guardianSurname: state.parent.guardianSurname || "", guardianPhone: state.parent.guardianCell1 || "", guardianCell1: state.parent.guardianCell1 || "", guardianPhoneAlt: state.parent.guardianCell2 || "", guardianCell2: state.parent.guardianCell2 || "", guardianEmail: state.parent.guardianEmail || "", guardianProvince: state.parent.guardianProvince || "", guardianPostal: state.parent.guardianPostal || "", guardianAddress: state.parent.guardianAddress || "", schoolName: state.school.schoolName || "", schoolAttended: state.school.schoolName || "", confirmName: state.school.confirmName || state.school.schoolName || "", schoolProvince: state.school.schoolProvince || "", schoolType: state.school.schoolType || "", completionYear: state.school.completionYear || "", average: state.school.average || "", marks: state.marks });

    const syncProfile = async () => {
      try {
        if (api.saveProfileAsync) await api.saveProfileAsync(user.id, profilePatch());
        else api.saveProfile(user.id, profilePatch());
        return true;
      } catch (error) {
        console.warn("Profile sync warning:", error);
        showNotice(`Draft saved, but your shared profile still needs attention: ${error.message}`, "warn");
        return false;
      }
    };

    const saveStep = async (key) => {
      try {
        if (key === "learner" || key === "parent" || key === "school") {
          if (api.saveFormSectionAsync) {
            await api.saveFormSectionAsync(key, clone(state[key]), draft.id);
          } else {
            api.saveFormSection(key, clone(state[key]), draft.id);
            await syncProfile();
          }
        }
        if (key === "marks") {
          if (api.saveFormSectionAsync) {
            await api.saveFormSectionAsync("marks", { subjects: clone(state.marks) }, draft.id);
          } else {
            api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
            await syncProfile();
          }
        }
        if (key === "pack") {
          if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, { package: selectedPack() });
          else api.updateApplication(draft.id, { package: selectedPack() });
        }
        if (key === "apply") {
          if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, { package: selectedPack(), institutions: clone(state.institutions) });
          else api.updateApplication(draft.id, { package: selectedPack(), institutions: clone(state.institutions) });
        }
        return true;
      } catch (error) {
        console.error("Could not sync step:", key, error);
        showNotice(`We kept your progress on this device, but ${key} could not fully save yet: ${error.message}`, "warn");
        return false;
      }
    };

    const saveAll = async () => {
      const results = [];
      for (const step of steps) results.push(await saveStep(step.key));
      return results.every(Boolean);
    };

    const refreshDraft = async () => {
      draft = api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(draft.id, user.id) : (api.getApplicationById(draft.id) || api.ensureDraft(user.id));
      state.institutions = normInst(draft.institutions);
      const livePack = normPack(draft.package);
      state.selectedPackId = livePack?.id || state.selectedPackId || "";
      saveWork();
    };

    const optionsFor = (name, value) => {
      if (name === "province" || name === "guardianProvince" || name === "schoolProvince") return [catalog.provinces || [], value, "Select province"];
      if (name === "gender") return [catalog.genders || [], value, "Select gender"];
      if (name === "homeLanguage") return [catalog.homeLanguages || [], value, "Select home language"];
      if (name === "schoolType") return [catalog.schoolTypes || [], value, "Select school type"];
      return [[], value, ""];
    };

    const fieldHtml = (group, name, label, type, value) => {
      if (type === "textarea") return `<div class="field-wrap" style="grid-column:span 3"><label class="label" for="${name}">${label}</label><textarea class="field" id="${name}" data-group="${group}" data-name="${name}" placeholder="${label}">${esc(value || "")}</textarea></div>`;
      if (type === "select") return `<div class="field-wrap"><label class="label" for="${name}">${label}</label><select class="field" id="${name}" data-group="${group}" data-name="${name}"></select></div>`;
      if (group === "school" && name === "schoolName") return `<div class="field-wrap"><label class="label" for="${name}">${label}</label><input class="field" id="${name}" data-group="${group}" data-name="${name}" type="text" list="schoolNameOptions" autocomplete="off" placeholder="Start typing your official school name" value="${esc(value || "")}" /></div>`;
      return `<div class="field-wrap"><label class="label" for="${name}">${label}</label><input class="field" id="${name}" data-group="${group}" data-name="${name}" type="${type || "text"}" placeholder="${label}" value="${esc(value || "")}" /></div>`;
    };

    const renderFields = (target, group) => {
      $(target).innerHTML = defs[group].map(([name, label, type]) => fieldHtml(group, name, label, type, state[group][name])).join("");
      defs[group].forEach(([name, , type]) => {
        if (type === "select") {
          const [list, value, placeholder] = optionsFor(name, state[group][name]);
          fill(name, list, value, placeholder);
        }
      });
    };

    const renderSchoolSuggestions = (query) => {
      const search = normalizeText(query);
      const provinceHint = state.school.schoolProvince;
      let matches = searchableHighSchools.filter((school) => (!search || school.searchKey.includes(search)) && (!provinceHint || school.province === provinceHint));
      if (!matches.length && provinceHint) {
        matches = searchableHighSchools.filter((school) => !search || school.searchKey.includes(search));
      }
      setDataList("schoolNameOptions", matches.slice(0, 60).map((school) => ({
        value: school.name,
        label: [school.province, school.town || school.district].filter(Boolean).join(" • ")
      })));
    };

    const syncSchoolLookup = () => {
      renderSchoolSuggestions(state.school.schoolName);
      const matched = getSchoolMatch(state.school.schoolName, state.school.schoolProvince);
      if (matched) {
        if (!state.school.schoolProvince) state.school.schoolProvince = matched.province || "";
        if (!state.school.schoolType || state.school.schoolType === "Other") state.school.schoolType = matched.schoolType || state.school.schoolType || "";
        const provinceField = $("schoolProvince");
        const typeField = $("schoolType");
        if (provinceField) provinceField.value = state.school.schoolProvince;
        if (typeField) typeField.value = state.school.schoolType;
      }
      const meta = $("schoolLookupMeta");
      if (!meta) return;
      meta.textContent = matched
        ? `${matched.name} matched in the Kagie school masterlist${matched.province ? ` • ${matched.province}` : ""}${matched.town ? ` • ${matched.town}` : ""}. You can still edit the school fields if needed.`
        : "Start typing your official school name. If it does not appear yet, you can still type it manually and keep moving.";
    };

    const renderSteps = () => {
      $("stepList").innerHTML = steps.map((step, i) => `<button class="step-btn ${state.current === step.key ? "active" : ""} ${complete(step.key) ? "done" : ""}" data-step="${step.key}" type="button"><b>${i + 1}</b><span><strong>${esc(step.label)}</strong><small>${esc(step.hint)}</small></span></button>`).join("");
    };

    const renderSummary = () => {
      const packChoice = selectedPack();
      const avg = workingAvg();
      const tips = !state.marks.length ? { title: "Add your marks", text: "Once your NSC subjects are captured, Kagie can guide a stronger shortlist." } : avg >= 70 ? { title: "Strong university readiness", text: "You look ready for a broad mix of universities and universities of technology." } : avg >= 55 ? { title: "Balanced shortlist path", text: "Combine universities, UoTs, and TVET options for wider coverage." } : { title: "Support-first strategy", text: "A blended shortlist with TVET options can give you stronger coverage." };
      $("heroTitle").textContent = `Hello, ${user.fullName || state.learner.fullNames || "Student"}`;
      $("packMeta").textContent = packChoice ? `${packChoice.name} selected` : "No package selected";
      $("instMeta").textContent = `${state.institutions.length} institution${state.institutions.length === 1 ? "" : "s"}`;
      $("markMeta").textContent = `${state.marks.length} subject${state.marks.length === 1 ? "" : "s"}`;
      $("avgMeta").textContent = avg ? `Average ${avg}%` : "Average pending";
      $("readyMeta").textContent = `${readiness()}%`;
      $("progressBar").style.width = `${readiness()}%`;
      $("stepMeta").textContent = steps.find((step) => step.key === state.current)?.label || "Learner details";
      $("stepHint").textContent = steps.find((step) => step.key === state.current)?.hint || "Complete the current section.";
      $("guideTitle").textContent = tips.title;
      $("guideText").textContent = tips.text;
      $("summaryList").innerHTML = [
        `<div class="item"><strong>${esc(packChoice ? packChoice.name : "No package selected")}</strong><p>${esc(packChoice ? `${money(packChoice.price)} | Institution limit: ${packChoice.institutionLimit === "unlimited" ? "Unlimited" : packChoice.institutionLimit}` : "Choose one Kagie package before moving to cart.")}</p></div>`,
        `<div class="item"><strong>${state.institutions.length} institution${state.institutions.length === 1 ? "" : "s"} added</strong><p>${esc(state.institutions.length ? "Your shortlist is already stored inside the draft." : "Add universities, TVET colleges, or UoTs for your shortlist.")}</p></div>`,
        `<div class="item"><strong>${state.marks.length ? `${state.marks.length} subjects stored` : "Marks not complete yet"}</strong><p>${esc(state.marks.length ? `Current working average: ${avg || 0}%` : "Add your NSC subjects and percentages so Kagie can guide your application strategy.")}</p></div>`,
        `<div class="item"><strong>Next recommended action</strong><p>${esc(!complete("learner") ? "Complete your learner details first." : !complete("parent") ? "Add guardian details for support and follow-up." : !complete("school") ? "Capture your school background and completion year." : !complete("marks") ? "Add your NSC subjects and percentages." : !complete("pack") ? "Choose the Kagie package you want to buy." : !complete("apply") ? "Add at least one institution and three course choices." : "Your draft is ready to move into cart.")}</p></div>`
      ].join("");
    };

    const renderMarks = () => {
      const avg = markAvg();
      $("marksCountPill").textContent = `${state.marks.length} subject${state.marks.length === 1 ? "" : "s"}`;
      $("marksAvgPill").textContent = avg ? `Calculated average ${avg}%` : "Average pending";
      $("marksList").innerHTML = state.marks.length ? state.marks.map((mark) => `<div class="item"><div class="row"><div><strong>${esc(mark.subject)}</strong><p>Percent: ${esc(mark.percent)}%<br>NSC level: ${esc(mark.level)}</p></div><button class="mini alt" data-remove-mark="${esc(mark.subject)}" type="button">Remove</button></div></div>`).join("") : `<div class="empty">No subjects added yet. Add each DBE or IEB NSC subject with its percent.</div>`;
    };

    const renderPacks = () => {
      const packChoice = selectedPack();
      $("packGrid").innerHTML = packs.map((item) => `<button class="pack ${packChoice?.id === item.id ? "active" : ""}" data-pack-id="${esc(item.id)}" type="button"><div class="row"><strong>${esc(item.name)}</strong><span class="badge">${esc(money(item.price))}</span></div><p>${esc(item.highlight)}</p><p>${esc(item.description)}</p><p>Institution limit: ${esc(item.institutionLimit === "unlimited" ? "Unlimited" : item.institutionLimit)}</p></button>`).join("");
      $("packSummaryCard").innerHTML = `<strong>${esc(packChoice ? `${packChoice.name} selected` : "No package selected")}</strong><p>${esc(packChoice ? `This package covers ${packChoice.institutionLimit === "unlimited" ? "an unlimited number of institutions" : `${packChoice.institutionLimit} institution${packChoice.institutionLimit === 1 ? "" : "s"}`}.` : "Choose the package that matches how many institutions you want Kagie to manage.")}</p>`;
    };

    const syncApply = () => {
      const provinceList = catalog.provinces || [];
      const typeList = [...new Set(institutions.filter((item) => !state.apply.province || item.province === state.apply.province).map((item) => item.type))];
      if (!provinceList.includes(state.apply.province)) state.apply.province = "";
      if (!typeList.includes(state.apply.institutionType)) state.apply.institutionType = "";
      const matches = institutions.filter((item) => (!state.apply.province || item.province === state.apply.province) && (!state.apply.institutionType || item.type === state.apply.institutionType));
      if (!matches.some((item) => item.name === state.apply.institutionName)) state.apply.institutionName = "";
      const chosen = matches.find((item) => item.name === state.apply.institutionName);
      const guidedFaculties = asArray(chosen?.faculties);
      const hasGuidedCatalog = guidedFaculties.length > 0;
      const facultyList = !chosen ? [] : (hasGuidedCatalog ? guidedFaculties.map((item) => item.name) : fallbackFaculties);
      const faculty = guidedFaculties.find((item) => item.name === state.apply.facultyName);
      const courseList = !chosen ? [] : (hasGuidedCatalog ? asArray(faculty?.courses) : getFallbackCourses(state.apply.facultyName));
      fill("applyProvince", provinceList, state.apply.province, "Select province");
      fill("institutionType", typeList, state.apply.institutionType, "Select institution type");
      fill("institutionName", matches.map((item) => item.name), state.apply.institutionName, "Select institution");
      $("facultyName").value = state.apply.facultyName || "";
      $("choice1").value = state.apply.choice1 || "";
      $("choice2").value = state.apply.choice2 || "";
      $("choice3").value = state.apply.choice3 || "";
      $("facultyName").placeholder = chosen ? (hasGuidedCatalog ? "Choose or type a faculty" : "Type the official faculty name") : "Select institution first";
      ["choice1", "choice2", "choice3"].forEach((fieldId, index) => {
        $(fieldId).placeholder = chosen ? (hasGuidedCatalog ? `Choose or type course ${index + 1}` : `Type official course choice ${index + 1}`) : "Select institution first";
      });
      setDataList("facultyOptions", facultyList);
      setDataList("courseOptions", courseList);
      const applyMeta = $("applyCatalogMeta");
      if (applyMeta) {
        applyMeta.textContent = !chosen
          ? "Choose an institution to load Kagie suggestions. If your faculty or course is not listed yet, type it exactly as it appears in the institution prospectus."
          : hasGuidedCatalog
            ? `${chosen.name} has curated Kagie faculty and course suggestions. You can still type the official faculty or course name if it is missing.`
            : `${chosen.name} is available nationally in Kagie. Type the official faculty and course names from the latest prospectus while the full course catalogue is being expanded.`;
      }
      const packChoice = selectedPack();
      $("instLimitPill").textContent = packChoice ? `${packChoice.name} limit: ${packChoice.institutionLimit === "unlimited" ? "Unlimited" : packChoice.institutionLimit}` : "No package selected yet";
    };

    const renderInst = () => {
      $("institutionsList").innerHTML = state.institutions.length ? state.institutions.map((item) => `<div class="item"><div class="row"><div><strong>${esc(item.institutionName)}</strong><p>Province: ${esc(item.province || "-")}<br>Type: ${esc(item.institutionType || "-")}<br>Faculty: ${esc(item.faculty || "-")}<br>Choice 1: ${esc(item.choice1 || "-")}<br>Choice 2: ${esc(item.choice2 || "-")}<br>Choice 3: ${esc(item.choice3 || "-")}</p></div><button class="mini alt" data-remove-inst="${esc(item.id)}" type="button">Remove</button></div></div>`).join("") : `<div class="empty">No institutions added yet. Choose a package first, then build your shortlist.</div>`;
    };

    const renderSections = () => {
      document.querySelectorAll("[data-step]").forEach((section) => section.classList.toggle("active", section.dataset.step === state.current));
      const i = steps.findIndex((step) => step.key === state.current);
      $("prevBtn").style.display = i <= 0 ? "none" : "inline-flex";
      $("nextBtn").textContent = state.current === "apply" ? "Add to cart" : "Next";
    };

    const renderAll = () => {
      renderFields("learnerFields", "learner");
      renderFields("parentFields", "parent");
      renderFields("schoolFields", "school");
      fill("subjectSelect", subjectCatalog, "", "Select subject");
      syncSchoolLookup();
      renderSteps();
      renderSummary();
      renderMarks();
      renderPacks();
      syncApply();
      renderInst();
      renderSections();
      saveWork();
    };

    const fieldChange = (event) => {
      const input = event.target;
      const group = input.dataset.group;
      const name = input.dataset.name;
      if (!group || !name) return;
      const previous = state[group][name];
      state[group][name] = input.value;
      if (group === "school" && name === "schoolName" && (!state.school.confirmName || normalizeText(state.school.confirmName) === normalizeText(previous))) {
        state.school.confirmName = input.value;
        const confirmField = $("confirmName");
        if (confirmField) confirmField.value = input.value;
      }
      if (group === "school" && (name === "schoolName" || name === "schoolProvince")) syncSchoolLookup();
      saveWork();
      renderSummary();
      renderSteps();
    };

    document.body.addEventListener("input", fieldChange);
    document.body.addEventListener("change", fieldChange);

    const go = async (next) => {
      await saveStep(state.current);
      state.current = next;
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    $("stepList").addEventListener("click", async (e) => {
      const button = e.target.closest("[data-step]");
      if (!button) return;
      await go(button.dataset.step);
    });

    $("addSubjectBtn").addEventListener("click", async () => {
      const subject = $("subjectSelect").value;
      const percent = Number($("subjectPercent").value);
      if (!subject || Number.isNaN(percent)) { alert("Choose a subject and enter the percent before adding it."); return; }
      if (percent < 0 || percent > 100) { alert("Percent must be between 0 and 100."); return; }
      const item = { subject, percent, level: percent >= 80 ? 7 : percent >= 70 ? 6 : percent >= 60 ? 5 : percent >= 50 ? 4 : percent >= 40 ? 3 : percent >= 30 ? 2 : 1 };
      const idx = state.marks.findIndex((mark) => mark.subject === subject);
      if (idx >= 0) state.marks[idx] = item; else state.marks.push(item);
      $("subjectSelect").value = "";
      $("subjectPercent").value = "";
      saveWork();
      renderSummary();
      renderMarks();
      renderSteps();
      try {
        if (api.saveFormSectionAsync) await api.saveFormSectionAsync("marks", { subjects: clone(state.marks) }, draft.id);
        else api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
        showNotice(`${subject} saved to your marks section.`, "success");
      } catch (error) {
        console.error(error);
        showNotice(`The subject was added here, but Kagie could not sync it yet: ${error.message}`, "warn");
      }
    });

    $("marksList").addEventListener("click", async (e) => {
      const subject = e.target.getAttribute("data-remove-mark");
      if (!subject) return;
      state.marks = state.marks.filter((item) => item.subject !== subject);
      saveWork();
      renderSummary();
      renderMarks();
      renderSteps();
      try {
        if (api.saveFormSectionAsync) await api.saveFormSectionAsync("marks", { subjects: clone(state.marks) }, draft.id);
        else api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
        showNotice(`${subject} removed from your marks.`, "info");
      } catch (error) {
        console.error(error);
        showNotice(`The mark was removed here, but Kagie could not sync it yet: ${error.message}`, "warn");
      }
    });

    $("packGrid").addEventListener("click", async (e) => {
      const button = e.target.closest("[data-pack-id]");
      if (!button) return;
      state.selectedPackId = button.dataset.packId;
      saveWork();
      renderSummary();
      renderPacks();
      renderSteps();
      syncApply();
      try {
        if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, { package: selectedPack() });
        else api.updateApplication(draft.id, { package: selectedPack() });
        showNotice("Package saved to your Kagie draft.", "success");
      } catch (error) {
        console.error(error);
        showNotice(`Package selected, but the draft could not sync yet: ${error.message}`, "warn");
      }
    });

    const applyFieldMap = { applyProvince: "province", institutionType: "institutionType", institutionName: "institutionName", facultyName: "facultyName", choice1: "choice1", choice2: "choice2", choice3: "choice3" };
    const updateApplyField = (id, value) => {
      const key = applyFieldMap[id];
      if (!key) return;
      if (id === "applyProvince" && state.apply.province !== value) {
        state.apply.institutionType = "";
        state.apply.institutionName = "";
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      } else if (id === "institutionType" && state.apply.institutionType !== value) {
        state.apply.institutionName = "";
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      } else if (id === "institutionName" && state.apply.institutionName !== value) {
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      }
      state.apply[key] = value;
      saveWork();
      syncApply();
      renderSummary();
      renderSteps();
    };

    Object.keys(applyFieldMap).forEach((id) => {
      $(id).addEventListener("change", (e) => updateApplyField(id, e.target.value));
      if (["facultyName", "choice1", "choice2", "choice3"].includes(id)) {
        $(id).addEventListener("input", (e) => updateApplyField(id, e.target.value));
      }
    });

    $("addInstitutionBtn").addEventListener("click", async () => {
      const packChoice = selectedPack();
      if (!packChoice) { alert("Select a package before adding institutions."); state.current = "pack"; renderAll(); return; }
      const chosen = institutions.find((item) => item.name === state.apply.institutionName);
      const item = {
        province: String(state.apply.province || chosen?.province || "").trim(),
        institutionType: String(state.apply.institutionType || chosen?.type || "").trim(),
        institutionName: String(state.apply.institutionName || "").trim(),
        faculty: String(state.apply.facultyName || "").trim(),
        choice1: String(state.apply.choice1 || "").trim(),
        choice2: String(state.apply.choice2 || "").trim(),
        choice3: String(state.apply.choice3 || "").trim()
      };
      if (!item.institutionName || !item.faculty || !item.choice1 || !item.choice2 || !item.choice3) { alert("Complete the institution, faculty, and all three course choices before adding."); return; }
      if (new Set([normalizeText(item.choice1), normalizeText(item.choice2), normalizeText(item.choice3)]).size !== 3) { alert("All three course choices must be different."); return; }
      if (packChoice.institutionLimit !== "unlimited" && state.institutions.length >= Number(packChoice.institutionLimit)) { alert(`Your ${packChoice.name} allows up to ${packChoice.institutionLimit} institutions.`); return; }
      if (state.institutions.some((entry) => normalizeText(entry.institutionName) === normalizeText(item.institutionName) && normalizeText(entry.faculty) === normalizeText(item.faculty))) { alert("That institution and faculty combination is already in your shortlist."); return; }
      try {
        if (api.addInstitutionToDraftAsync) await api.addInstitutionToDraftAsync(item, draft.id);
        else api.addInstitutionToDraft(item, draft.id);
        await refreshDraft();
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
        renderAll();
        showNotice(`${item.institutionName} added to your Kagie draft.`, "success");
      } catch (error) {
        console.error(error);
        showNotice(`Institution details were kept here, but Kagie could not save them yet: ${error.message}`, "warn");
      }
    });

    $("institutionsList").addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-remove-inst");
      if (!id) return;
      try {
        if (api.removeInstitutionFromDraftAsync) await api.removeInstitutionFromDraftAsync(id, draft.id);
        else api.removeInstitutionFromDraft(id, draft.id);
        await refreshDraft();
        renderAll();
        showNotice("Institution removed from your draft.", "info");
      } catch (error) {
        console.error(error);
        showNotice(`The institution could not be removed right now: ${error.message}`, "warn");
      }
    });

    $("saveBtn").addEventListener("click", async () => {
      const ok = await saveAll();
      saveWork();
      showNotice(ok ? "Your Kagie draft is fully saved." : "Your browser copy is safe, but part of the draft still needs a final sync.", ok ? "success" : "warn");
    });

    $("prevBtn").addEventListener("click", async () => {
      const i = steps.findIndex((step) => step.key === state.current);
      if (i > 0) await go(steps[i - 1].key);
    });

    $("nextBtn").addEventListener("click", async () => {
      if (state.current !== "apply") {
        const i = steps.findIndex((step) => step.key === state.current);
        if (i < steps.length - 1) await go(steps[i + 1].key);
        return;
      }

      const packChoice = selectedPack();
      if (!packChoice) { alert("Choose a Kagie package before adding your application to cart."); state.current = "pack"; renderAll(); return; }
      if (!state.institutions.length) { alert("Add at least one institution before moving to cart."); return; }
      if (packChoice.institutionLimit !== "unlimited" && state.institutions.length > Number(packChoice.institutionLimit)) { alert(`Your ${packChoice.name} only allows ${packChoice.institutionLimit} institutions.`); return; }

      const synced = await saveAll();
      try {
        if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, { package: packChoice, institutions: clone(state.institutions) });
        else api.updateApplication(draft.id, { package: packChoice, institutions: clone(state.institutions) });

        const cartItems = api.getCartAsync ? await api.getCartAsync(user.id) : (api.getCart(user.id) || []);
        for (const item of cartItems.filter((entry) => entry.type === "application_pack")) {
          if (api.removeCartItemAsync) await api.removeCartItemAsync(item.id, user.id);
          else api.removeCartItem(item.id, user.id);
        }

        const cartPayload = { id: `pack_${draft.id}`, type: "application_pack", name: packChoice.name, packName: packChoice.name, price: packChoice.price, packPrice: packChoice.price, institutionLimit: packChoice.institutionLimit, institutionCount: state.institutions.length, institutions: clone(state.institutions), learner: clone(state.learner), parentData: clone(state.parent), school: clone(state.school), marks: clone(state.marks) };
        if (api.addCartItemAsync) await api.addCartItemAsync(cartPayload, user.id);
        else api.addCartItem(cartPayload, user.id);

        await refreshDraft();
        saveWork();
        showNotice(synced ? "Your package and institutions were added to cart." : "Your package was added to cart. Some profile fields still need a final sync.", synced ? "success" : "warn");
        window.location.href = "cart.html";
      } catch (error) {
        console.error(error);
        alert(error.message || "Kagie could not move this application to cart right now.");
      }
    });

    renderAll();
    if (saved && Object.keys(saved).length) showNotice("Your last working draft was restored so you can continue from where you stopped.", "info");
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load your application workspace.");
      window.location.href = "login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
