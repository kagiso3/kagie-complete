import { Button, Card, SectionHeading } from "../../components/ui";
import { getLatePackageLimitLabel, latePackages, type LatePackage } from "./late-application-model";

export function LatePackageSelection({
  selectedPackageId,
  onSelect
}: {
  selectedPackageId: string;
  onSelect: (applicationPackage: LatePackage) => void;
}) {
  return (
    <>
      <SectionHeading
        title="Choose a Late Application package"
        copy="Your package controls the number of institutions included in this late application."
      />
      <div className="kg-specialised-pack-grid kg-late-package-grid">
        {latePackages.map((applicationPackage) => {
          const selected = applicationPackage.id === selectedPackageId;
          const limitLabel = getLatePackageLimitLabel(applicationPackage);
          return (
            <Card
              key={applicationPackage.id}
              className={`kg-specialised-pack ${applicationPackage.level.toLowerCase()} ${selected ? "selected" : ""}`}
            >
              {applicationPackage.badge ? <span className="kg-pack-badge">{applicationPackage.badge}</span> : null}
              <div className="kg-pack-level">{limitLabel}</div>
              <h3>{applicationPackage.name}</h3>
              <div className="kg-pack-price-block">
                <span>Package price</span>
                <strong>R{applicationPackage.price.toLocaleString("en-ZA")}</strong>
                <small>Once-off Kagie service fee</small>
              </div>
              <ul>{applicationPackage.features?.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <p><strong>Suitable for:</strong> {applicationPackage.suitableFor}</p>
              <Button tone={selected ? "success" : "primary"} onClick={() => onSelect(applicationPackage)}>
                {selected ? "Package selected" : "Choose package"}
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
