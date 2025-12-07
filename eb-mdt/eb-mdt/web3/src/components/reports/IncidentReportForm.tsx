import React, { useState } from "react";
import { classNames } from "../../utils/misc";
import { fetchNui } from "../../utils/fetchNui";
import ChargeSelector from "./ChargeSelector";

interface InvolvedPerson {
  citizenid: string;
  name: string;
  role: string;
  notes: string;
  charges: Charge[];
  fineReduction: number; // Percentage reduction (0-100)
}

interface Charge {
  code: string;
  title: string;
  class: "Felony" | "Misdemeanor" | "Infraction";
  fine: number;
  months: number;
  guiltyPlea: boolean;
}

interface IncidentFormData {
  incidentType: string[];
  otherIncidentType: string;
  narrative: string;
  witnessStatements: string;
  disposition: string[];
  otherDisposition: string;
  involved: InvolvedPerson[];
}

interface IncidentReportFormProps {
  data: IncidentFormData;
  onChange: (data: IncidentFormData) => void;
}

interface CitizenSearchResult {
  citizenid: string;
  name: string;
  phone: string;
}

const INVOLVEMENT_ROLES = [
  {
    value: "suspect",
    label: "Suspect",
    icon: "fa-user-secret",
    color: "text-red-400",
  },
  {
    value: "victim",
    label: "Victim",
    icon: "fa-user-injured",
    color: "text-blue-400",
  },
  {
    value: "witness",
    label: "Witness",
    icon: "fa-eye",
    color: "text-yellow-400",
  },
  {
    value: "reporting_party",
    label: "Reporting Party",
    icon: "fa-user-check",
    color: "text-green-400",
  },
  { value: "other", label: "Other", icon: "fa-user", color: "text-gray-400" },
];

