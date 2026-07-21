export type LegislativeTopic = {
  name: string;
  number: string | null;
};

export type TopicCategory = {
  category: string;
  emoji: string;
  topics: LegislativeTopic[];
};

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    category: "Cruelty & Enforcement",
    emoji: "⚖️",
    topics: [
      { name: "Animal Enterprise Terrorism Act (AETA)", number: "P.L. 109-374" },
      { name: "Animal Fighting Prohibition Enforcement Act", number: "P.L. 110-22" },
      { name: "Animal Crush Video Prohibition Act", number: "P.L. 111-294" },
      { name: "Preventing Animal Cruelty and Torture (PACT) Act", number: "P.L. 116-72" },
      { name: "Animal Cruelty Enforcement (ACE) Act of 2025", number: "H.R.1477" },
      { name: "Better CARE for Animals Act of 2025", number: "H.R.3112 / S.1538" },
    ],
  },
  {
    category: "Farmed Animals & Food System",
    emoji: "🐄",
    topics: [
      { name: "Save Our Bacon Act", number: "H.R.4673" },
      { name: "Farm Bill of 2026", number: "H.R.7567" },
      { name: "Food Security and Farm Protection Act", number: "S.1326" },
      { name: "EATS Act (Ending Agricultural Trade Suppression)", number: null },
      { name: "Egg Products Inspection Act Amendments", number: null },
      { name: "Farm System Reform Act", number: null },
      { name: "Industrial Agriculture Accountability Act", number: null },
      { name: "Opportunities for Fairness in Farming (OFF) Act", number: null },
      { name: "PRIME Act", number: null },
      { name: "National Bioengineered Food Disclosure Standard", number: "P.L. 114-216" },
      { name: "FDA Food Safety Modernization Act (FSMA)", number: "P.L. 111-353" },
      { name: "One Big Beautiful Bill Act", number: "P.L. 119-21" },
      { name: "Cultivated-meat labeling/procurement ban bills", number: null },
    ],
  },
  {
    category: "Companion Animals",
    emoji: "🐕",
    topics: [
      { name: "Pets Evacuation and Transportation Standards (PETS) Act", number: "P.L. 109-308" },
      { name: "Pet and Women Safety (PAWS) Act", number: "P.L. 115-334" },
      { name: "Dog and Cat Meat Trade Prohibition Act", number: "P.L. 115-334" },
      { name: "Goldie's Act", number: "H.R.349" },
      { name: "Puppy Protection Act of 2025", number: "H.R.2253" },
      { name: "BARK Act (pet-food donation)", number: "H.R.3732 / S.1939" },
      { name: "Child and Animal Abuse Detection and Reporting Act", number: "H.R.712" },
      { name: "Healthy Dog Importation Act", number: null },
      { name: "WOOF Act", number: null },
    ],
  },
  {
    category: "Equines",
    emoji: "🐎",
    topics: [
      { name: "Horseracing Integrity and Safety Act (HISA)", number: "P.L. 116-260" },
      { name: "Horse Transportation Safety Act", number: "P.L. 117-58" },
      { name: "Prevent All Soring Tactics (PAST) Act", number: null },
      { name: "Safeguard American Food Exports (SAFE) Act", number: null },
      { name: "Ejiao Act (donkey-skin trade ban)", number: null },
    ],
  },
  {
    category: "Wildlife, ESA & Captivity",
    emoji: "🦅",
    topics: [
      { name: "Endangered Species Act (ESA) Amendments Act of 2025", number: "H.R.1897" },
      { name: "Trust the Science Act (wolf delisting)", number: null },
      { name: "Recovering America's Wildlife Act (RAWA)", number: null },
      { name: "Big Cat Public Safety Act", number: "P.L. 117-243" },
      { name: "Captive Primate Safety Act of 2025", number: "H.R.3199 / S.1594" },
      { name: "Don't Feed the Bears Act of 2025", number: "H.R.4422" },
      { name: "END Wildlife Trafficking Act", number: "P.L. 114-231" },
      { name: "Traveling Exotic Animal and Public Safety Protection Act (TEAPSPA)", number: null },
      { name: "CECIL Act / ProTECT Act (trophy imports)", number: null },
      { name: "Migratory Bird Protection Act", number: null },
      { name: "Refuge from Cruel Trapping Act", number: null },
      { name: "M-44 / Canyon's Law", number: null },
      { name: "Greyhound Protection Act", number: null },
      { name: "SWIMS Act (cetacean captivity)", number: null },
      { name: "AQUAA Act (offshore aquaculture)", number: null },
    ],
  },
  {
    category: "Marine Mammals & Fisheries",
    emoji: "🐋",
    topics: [
      { name: "Magnuson-Stevens Fishery Conservation and Management Reauthorization Act", number: "P.L. 109-479" },
      { name: "Shark Conservation Act", number: "P.L. 111-348" },
      { name: "Shark Fin Sales Elimination Act", number: "P.L. 117-263" },
      { name: "Driftnet Modernization and Bycatch Reduction Act", number: "P.L. 117-263" },
      { name: "North Atlantic right whale regulatory pause", number: "P.L. 117-328" },
      { name: "OCTOPUS Act of 2025", number: "S.1947" },
    ],
  },
  {
    category: "Animals in Research & Testing",
    emoji: "🧪",
    topics: [
      { name: "FDA Modernization Act 2.0", number: "P.L. 117-328" },
      { name: "FDA Modernization Act 3.0", number: null },
      { name: "Frank R. Lautenberg Chemical Safety for the 21st Century Act (TSCA)", number: "P.L. 114-182" },
      { name: "CARGO Act of 2025 (overseas animal research)", number: "H.R.1085 / S.1802" },
      { name: "VA canine/feline/primate testing phase-out", number: "P.L. 116-260" },
      { name: "Humane Cosmetics Act", number: null },
      { name: "AFTER Act (lab-animal retirement)", number: null },
      { name: "Humane Research and Testing Act", number: null },
      { name: "Pet Safety and Protection Act (Class B dealers)", number: null },
    ],
  },
  {
    category: "Environmental / NEPA & Permitting",
    emoji: "🌎",
    topics: [
      { name: "Infrastructure Investment and Jobs Act (IIJA)", number: "P.L. 117-58" },
      { name: "Inflation Reduction Act (IRA)", number: "P.L. 117-169" },
      { name: "Fiscal Responsibility Act (NEPA amendments)", number: "P.L. 118-5" },
      { name: "SPEED Act", number: "H.R.4776" },
      { name: "Energy Permitting Reform Act", number: null },
    ],
  },
  {
    category: "Procedural & Administrative Law",
    emoji: "📋",
    topics: [
      { name: "OPEN Government Act", number: "P.L. 110-175" },
      { name: "FOIA Improvement Act", number: "P.L. 114-185" },
      { name: "Whistleblower Protection Enhancement Act", number: "P.L. 112-199" },
      { name: "FAA Reauthorization Act of 2024", number: "P.L. 118-63" },
      { name: "No Rogue Rulings Act (NORRA)", number: "H.R.1526" },
      { name: "REINS Act", number: null },
      { name: "Separation of Powers Restoration Act (SOPRA)", number: null },
      { name: "Regulatory Accountability Act", number: null },
      { name: "Scientific Integrity Act", number: null },
    ],
  },
];
