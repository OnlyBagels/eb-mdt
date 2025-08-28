import React from "react";
import { classNames } from "../../utils/misc";

interface IncidentFormData {
  incidentType: string[];
  otherIncidentType: string;
  narrative: string;
  witnessStatements: string;
  disposition: string[];
  otherDisposition: string;
}

interface IncidentReportFormProps {
  data: IncidentFormData;
  onChange: (data: IncidentFormData) => void;
}

const IncidentReportForm: React.FC<IncidentReportFormProps> = ({
  data,
  onChange,
}) => {
  const handleIncidentTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      onChange({
        ...data,
        incidentType: [...data.incidentType, type],
      });
    } else {
      onChange({
        ...data,
        incidentType: data.incidentType.filter((t) => t !== type),
        otherIncidentType: type === "Other" ? "" : data.otherIncidentType,
      });
    }
  };

  const handleDispositionChange = (disposition: string, checked: boolean) => {
    if (checked) {
      onChange({
        ...data,
        disposition: [...data.disposition, disposition],
      });
    } else {
      onChange({
        ...data,
        disposition: data.disposition.filter((d) => d !== disposition),
        otherDisposition: disposition === "Other" ? "" : data.otherDisposition,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Incident Type Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">Incident Type</h4>
        <div className="space-y-3">
          {["Disturbance", "Theft", "Assault", "Property Damage", "Other"].map(
            (type) => (
              <label
                key={type}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 bg-mdt-bg border-mdt-border rounded focus:ring-primary-500 focus:ring-2"
                  checked={data.incidentType.includes(type)}
                  onChange={(e) =>
                    handleIncidentTypeChange(type, e.target.checked)
                  }
                />
                <span className="text-sm text-white">{type}</span>
              </label>
            )
          )}

          {data.incidentType.includes("Other") && (
            <div className="ml-7">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Specify other incident type..."
                value={data.otherIncidentType}
                onChange={(e) =>
                  onChange({
                    ...data,
                    otherIncidentType: e.target.value,
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Narrative Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">Narrative</h4>
        <textarea
          className="mdt-input w-full h-32 resize-none"
          placeholder="Provide a detailed narrative of the incident..."
          value={data.narrative}
          onChange={(e) =>
            onChange({
              ...data,
              narrative: e.target.value,
            })
          }
          required
        />
      </div>

      {/* Witness Statements Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Witness Statements
        </h4>
        <textarea
          className="mdt-input w-full h-24 resize-none"
          placeholder="Include any witness statements (optional)..."
          value={data.witnessStatements}
          onChange={(e) =>
            onChange({
              ...data,
              witnessStatements: e.target.value,
            })
          }
        />
      </div>

      {/* Disposition Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">Disposition</h4>
        <div className="space-y-3">
          {[
            "Report taken",
            "Arrest made",
            "Citation issued",
            "Cleared by contact",
            "Other",
          ].map((disposition) => (
            <label
              key={disposition}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="w-4 h-4 text-primary-600 bg-mdt-bg border-mdt-border rounded focus:ring-primary-500 focus:ring-2"
                checked={data.disposition.includes(disposition)}
                onChange={(e) =>
                  handleDispositionChange(disposition, e.target.checked)
                }
              />
              <span className="text-sm text-white">{disposition}</span>
            </label>
          ))}

          {data.disposition.includes("Other") && (
            <div className="ml-7">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Specify other disposition..."
                value={data.otherDisposition}
                onChange={(e) =>
                  onChange({
                    ...data,
                    otherDisposition: e.target.value,
                  })
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentReportForm;
