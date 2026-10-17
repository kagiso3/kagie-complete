import { SectionHeading } from "../../components/ui";
import { validateDocumentFile } from "../application-form-utils";
import {
  lateDocumentDefinitions,
  type LateApplicationData,
  type LateDocument,
  type LateDocumentKey
} from "./late-application-model";

export function LateDocumentUpload({
  value,
  onChange,
  onError
}: {
  value: LateApplicationData["documents"];
  onChange: (value: LateApplicationData["documents"]) => void;
  onError: (message: string) => void;
}) {
  const selectedCount = lateDocumentDefinitions.filter((definition) => Boolean(value[definition.key])).length;
  const progress = Math.round((selectedCount / lateDocumentDefinitions.length) * 100);

  function selectDocument(key: LateDocumentKey, file: File) {
    const error = validateDocumentFile(file);
    if (error) {
      onError(error);
      return;
    }
    const document: LateDocument = {
      file,
      name: file.name,
      type: file.type,
      size: file.size
    };
    onChange({ ...value, [key]: document });
  }

  return (
    <>
      <SectionHeading
        title="Document uploads"
        copy={`${selectedCount} of ${lateDocumentDefinitions.length} document slots prepared. Required documents must be selected before submission.`}
      />
      <div className="kg-upload-progress" aria-label={`${progress}% of document slots prepared`}>
        <div><span>Upload preparation</span><strong>{progress}%</strong></div>
        <div className="kg-progress-track"><span style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="kg-journey-documents">
        {lateDocumentDefinitions.map((definition) => {
          const selected = value[definition.key];
          return (
            <div className={`kg-upload-card ${selected ? "selected" : ""}`} key={definition.key}>
              <div className="kg-upload-icon" aria-hidden="true">{"\u2191"}</div>
              <div className="kg-upload-copy">
                <strong>
                  {definition.label}
                  <span className={`kg-upload-required ${definition.required ? "required" : "optional"}`}>
                    {definition.required ? "Required" : "Optional"}
                  </span>
                </strong>
                <span>PDF, JPG, or PNG. Maximum 10 MB.</span>
                {selected ? <small className="uploaded">{selected.uploaded ? "Uploaded" : "Ready"}: {selected.name}</small> : null}
              </div>
              <div className="kg-upload-actions">
                <label className="kg-upload-button">
                  {selected ? "Replace" : "Choose file"}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) selectDocument(definition.key, file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {selected ? (
                  <button
                    type="button"
                    className="kg-text-link danger"
                    onClick={() => {
                      const next = { ...value };
                      delete next[definition.key];
                      onChange(next);
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
