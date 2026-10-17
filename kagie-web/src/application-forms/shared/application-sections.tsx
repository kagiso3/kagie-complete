import type { ApplicationPack } from "@kagie/shared";
import { Button, Card, SectionHeading, SelectField, TextAreaField, TextField } from "../../components/ui";
import type { ApplicationType } from "../application-form-types";
import type { ApplicationPackageSelection } from "../application-package-catalog";
import { validateDocumentFile } from "../application-form-utils";
import {
  createInstitutionSelection,
  type AcademicInformation,
  type ApplicationDocument,
  type ApplicationDocumentDefinition,
  type ApplicationDocumentKey,
  type ApplicationFormData,
  type ContactDetails,
  type EmergencyContact,
  type InstitutionSelection,
  type PersonalDetails,
  type TypeSpecificField
} from "../application-form-model";

const provinces = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

function updateRecord<T extends object>(value: T, key: keyof T, nextValue: string, onChange: (next: T) => void) {
  onChange({ ...value, [key]: nextValue });
}

export function PersonalDetailsSection({
  value,
  onChange
}: {
  value: PersonalDetails;
  onChange: (value: PersonalDetails) => void;
}) {
  return (
    <>
      <SectionHeading title="Personal details" copy="Identity information shared across every application type." />
      <div className="kg-journey-form-grid">
        <TextField label="First Name" value={value.firstName} onChange={(next) => updateRecord(value, "firstName", next, onChange)} />
        <TextField label="Middle Name" value={value.middleName} onChange={(next) => updateRecord(value, "middleName", next, onChange)} />
        <TextField label="Last Name" value={value.lastName} onChange={(next) => updateRecord(value, "lastName", next, onChange)} />
        <TextField label="ID Number / Passport Number" value={value.identityNumber} onChange={(next) => updateRecord(value, "identityNumber", next, onChange)} />
        <TextField label="Date of Birth" type="date" value={value.dateOfBirth} onChange={(next) => updateRecord(value, "dateOfBirth", next, onChange)} />
        <SelectField label="Gender" value={value.gender} options={["Female", "Male", "Non-binary", "Prefer not to say"]} onChange={(next) => updateRecord(value, "gender", next, onChange)} />
        <TextField label="Nationality" value={value.nationality} onChange={(next) => updateRecord(value, "nationality", next, onChange)} />
      </div>
    </>
  );
}

export function ContactDetailsSection({
  value,
  onChange
}: {
  value: ContactDetails;
  onChange: (value: ContactDetails) => void;
}) {
  return (
    <>
      <SectionHeading title="Contact details" copy="Contact and address information used by Kagie and institutions." />
      <div className="kg-journey-form-grid">
        <TextField label="Mobile Number" value={value.mobileNumber} onChange={(next) => updateRecord(value, "mobileNumber", next, onChange)} />
        <TextField label="Alternative Number" value={value.alternativeNumber} onChange={(next) => updateRecord(value, "alternativeNumber", next, onChange)} />
        <TextField label="Email Address" type="email" value={value.emailAddress} onChange={(next) => updateRecord(value, "emailAddress", next, onChange)} />
        <SelectField label="Province" value={value.province} options={provinces} onChange={(next) => updateRecord(value, "province", next, onChange)} />
        <TextAreaField label="Physical Address" value={value.physicalAddress} onChange={(next) => updateRecord(value, "physicalAddress", next, onChange)} />
        <TextField label="City" value={value.city} onChange={(next) => updateRecord(value, "city", next, onChange)} />
      </div>
    </>
  );
}

export function EmergencyContactSection({
  value,
  onChange
}: {
  value: EmergencyContact;
  onChange: (value: EmergencyContact) => void;
}) {
  return (
    <>
      <SectionHeading title="Emergency contact" copy="A trusted person institutions may contact when necessary." />
      <div className="kg-journey-form-grid">
        <TextField label="Full Name" value={value.fullName} onChange={(next) => updateRecord(value, "fullName", next, onChange)} />
        <TextField label="Relationship" value={value.relationship} onChange={(next) => updateRecord(value, "relationship", next, onChange)} />
        <TextField label="Phone Number" value={value.phoneNumber} onChange={(next) => updateRecord(value, "phoneNumber", next, onChange)} />
      </div>
    </>
  );
}

