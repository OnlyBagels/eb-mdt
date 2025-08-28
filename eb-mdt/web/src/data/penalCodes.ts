// src/data/penalCodes.ts
export interface PenalCodeStatute {
  id: number;
  title: string;
  class: "Felony" | "Misdemeanor" | "Infraction";
  months: number;
  fine: number;
  description: string;
}

export interface PenalCodeCategory {
  id: number;
  title: string;
  statutes: Record<number, PenalCodeStatute>;
}

export const penalCodeData: PenalCodeCategory[] = [
  {
    id: 0,
    title: "Offenses Against Persons",
    statutes: {
      1: {
        title: "Simple Assault",
        class: "Misdemeanor",
        id: 1001,
        months: 1,
        fine: 150,
        description:
          "A person who intentionally puts another in the reasonable belief of imminent physical harm or offensive contact is guilty under this code section.",
      },
      2: {
        title: "Assault",
        class: "Misdemeanor",
        id: 1002,
        months: 10,
        fine: 285,
        description:
          "A person who intentionally puts another in the reasonable belief of imminent serious physical harm or offensive contact is guilty under this code section.",
      },
      3: {
        title: "Aggravated Assault",
        class: "Felony",
        id: 1003,
        months: 15,
        fine: 325,
        description:
          "A person who uses intentional and unlawful force or violence to cause physical harm to another person is guilty under this code section.",
      },
      4: {
        title: "Assault with a Deadly Weapon",
        class: "Felony",
        id: 1004,
        months: 20,
        fine: 475,
        description:
          "A person who attempts to cause or threaten immediate harm to another while using a weapon, tool, or other dangerous item to communicate that threat is guilty under this code section.",
      },
      5: {
        title: "Battery",
        class: "Misdemeanor",
        id: 1005,
        months: 15,
        fine: 275,
        description:
          "A person who unlawfully applies force directly or indirectly upon another person or their personal belongings, causing bodily injury or offensive contact is guilty under this code section.",
      },
      6: {
        title: "Aggravated Battery",
        class: "Felony",
        id: 1006,
        months: 20,
        fine: 375,
        description:
          "A person who intentionally and unlawfully applies force directly or indirectly upon another person or their personal belongings, causing bodily injury or offensive contact is guilty under this code section.",
      },
      7: {
        title: "Involuntary Manslaughter",
        class: "Felony",
        id: 1007,
        months: 20,
        fine: 750,
        description:
          "A person who unintentionally kills another, with or without a quarrel or heat of passion is guilty under this code section. A person who, through a criminal accident or negligence, causes someones death is guilty under this code section.",
      },
      8: {
        title: "Vehicular Manslaughter",
        class: "Felony",
        id: 1008,
        months: 25,
        fine: 750,
        description:
          "A person who, while operating a vehicle, through a criminal accident or negligence, causes someones death is guilty under this code section.",
      },
      9: {
        title: "Attempted Murder of a Civilian",
        class: "Felony",
        id: 1009,
        months: 30,
        fine: 1500,
        description:
          "A person who takes a direct step towards killing another person and intended to kill that person is guilty under this code section.",
      },
      10: {
        title: "Second Degree Murder",
        class: "Felony",
        id: 1010,
        months: 40,
        fine: 1750,
        description:
          "A person who unlawfully kills another person either by intentional malice or reckless disregard that occurs in the spur of the moment is guilty under this code section.",
      },
      11: {
        title: "Accessory to Second Degree Murder",
        class: "Felony",
        id: 1011,
        months: 25,
        fine: 500,
        description:
          "A person who assists another person to commit murder of the second degree is guilty under this code section.",
      },
      12: {
        title: "First Degree Murder",
        class: "Felony",
        id: 1012,
        months: 50,
        fine: 2500,
        description:
          "A person who commits the intentional killing which is done in a way that is willful, deliberate and premeditated is guilty under this code section.",
      },
      13: {
        title: "Accessory to First Degree Murder",
        class: "Felony",
        id: 1013,
        months: 35,
        fine: 1500,
        description:
          "A person who assists another person to commit murder of the first degree is guilty under this code section.",
      },
      14: {
        title: "Murder of a Public Servant or Peace Officer",
        class: "Felony",
        id: 1014,
        months: 120,
        fine: 12000,
        description:
          "A person who commits the intentional killing of a public servant or peace officer, while in the execution of their duties, in a way that is willful, deliberate and premeditated is guilty under this code section.",
      },
      15: {
        title: "Attempted Murder of a Public Servant or Peace Officer",
        class: "Felony",
        id: 1015,
        months: 80,
        fine: 9500,
        description:
          "A person who attempts to unlawfully kill or cause great bodily harm to a public servant or peace officer, while in the execution of their duties, is guilty under this code section.",
      },
      16: {
        title: "Accessory to the Murder of a Public Servant or Peace Officer",
        class: "Felony",
        id: 1016,
        months: 50,
        fine: 5000,
        description:
          "A person who assists another person who attempts to unlawfully kill or cause great bodily harm to a public servant or peace officer, while in the execution of their duties, is guilty under this code section.",
      },
      17: {
        title: "Unlawful Imprisonment",
        class: "Misdemeanor",
        id: 1017,
        months: 1,
        fine: 300,
        description:
          "A person who intentionally restricts anothers freedom of movement without their consent is guilty under this code section",
      },
      18: {
        title: "Kidnapping",
        class: "Felony",
        id: 1018,
        months: 15,
        fine: 500,
        description:
          "A person who abducts or confines another individual against their will by force, threat, or deception, is guilty under this code section.",
      },
      19: {
        title: "Accessory to Kidnapping",
        class: "Misdemeanor",
        id: 1019,
        months: 7,
        fine: 150,
        description:
          "A person who, without directly committing the act of kidnapping, knowingly aids, assists, encourages, or facilitates the commission of the kidnapping by another person is guilty under this code section.",
      },
      20: {
        title: "Attempted Kidnapping",
        class: "Felony",
        id: 1020,
        months: 10,
        fine: 150,
        description:
          "A person who takes a direct step towards the kidnapping of another person is guilty under this code section.",
      },
      21: {
        title: "Hostage Taking",
        class: "Felony",
        id: 1021,
        months: 20,
        fine: 750,
        description:
          "A person who kidnaps someone in an attempt to gain the power to attain something, with threat of their life is guilty under this code section.",
      },
      22: {
        title: "Accessory to Hostage Taking",
        class: "Misdemeanor",
        id: 1022,
        months: 10,
        fine: 150,
        description:
          "A person who helps someone commit hostage taking is guilty under this code section.",
      },
      23: {
        title: "Unlawful Imprisonment of a Public Servant or Peace Officer",
        class: "Felony",
        id: 1023,
        months: 25,
        fine: 750,
        description:
          "A person who intentionally restricts a public servant or peace officers freedom of movement without their consent is guilty under this code section",
      },
      24: {
        title: "Criminal Threats",
        class: "Misdemeanor",
        id: 1024,
        months: 1,
        fine: 200,
        description:
          "A person who communicates to another that they will physically harm or kill such other, placing such other in a reasonable state of fear for their own safety is guilty under this code section.",
      },
      25: {
        title: "Reckless Endangerment",
        class: "Misdemeanor",
        id: 1025,
        months: 10,
        fine: 175,
        description:
          "A person who consciously disregards the potential risks or dangers of their actions which create a substantial serious risk of injury to another person is guilty under this code section.",
      },
      26: {
        title: "Gang Related Enhancement",
        class: "Felony",
        id: 1026,
        months: 10,
        fine: 500,
        description:
          "This charge is added to another charge, when the individual's actions are connected to or motivated by gang activity, which the individual is associated with.",
      },
      27: {
        title: "Desecration of a Human Corpse",
        class: "Felony",
        id: 1027,
        months: 30,
        fine: 1000,
        description:
          "Any act committed after the death of a human being including, but not limited to, dismemberment, disfigurement, mutilation, burning, or any act committed to cause the dead body to be devoured, scattered or dissipated",
      },
      28: {
        title: "Torture",
        class: "Felony",
        id: 1028,
        months: 20,
        fine: 1500,
        description:
          "A person who intentionally causes extreme pain and suffering to someone for reasons such as punishment, extracting a confession, interrogation, revenge, extortion, or any sadistic purpose, is guilty under this code section.",
      },
    },
  },
  {
    id: 1,
    title: "Offenses Involving Theft",
    statutes: {
      1: {
        title: "Petty Theft",
        class: "Infraction",
        id: 2001,
        months: 0,
        fine: 400,
        description:
          "A person who steals or takes the personal property of another worth $2000 or less is guilty under this code section.",
      },
      2: {
        title: "Grand Theft",
        class: "Misdemeanor",
        id: 2002,
        months: 10,
        fine: 850,
        description:
          "A person who steals or takes the personal property of another worth more than $2,000 but less than $15,000 or a firearm of any value is guilty under this code section.",
      },
      3: {
        title: "Grand Theft Auto A",
        class: "Felony",
        id: 2003,
        months: 10,
        fine: 120,
        description:
          "A person who commits the theft of any motor vehicle, no matter the value is guilty under this code section.",
      },
      4: {
        title: "Grand Theft Auto B",
        class: "Felony",
        id: 2004,
        months: 15,
        fine: 400,
        description:
          "A person who commits the theft of any motor vehicle, no matter the value, while armed or committing another felony, is guilty under this code section.",
      },
      5: {
        title: "Carjacking",
        class: "Felony",
        id: 2005,
        months: 20,
        fine: 400,
        description:
          "A person who commits the theft of a motor vehicle from another person while it is being operated is guilty under this code section",
      },
      6: {
        title: "Burglary",
        class: "Misdemeanor",
        id: 2006,
        months: 10,
        fine: 500,
        description:
          "A person who enters a structure without the permission of the owner or agent of the owner, typically with the intention of committing a criminal offense, is guilty under this code section.",
      },
      7: {
        title: "Robbery",
        class: "Felony",
        id: 2007,
        months: 25,
        fine: 1000,
        description:
          "A person who takes property from the possession of another against their will, by means of force or fear, such as through criminal threats, blunt weapons, assault or battery is guilty under this code section.",
      },
      8: {
        title: "Accessory to Robbery",
        class: "Felony",
        id: 2008,
        months: 12,
        fine: 200,
        description:
          "A Person who assists someone with comitting Robbery is guilty under this code section.",
      },
      9: {
        title: "Attempted Robbery",
        class: "Felony",
        id: 2009,
        months: 15,
        fine: 300,
        description:
          "A person who attempts to take property from the possession of another against their will, by means of force or fear, such as through criminal threats, blunt weapons, assault or battery is guilty under this code section.",
      },
      10: {
        title: "Armed Robbery",
        class: "Felony",
        id: 2010,
        months: 25,
        fine: 1500,
        description:
          "A person who takes property from the possession of another against their will, by means of force facilitated with a gun or any bladed weapon is guilty under this code section.",
      },
      11: {
        title: "Accessory to Armed Robbery",
        class: "Felony",
        id: 2011,
        months: 12,
        fine: 300,
        description:
          "A person who helps someone to take property from the possession of another against their will, by means of force facilitated with a gun or any bladed weapon is guilty under this code section.",
      },
      12: {
        title: "Attempted Armed Robbery",
        class: "Felony",
        id: 2012,
        months: 25,
        fine: 300,
        description:
          "A person who attempts to take property from the possession of another against their will, by means of force facilitated with a gun or any bladed weapon is guilty under this code section.",
      },
      13: {
        title: "Grand Larceny",
        class: "Felony",
        id: 2013,
        months: 30,
        fine: 1000,
        description:
          "A person who steals or takes the personal property of another worth more than $15000 is guilty under this code section.",
      },
      14: {
        title: "Leaving Without Paying",
        class: "Infraction",
        id: 2014,
        months: 0,
        fine: 300,
        description:
          "A person who leaves a billed premises without paying the total amount of their bill is guilty under this code section.",
      },
      15: {
        title: "Possession of Nonlegal Currency",
        class: "Misdemeanor",
        id: 2015,
        months: 10,
        fine: 750,
        description:
          "A person who is in possession of, or attempts to use a fraudulent currency in the attempt to pass it off as legal tender is guilty under this code section. The fraudulent currency is subject to confiscation.",
      },
      16: {
        title: "Possession of Government-Issued Items",
        class: "Misdemeanor",
        id: 2016,
        months: 20,
        fine: 1000,
        description:
          "A person who is unlawfully in possession of a goverment issued firearm, vehicle, or other item is guilty under this code section.",
      },
      17: {
        title: "Possession of Items Used in the Commission of a Crime",
        class: "Misdemeanor",
        id: 2017,
        months: 10,
        fine: 500,
        description:
          "A person in possession of tools used by that person to commit another crime, such as a firearm or burglary tools, is guilty under this code section.",
      },
      18: {
        title: "Sale of Items Used in the Commission of a Crime",
        class: "Misdemeanor",
        id: 2018,
        months: 15,
        fine: 100,
        description:
          "A person who is in possession of, or attempts to use a fraudulent currency in the attempt to pass it off as legal tender is guilty under this code section. The fraudulent currency is subject to confiscation.",
      },
      19: {
        title: "Theft of an Aircraft",
        class: "Felony",
        id: 2019,
        months: 40,
        fine: 5000,
        description:
          "A person who commits the theft of an aircraft is guilty under this code section.",
      },
      20: {
        title: "Criminal Possession of Stolen Property",
        class: "Misdemeanor",
        id: 2020,
        months: 10,
        fine: 200,
        description:
          "A person who has possession of stolen items, with knowledge that the item is stolen, is guilty under this code section.",
      },
      21: {
        title: "Theft of a Law Enforcement Vehicle",
        class: "Felony",
        id: 2021,
        months: 60,
        fine: 10000,
        description:
          "A person who commits the theft of any motor vehicle owned by a law enforcement agency is guilty under this code section.",
      },
    },
  },
  // Continue with more categories as needed...
];

// Helper function to get all statutes as a flat array for searching
export const getAllStatutes = (): PenalCodeStatute[] => {
  const allStatutes: PenalCodeStatute[] = [];
  penalCodeData.forEach((category) => {
    Object.values(category.statutes).forEach((statute) => {
      allStatutes.push(statute);
    });
  });
  return allStatutes;
};

// Helper function to find statute by ID
export const findStatuteById = (id: number): PenalCodeStatute | undefined => {
  for (const category of penalCodeData) {
    for (const statute of Object.values(category.statutes)) {
      if (statute.id === id) {
        return statute;
      }
    }
  }
  return undefined;
};

// Helper function to search statutes
export const searchStatutes = (query: string): PenalCodeStatute[] => {
  if (!query.trim()) return [];

  const searchTerm = query.toLowerCase();
  const results: PenalCodeStatute[] = [];

  penalCodeData.forEach((category) => {
    Object.values(category.statutes).forEach((statute) => {
      if (
        statute.title.toLowerCase().includes(searchTerm) ||
        statute.description.toLowerCase().includes(searchTerm) ||
        statute.id.toString().includes(searchTerm)
      ) {
        results.push(statute);
      }
    });
  });

  return results;
};
