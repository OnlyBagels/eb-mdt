import React, { useEffect, useState } from "react";
import { classNames } from "../../utils/misc";
import { fetchNui } from "../../utils/fetchNui";

interface CitationFormData {
  violatorName: string;
  violatorDOB: string;
  violatorAddress: string;
  violatorPhone: string;
  violatorCitizenId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  vehiclePlate: string;
  vehicleState: string;
  officerObservations: string;
  correctiveAction: string;
  fineAmount: number;
  courtDate: string;
}

interface CitationReportFormProps {
  data: CitationFormData;
  onChange: (data: CitationFormData) => void;
  onSearchViolator: () => void;
  totalFine?: number;
}

const CitationReportForm: React.FC<CitationReportFormProps> = ({
  data,
  onChange,
  onSearchViolator,
  totalFine = 0,
}) => {
  const [searchingPlate, setSearchingPlate] = useState(false);
  const [plateSearchTimer, setPlateSearchTimer] =
    useState<NodeJS.Timeout | null>(null);

  // Auto-update fine amount when totalFine changes
  useEffect(() => {
    onChange({
      ...data,
      fineAmount: Math.min(totalFine, 100000), // Cap at $100,000
    });
  }, [totalFine]);

  // Auto-search vehicle by plate
  const handlePlateChange = (plate: string) => {
    onChange({
      ...data,
      vehiclePlate: plate,
    });

    // Clear existing timer
    if (plateSearchTimer) {
      clearTimeout(plateSearchTimer);
    }

    // Only search if plate is at least 3 characters
    if (plate.length >= 3) {
      setSearchingPlate(true);

      // Debounce the search
      const timer = setTimeout(async () => {
        try {
          const vehicles = await fetchNui<any[]>("searchVehicles", {
            query: plate,
          });

          if (vehicles && vehicles.length > 0) {
            // Find exact match first, otherwise use first result
            const vehicle =
              vehicles.find(
                (v: any) => v.plate.toLowerCase() === plate.toLowerCase()
              ) || vehicles[0];

            // Parse the vehicle model to extract make if possible
            const modelParts = vehicle.model.split(" ");
            const make = modelParts.length > 1 ? modelParts[0] : "";
            const model =
              modelParts.length > 1
                ? modelParts.slice(1).join(" ")
                : vehicle.model;

            onChange({
              ...data,
              vehiclePlate: plate,
              vehicleMake: make,
              vehicleModel: model,
              vehicleYear: "", // Year might not be available in the data
              vehicleColor: "", // Color might not be available in the data
              vehicleState: "San Andreas", // Default state
            });

            // Also update violator info if available
            if (vehicle.owner && !data.violatorName) {
              onChange({
                ...data,
                vehiclePlate: plate,
                vehicleMake: make,
                vehicleModel: model,
                vehicleYear: "",
                vehicleColor: "",
                vehicleState: "San Andreas",
                violatorName: vehicle.owner,
                violatorCitizenId: vehicle.citizenid,
              });
            }
          }
        } catch (error) {
          console.error("Error searching vehicle by plate:", error);
        } finally {
          setSearchingPlate(false);
        }
      }, 500); // 500ms debounce

      setPlateSearchTimer(timer);
    } else {
      setSearchingPlate(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (plateSearchTimer) {
        clearTimeout(plateSearchTimer);
      }
    };
  }, [plateSearchTimer]);

  const handleClearViolator = () => {
    onChange({
      ...data,
      violatorName: "",
      violatorDOB: "",
      violatorAddress: "",
      violatorPhone: "",
      violatorCitizenId: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Violator Information Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium mb-3 text-white">
            Violator Information
          </h4>
          <button
            className="mdt-button mdt-button-primary text-xs py-1 px-3 flex items-center gap-2"
            onClick={onSearchViolator}
          >
            <i className="fas fa-search"></i>
            Search Citizen
          </button>
        </div>

        {data.violatorName && (
          <div className="p-3 bg-mdt-bg rounded border border-mdt-border mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">
                  {data.violatorName}
                </div>
                <div className="flex items-center gap-4 text-xs text-primary-200 mt-1">
                  <span>DOB: {data.violatorDOB || "Unknown"}</span>
                  <span>Phone: {data.violatorPhone || "Unknown"}</span>
                  <span>CID: {data.violatorCitizenId || "Unknown"}</span>
                </div>
              </div>
              <button
                className="w-6 h-6 text-red-400 hover:text-red-300 transition-colors"
                onClick={handleClearViolator}
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Full Name</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Search for citizen above or enter manually..."
                value={data.violatorName}
                onChange={(e) =>
                  onChange({
                    ...data,
                    violatorName: e.target.value,
                  })
                }
                required
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Date of Birth</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="MM/DD/YYYY"
                value={data.violatorDOB}
                onChange={(e) =>
                  onChange({
                    ...data,
                    violatorDOB: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Address</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Enter full address..."
                value={data.violatorAddress}
                onChange={(e) =>
                  onChange({
                    ...data,
                    violatorAddress: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Phone Number</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Enter phone number..."
                value={data.violatorPhone}
                onChange={(e) =>
                  onChange({
                    ...data,
                    violatorPhone: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-primary-200">Citizen ID</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full bg-mdt-bg opacity-50 cursor-not-allowed"
                placeholder="Citizen ID..."
                value={data.violatorCitizenId}
                onChange={(e) =>
                  onChange({
                    ...data,
                    violatorCitizenId: e.target.value,
                  })
                }
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Information Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Vehicle Information (if applicable)
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">License Plate</span>
            <div className="flex-1 ml-4 relative">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Enter plate number..."
                value={data.vehiclePlate}
                onChange={(e) => handlePlateChange(e.target.value)}
              />
              {searchingPlate && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Make</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Vehicle make..."
                value={data.vehicleMake}
                onChange={(e) =>
                  onChange({
                    ...data,
                    vehicleMake: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Model</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Vehicle model..."
                value={data.vehicleModel}
                onChange={(e) =>
                  onChange({
                    ...data,
                    vehicleModel: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Year</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Year..."
                value={data.vehicleYear}
                onChange={(e) =>
                  onChange({
                    ...data,
                    vehicleYear: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2 border-b border-mdt-border">
            <span className="text-sm text-primary-200">Color</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="Vehicle color..."
                value={data.vehicleColor}
                onChange={(e) =>
                  onChange({
                    ...data,
                    vehicleColor: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-primary-200">State</span>
            <div className="flex-1 ml-4">
              <input
                type="text"
                className="mdt-input w-full"
                placeholder="State..."
                value={data.vehicleState}
                onChange={(e) =>
                  onChange({
                    ...data,
                    vehicleState: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Officer Observations Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Officer Observations
        </h4>
        <textarea
          className="mdt-input w-full h-24 resize-none"
          placeholder="Describe the violation observed..."
          value={data.officerObservations}
          onChange={(e) =>
            onChange({
              ...data,
              officerObservations: e.target.value,
            })
          }
          required
        />
      </div>

      {/* Corrective Action Section */}
      <div className="bg-mdt-accent p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-4 text-white">
          Corrective Action
        </h4>
        <div className="space-y-3 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="correctiveAction"
              value="warning"
              className="w-4 h-4 text-primary-600 bg-mdt-bg border-mdt-border focus:ring-primary-500 focus:ring-2"
              checked={data.correctiveAction === "warning"}
              onChange={(e) =>
                onChange({
                  ...data,
                  correctiveAction: e.target.value,
                })
              }
            />
            <span className="text-sm text-white">Warning issued</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="correctiveAction"
              value="citation"
              className="w-4 h-4 text-primary-600 bg-mdt-bg border-mdt-border focus:ring-primary-500 focus:ring-2"
              checked={data.correctiveAction === "citation"}
              onChange={(e) =>
                onChange({
                  ...data,
                  correctiveAction: e.target.value,
                })
              }
            />
            <span className="text-sm text-white">Citation issued</span>
          </label>
        </div>

        <div className="flex justify-between py-2 border-b border-mdt-border">
          <span className="text-sm text-primary-200">Fine Amount</span>
          <div className="flex-1 ml-4 relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-200">
              $
            </span>
            <input
              type="text"
              className="mdt-input w-full pl-8 bg-mdt-bg opacity-50 cursor-not-allowed"
              value={data.fineAmount.toLocaleString()}
              disabled
            />
          </div>
        </div>
        <p className="text-xs text-primary-200 mt-2">
          Auto-calculated from charges (max $100,000)
        </p>
      </div>
    </div>
  );
};

export default CitationReportForm;
