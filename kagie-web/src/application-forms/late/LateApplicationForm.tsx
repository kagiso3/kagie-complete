import { useState } from "react";
import { Button, Card, SectionHeading, SelectField, TextAreaField, TextField } from "../../components/ui";
import type { KagieApplication, KagieUser, LegacyApi, ProtectedRouteKey } from "../../lib/types";
import { buildPackageSelection, savePackageSelection } from "../application-package-catalog";
import { getStepProgress } from "../application-form-utils";
import { LateApplicationReview } from "./LateApplicationReview";
import { LateDocumentUpload } from "./LateDocumentUpload";
import { LateInstitutionSelection } from "./LateInstitutionSelection";
import { LatePackageSelection } from "./LatePackageSelection";
import {
  calculateLateAverage,
  createEmptyLateApplication,
  createLateSubject,
  educationLevels,
  getLatePackageLimitLabel,
  getMissingLateDocuments,
  isWithinLatePackageLimit,
  lateApplicationReasons,
  lateApplicationStepStorageKey,
  lateApplicationStorageKey,
  lateDocumentDefinitions,
  latePackages,
  type LateApplicationData,
  type LateDocumentKey,
  type LatePackage,
  type LateSubject
} from "./late-application-model";

const provinces = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];
const stepLabels = [
  "Package Selection",
  "Personal Information",
  "Contact Information",
  "Emergency Contact",
  "Academic Information",
  "Late Application Details",
  "Institution Selection",
  "Parent / Guardian",
  "Document Uploads",
  "Application Review",
  "Applicant Declaration",
  "Submit Application"
];

function readStoredLateApplication(user: KagieUser) {
  const empty = createEmptyLateApplication(user);
  try {
    const stored = localStorage.getItem(lateApplicationStorageKey(user.id));
    if (!stored) return empty;
    const parsed = JSON.parse(stored) as Partial<LateApplicationData>;
    return {
      ...empty,
      ...parsed,
      personal: { ...empty.personal, ...(parsed.personal || {}) },
      contact: { ...empty.contact, ...(parsed.contact || {}) },
      emergency: { ...empty.emergency, ...(parsed.emergency || {}) },
      academic: {
        ...empty.academic,
        ...(parsed.academic || {}),
        subjects: parsed.academic?.subjects?.length ? parsed.academic.subjects : empty.academic.subjects
      },
      lateDetails: { ...empty.lateDetails, ...(parsed.lateDetails || {}) },
      institutions: Array.isArray(parsed.institutions) ? parsed.institutions : [],
      guardian: { ...empty.guardian, ...(parsed.guardian || {}) },
      documents: parsed.documents || {},
      declarationAccepted: Boolean(parsed.declarationAccepted)
    };
  } catch {
    return empty;
  }
}

function readStoredStep(userId: string) {
  try {
    const step = Number(localStorage.getItem(lateApplicationStepStorageKey(userId)));
    return Number.isInteger(step) ? Math.max(0, Math.min(step, stepLabels.length - 1)) : 0;
  } catch {
    return 0;
  }
}

function readStoredPackage(userId: string) {
  try {
    const stored = localStorage.getItem(`${lateApplicationStorageKey(userId)}_package`);
    return latePackages.some((applicationPackage) => applicationPackage.id === stored) ? stored || "" : "";
  } catch {
    return "";
  }
}