export function AcademicInformationSection({
  value,
  onChange
}: {
  value: AcademicInformation;
  onChange: (value: AcademicInformation) => void;
}) {
  return (
    <>
      <SectionHeading title="Academic information" copy="Current or completed academic history for programme matching." />
      <div className="kg-journey-form-grid">
        <TextField label="Highest Qualification" value={value.highestQualification} onChange={(next) => updateRecord(value, "highestQualification", next, onChange)} />
        <TextField label="School Name" value={value.schoolName} onChange={(next) => updateRecord(value, "schoolName", next, onChange)} />
        <TextField label="Examination Number" value={value.examinationNumber} onChange={(next) => updateRecord(value, "examinationNumber", next, onChange)} />
        <TextField label="Year Completed" type="number" value={value.yearCompleted} onChange={(next) => updateRecord(value, "yearCompleted", next, onChange)} />
        <TextAreaField label="Subjects" value={value.subjects} placeholder="List subjects separated by commas or new lines." onChange={(next) => updateRecord(value, "subjects", next, onChange)} />
        <TextAreaField label="Results" value={value.results} placeholder="Add each subject result or aggregate." onChange={(next) => updateRecord(value, "results", next, onChange)} />
      </div>
    </>
  );
}

function InstitutionEditor({
  institution,
  onChange,
  onRemove
}: {
  institution: InstitutionSelection;
  onChange: (value: InstitutionSelection) => void;
  onRemove: () => void;
}) {
  return (
    <div className="kg-list-card kg-institution-editor">
      <div className="kg-list-title-row">
        <strong>{institution.institutionName || "New institution"}</strong>
        <button type="button" className="kg-text-link danger" onClick={onRemove}>Remove</button>
      </div>
      <div className="kg-journey-form-grid">
        <TextField label="Institution Name" value={institution.institutionName} onChange={(next) => updateRecord(institution, "institutionName", next, onChange)} />
        <TextField label="Campus" value={institution.campus} onChange={(next) => updateRecord(institution, "campus", next, onChange)} />
        <TextField label="Programme" value={institution.programme} onChange={(next) => updateRecord(institution, "programme", next, onChange)} />
        <TextField label="Qualification Type" value={institution.qualificationType} onChange={(next) => updateRecord(institution, "qualificationType", next, onChange)} />
        <TextField label="Intake Year" type="number" value={institution.intakeYear} onChange={(next) => updateRecord(institution, "intakeYear", next, onChange)} />
        <SelectField label="Intake Semester" value={institution.intakeSemester} options={["Semester 1", "Semester 2", "Full year", "Other"]} onChange={(next) => updateRecord(institution, "intakeSemester", next, onChange)} />
      </div>
    </div>
  );
}

export function InstitutionSelectionSection({
  value,
  onChange,
  institutionLimit,
  packageName
}: {
  value: InstitutionSelection[];
  onChange: (value: InstitutionSelection[]) => void;
  institutionLimit: number | "unlimited";
  packageName: string;
}) {
  const atLimit = institutionLimit !== "unlimited" && value.length >= institutionLimit;
  const limitLabel = institutionLimit === "unlimited"
    ? `${value.length} selected, unlimited`
    : `${value.length} of ${institutionLimit} selected`;

  return (
    <>
      <SectionHeading
        title="Institution selection"
        copy={`${packageName}: ${limitLabel}. Add each institution and programme included in this application.`}
        actions={<Button tone="secondary" disabled={atLimit} onClick={() => onChange([...value, createInstitutionSelection()])}>Add institution</Button>}
      />
      <div className="kg-list-stack">
        {value.map((institution) => (
          <InstitutionEditor
            key={institution.id}
            institution={institution}
            onChange={(next) => onChange(value.map((item) => item.id === next.id ? next : item))}
            onRemove={() => onChange(value.filter((item) => item.id !== institution.id))}
          />
        ))}
        {!value.length ? <div className="kg-journey-notice">No institutions added yet. Use Add institution to create the first choice.</div> : null}
        {atLimit ? <div className="kg-journey-notice">You have reached the institution limit for {packageName}.</div> : null}
      </div>
    </>
  );
}

