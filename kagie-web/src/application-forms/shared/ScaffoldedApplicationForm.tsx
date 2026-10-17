import type { ApplicationPack } from "@kagie/shared";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, SectionHeading } from "../../components/ui";
import type { KagieApplication, KagieUser, LegacyApi, ProtectedRouteKey } from "../../lib/types";
import {
  applicationTypeLabels,
  buildPackageSelection,
  getApplicationPackagesForType,
  readPackageSelection,
  savePackageSelection,
  type ApplicationPackageSelection
} from "../application-package-catalog";
import {
  applicationStorageKey,
  applicationStepStorageKey,
  clearApplicationStorage,
  createEmptyApplicationForm,
  getMissingDocuments,
  type ApplicationDocumentDefinition,
  type ApplicationFormData,
  type ApplicationProgress,
  type TypeSpecificField
} from "../application-form-model";
import type { ApplicationType } from "../application-form-types";
import {
  getBackendApplicationStatus,
  getDocumentCategory,
  getStepProgress,
  isWithinInstitutionLimit
} from "../application-form-utils";
import {
  ApplicationSummarySection,
  ContactDetailsSection,
  DocumentUploadSection,
  EmergencyContactSection,
  InstitutionSelectionSection,
  PackageSelectionSection,
  PersonalDetailsSection,
  TypeSpecificSection
} from "./application-sections";

type ScaffoldConfig = {
  applicationType: Exclude<ApplicationType, "undergraduate">;
  title: string;
  description: string;
  specificSectionTitle: string;
  specificFields: TypeSpecificField[];
  documents: ApplicationDocumentDefinition[];
};

const stepLabels = [
  "Package Selection",
  "Personal Details",
  "Contact Information",
  "Emergency Contact",
  "Application Details",
  "Institution Selection",
  "Document Uploads",
  "Application Summary"
];

function readStoredData(user: KagieUser, applicationType: ApplicationType) {
  const empty = createEmptyApplicationForm(user);
  try {
    const stored = localStorage.getItem(applicationStorageKey(user.id, applicationType));
    if (!stored) return empty;
    const parsed = JSON.parse(stored) as Partial<ApplicationFormData>;
    return {
      ...empty,
      ...parsed,
      personalDetails: { ...empty.personalDetails, ...(parsed.personalDetails || {}) },
      contactDetails: { ...empty.contactDetails, ...(parsed.contactDetails || {}) },
      emergencyContact: { ...empty.emergencyContact, ...(parsed.emergencyContact || {}) },
      academicInformation: { ...empty.academicInformation, ...(parsed.academicInformation || {}) },
      institutions: Array.isArray(parsed.institutions) ? parsed.institutions : [],
      documents: parsed.documents || {},
      typeSpecific: parsed.typeSpecific || {}
    };
  } catch {
    return empty;
  }
}