function createReference() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAG-LATE-${new Date().getFullYear()}-${random}`;
}

function isFilled(values: string[]) {
  return values.every((value) => String(value || "").trim());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isLikelyYear(value: string, minimum = 1990, maximum = new Date().getFullYear() + 2) {
  const year = Number(value);
  return Number.isInteger(year) && year >= minimum && year <= maximum;
}

function serializableLateData(data: LateApplicationData): LateApplicationData {
  return {
    ...data,
    documents: Object.fromEntries(
      Object.entries(data.documents)
        .filter(([, document]) => Boolean(document?.uploaded))
        .map(([key, document]) => [key, {
          name: document?.name || "",
          type: document?.type || "",
          size: document?.size || 0,
          uploaded: true
        }])
    )
  };
}

function mapInstitutions(data: LateApplicationData) {
  return data.institutions.map((institution) => ({
    id: institution.id,
    institutionName: institution.institutionName,
    province: "",
    institutionType: institution.qualificationType,
    faculty: institution.faculty,
    choice1: institution.programme,
    choice2: "",
    choice3: "",
    year: institution.intakeYear,
    campus: institution.campus,
    intakeSemester: institution.intakeSemester,
    programmePriority: institution.programmePriority
  }));
}

export function LateApplicationForm({
  api,
  user,
  onNavigate
}: {
  api: LegacyApi;
  user: KagieUser;
  onNavigate: (route: ProtectedRouteKey) => void;
}) {
  const [data, setData] = useState<LateApplicationData>(() => readStoredLateApplication(user));
  const [selectedPackageId, setSelectedPackageId] = useState(() => readStoredPackage(user.id));
  const [currentStep, setCurrentStep] = useState(() => readStoredStep(user.id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [submitted, setSubmitted] = useState<{
    applicationId: string;
    reference: string;
    submittedAt: string;
  } | null>(null);

  const selectedPackage = latePackages.find((applicationPackage) => applicationPackage.id === selectedPackageId) || null;
  const progressPercentage = getStepProgress(currentStep, stepLabels.length);
  const missingDocuments = getMissingLateDocuments(data.documents);
  const academicAverage = calculateLateAverage(data.academic.subjects);

  function showMessage(text: string, tone: "success" | "error" | "info" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function clearMessage() {
    setMessage("");
    setMessageTone("info");
  }

  function persistLocal(nextData = data, step = currentStep, packageId = selectedPackageId) {
    try {
      localStorage.setItem(lateApplicationStorageKey(user.id), JSON.stringify(serializableLateData(nextData)));
      localStorage.setItem(lateApplicationStepStorageKey(user.id), String(step));
      if (packageId) localStorage.setItem(`${lateApplicationStorageKey(user.id)}_package`, packageId);
    } catch {
      // The active Late Application remains usable without browser storage.
    }
  }

  function updateSection<K extends keyof LateApplicationData>(key: K, value: LateApplicationData[K]) {
    setData((current) => {
      const next = { ...current, [key]: value };
      persistLocal(next);
      return next;
    });
    clearMessage();
  }

  function goToStep(step: number) {
    const boundedStep = Math.max(0, Math.min(step, stepLabels.length - 1));
    setCurrentStep(boundedStep);
    persistLocal(data, boundedStep);
  }

  function selectPackage(applicationPackage: LatePackage) {
    if (!isWithinLatePackageLimit(applicationPackage, data.institutions.length)) {
      showMessage(`Remove institutions until your choices fit the ${applicationPackage.name} limit.`, "error");
      return;
    }
    setSelectedPackageId(applicationPackage.id);
    persistLocal(data, currentStep, applicationPackage.id);
    savePackageSelection(user.id, buildPackageSelection("late", applicationPackage));
    clearMessage();
  }

  async function ensureDraft() {
    return api.ensureApplicationDraftAsync
      ? api.ensureApplicationDraftAsync("late", user.id)
      : api.ensureApplicationDraft
        ? api.ensureApplicationDraft("late", user.id)
        : api.ensureDraftAsync
          ? api.ensureDraftAsync(user.id)
          : api.ensureDraft(user.id);
  }

  function validateStep(step: number) {
    if (step === 0 && !selectedPackage) {
      showMessage("Choose a Late Application package before continuing.", "error");
      return false;
    }

    if (step === 1) {
      const personal = data.personal;
      if (!isFilled([
        personal.firstName,
        personal.lastName,
        personal.identityNumber,
        personal.dateOfBirth,
        personal.gender,
        personal.nationality,
        personal.maritalStatus
      ])) {
        showMessage("Complete all required personal information.", "error");
        return false;
      }
      if (personal.disabilityStatus === "Yes" && !personal.disabilityDescription.trim()) {
        showMessage("Describe the disability or support requirement.", "error");
        return false;
      }
    }

    if (step === 2) {
      const contact = data.contact;
      if (!isFilled([
        contact.mobileNumber,
        contact.emailAddress,
        contact.residentialAddress,
        contact.province,
        contact.city,
        contact.postalCode
      ])) {
        showMessage("Complete all required contact information.", "error");
        return false;
      }
      if (!isValidEmail(contact.emailAddress)) {
        showMessage("Enter a valid email address.", "error");
        return false;
      }
    }

    if (step === 3 && !isFilled([
      data.emergency.fullName,
      data.emergency.relationship,
      data.emergency.contactNumber
    ])) {
      showMessage("Complete the required emergency contact information.", "error");
      return false;
    }

    if (step === 4) {
      const academic = data.academic;
      if (!isFilled([academic.schoolName, academic.examinationNumber, academic.yearCompleted, academic.currentEducationLevel])) {
        showMessage("Complete all required academic information.", "error");
        return false;
      }
      if (!isLikelyYear(academic.yearCompleted)) {
        showMessage("Enter a valid year completed.", "error");
        return false;
      }
      if (!academic.subjects.length || academic.subjects.some((subject) => {
        const percentage = Number(subject.percentage);
        return !isFilled([subject.name, subject.mark, subject.percentage])
          || !Number.isFinite(percentage)
          || percentage < 0
          || percentage > 100;
      })) {
        showMessage("Add complete subject details with percentages between 0 and 100.", "error");
        return false;
      }
    }

    if (step === 5) {
      const details = data.lateDetails;
      if (!isFilled([details.appliedBefore, details.reason, details.detailedExplanation])) {
        showMessage("Complete all required Late Application details.", "error");
        return false;
      }
      if (details.appliedBefore === "Yes" && !isFilled([
        details.previousInstitution,
        details.previousApplicationYear,
        details.previousProgramme
      ])) {
        showMessage("Complete the previous application details.", "error");
        return false;
      }
      if (details.appliedBefore === "Yes" && !isLikelyYear(details.previousApplicationYear)) {
        showMessage("Enter a valid previous application year.", "error");
        return false;
      }
      if (details.detailedExplanation.trim().length < 20) {
        showMessage("Add a short explanation of at least 20 characters.", "error");
        return false;
      }
    }

    if (step === 6) {
      if (!selectedPackage || !data.institutions.length) {
        showMessage("Add at least one institution.", "error");
        return false;
      }
      if (!isWithinLatePackageLimit(selectedPackage, data.institutions.length)) {
        showMessage(`${selectedPackage.name} allows ${getLatePackageLimitLabel(selectedPackage).toLowerCase()}.`, "error");
        return false;
      }
      if (data.institutions.some((institution) => !isFilled([
        institution.institutionName,
        institution.campus,
        institution.faculty,
        institution.qualificationType,
        institution.programme,
        institution.intakeYear,
        institution.intakeSemester,
        institution.programmePriority
      ]))) {
        showMessage("Complete every field for each selected institution.", "error");
        return false;
      }
      if (data.institutions.some((institution) => !isLikelyYear(institution.intakeYear, new Date().getFullYear(), new Date().getFullYear() + 3))) {
        showMessage("Enter a valid intake year for each selected institution.", "error");
        return false;
      }
    }

    if (step === 7) {
      if (!isFilled([
        data.guardian.fullName,
        data.guardian.relationship,
        data.guardian.contactNumber
      ])) {
        showMessage("Complete the required parent or guardian information.", "error");
        return false;
      }
      if (data.guardian.emailAddress.trim() && !isValidEmail(data.guardian.emailAddress)) {
        showMessage("Enter a valid parent or guardian email address.", "error");
        return false;
      }
    }

    if (step === 8 && missingDocuments.length) {
      showMessage(`Select the required documents: ${missingDocuments.join(", ")}.`, "error");
      return false;
    }

    if (step === 10 && !data.declarationAccepted) {
      showMessage("Accept the applicant declaration before continuing.", "error");
      return false;
    }

    clearMessage();
    return true;
  }

  function buildApplicationPatch(
    draft: KagieApplication,
    applicationData: LateApplicationData,
    status: "Draft" | "Submitted",
    progressStatus: "Draft" | "In Progress" | "Submitted",
    step: number
  ) {
    if (!selectedPackage) throw new Error("Choose a Late Application package first.");
    const submissionComplete = status === "Submitted";
    const serializableData = serializableLateData(applicationData);
    return {
      applicationType: "late",
      applicationTypeLabel: "Late Application",
      selectedPackage,
      package: selectedPackage,
      packagePrice: selectedPackage.price,
      finalTotal: selectedPackage.price,
      institutions: mapInstitutions(applicationData),
      forms: {
        ...(draft.forms || {}),
        applicationType: { type: "late", label: "Late Application" },
        packageSelection: buildPackageSelection("late", selectedPackage, draft.id),
        lateApplication: {
          ...serializableData,
          academicAverage
        },
        applicationProgress: {
          percentage: submissionComplete ? 100 : getStepProgress(step, stepLabels.length),
          currentStep: submissionComplete ? "Submitted" : stepLabels[step],
          currentStepNumber: submissionComplete ? stepLabels.length : step + 1,
          totalSteps: stepLabels.length,
          missingDocuments: getMissingLateDocuments(applicationData.documents),
          status: progressStatus
        },
        learner: {
          firstName: applicationData.personal.firstName,
          middleName: applicationData.personal.middleName,
          surname: applicationData.personal.lastName,
          fullNames: [applicationData.personal.firstName, applicationData.personal.middleName].filter(Boolean).join(" "),
          idNumber: applicationData.personal.identityNumber,
          dob: applicationData.personal.dateOfBirth,
          gender: applicationData.personal.gender,
          nationality: applicationData.personal.nationality,
          cellphone: applicationData.contact.mobileNumber,
          email: applicationData.contact.emailAddress,
          address: applicationData.contact.residentialAddress,
          province: applicationData.contact.province,
          city: applicationData.contact.city,
          postalCode: applicationData.contact.postalCode
        },
        parent: {
          guardianFullNames: applicationData.guardian.fullName,
          guardianRelation: applicationData.guardian.relationship,
          guardianCell1: applicationData.guardian.contactNumber,
          guardianEmail: applicationData.guardian.emailAddress,
          occupation: applicationData.guardian.occupation
        },
        school: {
          schoolName: applicationData.academic.schoolName,
          examinationNumber: applicationData.academic.examinationNumber,
          completionYear: applicationData.academic.yearCompleted,
          highestQualification: applicationData.academic.currentEducationLevel,
          average: academicAverage
        },
        marks: {
          subjects: applicationData.academic.subjects.map((subject) => ({
            subject: subject.name,
            percent: Number(subject.percentage),
            level: api.calculateNscLevel ? api.calculateNscLevel(Number(subject.percentage)) : 1
          }))
        }
      },
      status,
      paymentStatus: "Unpaid"
    };
  }

  async function persistApplication(
    progressStatus: "Draft" | "In Progress",
    step: number
  ) {
    const draft = await ensureDraft();
    const patch = buildApplicationPatch(draft, data, "Draft", progressStatus, step);
    const updated = api.updateApplicationAsync
      ? await api.updateApplicationAsync(draft.id, patch)
      : api.updateApplication?.(draft.id, patch);
    savePackageSelection(user.id, buildPackageSelection("late", selectedPackage as LatePackage, updated?.id || draft.id));
    persistLocal(data, step);
    return updated || draft;
  }

  async function saveDraft() {
    if (!selectedPackage) {
      showMessage("Choose a Late Application package before saving.", "error");
      return;
    }
    setSaving(true);
    try {
      await persistApplication("Draft", currentStep);
      showMessage("Late Application draft saved.", "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not save the Late Application.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function continueForward() {
    if (!validateStep(currentStep)) return;
    const nextStep = Math.min(stepLabels.length - 1, currentStep + 1);
    setSaving(true);
    try {
      await persistApplication("In Progress", nextStep);
      goToStep(nextStep);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not save the Late Application.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addPackageToCart(application: KagieApplication, applicationData: LateApplicationData) {
    if (!selectedPackage) return;
    const institutions = mapInstitutions(applicationData);
    const cartItem = {
      id: `pack_${application.id}`,
      clientKey: `pack_${application.id}`,
      type: "application_pack",
      name: selectedPackage.name,
      packName: selectedPackage.name,
      price: selectedPackage.price,
      packPrice: selectedPackage.price,
      institutionLimit: selectedPackage.institutionLimit,
      institutionCount: institutions.length,
      institutions,
      applicationType: "late",
      applicationId: application.id
    };

    const saveLocalCartCopy = () => {
      (api.getCart(user.id) || [])
        .filter((entry) => entry.type === "application_pack")
        .forEach((entry) => api.removeCartItem(entry.id, user.id));
      return api.addCartItem({ ...cartItem, syncState: "local" }, user.id);
    };

    try {
      if (api.replaceApplicationPackCartItemAsync) {
        return await api.replaceApplicationPackCartItemAsync({ ...cartItem, syncState: "synced" }, user.id);
      }
      const localItem = saveLocalCartCopy();
      return api.addCartItemAsync
        ? await api.addCartItemAsync({ ...cartItem, syncState: "synced" }, user.id)
        : localItem;
    } catch (error) {
      console.warn("Kagie late application cart sync fallback:", error);
      return saveLocalCartCopy();
    }
  }

  async function continueToPayment() {
    if (!selectedPackage) {
      showMessage("Choose a Late Application package before checkout.", "error");
      return;
    }

    setSaving(true);
    clearMessage();
    try {
      const draft = await persistApplication("Draft", 0);
      await addPackageToCart(draft, data);
      showMessage("Late Application package added to cart. Complete payment now and finish details later from your Dashboard.", "success");
      onNavigate("cart");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not add this package to cart yet.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function submitApplication() {
    for (let step = 0; step <= 10; step += 1) {
      if (!validateStep(step)) {
        goToStep(step);
        return;
      }
    }
    if (!selectedPackage) return;

    setSaving(true);
    clearMessage();
    try {
      const draft = await ensureDraft();
      let submittedData = data;
      const pendingDocuments = Object.entries(data.documents)
        .filter(([, document]) => Boolean(document?.file))
        .map(([key, document]) => {
          const definition = lateDocumentDefinitions.find((item) => item.key === key);
          return {
            applicationId: draft.id,
            category: definition?.category || "general",
            name: document?.name,
            fileName: document?.name,
            type: document?.type,
            mimeType: document?.type,
            size: document?.size,
            file: document?.file
          };
        });

      if (pendingDocuments.length) {
        if (api.saveDocumentsAsync) await api.saveDocumentsAsync(pendingDocuments, user.id);
        else api.saveDocuments?.(pendingDocuments, user.id);
        submittedData = {
          ...data,
          documents: Object.fromEntries(
            Object.entries(data.documents).map(([key, document]) => [key, document?.file
              ? { ...document, file: undefined, uploaded: true }
              : document])
          )
        };
        setData(submittedData);
      }

      const reference = createReference();
      const submittedAt = new Date().toISOString();
      const patch = {
        ...buildApplicationPatch(draft, submittedData, "Submitted", "Submitted", stepLabels.length - 1),
        applicationReference: reference,
        submittedAt
      };
      const updated = api.updateApplicationAsync
        ? await api.updateApplicationAsync(draft.id, patch)
        : api.updateApplication?.(draft.id, patch);
      const application = updated || draft;
      await addPackageToCart(application, submittedData);

      try {
        localStorage.removeItem(lateApplicationStorageKey(user.id));
        localStorage.removeItem(lateApplicationStepStorageKey(user.id));
        localStorage.removeItem(`${lateApplicationStorageKey(user.id)}_package`);
      } catch {
        // Submission is complete even if browser storage cannot be cleared.
      }
      savePackageSelection(user.id, buildPackageSelection("late", selectedPackage, application.id));
      setSubmitted({ applicationId: application.id, reference, submittedAt });
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not submit the Late Application.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="kg-page-stack kg-application-theme kg-application-theme-late">
        <Card className="kg-journey-success">
          <div className="kg-journey-success-mark" aria-hidden="true">{"\u2713"}</div>
          <SectionHeading title="Late Application submitted" copy="The application record and package are ready for dashboard tracking." />
          <div className="kg-reference-card">
            <span>Application ID</span>
            <strong>{submitted.applicationId}</strong>
            <small>Reference: {submitted.reference}</small>
            <small>Submitted: {new Date(submitted.submittedAt).toLocaleString("en-ZA")}</small>
            <small>Status: Submitted</small>
          </div>
          <div className="kg-action-row">
            <Button tone="secondary" onClick={() => onNavigate("dashboard")}>View dashboard</Button>
            <Button tone="success" onClick={() => onNavigate("cart")}>View cart</Button>
          </div>
        </Card>
      </div>
    );
  }

  const activeSection = (() => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <LatePackageSelection selectedPackageId={selectedPackageId} onSelect={selectPackage} />
            {selectedPackage ? (
              <div className="kg-journey-notice">
                Payment can be completed before the late-application details are finished. The application will stay Pending Details until all required sections are submitted.
              </div>
            ) : null}
          </>
        );
      case 1:
        return (
          <>
            <SectionHeading title="Personal information" copy="Identity and personal details for this Late Application." />
            <div className="kg-journey-form-grid">
              <TextField label="First Name" value={data.personal.firstName} onChange={(value) => updateSection("personal", { ...data.personal, firstName: value })} />
              <TextField label="Middle Name" value={data.personal.middleName} onChange={(value) => updateSection("personal", { ...data.personal, middleName: value })} />
              <TextField label="Last Name" value={data.personal.lastName} onChange={(value) => updateSection("personal", { ...data.personal, lastName: value })} />
              <TextField label="ID Number / Passport Number" value={data.personal.identityNumber} onChange={(value) => updateSection("personal", { ...data.personal, identityNumber: value })} />
              <TextField label="Date Of Birth" type="date" value={data.personal.dateOfBirth} onChange={(value) => updateSection("personal", { ...data.personal, dateOfBirth: value })} />
              <SelectField label="Gender" value={data.personal.gender} options={["Female", "Male", "Non-binary", "Prefer not to say"]} onChange={(value) => updateSection("personal", { ...data.personal, gender: value })} />
              <TextField label="Nationality" value={data.personal.nationality} onChange={(value) => updateSection("personal", { ...data.personal, nationality: value })} />
              <SelectField label="Marital Status" value={data.personal.maritalStatus} options={["Single", "Married", "Divorced", "Widowed", "Prefer not to say"]} onChange={(value) => updateSection("personal", { ...data.personal, maritalStatus: value })} />
              <SelectField label="Disability Status" value={data.personal.disabilityStatus} options={["No", "Yes", "Prefer not to say"]} onChange={(value) => updateSection("personal", { ...data.personal, disabilityStatus: value, disabilityDescription: value === "Yes" ? data.personal.disabilityDescription : "" })} />
              {data.personal.disabilityStatus === "Yes" ? <TextAreaField label="Disability Description" value={data.personal.disabilityDescription} onChange={(value) => updateSection("personal", { ...data.personal, disabilityDescription: value })} /> : null}
            </div>
          </>
        );
      case 2:
        return (
          <>
            <SectionHeading title="Contact information" copy="All fields are required for Late Application updates." />
            <div className="kg-journey-form-grid">
              <TextField label="Mobile Number" type="tel" value={data.contact.mobileNumber} onChange={(value) => updateSection("contact", { ...data.contact, mobileNumber: value })} />
              <TextField label="Alternative Number" type="tel" value={data.contact.alternativeNumber} onChange={(value) => updateSection("contact", { ...data.contact, alternativeNumber: value })} />
              <TextField label="Email Address" type="email" value={data.contact.emailAddress} onChange={(value) => updateSection("contact", { ...data.contact, emailAddress: value })} />
              <TextAreaField label="Residential Address" value={data.contact.residentialAddress} onChange={(value) => updateSection("contact", { ...data.contact, residentialAddress: value })} />
              <SelectField label="Province" value={data.contact.province} options={provinces} onChange={(value) => updateSection("contact", { ...data.contact, province: value })} />
              <TextField label="City" value={data.contact.city} onChange={(value) => updateSection("contact", { ...data.contact, city: value })} />
              <TextField label="Postal Code" value={data.contact.postalCode} onChange={(value) => updateSection("contact", { ...data.contact, postalCode: value })} />
            </div>
          </>
        );
      case 3:
        return (
          <>
            <SectionHeading title="Emergency contact" copy="Provide one reliable emergency contact." />
            <div className="kg-journey-form-grid">
              <TextField label="Full Name" value={data.emergency.fullName} onChange={(value) => updateSection("emergency", { ...data.emergency, fullName: value })} />
              <TextField label="Relationship" value={data.emergency.relationship} onChange={(value) => updateSection("emergency", { ...data.emergency, relationship: value })} />
              <TextField label="Contact Number" type="tel" value={data.emergency.contactNumber} onChange={(value) => updateSection("emergency", { ...data.emergency, contactNumber: value })} />
              <TextField label="Alternative Contact Number" type="tel" value={data.emergency.alternativeContactNumber} onChange={(value) => updateSection("emergency", { ...data.emergency, alternativeContactNumber: value })} />
            </div>
          </>
        );
      case 4:
        return (
          <>
            <SectionHeading
              title="Academic information"
              copy="Add each subject and result. Kagie calculates the average automatically."
              actions={<Button tone="secondary" onClick={() => updateSection("academic", { ...data.academic, subjects: [...data.academic.subjects, createLateSubject()] })}>Add subject</Button>}
            />
            <div className="kg-journey-form-grid">
              <TextField label="School Name" value={data.academic.schoolName} onChange={(value) => updateSection("academic", { ...data.academic, schoolName: value })} />
              <TextField label="Examination Number" value={data.academic.examinationNumber} onChange={(value) => updateSection("academic", { ...data.academic, examinationNumber: value })} />
              <TextField label="Year Completed" type="number" value={data.academic.yearCompleted} onChange={(value) => updateSection("academic", { ...data.academic, yearCompleted: value })} />
              <SelectField label="Current Education Level" value={data.academic.currentEducationLevel} options={educationLevels} onChange={(value) => updateSection("academic", { ...data.academic, currentEducationLevel: value })} />
            </div>
            <div className="kg-late-subject-list">
              {data.academic.subjects.map((subject, index) => (
                <div className="kg-list-card kg-late-subject-row" key={subject.id}>
                  <strong>Subject {index + 1}</strong>
                  <TextField label="Subject Name" value={subject.name} onChange={(value) => updateSection("academic", { ...data.academic, subjects: data.academic.subjects.map((item) => item.id === subject.id ? { ...item, name: value } : item) })} />
                  <TextField label="Subject Mark" value={subject.mark} onChange={(value) => updateSection("academic", { ...data.academic, subjects: data.academic.subjects.map((item) => item.id === subject.id ? { ...item, mark: value } : item) })} />
                  <TextField label="Subject Percentage" type="number" value={subject.percentage} onChange={(value) => updateSection("academic", { ...data.academic, subjects: data.academic.subjects.map((item) => item.id === subject.id ? { ...item, percentage: value } : item) })} />
                  <button type="button" className="kg-text-link danger" disabled={data.academic.subjects.length === 1} onClick={() => updateSection("academic", { ...data.academic, subjects: data.academic.subjects.filter((item) => item.id !== subject.id) })}>Remove</button>
                </div>
              ))}
            </div>
            <div className="kg-late-average"><span>Average Percentage</span><strong>{academicAverage}%</strong></div>
          </>
        );
      case 5:
        return (
          <>
            <SectionHeading title="Late Application details" copy="Explain the previous application history and reason for applying late." />
            <div className="kg-journey-form-grid">
              <SelectField label="Have You Applied Before?" value={data.lateDetails.appliedBefore} options={["Yes", "No"]} onChange={(value) => updateSection("lateDetails", {
                ...data.lateDetails,
                appliedBefore: value,
                previousInstitution: value === "Yes" ? data.lateDetails.previousInstitution : "",
                previousApplicationYear: value === "Yes" ? data.lateDetails.previousApplicationYear : "",
                previousProgramme: value === "Yes" ? data.lateDetails.previousProgramme : ""
              })} />
              {data.lateDetails.appliedBefore === "Yes" ? (
                <>
                  <TextField label="Previous Institution" value={data.lateDetails.previousInstitution} onChange={(value) => updateSection("lateDetails", { ...data.lateDetails, previousInstitution: value })} />
                  <TextField label="Previous Application Year" type="number" value={data.lateDetails.previousApplicationYear} onChange={(value) => updateSection("lateDetails", { ...data.lateDetails, previousApplicationYear: value })} />
                  <TextField label="Previous Programme" value={data.lateDetails.previousProgramme} onChange={(value) => updateSection("lateDetails", { ...data.lateDetails, previousProgramme: value })} />
                </>
              ) : null}
              <SelectField label="Reason For Late Application" value={data.lateDetails.reason} options={lateApplicationReasons} onChange={(value) => updateSection("lateDetails", { ...data.lateDetails, reason: value })} />
              <TextAreaField label="Detailed Explanation" placeholder="Explain why the application is late, why the institution should still consider it, and any special circumstances." value={data.lateDetails.detailedExplanation} onChange={(value) => updateSection("lateDetails", { ...data.lateDetails, detailedExplanation: value })} />
            </div>
          </>
        );
      case 6:
        return selectedPackage
          ? <LateInstitutionSelection value={data.institutions} selectedPackage={selectedPackage} onChange={(value) => updateSection("institutions", value)} />
          : null;
      case 7:
        return (
          <>
            <SectionHeading title="Parent / guardian information" copy="Required guardian contact details and optional background information." />
            <div className="kg-journey-form-grid">
              <TextField label="Parent / Guardian Full Name" value={data.guardian.fullName} onChange={(value) => updateSection("guardian", { ...data.guardian, fullName: value })} />
              <TextField label="Relationship" value={data.guardian.relationship} onChange={(value) => updateSection("guardian", { ...data.guardian, relationship: value })} />
              <TextField label="Contact Number" type="tel" value={data.guardian.contactNumber} onChange={(value) => updateSection("guardian", { ...data.guardian, contactNumber: value })} />
              <TextField label="Email Address" type="email" value={data.guardian.emailAddress} onChange={(value) => updateSection("guardian", { ...data.guardian, emailAddress: value })} />
              <TextField label="Occupation" value={data.guardian.occupation} onChange={(value) => updateSection("guardian", { ...data.guardian, occupation: value })} />
            </div>
          </>
        );
      case 8:
        return <LateDocumentUpload value={data.documents} onChange={(value) => updateSection("documents", value)} onError={(error) => showMessage(error, "error")} />;
      case 9:
        return selectedPackage ? <LateApplicationReview data={data} selectedPackage={selectedPackage} /> : null;
      case 10:
        return (
          <>
            <SectionHeading title="Applicant declaration" copy="This confirmation is required before submission." />
            <label className="kg-late-declaration">
              <input type="checkbox" checked={data.declarationAccepted} onChange={(event) => updateSection("declarationAccepted", event.target.checked)} />
              <span>I confirm that all information provided is accurate and understand that late applications are subject to institution availability and acceptance.</span>
            </label>
          </>
        );
      default:
        return (
          <>
            <SectionHeading title="Submit Late Application" copy="Everything is ready. Submit the application to create its final record and dashboard status." />
            <div className="kg-late-submit-summary">
              <div><span>Application type</span><strong>Late Application</strong></div>
              <div><span>Package</span><strong>{selectedPackage?.name || "Not selected"}</strong></div>
              <div><span>Institutions</span><strong>{data.institutions.length}</strong></div>
              <div><span>Completion</span><strong>100%</strong></div>
              <div><span>Status after submission</span><strong>Submitted</strong></div>
            </div>
          </>
        );
    }
  })();

  return (
    <div className="kg-page-stack kg-application-theme kg-application-theme-late kg-late-application">
      <Card className="kg-journey-hero">
        <SectionHeading
          eyebrow="Late Application"
          title="Late Application Form"
          copy="A dedicated workflow for applications submitted after official institution closing dates."
          actions={<Button tone="ghost" onClick={() => onNavigate("apply")}>Change application type</Button>}
        />
        <div className="kg-selected-package-inline">
          <div><small>Selected package</small><strong>{selectedPackage?.name || "No package selected"}</strong></div>
          <div className="kg-selected-package-inline-price"><small>Package price</small><span>{selectedPackage ? `R${selectedPackage.price.toLocaleString("en-ZA")}` : "Not selected"}</span></div>
        </div>
      </Card>

      <Card>
        <div className="kg-journey-progress-head">
          <div><strong>{stepLabels[currentStep]}</strong><p>Step {currentStep + 1} of {stepLabels.length}</p></div>
          <span>{progressPercentage}% complete</span>
        </div>
        <div className="kg-progress-track"><span style={{ width: `${progressPercentage}%` }} /></div>
        <div className="kg-journey-steps" style={{ gridTemplateColumns: `repeat(${stepLabels.length}, minmax(132px, 1fr))` }}>
          {stepLabels.map((label, index) => (
            <button
              key={label}
              type="button"
              className={`kg-journey-step ${index === currentStep ? "active" : ""} ${index < currentStep ? "complete" : ""}`}
              disabled={index > currentStep}
              onClick={() => goToStep(index)}
            >
              <span>{index < currentStep ? "\u2713" : index + 1}</span>
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        {activeSection}
        {message ? <div className={`kg-inline-message ${messageTone}`}>{message}</div> : null}
        <div className="kg-journey-actions">
          <Button tone="secondary" onClick={() => currentStep === 0 ? onNavigate("apply") : goToStep(currentStep - 1)}>Back</Button>
          <Button tone="ghost" loading={saving} loadingLabel="Saving draft..." onClick={saveDraft}>Save draft</Button>
          {currentStep === 0 ? (
            <Button tone="success" disabled={saving || !selectedPackage} loading={saving} loadingLabel="Adding to cart..." onClick={continueToPayment}>Continue to checkout</Button>
          ) : null}
          {currentStep < stepLabels.length - 1 ? (
            <Button tone={currentStep === 0 ? "secondary" : "success"} disabled={saving} onClick={continueForward}>Continue details</Button>
          ) : (
            <Button tone="success" disabled={saving} loading={saving} loadingLabel="Submitting..." onClick={submitApplication}>Submit application</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