export function PackageSelectionSection({
  applicationType,
  packages,
  selectedPackageId,
  onSelect
}: {
  applicationType: ApplicationType;
  packages: ApplicationPack[];
  selectedPackageId: string;
  onSelect: (packageId: string) => void;
}) {
  return (
    <div className="kg-specialised-pack-grid" aria-label={`${applicationType} packages`}>
      {packages.map((applicationPackage) => {
        const selected = applicationPackage.id === selectedPackageId;
        const levelClass = String(applicationPackage.level || "package").toLowerCase();
        const institutionLimit = applicationPackage.institutionLimit === "unlimited"
          ? "Unlimited institutions"
          : `${applicationPackage.institutionLimit} institutions`;
        return (
          <Card key={applicationPackage.id} className={`kg-specialised-pack ${levelClass} ${selected ? "selected" : ""}`}>
            {applicationPackage.badge ? <span className="kg-pack-badge">{applicationPackage.badge}</span> : null}
            <div className="kg-pack-level">{institutionLimit}</div>
            <h3>{applicationPackage.name}</h3>
            <div className="kg-pack-price-block">
              <span>Package price</span>
              <strong>R{applicationPackage.price.toLocaleString("en-ZA")}</strong>
              <small>Once-off Kagie service fee</small>
            </div>
            <p>{applicationPackage.description}</p>
            {applicationPackage.features?.length ? <ul>{applicationPackage.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : null}
            {applicationPackage.highlight ? <small>{applicationPackage.highlight}</small> : null}
            <Button tone={selected ? "success" : "primary"} onClick={() => onSelect(applicationPackage.id)}>
              {selected ? "Package selected" : "Choose package"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

export function DocumentUploadSection({
  value,
  onChange,
  documents,
  onError
}: {
  value: ApplicationFormData["documents"];
  onChange: (value: ApplicationFormData["documents"]) => void;
  documents: ApplicationDocumentDefinition[];
  onError: (message: string) => void;
}) {
  function selectDocument(key: ApplicationDocumentKey, file: File) {
    const validationError = validateDocumentFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }
    const document: ApplicationDocument = { file, name: file.name, type: file.type, size: file.size };
    onChange({ ...value, [key]: document });
  }

  return (
    <>
      <SectionHeading title="Document uploads" copy="Upload the common documents required for this application type." />
      <div className="kg-journey-documents">
        {documents.map((document) => {
          const selected = value[document.key];
          return (
            <div className="kg-upload-card" key={document.key}>
              <div className="kg-upload-icon" aria-hidden="true">{"\u2191"}</div>
              <div className="kg-upload-copy">
                <strong>{document.label}{document.required ? "" : " (optional)"}</strong>
                <span>PDF, JPG, or PNG. Maximum 10 MB.</span>
                {selected ? <small className="uploaded">{selected.name}</small> : null}
              </div>
              <div className="kg-upload-actions">
                <label className="kg-upload-button">
                  {selected ? "Replace" : "Choose file"}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) selectDocument(document.key, file);
                    event.target.value = "";
                  }} />
                </label>
                {selected ? <button type="button" className="kg-text-link danger" onClick={() => {
                  const next = { ...value };
                  delete next[document.key];
                  onChange(next);
                }}>Remove</button> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function TypeSpecificSection({
  title,
  fields,
  value,
  onChange
}: {
  title: string;
  fields: TypeSpecificField[];
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  return (
    <>
      <SectionHeading title={title} copy="Application-type fields are isolated here so this scaffold can be extended without changing common sections." />
      <div className="kg-journey-form-grid">
        {fields.map((field) => field.type === "textarea" ? (
          <TextAreaField key={field.key} label={field.label} placeholder={field.placeholder} value={value[field.key] || ""} onChange={(next) => onChange({ ...value, [field.key]: next })} />
        ) : (
          <TextField key={field.key} label={field.label} placeholder={field.placeholder} type={field.type || "text"} value={value[field.key] || ""} onChange={(next) => onChange({ ...value, [field.key]: next })} />
        ))}
      </div>
    </>
  );
}

export function ApplicationSummarySection({
  applicationTypeLabel,
  packageSelection,
  formData
}: {
  applicationTypeLabel: string;
  packageSelection: ApplicationPackageSelection;
  formData: ApplicationFormData;
}) {
  const uploadedDocuments = Object.values(formData.documents).filter(Boolean);
  return (
    <>
      <SectionHeading title="Application summary" copy="Review the application type, package, choices, and uploads before submission." />
      <div className="kg-journey-review">
        <dl>
          <div><dt>Application Type</dt><dd>{applicationTypeLabel}</dd></div>
          <div><dt>Selected Package</dt><dd>{packageSelection.package.name}</dd></div>
          <div><dt>Institutions Chosen</dt><dd>{formData.institutions.map((item) => item.institutionName).filter(Boolean).join(", ") || "None"}</dd></div>
          <div><dt>Programmes Chosen</dt><dd>{formData.institutions.map((item) => item.programme).filter(Boolean).join(", ") || "None"}</dd></div>
          <div><dt>Uploaded Documents</dt><dd>{uploadedDocuments.map((document) => document?.name).filter(Boolean).join(", ") || "None"}</dd></div>
        </dl>
      </div>
    </>
  );
}
