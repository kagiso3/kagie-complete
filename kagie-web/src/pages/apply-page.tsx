import type { ApplicationMark, ApplicationPack } from "@kagie/shared";
import { useDeferredValue, useEffect, useState } from "react";
import { Button, Card, EmptyState, SectionHeading, SelectField, StatusPill, TextAreaField, TextField } from "../components/ui";
import { ensureNationalCatalogLoaded } from "../lib/runtime";
import type { KagieApplication, KagieFavorite, KagieInstitution, KagieUser, LegacyApi, ProtectedRouteKey } from "../lib/types";

function text(value: unknown) {
  return String(value || "");
}

function asArray<T>(value: unknown) {
  return (Array.isArray(value) ? value : []) as T[];
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function readSavedState(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function ApplyPage({
  api,
  user,
  onNavigate
}: {
  api: LegacyApi;
  user: KagieUser;
  onNavigate: (route: ProtectedRouteKey) => void;
}) {
  const storageKey = `kagie_react_apply_${user.id}`;
  const currentYear = String(new Date().getFullYear());
  const sharedCatalog = (window.KagieData || {}) as Record<string, unknown>;
  const provinces = asArray<string>(sharedCatalog.provinces).map((item) => text(item));
  const genders = asArray<string>(sharedCatalog.genders).map((item) => text(item));
  const homeLanguages = asArray<string>(sharedCatalog.homeLanguages).map((item) => text(item));
  const schoolTypes = asArray<string>(sharedCatalog.schoolTypes).map((item) => text(item));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<KagieApplication | null>(null);
  const [favorites, setFavorites] = useState<KagieFavorite[]>([]);
  const [packs, setPacks] = useState<ApplicationPack[]>([]);
  const [institutions, setInstitutions] = useState<Array<Record<string, unknown>>>([]);
  const [learner, setLearner] = useState<Record<string, string>>({});
  const [parent, setParent] = useState<Record<string, string>>({});
  const [school, setSchool] = useState<Record<string, string>>({});
  const [apply, setApply] = useState<Record<string, string>>({
    year: currentYear,
    province: "",
    institutionType: "",
    institutionSearch: "",
    institutionName: "",
    facultyName: "",
    choice1: "",
    choice2: "",
    choice3: ""
  });
  const [marks, setMarks] = useState<ApplicationMark[]>([]);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectPercent, setSubjectPercent] = useState("");
  const [schoolMatches, setSchoolMatches] = useState<Array<Record<string, unknown>>>([]);

  const deferredInstitutionSearch = useDeferredValue(text(apply.institutionSearch));
  const deferredSchoolSearch = useDeferredValue(text(school.schoolName));

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const saved = readSavedState(storageKey);
        const loadedProfile = api.getProfileAsync ? await api.getProfileAsync(user.id) : api.getProfile?.(user.id) || {};
        const workingDraft = api.ensureDraftAsync ? await api.ensureDraftAsync(user.id) : api.ensureDraft(user.id);
        const loadedFavorites = api.getFavoritesAsync ? await api.getFavoritesAsync(user.id) : api.getFavorites(user.id);
        const forms = (workingDraft.forms || {}) as Record<string, Record<string, unknown>>;
        const learnerSource = { ...(loadedProfile || {}), ...(forms.learner || {}), ...((saved.learner as Record<string, unknown>) || {}) };
        const parentSource = { ...(loadedProfile || {}), ...(forms.parent || {}), ...((saved.parent as Record<string, unknown>) || {}) };
        const schoolSource = { ...(loadedProfile || {}), ...(forms.school || {}), ...((saved.school as Record<string, unknown>) || {}) };

        if (!active) return;

        setDraft(workingDraft);
        setPacks(api.getPackCatalog());
        setFavorites(loadedFavorites || []);
        setInstitutions(asArray<Record<string, unknown>>(workingDraft.institutions));
        setSelectedPackId(text(saved.selectedPackId || workingDraft.package?.id));
        setMarks((saved.marks as ApplicationMark[]) || asArray<ApplicationMark>(forms.marks?.subjects) || asArray<ApplicationMark>(workingDraft.marks));
        setLearner({
          idNumber: text(learnerSource.idNumber),
          fullNames: text(learnerSource.fullNames || user.fullName),
          surname: text(learnerSource.surname),
          maidenName: text(learnerSource.maidenName),
          cellphone: text(learnerSource.cellphone || user.phone),
          email: text(learnerSource.email || user.email),
          province: text(learnerSource.province),
          postalCode: text(learnerSource.postalCode),
          dob: text(learnerSource.dob),
          gender: text(learnerSource.gender),
          homeLanguage: text(learnerSource.homeLanguage),
          address: text(learnerSource.address)
        });
        setParent({
          guardianRelation: text(parentSource.guardianRelation || parentSource.relation),
          guardianId: text(parentSource.guardianId),
          guardianFullNames: text(parentSource.guardianFullNames || parentSource.fullNames),
          guardianSurname: text(parentSource.guardianSurname || parentSource.surname),
          guardianCell1: text(parentSource.guardianCell1 || parentSource.phone1),
          guardianCell2: text(parentSource.guardianCell2 || parentSource.phone2),
          guardianEmail: text(parentSource.guardianEmail || parentSource.email),
          guardianProvince: text(parentSource.guardianProvince || parentSource.province),
          guardianPostal: text(parentSource.guardianPostal || parentSource.postalCode),
          guardianAddress: text(parentSource.guardianAddress || parentSource.address)
        });
        setSchool({
          schoolName: text(schoolSource.schoolName),
          confirmName: text(schoolSource.confirmName || schoolSource.schoolName),
          schoolProvince: text(schoolSource.schoolProvince),
          schoolType: text(schoolSource.schoolType),
          completionYear: text(schoolSource.completionYear),
          average: text(schoolSource.average)
        });
        setApply(
          (saved.apply as Record<string, string>) || {
            year: currentYear,
            province: "",
            institutionType: "",
            institutionSearch: "",
            institutionName: "",
            facultyName: "",
            choice1: "",
            choice2: "",
            choice3: ""
          }
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [api, currentYear, storageKey, user]);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(storageKey, JSON.stringify({ learner, parent, school, marks, apply, selectedPackId }));
  }, [apply, learner, loading, marks, parent, school, selectedPackId, storageKey]);

  useEffect(() => {
    let active = true;
    const query = normalize(deferredSchoolSearch);
    if (query.length < 2) {
      setSchoolMatches([]);
      return;
    }

    (async () => {
      await ensureNationalCatalogLoaded();
      const highSchools = api.getHighSchoolCatalog ? api.getHighSchoolCatalog() : [];
      const matches = highSchools.filter((item) => normalize(text(item.name)).includes(query)).slice(0, 8);
      if (active) setSchoolMatches(matches);
    })();

    return () => {
      active = false;
    };
  }, [api, deferredSchoolSearch]);

  const subjectCatalog = api.getSubjectCatalog ? api.getSubjectCatalog() : [];
  const years = api.getInstitutionYears ? api.getInstitutionYears() : [currentYear];
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) || null;
  const aps = api.calculateAps(marks);
  const recommendationSummary = api.getApplicationRecommendations({ marks, limit: 6 }) || { safeAlternatives: [], warnings: [] };

  const institutionPool = api.getInstitutionCatalog({ year: text(apply.year || currentYear), includeInactive: true });
  const filteredInstitutionPool = institutionPool.filter((institution) => {
    if (text(apply.province) && institution.province !== text(apply.province)) return false;
    if (text(apply.institutionType) && institution.type !== text(apply.institutionType)) return false;
    if (deferredInstitutionSearch && !normalize(institution.name).includes(normalize(deferredInstitutionSearch))) return false;
    return true;
  });
  const institutionTypes = [...new Set(institutionPool.filter((item) => !text(apply.province) || item.province === text(apply.province)).map((item) => item.type).filter(Boolean))];
  const selectedInstitution = filteredInstitutionPool.find((item) => item.name === text(apply.institutionName)) || institutionPool.find((item) => item.name === text(apply.institutionName)) || null;
  const facultyOptions = selectedInstitution?.faculties?.map((item) => item.name) || [];
  const chosenFaculty = selectedInstitution?.faculties?.find((item) => item.name === text(apply.facultyName)) || null;
  const courseOptions = chosenFaculty?.courses || [];

  const learnerFields = [
    ["idNumber", "ID number"],
    ["fullNames", "Full names"],
    ["surname", "Surname"],
    ["maidenName", "Maiden name"],
    ["cellphone", "Cellphone"],
    ["email", "Email"],
    ["postalCode", "Postal code"],
    ["dob", "Date of birth"]
  ] as const;
  const parentFields = [
    ["guardianRelation", "Relation"],
    ["guardianId", "Guardian ID"],
    ["guardianFullNames", "Full names"],
    ["guardianSurname", "Surname"],
    ["guardianCell1", "Primary phone"],
    ["guardianCell2", "Alternative phone"],
    ["guardianEmail", "Email"],
    ["guardianPostal", "Postal code"]
  ] as const;
  const schoolFields = [
    ["schoolName", "School name"],
    ["confirmName", "Confirm school name"],
    ["completionYear", "Completion year"],
    ["average", "Average percent"]
  ] as const;

  async function refreshFavorites() {
    const next = api.getFavoritesAsync ? await api.getFavoritesAsync(user.id) : api.getFavorites(user.id);
    setFavorites(next || []);
  }

  async function saveDraft(showMessage = true) {
    setSaving(true);
    try {
      const workingDraft = draft || (api.ensureDraftAsync ? await api.ensureDraftAsync(user.id) : api.ensureDraft(user.id));
      const profilePatch = { ...learner, ...parent, ...school, relation: parent.guardianRelation };
      if (api.saveProfileAsync) await api.saveProfileAsync(user.id, profilePatch);
      else if (api.saveProfile) api.saveProfile(user.id, profilePatch);

      let nextDraft = api.saveFormSectionAsync
        ? await api.saveFormSectionAsync("learner", learner, workingDraft.id)
        : api.saveFormSection("learner", learner, workingDraft.id);
      nextDraft = api.saveFormSectionAsync
        ? await api.saveFormSectionAsync("parent", parent, nextDraft.id)
        : api.saveFormSection("parent", parent, nextDraft.id);
      nextDraft = api.saveFormSectionAsync
        ? await api.saveFormSectionAsync("school", school, nextDraft.id)
        : api.saveFormSection("school", school, nextDraft.id);
      nextDraft = api.saveFormSectionAsync
        ? await api.saveFormSectionAsync("marks", { subjects: marks }, nextDraft.id)
        : api.saveFormSection("marks", { subjects: marks }, nextDraft.id);

      if (selectedPack) {
        nextDraft = api.updateApplicationAsync
          ? await api.updateApplicationAsync(nextDraft.id, { package: selectedPack })
          : api.updateApplication
            ? api.updateApplication(nextDraft.id, { package: selectedPack })
            : nextDraft;
      }

      setDraft(nextDraft);
      if (showMessage) setNotice("Your Kagie draft was saved.");
      return nextDraft;
    } finally {
      setSaving(false);
    }
  }

  function updateRecord(
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    key: string,
    value: string
  ) {
    setter((current) => ({ ...current, [key]: value }));
  }

  function addMark() {
    const percent = Number(subjectPercent);
    if (!subjectName || Number.isNaN(percent) || percent < 0 || percent > 100) {
      setNotice("Choose a subject and enter a valid percent.");
      return;
    }
    const level = api.calculateNscLevel ? api.calculateNscLevel(percent) : percent >= 80 ? 7 : percent >= 70 ? 6 : percent >= 60 ? 5 : percent >= 50 ? 4 : percent >= 40 ? 3 : percent >= 30 ? 2 : 1;
    const next = marks.filter((item) => item.subject !== subjectName);
    next.push({ id: `mark_${subjectName}`, subject: subjectName, percent, level });
    setMarks(next);
    setSubjectName("");
    setSubjectPercent("");
    setNotice(`${subjectName} added to marks.`);
  }

  async function saveFavorite(type: "institution" | "course") {
    if (type === "institution") {
      if (!selectedInstitution) {
        setNotice("Choose an institution first.");
        return;
      }
      const payload = { type, institutionId: selectedInstitution.id, institutionName: selectedInstitution.name, province: selectedInstitution.province, year: selectedInstitution.year };
      if (api.addFavoriteAsync) await api.addFavoriteAsync(payload, user.id);
      else api.addFavorite(payload, user.id);
      await refreshFavorites();
      setNotice(`${selectedInstitution.name} saved to favorites.`);
      return;
    }

    if (!selectedInstitution || !text(apply.choice1)) {
      setNotice("Choose an institution and first course choice before saving a course.");
      return;
    }
    const payload = { type, institutionId: selectedInstitution.id, institutionName: selectedInstitution.name, province: selectedInstitution.province, faculty: text(apply.facultyName), course: text(apply.choice1) };
    if (api.addFavoriteAsync) await api.addFavoriteAsync(payload, user.id);
    else api.addFavorite(payload, user.id);
    await refreshFavorites();
    setNotice(`${text(apply.choice1)} saved to favorites.`);
  }

  async function addInstitution() {
    if (!selectedPack) {
      setNotice("Choose a package before adding institutions.");
      return;
    }
    if (!selectedInstitution) {
      setNotice("Choose an institution first.");
      return;
    }
    if (selectedInstitution.canApply === false || selectedInstitution.status === "closed") {
      setNotice("Applications for this institution are closed.");
      return;
    }
    if (selectedPack.institutionLimit !== "unlimited" && institutions.length >= Number(selectedPack.institutionLimit || 0)) {
      setNotice("You have reached your institution limit.");
      return;
    }

    const workingDraft = await saveDraft(false);
    const payload = {
      institutionId: selectedInstitution.id,
      institutionName: selectedInstitution.name,
      province: selectedInstitution.province,
      institutionType: selectedInstitution.type,
      year: text(apply.year || currentYear),
      institutionStatus: selectedInstitution.status,
      closingDate: selectedInstitution.closingDate || "",
      faculty: text(apply.facultyName),
      choice1: text(apply.choice1),
      choice2: text(apply.choice2),
      choice3: text(apply.choice3)
    };
    const nextDraft = api.addInstitutionToDraftAsync ? await api.addInstitutionToDraftAsync(payload, workingDraft.id) : api.addInstitutionToDraft(payload, workingDraft.id);
    setDraft(nextDraft);
    setInstitutions(asArray<Record<string, unknown>>(nextDraft.institutions));
    setApply((current) => ({ ...current, institutionSearch: "", institutionName: "", facultyName: "", choice1: "", choice2: "", choice3: "" }));
    setNotice(`${selectedInstitution.name} added to your shortlist.`);
  }

  async function removeInstitution(institutionId: string) {
    if (!draft) return;
    const nextDraft = api.removeInstitutionFromDraftAsync
      ? await api.removeInstitutionFromDraftAsync(institutionId, draft.id)
      : api.removeInstitutionFromDraft
        ? api.removeInstitutionFromDraft(institutionId, draft.id)
        : draft;
    setDraft(nextDraft);
    setInstitutions(asArray<Record<string, unknown>>(nextDraft.institutions));
  }

  async function addToCart() {
    if (!selectedPack) {
      setNotice("Choose a package before sending your application to cart.");
      return;
    }
    if (!institutions.length) {
      setNotice("Add at least one institution first.");
      return;
    }

    const workingDraft = await saveDraft(false);
    const cartPayload = {
      id: `pack_${workingDraft.id}`,
      clientKey: `pack_${workingDraft.id}`,
      type: "application_pack",
      name: selectedPack.name,
      packName: selectedPack.name,
      price: selectedPack.price,
      packPrice: selectedPack.price,
      institutionLimit: selectedPack.institutionLimit,
      institutionCount: institutions.length,
      institutions,
      learner,
      parentData: parent,
      school,
      marks
    };

    (api.getCart(user.id) || [])
      .filter((entry) => entry.type === "application_pack")
      .forEach((entry) => api.removeCartItem(entry.id, user.id));
    api.addCartItem(cartPayload, user.id);
    if (api.addCartItemAsync) await api.addCartItemAsync(cartPayload, user.id);
    if (api.updateApplicationAsync) await api.updateApplicationAsync(workingDraft.id, { package: selectedPack, institutions });
    setNotice("Your package and institutions were added to cart.");
    onNavigate("cart");
  }

  if (loading) {
    return <div className="kg-loading-inline">Loading your React application workspace...</div>;
  }

  return (
    <div className="kg-page-stack">
      <Card className="kg-hero-card soft">
        <SectionHeading
          eyebrow="Application workspace"
          title="Kagie React apply flow"
          copy="The same learner, guardian, school, marks, package, and shortlist flow now runs in a cleaner React shell."
          actions={
            <div className="kg-action-row">
              <Button tone="ghost" onClick={() => void saveDraft()} disabled={saving}>
                {saving ? "Saving..." : "Save draft"}
              </Button>
              <Button onClick={() => void addToCart()} disabled={saving}>
                Add to cart
              </Button>
            </div>
          }
        />
        <div className="kg-metric-grid">
          <div className="kg-summary-chip">{marks.length} subjects</div>
          <div className="kg-summary-chip">APS {aps.total ?? "Pending"}</div>
          <div className="kg-summary-chip">{selectedPack ? selectedPack.name : "No package selected"}</div>
          <div className="kg-summary-chip">{institutions.length} institutions</div>
        </div>
        {notice ? <div className="kg-inline-message info">{notice}</div> : null}
      </Card>

      <Card>
        <SectionHeading title="Learner details" copy="Profile auto-fill stays in place so students do not keep repeating themselves." />
        <div className="kg-form-grid">
          {learnerFields.map(([key, label]) => (
            <TextField
              key={key}
              label={label}
              value={text(learner[key])}
              onChange={(value) => updateRecord(setLearner, key, value)}
              type={key === "email" ? "email" : key === "dob" ? "date" : "text"}
            />
          ))}
          <SelectField label="Province" value={text(learner.province)} onChange={(value) => updateRecord(setLearner, "province", value)} options={provinces} />
          <SelectField label="Gender" value={text(learner.gender)} onChange={(value) => updateRecord(setLearner, "gender", value)} options={genders} />
          <SelectField label="Home language" value={text(learner.homeLanguage)} onChange={(value) => updateRecord(setLearner, "homeLanguage", value)} options={homeLanguages} />
          <TextAreaField label="Address" value={text(learner.address)} onChange={(value) => updateRecord(setLearner, "address", value)} />
        </div>
      </Card>

      <Card>
        <SectionHeading title="Guardian details" copy="Guardian information stays part of the same draft." />
        <div className="kg-form-grid">
          {parentFields.map(([key, label]) => (
            <TextField key={key} label={label} value={text(parent[key])} onChange={(value) => updateRecord(setParent, key, value)} type={key === "guardianEmail" ? "email" : "text"} />
          ))}
          <SelectField label="Province" value={text(parent.guardianProvince)} onChange={(value) => updateRecord(setParent, "guardianProvince", value)} options={provinces} />
          <TextAreaField label="Address" value={text(parent.guardianAddress)} onChange={(value) => updateRecord(setParent, "guardianAddress", value)} />
        </div>
      </Card>

      <Card>
        <SectionHeading title="School details" copy="National school search is lazy-loaded so the page stays faster until you need it." />
        <div className="kg-form-grid">
          {schoolFields.map(([key, label]) => (
            <TextField key={key} label={label} value={text(school[key])} onChange={(value) => updateRecord(setSchool, key, value)} type={key === "completionYear" || key === "average" ? "number" : "text"} />
          ))}
          <SelectField label="Province" value={text(school.schoolProvince)} onChange={(value) => updateRecord(setSchool, "schoolProvince", value)} options={provinces} />
          <SelectField label="School type" value={text(school.schoolType)} onChange={(value) => updateRecord(setSchool, "schoolType", value)} options={schoolTypes} />
        </div>
        {schoolMatches.length ? (
          <div className="kg-sublist">
            {schoolMatches.map((match) => (
              <button
                key={text(match.name)}
                type="button"
                className="kg-sublist-item clickable"
                onClick={() => setSchool((current) => ({
                  ...current,
                  schoolName: text(match.name),
                  confirmName: text(match.name),
                  schoolProvince: text(match.province || current.schoolProvince)
                }))}
              >
                <strong>{text(match.name)}</strong>
                <span>{text(match.province)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="kg-grid two">
        <Card>
          <SectionHeading title="Marks and APS" copy="APS updates automatically from the marks already built into Kagie." />
          <div className="kg-inline-form">
            <label className="kg-field">
              <span>Subject</span>
              <select className="kg-input" value={subjectName} onChange={(event) => setSubjectName(event.target.value)}>
                <option value="">Select subject</option>
                {subjectCatalog.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Percent" value={subjectPercent} onChange={setSubjectPercent} type="number" />
            <Button onClick={addMark}>Add subject</Button>
          </div>
          <div className="kg-summary-line">
            <span>{marks.length} subjects saved</span>
            <span>APS: {aps.total ?? "Pending"}</span>
          </div>
          {marks.length ? (
            <div className="kg-sublist">
              {marks.map((mark) => (
                <div className="kg-sublist-item" key={mark.subject}>
                  <strong>{mark.subject}</strong>
                  <span>
                    {mark.percent}% | Level {mark.level}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No marks yet" copy="Add DBE or IEB subjects to unlock APS and course guidance." />
          )}
        </Card>

        <Card>
          <SectionHeading title="Package selection" copy="The current package flow stays connected to cart and checkout." />
          <div className="kg-pack-grid">
            {packs.map((pack) => (
              <button
                type="button"
                key={pack.id}
                className={`kg-pack-card ${selectedPackId === pack.id ? "active" : ""}`}
                onClick={() => setSelectedPackId(pack.id)}
              >
                <div className="kg-list-title-row">
                  <strong>{pack.name}</strong>
                  <span>R{pack.price}</span>
                </div>
                <p>{pack.highlight}</p>
                <small>{pack.description}</small>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeading title="Institution shortlist" copy="Year filter, institution search, faculty-aware choices, and closed-institution blocking are all preserved." />
        <div className="kg-form-grid">
          <SelectField label="Year" value={text(apply.year || currentYear)} onChange={(value) => setApply((current) => ({ ...current, year: value, institutionType: "", institutionName: "", facultyName: "", choice1: "", choice2: "", choice3: "" }))} options={years} />
          <SelectField label="Province" value={text(apply.province)} onChange={(value) => setApply((current) => ({ ...current, province: value, institutionType: "", institutionName: "", facultyName: "", choice1: "", choice2: "", choice3: "" }))} options={provinces} />
          <SelectField label="Institution type" value={text(apply.institutionType)} onChange={(value) => setApply((current) => ({ ...current, institutionType: value, institutionName: "", facultyName: "", choice1: "", choice2: "", choice3: "" }))} options={institutionTypes} />
          <TextField label="Search institutions" value={text(apply.institutionSearch)} onChange={(value) => setApply((current) => ({ ...current, institutionSearch: value }))} placeholder="Start typing institution" />
          <label className="kg-field">
            <span>Institution</span>
            <select className="kg-input" value={text(apply.institutionName)} onChange={(event) => setApply((current) => ({ ...current, institutionName: event.target.value, facultyName: "", choice1: "", choice2: "", choice3: "" }))}>
              <option value="">Select institution</option>
              {filteredInstitutionPool.slice(0, 120).map((institution) => (
                <option key={institution.id} value={institution.name}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Faculty" value={text(apply.facultyName)} onChange={(value) => setApply((current) => ({ ...current, facultyName: value }))} placeholder={facultyOptions[0] || "Type faculty"} />
          <TextField label="Choice 1" value={text(apply.choice1)} onChange={(value) => setApply((current) => ({ ...current, choice1: value }))} placeholder={courseOptions[0] || "Type course choice 1"} />
          <TextField label="Choice 2" value={text(apply.choice2)} onChange={(value) => setApply((current) => ({ ...current, choice2: value }))} placeholder={courseOptions[1] || "Type course choice 2"} />
          <TextField label="Choice 3" value={text(apply.choice3)} onChange={(value) => setApply((current) => ({ ...current, choice3: value }))} placeholder={courseOptions[2] || "Type course choice 3"} />
        </div>

        {selectedInstitution ? (
          <div className="kg-list-card">
            <div className="kg-list-title-row">
              <strong>{selectedInstitution.name}</strong>
              <StatusPill label={selectedInstitution.status === "closing_soon" ? "Closing Soon" : selectedInstitution.status === "closed" ? "Closed" : "Open"} />
            </div>
            <p>
              {selectedInstitution.province} | {selectedInstitution.type}
              <br />
              Opening: {selectedInstitution.openingDate || "Not set"}
              <br />
              Closing: {selectedInstitution.closingDate || "Not set"}
            </p>
          </div>
        ) : null}

        <div className="kg-action-row">
          <Button tone="ghost" onClick={() => void saveFavorite("institution")}>
            Save institution
          </Button>
          <Button tone="secondary" onClick={() => void saveFavorite("course")}>
            Save course
          </Button>
          <Button tone="success" onClick={() => void addInstitution()}>
            Add institution
          </Button>
        </div>

        <div className="kg-grid two">
          <div>
            <div className="kg-subtitle">Recommendations</div>
            {(recommendationSummary.safeAlternatives || []).length ? (
              <div className="kg-sublist">
                {(recommendationSummary.safeAlternatives || []).slice(0, 5).map((item) => (
                  <div className="kg-sublist-item" key={`${item.institutionName}-${item.course}`}>
                    <strong>{item.course}</strong>
                    <span>{item.institutionName}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Recommendations pending" copy="Add marks and Kagie will surface safer-fit choices here." />
            )}
          </div>
          <div>
            <div className="kg-subtitle">Favorites</div>
            {favorites.length ? (
              <div className="kg-sublist">
                {favorites.slice(0, 6).map((favorite) => (
                  <div className="kg-sublist-item" key={favorite.id}>
                    <strong>{favorite.type === "course" ? favorite.course || "Saved course" : favorite.institutionName || "Saved institution"}</strong>
                    <span>{favorite.institutionName || favorite.province || ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No favorites yet" copy="Save institutions and courses to build a smarter shortlist." />
            )}
          </div>
        </div>

        <div className="kg-subtitle">Shortlisted institutions</div>
        {institutions.length ? (
          <div className="kg-list-stack">
            {institutions.map((institution) => (
              <div className="kg-list-card" key={text(institution.id)}>
                <div className="kg-list-title-row">
                  <strong>{text(institution.institutionName)}</strong>
                  <StatusPill label={text(institution.institutionStatus || "Open")} />
                </div>
                <p>
                  {text(institution.faculty || "Faculty pending")}
                  <br />
                  {text(institution.choice1 || "No first choice yet")}
                  {text(institution.closingDate) ? <><br />Closing date: {text(institution.closingDate)}</> : null}
                </p>
                <div className="kg-action-row">
                  <Button tone="ghost" onClick={() => void removeInstitution(text(institution.id))}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No institutions shortlisted" copy="Choose a package and start building your Kagie shortlist." />
        )}
      </Card>
    </div>
  );
}
