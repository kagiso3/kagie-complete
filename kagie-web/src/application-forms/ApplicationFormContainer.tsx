import type { KagieUser, LegacyApi, ProtectedRouteKey } from "../lib/types";
import type { ApplicationType } from "./application-form-types";
import { BridgingProgrammeForm } from "./bridging/BridgingProgrammeForm";
import { LateApplicationForm } from "./late/LateApplicationForm";
import { PostgraduateApplicationForm } from "./postgraduate/PostgraduateApplicationForm";
import { TransferApplicationForm } from "./transfer/TransferApplicationForm";
import { UndergraduateApplicationForm } from "./undergraduate/UndergraduateApplicationForm";

export function ApplicationFormContainer({
  applicationType,
  api,
  user,
  onNavigate
}: {
  applicationType: ApplicationType;
  api: LegacyApi;
  user: KagieUser;
  onNavigate: (route: ProtectedRouteKey) => void;
}) {
  switch (applicationType) {
    case "late":
      return <LateApplicationForm api={api} user={user} onNavigate={onNavigate} />;
    case "transfer":
      return <TransferApplicationForm api={api} user={user} onNavigate={onNavigate} />;
    case "bridging":
      return <BridgingProgrammeForm api={api} user={user} onNavigate={onNavigate} />;
    case "postgraduate":
      return <PostgraduateApplicationForm api={api} user={user} onNavigate={onNavigate} />;
    case "undergraduate":
    default:
      return <UndergraduateApplicationForm api={api} user={user} onNavigate={onNavigate} />;
  }
}