function createReference(applicationType: ApplicationType) {
  const code = applicationType.slice(0, 4).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAG-${code}-${new Date().getFullYear()}-${random}`;
}

function readStoredStep(userId: string, applicationType: ApplicationType) {
  try {
    const step = Number(localStorage.getItem(applicationStepStorageKey(userId, applicationType)));
    return Number.isInteger(step) ? Math.max(0, Math.min(step, stepLabels.length - 1)) : 0;
  } catch {
    return 0;
  }
}

export function ScaffoldedApplicationForm({
  config,
  api,
  user,
  onNavigate
}: {
  config: ScaffoldConfig;
  api: LegacyApi;
  user: KagieUser;
  onNavigate: (route: ProtectedRouteKey) => void;
}) {
  const [formData, setFormData] = useState<ApplicationFormData>(() => readStoredData(user, config.applicationType));
  const [packages, setPackages] = useState<ApplicationPack[]>(() => api.getPackCatalog());
  const [selectedPackageId, setSelectedPackageId] = useState(() => {
    const saved = readPackageSelection(user.id, config.applicationType);
    return saved?.package.id || "";
  });
  const [currentStep, setCurrentStep] = useState(() => readStoredStep(user.id, config.applicationType));
  const [applicationId, setApplicationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [submittedReference, setSubmittedReference] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    if (!api.getPackCatalogAsync) return;
    let active = true;
    api.getPackCatalogAsync()
      .then((nextPackages) => {
        if (active && nextPackages.length) setPackages(nextPackages);
      })
      .catch(() => {
        // The synchronous package catalog remains the fallback source of truth.
      });
    return () => {
      active = false;
    };
  }, [api]);

  const availablePackages = useMemo(
    () => getApplicationPackagesForType(packages, config.applicationType),
    [packages, config.applicationType]
  );

  useEffect(() => {
    if (!packages.length || !selectedPackageId) return;
    if (!availablePackages.some((pack) => pack.id === selectedPackageId)) {
      setSelectedPackageId("");
    }
  }, [availablePackages, packages.length, selectedPackageId]);

  const selectedPackage = availablePackages.find((pack) => pack.id === selectedPackageId) || null;
  const packageSelection: ApplicationPackageSelection | null = selectedPackage
    ? buildPackageSelection(config.applicationType, selectedPackage, applicationId || undefined)
    : null;
  const documentLabels = new Map(config.documents.map((document) => [document.key, document.label]));
  const missingDocuments = getMissingDocuments(formData.documents, config.documents)
    .map((key) => documentLabels.get(key) || key);
  const progressPercentage = getStepProgress(currentStep, stepLabels.length);

  function updateForm<K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) {
    setFormData((current) => {
      const next = { ...current, [key]: value };
      persistLocal(next, currentStep);
      return next;
    });
  }

  function persistLocal(nextData = formData, step = currentStep) {
    const serializableDocuments = Object.fromEntries(
      Object.entries(nextData.documents)
        .filter(([, document]) => Boolean(document?.uploaded))
        .map(([key, document]) => [key, {
          name: document?.name || "",
          type: document?.type || "",
          size: document?.size || 0,
          uploaded: true
        }])
    );
    try {
      localStorage.setItem(applicationStorageKey(user.id, config.applicationType), JSON.stringify({
        ...nextData,
        documents: serializableDocuments
      }));
      localStorage.setItem(applicationStepStorageKey(user.id, config.applicationType), String(step));
    } catch {
      // The active form remains usable if browser storage is unavailable.
    }
  }

  function goToStep(step: number) {
    const boundedStep = Math.max(0, Math.min(step, stepLabels.length - 1));
    setCurrentStep(boundedStep);
    persistLocal(formData, boundedStep);
  }

  function showMessage(text: string, tone: "success" | "error" | "info" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function clearMessage() {
    setMessage("");
    setMessageTone("info");
  }

  function selectPackage(packageId: string) {
    const nextPackage = availablePackages.find((pack) => pack.id === packageId);
    if (!nextPackage) return;
    if (!isWithinInstitutionLimit(nextPackage, formData.institutions.length)) {
      showMessage(`Remove institutions until the selection fits the ${nextPackage.name} limit.`, "error");
      return;
    }
    setSelectedPackageId(packageId);
    savePackageSelection(user.id, buildPackageSelection(config.applicationType, nextPackage, applicationId || undefined));
    clearMessage();
  }

  async function ensureDraft() {
    const draft = api.ensureApplicationDraftAsync
      ? await api.ensureApplicationDraftAsync(config.applicationType, user.id)
      : api.ensureApplicationDraft
        ? api.ensureApplicationDraft(config.applicationType, user.id)
        : api.ensureDraftAsync
          ? await api.ensureDraftAsync(user.id)
          : api.ensureDraft(user.id);
    setApplicationId(draft.id);
    if (selectedPackage) {
      savePackageSelection(user.id, buildPackageSelection(config.applicationType, selectedPackage, draft.id));
    }
    return draft;
  }

  function buildProgress(
    status: ApplicationProgress["status"],
    data: ApplicationFormData = formData,
    step = currentStep
  ): ApplicationProgress {
    const persistedDocuments = serializableFormData(data).documents;
    return {
      percentage: status === "Submitted" ? 100 : getStepProgress(step, stepLabels.length),
      currentStep: status === "Submitted" ? "Submitted" : (stepLabels[step] || "Package Selection"),
      currentStepNumber: status === "Submitted" ? stepLabels.length : step + 1,
      totalSteps: stepLabels.length,
      missingDocuments: getMissingDocuments(persistedDocuments, config.documents)
        .map((key) => documentLabels.get(key) || key),
      status
    };
  }

  function validateStep(step: number) {
    const requiredValues: string[] = [];
    if (step === 0) {
      if (!selectedPackage) {
        showMessage("Choose a Kagie application package before continuing.", "error");
        return false;
      }
    } else if (step === 1) {
      const personal = formData.personalDetails;
      requiredValues.push(personal.firstName, personal.lastName, personal.identityNumber, personal.dateOfBirth, personal.gender, personal.nationality);
    } else if (step === 2) {
      const contact = formData.contactDetails;
      requiredValues.push(contact.mobileNumber, contact.emailAddress, contact.physicalAddress, contact.province, contact.city);
    } else if (step === 3) {
      const emergency = formData.emergencyContact;
      requiredValues.push(emergency.fullName, emergency.relationship, emergency.phoneNumber);
    } else if (step === 4) {
      config.specificFields.forEach((field) => requiredValues.push(formData.typeSpecific[field.key] || ""));
    } else if (step === 5) {
      if (!selectedPackage || !formData.institutions.length) {
        showMessage("Choose a package and add at least one institution before continuing.", "error");
        return false;
      }
      if (!isWithinInstitutionLimit(selectedPackage, formData.institutions.length)) {
        showMessage(`${selectedPackage.name} allows only ${selectedPackage.institutionLimit} institutions.`, "error");
        return false;
      }
      formData.institutions.forEach((institution) => {
        requiredValues.push(institution.institutionName, institution.programme);
      });
    } else if (step === 6 && missingDocuments.length) {
      showMessage(`Upload the required documents: ${missingDocuments.join(", ")}.`, "error");
      return false;
    }

    if (requiredValues.some((value) => !String(value || "").trim())) {
      showMessage("Complete all required fields in this section before continuing.", "error");
      return false;
    }
    clearMessage();
    return true;
  }

  function mapInstitutions(data: ApplicationFormData) {
    return data.institutions.map((institution) => ({
      ...institution,
      institutionName: institution.institutionName,
      faculty: institution.qualificationType,
      choice1: institution.programme,
      choice2: "",
      choice3: "",
      province: "",
      institutionType: institution.qualificationType,
      year: institution.intakeYear
    }));
  }

  function serializableFormData(data: ApplicationFormData): ApplicationFormData {
    return {
      ...data,
      documents: Object.fromEntries(
        Object.entries(data.documents).map(([key, document]) => [key, document ? {
          name: document.name,
          type: document.type,
          size: document.size,
          uploaded: Boolean(document.uploaded)
        } : document])
      )
    };
  }

  async function persistApplication(
    status: ApplicationProgress["status"] = "Draft",
    data: ApplicationFormData = formData,
    step = currentStep
  ) {
    if (!selectedPackage) throw new Error("Choose a Kagie application package before saving.");

    const draft = await ensureDraft();
    const progress = buildProgress(status, data, step);
    const patch = {
      applicationType: config.applicationType,
      applicationTypeLabel: applicationTypeLabels[config.applicationType],
      selectedPackage,
      package: selectedPackage,
      packagePrice: selectedPackage.price,
      finalTotal: selectedPackage.price,
      institutions: mapInstitutions(data),
      forms: {
        ...(draft.forms || {}),
        applicationType: {
          type: config.applicationType,
          label: applicationTypeLabels[config.applicationType]
        },
        packageSelection: buildPackageSelection(config.applicationType, selectedPackage, draft.id),
        commonApplication: serializableFormData(data),
        typeSpecific: data.typeSpecific,
        applicationProgress: progress,
        learner: {
          firstName: data.personalDetails.firstName,
          middleName: data.personalDetails.middleName,
          surname: data.personalDetails.lastName,
          fullNames: [data.personalDetails.firstName, data.personalDetails.middleName].filter(Boolean).join(" "),
          idNumber: data.personalDetails.identityNumber,
          dob: data.personalDetails.dateOfBirth,
          gender: data.personalDetails.gender,
          nationality: data.personalDetails.nationality,
          cellphone: data.contactDetails.mobileNumber,
          email: data.contactDetails.emailAddress,
          address: data.contactDetails.physicalAddress,
          province: data.contactDetails.province
        }
      },
      status: getBackendApplicationStatus(status),
      paymentStatus: "Unpaid"
    };
    const updated = api.updateApplicationAsync
      ? await api.updateApplicationAsync(draft.id, patch)
      : api.updateApplication?.(draft.id, patch);
    const savedApplication = updated || draft;
    setApplicationId(savedApplication.id);
    savePackageSelection(user.id, buildPackageSelection(config.applicationType, selectedPackage, savedApplication.id));
    persistLocal(data, step);
    return savedApplication;
  }

  async function saveDraft() {
    setSaving(true);
    clearMessage();
    try {
      await persistApplication("Draft");
      showMessage("Draft saved.", "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not save this application.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function continueForward() {
    if (!validateStep(currentStep)) return;
    const nextStep = Math.min(stepLabels.length - 1, currentStep + 1);
    setSaving(true);
    try {
      await persistApplication("In Progress", formData, nextStep);
      goToStep(nextStep);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not save this application.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addPackageToCart(application: KagieApplication, data: ApplicationFormData) {
    if (!selectedPackage) return null;
    const institutions = mapInstitutions(data);
    const cartPayload = {
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
      applicationType: config.applicationType,
      applicationId: application.id
    };

    const saveLocalCartCopy = () => {
      (api.getCart(user.id) || [])
        .filter((entry) => entry.type === "application_pack")
        .forEach((entry) => api.removeCartItem(entry.id, user.id));
      return api.addCartItem({ ...cartPayload, syncState: "local" }, user.id);
    };

    try {
      if (api.replaceApplicationPackCartItemAsync) {
        return await api.replaceApplicationPackCartItemAsync({ ...cartPayload, syncState: "synced" }, user.id);
      }
      const localItem = saveLocalCartCopy();
      return api.addCartItemAsync
        ? await api.addCartItemAsync({ ...cartPayload, syncState: "synced" }, user.id)
        : localItem;
    } catch (error) {
      console.warn("Kagie package cart sync fallback:", error);
      return saveLocalCartCopy();
    }
  }

  async function continueToPayment() {
    if (!selectedPackage) {
      showMessage("Choose a Kagie application package before checkout.", "error");
      return;
    }

    setSaving(true);
    clearMessage();
    try {
      const draft = await persistApplication("Draft", formData, 0);
      await addPackageToCart(draft, formData);
      showMessage("Package added to cart. Complete payment now and finish details later from your Dashboard.", "success");
      onNavigate("cart");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not add this package to cart yet.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function submitApplication() {
    for (let step = 0; step <= 6; step += 1) {
      if (!validateStep(step)) {
        goToStep(step);
        return;
      }
    }

    setSaving(true);
    clearMessage();
    try {
      const draft = await ensureDraft();
      let submittedData = formData;
      const pendingDocuments = Object.entries(formData.documents)
        .filter(([, document]) => Boolean(document?.file))
        .map(([key, document]) => ({
          applicationId: draft.id,
          category: getDocumentCategory(key as keyof ApplicationFormData["documents"]),
          name: document?.name,
          fileName: document?.name,
          type: document?.type,
          mimeType: document?.type,
          size: document?.size,
          file: document?.file
        }));
      if (pendingDocuments.length) {
        if (api.saveDocumentsAsync) await api.saveDocumentsAsync(pendingDocuments, user.id);
        else api.saveDocuments?.(pendingDocuments, user.id);
        const uploadedDocuments = Object.fromEntries(
          Object.entries(formData.documents).map(([key, document]) => [key, document?.file
            ? { ...document, file: undefined, uploaded: true }
            : document])
        );
        submittedData = {
          ...formData,
          documents: uploadedDocuments
        };
        setFormData(submittedData);
        persistLocal(submittedData);
      }
      const reference = createReference(config.applicationType);
      const updated = await persistApplication("Submitted", submittedData, stepLabels.length - 1);
      const finalPatch = {
        applicationReference: reference,
        submittedAt: new Date().toISOString()
      };
      if (api.updateApplicationAsync) await api.updateApplicationAsync(updated.id, finalPatch);
      else api.updateApplication?.(updated.id, finalPatch);
      await addPackageToCart(updated, submittedData);
      clearApplicationStorage(user.id, config.applicationType);
      if (selectedPackage) {
        savePackageSelection(user.id, buildPackageSelection(config.applicationType, selectedPackage));
      }
      setApplicationId("");
      setSubmittedReference(reference);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not submit this application.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (submittedReference) {
    return (
      <div className={`kg-page-stack kg-application-theme kg-application-theme-${config.applicationType}`}>
        <Card className="kg-journey-success">
          <div className="kg-journey-success-mark" aria-hidden="true">{"\u2713"}</div>
          <SectionHeading title="Application submitted" copy={`${applicationTypeLabels[config.applicationType]} was saved and its Kagie package was added to your cart.`} />
          <div className="kg-reference-card">
            <span>Application reference</span>
            <strong>{submittedReference}</strong>
            <small>Track progress from your dashboard or continue to payment.</small>
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
            <SectionHeading title="Package selection" copy={`${applicationTypeLabels[config.applicationType]} package options are filtered to the right application type. Select a package to continue to checkout now, or complete details first if you prefer.`} />
            {availablePackages.length ? (
              <PackageSelectionSection
                applicationType={config.applicationType}
                packages={availablePackages}
                selectedPackageId={selectedPackageId}
                onSelect={selectPackage}
              />
            ) : (
              <div className="kg-journey-notice">No active Kagie packages are available. Please try again shortly.</div>
            )}
            {selectedPackage ? (
              <div className="kg-journey-notice">
                Payment can be completed before the form is finished. The application will stay Pending Details until all required sections are submitted.
              </div>
            ) : null}
          </>
        );
      case 1:
        return <PersonalDetailsSection value={formData.personalDetails} onChange={(value) => updateForm("personalDetails", value)} />;
      case 2:
        return <ContactDetailsSection value={formData.contactDetails} onChange={(value) => updateForm("contactDetails", value)} />;
      case 3:
        return <EmergencyContactSection value={formData.emergencyContact} onChange={(value) => updateForm("emergencyContact", value)} />;
      case 4:
        return <TypeSpecificSection title={config.specificSectionTitle} fields={config.specificFields} value={formData.typeSpecific} onChange={(value) => updateForm("typeSpecific", value)} />;
      case 5:
        return selectedPackage ? (
          <InstitutionSelectionSection
            value={formData.institutions}
            onChange={(value) => updateForm("institutions", value)}
            institutionLimit={selectedPackage.institutionLimit}
            packageName={selectedPackage.name}
          />
        ) : null;
      case 6:
        return (
          <DocumentUploadSection
            value={formData.documents}
            documents={config.documents}
            onChange={(value) => {
              clearMessage();
              updateForm("documents", value);
            }}
            onError={(error) => showMessage(error, "error")}
          />
        );
      default:
        return packageSelection
          ? <ApplicationSummarySection applicationTypeLabel={applicationTypeLabels[config.applicationType]} packageSelection={packageSelection} formData={formData} />
          : null;
    }
  })();

  return (
    <div className={`kg-page-stack kg-application-theme kg-application-theme-${config.applicationType}`}>
      <Card className="kg-journey-hero">
        <SectionHeading
          eyebrow={applicationTypeLabels[config.applicationType]}
          title={config.title}
          copy={config.description}
          actions={<Button tone="ghost" onClick={() => onNavigate("apply")}>Change application type</Button>}
        />
        <div className="kg-selected-package-inline">
          <div>
            <small>Selected package</small>
            <strong>{selectedPackage?.name || "No package selected"}</strong>
          </div>
          <div className="kg-selected-package-inline-price">
            <small>Package price</small>
            <span>{selectedPackage ? `R${selectedPackage.price.toLocaleString("en-ZA")}` : "Not selected"}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="kg-journey-progress-head">
          <div>
            <strong>{stepLabels[currentStep]}</strong>
            <p>Step {currentStep + 1} of {stepLabels.length}</p>
          </div>
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