const IncidentReportForm: React.FC<IncidentReportFormProps> = ({
  data,
  onChange,
}) => {
  // Modal states
  const [citizenSearchModalOpen, setCitizenSearchModalOpen] = useState(false);
  const [citizenRoleModalOpen, setCitizenRoleModalOpen] = useState(false);
  const [chargeSelectorOpen, setChargeSelectorOpen] = useState(false);
  const [selectedPersonIndex, setSelectedPersonIndex] = useState<number | null>(
    null
  );
  const [addingRole, setAddingRole] = useState<string>("");

  // Search states
  const [citizenSearchQuery, setCitizenSearchQuery] = useState("");
  const [citizenSearchResults, setCitizenSearchResults] = useState<
    CitizenSearchResult[]
  >([]);
  const [citizenSearchLoading, setCitizenSearchLoading] = useState(false);

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

  // Citizen search functionality
  const searchCitizens = async () => {
    if (!citizenSearchQuery.trim()) return;

    setCitizenSearchLoading(true);
    try {
      const results = await fetchNui<CitizenSearchResult[]>(
        "searchCitizensForReport",
        { query: citizenSearchQuery }
      );
      setCitizenSearchResults(results || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setCitizenSearchLoading(false);
    }
  };

  const openRoleSelection = () => {
    setCitizenRoleModalOpen(true);
  };

  const selectRole = (role: string) => {
    setAddingRole(role);
    setCitizenRoleModalOpen(false);
    setCitizenSearchModalOpen(true);
  };

  const addInvolvedPerson = (citizen: CitizenSearchResult) => {
    const newPerson: InvolvedPerson = {
      citizenid: citizen.citizenid,
      name: citizen.name,
      role: addingRole,
      notes: "",
      charges: [],
      fineReduction: 0, // Default 0% reduction
    };

    onChange({
      ...data,
      involved: [...data.involved, newPerson],
    });

    setCitizenSearchModalOpen(false);
    setCitizenSearchQuery("");
    setCitizenSearchResults([]);
    setAddingRole("");
  };

  const removeInvolvedPerson = (index: number) => {
    onChange({
      ...data,
      involved: data.involved.filter((_, i) => i !== index),
    });
  };

  const updateInvolvedPersonNotes = (index: number, notes: string) => {
    const updatedInvolved = [...data.involved];
    updatedInvolved[index] = { ...updatedInvolved[index], notes };
    onChange({ ...data, involved: updatedInvolved });
  };

  const updateInvolvedPersonRole = (index: number, role: string) => {
    const updatedInvolved = [...data.involved];
    updatedInvolved[index] = { ...updatedInvolved[index], role };
    onChange({ ...data, involved: updatedInvolved });
  };

  const updateFineReduction = (index: number, reduction: number) => {
    // Clamp between 0 and 100
    const clampedReduction = Math.max(0, Math.min(100, reduction));
    const updatedInvolved = [...data.involved];
    updatedInvolved[index] = {
      ...updatedInvolved[index],
      fineReduction: clampedReduction,
    };
    onChange({ ...data, involved: updatedInvolved });
  };

  // Charge management
  const openAddCharge = (personIndex: number) => {
    setSelectedPersonIndex(personIndex);
    setChargeSelectorOpen(true);
  };

  const addChargeToPerson = (charge: {
    code: string;
    title: string;
    class: "Felony" | "Misdemeanor" | "Infraction";
    fine: number;
    months: number;
  }) => {
    if (selectedPersonIndex === null) return;

    const updatedInvolved = [...data.involved];
    const newCharge: Charge = {
      code: charge.code,
      title: charge.title,
      class: charge.class,
      fine: charge.fine,
      months: charge.months,
      guiltyPlea: false,
    };

    updatedInvolved[selectedPersonIndex] = {
      ...updatedInvolved[selectedPersonIndex],
      charges: [...updatedInvolved[selectedPersonIndex].charges, newCharge],
    };

    onChange({ ...data, involved: updatedInvolved });
  };

  const removeChargeFromPerson = (personIndex: number, chargeIndex: number) => {
    const updatedInvolved = [...data.involved];
    updatedInvolved[personIndex] = {
      ...updatedInvolved[personIndex],
      charges: updatedInvolved[personIndex].charges.filter(
        (_, i) => i !== chargeIndex
      ),
    };
    onChange({ ...data, involved: updatedInvolved });
  };

  const toggleGuiltyPlea = (personIndex: number, chargeIndex: number) => {
    const updatedInvolved = [...data.involved];
    const charges = [...updatedInvolved[personIndex].charges];
    charges[chargeIndex] = {
      ...charges[chargeIndex],
      guiltyPlea: !charges[chargeIndex].guiltyPlea,
    };
    updatedInvolved[personIndex] = {
      ...updatedInvolved[personIndex],
      charges,
    };
    onChange({ ...data, involved: updatedInvolved });
  };

  const getChargeColor = (chargeClass: string) => {
    switch (chargeClass) {
      case "Felony":
        return "bg-red-500";
      case "Misdemeanor":
        return "bg-orange-500";
      case "Infraction":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getRoleInfo = (role: string) => {
    return (
      INVOLVEMENT_ROLES.find((r) => r.value === role) || INVOLVEMENT_ROLES[4]
    );
  };

  const getTotalChargesForPerson = (person: InvolvedPerson) => {
    return person.charges.length;
  };

  const getTotalFineForPerson = (person: InvolvedPerson) => {
    const baseFine = person.charges.reduce(
      (sum, charge) => sum + charge.fine,
      0
    );
    const reduction = (baseFine * person.fineReduction) / 100;
    return baseFine - reduction;
  };

  const getOriginalFineForPerson = (person: InvolvedPerson) => {
    return person.charges.reduce((sum, charge) => sum + charge.fine, 0);
  };

  const getTotalMonthsForPerson = (person: InvolvedPerson) => {
    return person.charges.reduce((sum, charge) => sum + charge.months, 0);
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

      {/* Involved Parties Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white">
            Involved Parties ({data.involved.length})
          </h4>
          <button
            className="mdt-button mdt-button-primary text-xs py-1 px-3 flex items-center gap-2"
            onClick={openRoleSelection}
          >
            <i className="fas fa-plus"></i>
            Add Person
          </button>
        </div>

        {data.involved.length === 0 ? (
          <div className="text-center py-8 text-primary-200 text-sm">
            <i className="fas fa-users text-3xl mb-2 opacity-50"></i>
            <p>No involved parties added yet</p>
            <p className="text-xs mt-1">
              Click "Add Person" to add involved parties
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.involved.map((person, personIndex) => {
              const roleInfo = getRoleInfo(person.role);
              const totalCharges = getTotalChargesForPerson(person);
              const originalFine = getOriginalFineForPerson(person);
              const finalFine = getTotalFineForPerson(person);
              const totalMonths = getTotalMonthsForPerson(person);

              return (
                <div
                  key={personIndex}
                  className="bg-mdt-bg rounded-lg border border-mdt-border overflow-hidden"
                >
                  {/* Person Header */}
                  <div className="p-3 bg-mdt-accent border-b border-mdt-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <i
                          className={classNames(
                            "fas",
                            roleInfo.icon,
                            roleInfo.color
                          )}
                        ></i>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              {person.name}
                            </span>
                            <span className="text-xs text-primary-200">
                              ({person.citizenid})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <select
                              className="mdt-input text-xs py-0.5 px-2 bg-mdt-bg"
                              value={person.role}
                              onChange={(e) =>
                                updateInvolvedPersonRole(
                                  personIndex,
                                  e.target.value
                                )
                              }
                            >
                              {INVOLVEMENT_ROLES.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                            {totalCharges > 0 && (
                              <>
                                <span className="badge badge-outline text-xs">
                                  {totalCharges} charge
                                  {totalCharges !== 1 ? "s" : ""}
                                </span>
                                <span
                                  className={classNames(
                                    "badge text-white text-xs",
                                    person.fineReduction > 0
                                      ? "bg-blue-500"
                                      : "bg-green-500"
                                  )}
                                >
                                  ${finalFine.toLocaleString()}
                                  {person.fineReduction > 0 && (
                                    <span className="ml-1 text-xs">
                                      ({person.fineReduction}% off)
                                    </span>
                                  )}
                                </span>
                                {person.fineReduction > 0 && (
                                  <span className="text-xs text-primary-200 line-through">
                                    ${originalFine.toLocaleString()}
                                  </span>
                                )}
                                {totalMonths > 0 && (
                                  <span className="badge badge-outline text-xs">
                                    {totalMonths} months
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs transition-colors"
                          onClick={() => openAddCharge(personIndex)}
                          title="Add Charge"
                        >
                          <i className="fas fa-gavel"></i>
                        </button>
                        <button
                          className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded text-white text-xs transition-colors"
                          onClick={() => removeInvolvedPerson(personIndex)}
                          title="Remove Person"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    {/* Fine Reduction Section - Only show if person has charges */}
                    {totalCharges > 0 && (
                      <div className="mt-3 pt-3 border-t border-mdt-border">
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-primary-200 whitespace-nowrap">
                            Fine Reduction:
                          </label>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={person.fineReduction}
                              onChange={(e) =>
                                updateFineReduction(
                                  personIndex,
                                  parseInt(e.target.value)
                                )
                              }
                              className="flex-1 h-2 bg-mdt-bg rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={person.fineReduction}
                              onChange={(e) =>
                                updateFineReduction(
                                  personIndex,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="mdt-input text-xs py-1 px-2 w-16 text-center"
                            />
                            <span className="text-xs text-white">%</span>
                          </div>
                        </div>
                        {person.fineReduction > 0 && (
                          <div className="text-xs text-primary-200 mt-1">
                            Savings: $
                            {(originalFine - finalFine).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Person Charges */}
                  {person.charges.length > 0 && (
                    <div className="p-3 space-y-2">
                      {person.charges.map((charge, chargeIndex) => (
                        <div
                          key={chargeIndex}
                          className="p-3 bg-mdt-accent rounded border border-mdt-border"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <i className="fas fa-gavel text-xs text-primary-200"></i>
                                <span className="text-xs font-medium text-white">
                                  §{charge.code} - {charge.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={classNames(
                                    "badge text-white text-xs",
                                    getChargeColor(charge.class)
                                  )}
                                >
                                  {charge.class}
                                </span>
                                {charge.months > 0 && (
                                  <span className="badge badge-outline text-xs">
                                    {charge.months} months
                                  </span>
                                )}
                                <span className="badge bg-green-500 text-white text-xs">
                                  ${charge.fine.toLocaleString()}
                                </span>
                                <button
                                  className={classNames(
                                    "badge text-xs cursor-pointer transition-colors",
                                    charge.guiltyPlea
                                      ? "bg-green-500 text-white"
                                      : "badge-outline"
                                  )}
                                  onClick={() =>
                                    toggleGuiltyPlea(personIndex, chargeIndex)
                                  }
                                >
                                  {charge.guiltyPlea ? "✓ " : ""}Guilty Plea
                                </button>
                              </div>
                            </div>
                            <button
                              className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded text-white text-xs transition-colors ml-3"
                              onClick={() =>
                                removeChargeFromPerson(personIndex, chargeIndex)
                              }
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Person Notes */}
                  <div className="p-3 border-t border-mdt-border">
                    <textarea
                      className="mdt-input w-full h-16 resize-none text-xs"
                      placeholder="Additional notes about this person's involvement..."
                      value={person.notes}
                      onChange={(e) =>
                        updateInvolvedPersonNotes(personIndex, e.target.value)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* Role Selection Modal */}
      {citizenRoleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-mdt-card rounded-lg border border-mdt-border w-full max-w-sm mx-4">
            <div className="p-4 border-b border-mdt-border">
              <h2 className="text-lg font-semibold text-white">Select Role</h2>
            </div>

            <div className="p-4 space-y-2">
              {INVOLVEMENT_ROLES.map((role) => (
                <div
                  key={role.value}
                  className="p-3 bg-mdt-accent rounded-lg cursor-pointer transition-all duration-150 hover:bg-mdt-border border border-mdt-border hover:border-primary-600"
                  onClick={() => selectRole(role.value)}
                >
                  <div className="flex items-center gap-3">
                    <i className={classNames("fas", role.icon, role.color)}></i>
                    <span className="text-white">{role.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-mdt-border flex justify-end">
              <button
                className="mdt-button mdt-button-secondary"
                onClick={() => setCitizenRoleModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Search Modal */}
      {citizenSearchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-mdt-card rounded-lg border border-mdt-border w-full max-w-lg mx-4">
            <div className="p-4 border-b border-mdt-border">
              <h2 className="text-lg font-semibold text-white">
                Search Citizen
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-200"></i>
                <input
                  type="text"
                  className="mdt-input pl-10 w-full"
                  placeholder="Search by name or citizen ID..."
                  value={citizenSearchQuery}
                  onChange={(e) => setCitizenSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && searchCitizens()}
                />
              </div>

              <button
                className="mdt-button mdt-button-primary w-full"
                onClick={searchCitizens}
                disabled={citizenSearchLoading}
              >
                {citizenSearchLoading ? (
                  <div className="flex items-center gap-2 justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Searching...
                  </div>
                ) : (
                  "Search"
                )}
              </button>

              {citizenSearchResults.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-auto custom-scrollbar">
                  {citizenSearchResults.map((citizen) => (
                    <div
                      key={citizen.citizenid}
                      className="p-3 bg-mdt-accent rounded-lg cursor-pointer transition-all duration-150 hover:bg-mdt-border border border-mdt-border hover:border-primary-600"
                      onClick={() => addInvolvedPerson(citizen)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-white font-medium">
                            {citizen.name}
                          </span>
                          <p className="text-xs text-primary-200 mt-1">
                            ID: {citizen.citizenid} • Phone: {citizen.phone}
                          </p>
                        </div>
                        <i className="fas fa-plus text-primary-400"></i>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-mdt-border flex justify-end">
              <button
                className="mdt-button mdt-button-secondary"
                onClick={() => {
                  setCitizenSearchModalOpen(false);
                  setCitizenSearchQuery("");
                  setCitizenSearchResults([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charge Selector */}
      <ChargeSelector
        isOpen={chargeSelectorOpen}
        onClose={() => {
          setChargeSelectorOpen(false);
          setSelectedPersonIndex(null);
        }}
        onSelectCharge={addChargeToPerson}
        selectedCitizenId={
          selectedPersonIndex !== null
            ? data.involved[selectedPersonIndex]?.citizenid
            : ""
        }
      />
    </div>
  );
};

export default IncidentReportForm;
