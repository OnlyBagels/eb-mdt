// Report type definitions and utilities
export interface PlayerInfo {
  name: string;
  callsign: string;
  department: string;
  rank: string;
  jobName?: string;
  gradeLevel?: number;
}

export interface IncidentFormData {
  incidentType: string[];
  otherIncidentType: string;
  narrative: string;
  witnessStatements: string;
  disposition: string[];
  otherDisposition: string;
}

export interface OISFormData {
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

export interface CitationFormData {
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

export const generateIncidentContent = (
  data: IncidentFormData,
  location: string,
  playerInfo?: PlayerInfo
): string => {
  return `INCIDENT REPORT

Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
Location: ${location}

INCIDENT TYPE:
${data.incidentType.map((type) => `â€¢ ${type}`).join("\n")}
${data.otherIncidentType ? `â€¢ Other: ${data.otherIncidentType}` : ""}

NARRATIVE:
${data.narrative}

WITNESS STATEMENTS:
${data.witnessStatements || "None provided"}

DISPOSITION:
${data.disposition.map((disp) => `â€¢ ${disp}`).join("\n")}
${data.otherDisposition ? `â€¢ Other: ${data.otherDisposition}` : ""}

Officer: ${playerInfo?.name || ""}
Badge #: ${playerInfo?.callsign || ""}`;
};

export const generateOISContent = (
  data: OISFormData,
  location: string,
  playerInfo?: PlayerInfo
): string => {
  return `OFFICER INVOLVED SHOOTING REPORT

Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
Location: ${location}

INVOLVED OFFICER(S):
Name: ${playerInfo?.name || ""}
Badge #: ${playerInfo?.callsign || ""}
Department: ${playerInfo?.department || ""}
Duty Status: ${data.dutyStatus}
Uniform Status: ${data.uniformStatus}

THREAT ASSESSMENT:
${data.threatAssessment.map((threat) => `â€¢ ${threat}`).join("\n")}
${data.otherThreat ? `â€¢ Other: ${data.otherThreat}` : ""}

INJURIES:
Subject: ${data.subjectInjuries || "None"}
Officer: ${data.officerInjuries || "None"}
Bystanders: ${data.bystanderInjuries || "None"}

DETAILED NARRATIVE:
${data.detailedNarrative}

WITNESS OFFICERS:
${data.witnessOfficers}

EVIDENCE COLLECTED:
${data.evidenceCollected.map((evidence) => `â€¢ ${evidence}`).join("\n")}

NOTIFICATIONS MADE:
${data.notificationsMade
  .map((notification) => `â€¢ ${notification}`)
  .join("\n")}

INVESTIGATOR ASSIGNED:
Name: ${data.investigatorName}
Badge #: ${data.investigatorBadge}
Contact: ${data.investigatorContact}

Reporting Officer: ${playerInfo?.name || ""}
Badge #: ${playerInfo?.callsign || ""}`;
};

export const generateCitationContent = (
  data: CitationFormData,
  location: string,
  playerInfo?: PlayerInfo
): string => {
  return `CITATION

Citation #: ${Date.now().toString().slice(-6)}
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
Location: ${location}

VIOLATOR INFORMATION:
Name: ${data.violatorName}
DOB: ${data.violatorDOB}
Address: ${data.violatorAddress}
Phone: ${data.violatorPhone}
Citizen ID: ${data.violatorCitizenId}

VEHICLE INFORMATION:
Make: ${data.vehicleMake}
Model: ${data.vehicleModel}
Year: ${data.vehicleYear}
Color: ${data.vehicleColor}
License Plate: ${data.vehiclePlate}
State: ${data.vehicleState}

OFFICER OBSERVATIONS:
${data.officerObservations}

CORRECTIVE ACTION: ${data.correctiveAction}
Fine Amount: $${data.fineAmount}
${data.courtDate ? `Court Date: ${data.courtDate}` : ""}

Officer: ${playerInfo?.name || ""}
Badge #: ${playerInfo?.callsign || ""}
Department: ${playerInfo?.department || ""}`;
};
