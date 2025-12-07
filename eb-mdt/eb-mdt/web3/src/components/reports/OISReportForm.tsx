import React from "react";
import { classNames } from "../../utils/misc";

interface OISFormData {
  dutyStatus: string;
  uniformStatus: string;
  threatAssessment: string[];
  otherThreat: string;
  subjectInjuries: string;
  officerInjuries: string;
  bystanderInjuries: string;
  detailedNarrative: string;
  witnessOfficers: string;
  evidenceCollected: string[];
  notificationsMade: string[];
  investigatorName: string;
  investigatorBadge: string;
  investigatorContact: string;
}

interface OISReportFormProps {
  data: OISFormData;
  onChange: (data: OISFormData) => void;
}

const OISReportForm: React.FC<OISReportFormProps> = ({ data, onChange }) => {
  const handleThreatAssessmentChange = (threat: string, checked: boolean) => {
    if (checked) {
      onChange({
        ...data,
        threatAssessment: [...data.threatAssessment, threat],
      });
    } else {
      onChange({
        ...data,
        threatAssessment: data.threatAssessment.filter((t) => t !== threat),
        otherThreat: threat === "Other" ? "" : data.otherThreat,
      });
    }
  };

  const handleEvidenceChange = (evidence: string, checked: boolean) => {
    if (checked) {
      onChange({
        ...data,
        evidenceCollected: [...data.evidenceCollected, evidence],
      });
    } else {
      onChange({
        ...data,
        evidenceCollected: data.evidenceCollected.filter((e) => e !== evidence),
      });
    }
  };

  const handleNotificationChange = (notification: string, checked: boolean) => {
    if (checked) {
      onChange({
        ...data,
        notificationsMade: [...data.notificationsMade, notification],
      });
    } else {
      onChange({
        ...data,
        notificationsMade: data.notificationsMade.filter(
          (n) => n !== notification
        ),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Incident Details Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Incident Details
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Duty Status</span>
            <div className="flex-1 ml-4">
              <select
                className="mdt-input w-full"
                value={data.dutyStatus}
                onChange={(e) =>
                  onChange({
                    ...data,
                    dutyStatus: e.target.value || "on-duty",
                  })
                }
              >
                <option value="on-duty">On-Duty</option>
                <option value="off-duty">Off-Duty</option>
              </select>
            </div>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-primary-200">Uniform Status</span>
            <div className="flex-1 ml-4">
              <select
                className="mdt-input w-full"
                value={data.uniformStatus}
                onChange={(e) =>
                  onChange({
                    ...data,
                    uniformStatus: e.target.value || "uniformed",
                  })
                }
              >
                <option value="uniformed">Uniformed</option>
                <option value="plain-clothes">Plain Clothes</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Assessment Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Threat Assessment
        </h4>
        <div className="space-y-3">
          {[
            "Subject armed with firearm",
            "Subject armed with other weapon",
            "Subject made threatening movements",
            "Subject verbally threatened deadly force",
            "Other",
          ].map((threat) => (
            <label
              key={threat}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="w-4 h-4 text-primary-600 bg-mdt-bg border-mdt-border rounded focus:ring-primary-500 focus:ring-2"
                checked={data.threatAssessment.includes(threat)}
                onChange={(e) =>
                  handleThreatAssessmentChange(threat, e.target.checked)
                }
              />
              <span className="text-sm text-white">{threat}</span>
            </label>
          ))}

          {data.threatAssessment.includes("Other") && (
            <div className="ml-7">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Specify other threat..."
                value={data.otherThreat}
                onChange={(e) =>
                  onChange({
                    ...data,
                    otherThreat: e.target.value,
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Injuries Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">Injuries</h4>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Subject injuries</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Describe subject injuries..."
                value={data.subjectInjuries}
                onChange={(e) =>
                  onChange({
                    ...data,
                    subjectInjuries: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Officer injuries</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Describe officer injuries..."
                value={data.officerInjuries}
                onChange={(e) =>
                  onChange({
                    ...data,
                    officerInjuries: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-primary-200">Bystander injuries</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Describe bystander injuries..."
                value={data.bystanderInjuries}
                onChange={(e) =>
                  onChange({
                    ...data,
                    bystanderInjuries: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Narrative Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Detailed Narrative
        </h4>
        <textarea
          className="mdt-input w-full h-40 resize-none"
          placeholder="Provide a detailed narrative of events leading to the shooting..."
          value={data.detailedNarrative}
          onChange={(e) =>
            onChange({
              ...data,
              detailedNarrative: e.target.value,
            })
          }
          required
        />
      </div>

      {/* Witness Officers Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Witness Officers
        </h4>
        <textarea
          className="mdt-input w-full h-20 resize-none"
          placeholder="List all officers present..."
          value={data.witnessOfficers}
          onChange={(e) =>
            onChange({
              ...data,
              witnessOfficers: e.target.value,
            })
          }
        />
      </div>

      {/* Evidence Collected Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Evidence Collected
        </h4>
        <div className="space-y-3">
          {[
            "Officer's weapon secured",
            "Subject's weapon secured",
            "Shell casings marked",
            "Photographs taken",
            "Body camera footage secured",
            "Dashcam footage secured",
          ].map((evidence) => (
            <label
              key={evidence}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="w-4 h-4 text-primary-600 bg-mdt-bg border-mdt-border rounded focus:ring-primary-500 focus:ring-2"
                checked={data.evidenceCollected.includes(evidence)}
                onChange={(e) =>
                  handleEvidenceChange(evidence, e.target.checked)
                }
              />
              <span className="text-sm text-white">{evidence}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notifications Made Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Notifications Made
        </h4>
        <div className="space-y-3">
          {[
            "Department Command Staff",
            "Internal Affairs",
            "District Attorney's Office",
            "Officer's Union Representative",
          ].map((notification) => (
            <label
              key={notification}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="w-4 h-4 text-primary-600 bg-mdt-bg border-mdt-border rounded focus:ring-primary-500 focus:ring-2"
                checked={data.notificationsMade.includes(notification)}
                onChange={(e) =>
                  handleNotificationChange(notification, e.target.checked)
                }
              />
              <span className="text-sm text-white">{notification}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Investigator Assigned Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Investigator Assigned
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Name</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Investigator name..."
                value={data.investigatorName}
                onChange={(e) =>
                  onChange({
                    ...data,
                    investigatorName: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Badge #</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Badge number..."
                value={data.investigatorBadge}
                onChange={(e) =>
                  onChange({
                    ...data,
                    investigatorBadge: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-primary-200">Contact</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Phone number..."
                value={data.investigatorContact}
                onChange={(e) =>
                  onChange({
                    ...data,
                    investigatorContact: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OISReportForm;
