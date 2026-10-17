import { Button, SectionHeading, SelectField, TextField } from "../../components/ui";
import {
  createLateInstitution,
  getLatePackageLimitLabel,
  isAtLatePackageLimit,
  programmePriorities,
  qualificationTypes,
  type LateInstitution,
  type LatePackage
} from "./late-application-model";

function updateInstitution(
  institution: LateInstitution,
  key: keyof LateInstitution,
  value: string,
  onChange: (institution: LateInstitution) => void
) {
  onChange({ ...institution, [key]: value });
}

export function LateInstitutionSelection({
  value,
  selectedPackage,
  onChange
}: {
  value: LateInstitution[];
  selectedPackage: LatePackage;
  onChange: (value: LateInstitution[]) => void;
}) {
  const atLimit = isAtLatePackageLimit(selectedPackage, value.length);
  const limitLabel = getLatePackageLimitLabel(selectedPackage);

  return (
    <>
      <SectionHeading
        title="Institution selection"
        copy={`${selectedPackage.name} includes ${limitLabel.toLowerCase()}. ${value.length} selected.`}
        actions={
          <Button
            tone="secondary"
            disabled={atLimit}
            onClick={() => onChange([...value, createLateInstitution()])}
          >
            Add institution
          </Button>
        }
      />
      <div className="kg-list-stack">
        {value.map((institution, index) => (
          <div className="kg-list-card kg-institution-editor" key={institution.id}>
            <div className="kg-list-title-row">
              <strong>{institution.institutionName || `Institution ${index + 1}`}</strong>
              <button
                type="button"
                className="kg-text-link danger"
                onClick={() => onChange(value.filter((item) => item.id !== institution.id))}
              >
                Remove
              </button>
            </div>
            <div className="kg-journey-form-grid">
              <TextField label="Institution Name" value={institution.institutionName} onChange={(next) => updateInstitution(institution, "institutionName", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
              <TextField label="Campus" value={institution.campus} onChange={(next) => updateInstitution(institution, "campus", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
              <TextField label="Faculty" value={institution.faculty} onChange={(next) => updateInstitution(institution, "faculty", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
              <SelectField label="Qualification Type" value={institution.qualificationType} options={qualificationTypes} onChange={(next) => updateInstitution(institution, "qualificationType", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
              <TextField label="Programme" value={institution.programme} onChange={(next) => updateInstitution(institution, "programme", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
              <TextField label="Intake Year" type="number" value={institution.intakeYear} onChange={(next) => updateInstitution(institution, "intakeYear", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
              <SelectField label="Intake Semester" value={institution.intakeSemester} options={["Semester 1", "Semester 2", "Full year", "Other"]} onChange={(next) => updateInstitution(institution, "intakeSemester", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
              <SelectField label="Programme Priority" value={institution.programmePriority} options={programmePriorities} onChange={(next) => updateInstitution(institution, "programmePriority", next, (updated) => onChange(value.map((item) => item.id === updated.id ? updated : item)))} />
            </div>
          </div>
        ))}
        {!value.length ? <div className="kg-journey-notice">Add at least one institution to continue.</div> : null}
        {atLimit ? <div className="kg-journey-notice">You have reached the {selectedPackage.name} institution limit.</div> : null}
      </div>
    </>
  );
}
