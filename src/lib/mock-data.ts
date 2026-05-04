export const student = {
  name: "Paul L.",
  university: "Columbia University",
  year: "Freshman",
  gpa: "3.47",
  fields: ["Physics", "Mathematics"],
  subfield: "Condensed Matter & Quantum Systems",
  coursework: [
    "Classical Mechanics",
    "Electromagnetism",
    "Linear Algebra",
    "Multivariable Calculus",
    "Quantum Mechanics I",
    "Statistical Physics",
  ],
  experience: "Research assistant in Columbia's Applied Math Lab (Spring 2025) — numerical simulation of fluid dynamics models. Co-authored a poster presentation at the SEAS undergraduate research symposium.",
  availability: "Summer 2025, starting mid-May",
  preference: "In-person or hybrid",
};

export interface Professor {
  id: string;
  name: string;
  university: string;
  department: string;
  description: string;
  email: string;
  fitScore: number;
  researchAreas: string[];
  selected?: boolean;
}

export const professors: Professor[] = [
  {
    id: "p1",
    name: "Prof. Dmitri Volkov",
    university: "Columbia University",
    department: "Physics",
    description: "Topological insulators and unconventional superconductivity in correlated electron systems.",
    email: "d.volkov@phys.columbia.edu",
    fitScore: 96,
    researchAreas: ["Topological Insulators", "Superconductivity", "Condensed Matter"],
    selected: true,
  },
  {
    id: "p2",
    name: "Prof. Sarah Chen",
    university: "Columbia University",
    department: "Applied Physics",
    description: "Variational quantum algorithms and error mitigation for near-term quantum devices.",
    email: "s.chen@apam.columbia.edu",
    fitScore: 94,
    researchAreas: ["Quantum Computing", "NISQ Algorithms", "Quantum Error Mitigation"],
    selected: true,
  },
  {
    id: "p3",
    name: "Prof. Lars Eriksson",
    university: "MIT",
    department: "Physics",
    description: "Exotic quantum phases in frustrated magnets and spin liquid candidates.",
    email: "l.eriksson@mit.edu",
    fitScore: 92,
    researchAreas: ["Quantum Materials", "Spin Liquids", "Frustrated Magnetism"],
    selected: true,
  },
  {
    id: "p4",
    name: "Prof. James Moretti",
    university: "Columbia University",
    department: "Astronomy",
    description: "Dark matter detection via gravitational lensing and galaxy cluster dynamics.",
    email: "j.moretti@astro.columbia.edu",
    fitScore: 89,
    researchAreas: ["Dark Matter", "Gravitational Lensing", "Cosmology"],
    selected: false,
  },
  {
    id: "p5",
    name: "Prof. Maya Okonkwo",
    university: "MIT",
    department: "Physics",
    description: "Topological quantum error correction and fault-tolerant quantum computation.",
    email: "m.okonkwo@mit.edu",
    fitScore: 88,
    researchAreas: ["Quantum Error Correction", "Topological Codes", "Quantum Information"],
    selected: false,
  },
  {
    id: "p6",
    name: "Prof. Anika Patel",
    university: "Columbia University",
    department: "Physics",
    description: "Searches for beyond-Standard-Model physics using LHC collision data.",
    email: "a.patel@phys.columbia.edu",
    fitScore: 86,
    researchAreas: ["Particle Physics", "LHC", "BSM Phenomenology"],
    selected: false,
  },
  {
    id: "p7",
    name: "Prof. Robert Zhang",
    university: "MIT",
    department: "Physics",
    description: "Neutrino mass hierarchies and oscillation experiments at deep underground labs.",
    email: "r.zhang@mit.edu",
    fitScore: 83,
    researchAreas: ["Neutrino Physics", "Particle Astrophysics", "Underground Experiments"],
    selected: false,
  },
  {
    id: "p8",
    name: "Prof. Isabel Torres",
    university: "MIT",
    department: "Physics",
    description: "First-principles DFT and machine-learning interatomic potentials for materials discovery.",
    email: "i.torres@mit.edu",
    fitScore: 78,
    researchAreas: ["Computational Physics", "DFT", "Materials Science"],
    selected: false,
  },
];

export interface DraftEmail {
  id: string;
  professor: Professor;
  subject: string;
  body: string;
}

export const draftEmails: DraftEmail[] = [
  {
    id: "e1",
    professor: professors[0],
    subject: "Undergraduate Research Inquiry — Topological Systems",
    body: `Dear Professor Volkov,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I came across your recent work on the interplay between topology and superconductivity in transition metal dichalcogenides — particularly the role of Berry curvature in driving unconventional pairing symmetries. I found your 2024 paper in Physical Review Letters genuinely compelling, and it's exactly the intersection of geometry and condensed matter that drew me to physics in the first place.

I'm writing to ask whether you have any openings for an undergraduate research assistant this summer (starting mid-May). I understand this is early and that your lab's focus demands real technical grounding, so I want to be upfront about where I am: I've completed Classical Mechanics, EM, and Quantum I, and I'm currently working through Griffiths on my own. I also spent last semester as an RA in Columbia's Applied Math Lab, running numerical simulations in Python, which I suspect translates reasonably well to the kind of tight-binding and Monte Carlo work your group does.

I'm in-person in New York all summer and am fully committed to showing up consistently. Even if a formal position isn't available, I'd genuinely value 20 minutes of your time to learn more about the lab's current direction.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028
paul.a.lacarriere@columbia.edu`,
  },
  {
    id: "e2",
    professor: professors[1],
    subject: "Summer Research — Variational Quantum Algorithms",
    body: `Dear Professor Chen,

I'm a freshman at Columbia (Physics and Math) writing to ask about undergraduate research opportunities in your group this summer. Your work on noise-aware variational quantum eigensolvers — and specifically your recent results showing that symmetry-preserving ansätze meaningfully outperform hardware-efficient circuits on NISQ devices — is the kind of problem I'd really like to contribute to, even at a supporting level.

My background: I've taken the core physics sequence through Quantum I, and I've been working through Nielsen & Chuang independently since January. I have some programming experience in Python (NumPy, SciPy, a bit of Qiskit), which I've used in a numerical methods context at Columbia's Applied Math Lab last semester.

I'm available in-person starting mid-May through August. I'm not expecting to run experiments on day one — I understand quantum computing research has a steep curve — but I'm serious about climbing it and would be glad to start with literature review, simulation work, or whatever would actually be useful to your group.

If you have capacity this summer, I'd be grateful for the chance to discuss it.

Thank you,

Paul Lacarrière
Columbia University, Class of 2028`,
  },
  {
    id: "e3",
    professor: professors[2],
    subject: "Inquiry: Undergraduate Research, Quantum Materials (Summer 2025)",
    body: `Dear Professor Eriksson,

I'm Paul, a first-year student at Columbia studying Physics and Mathematics. I'm reaching out because your group's work on quantum spin liquids — particularly the experimental signatures you've identified in candidate materials like α-RuCl₃ — sits squarely at the intersection of things I find most interesting about condensed matter: highly frustrated geometries, emergent gauge fields, and the challenge of distinguishing true spin liquid behavior from conventional ordered phases.

I'm writing to ask whether there might be room for an undergraduate researcher in your group this summer. I know MIT is a commute from New York, so I want to flag that I'm flexible — I could relocate to Cambridge for the summer if the opportunity warranted it. I've completed the standard first-year Physics sequence at Columbia, I'm comfortable with Python and numerical methods from prior lab work, and I'm a reliable, low-maintenance collaborator. My GPA is 3.47 if that's relevant to your considerations.

I recognize this is a long shot, and I don't want to oversell what I can contribute at this stage. But if your lab takes undergrads and you think there's a fit, I'd be glad to send materials or talk further.

Thank you for your time,

Paul Lacarrière
Columbia University, Class of 2028
paul.a.lacarriere@columbia.edu`,
  },
];

export type EmailStatus =
  | "Sent"
  | "Positive Reply"
  | "Negative Reply"
  | "No Response"
  | "Do Not Contact";

export interface SentEmail {
  id: string;
  professor: string;
  university: string;
  department: string;
  campaign: string;
  dateSent: string;
  status: EmailStatus;
}

export const sentEmails: SentEmail[] = [
  { id: "s1", professor: "Prof. Dmitri Volkov", university: "Columbia", department: "Physics", campaign: "Columbia Physics — Spring '25", dateSent: "Apr 12, 2025", status: "Positive Reply" },
  { id: "s2", professor: "Prof. Sarah Chen", university: "Columbia", department: "Applied Physics", campaign: "Columbia Physics — Spring '25", dateSent: "Apr 12, 2025", status: "No Response" },
  { id: "s3", professor: "Prof. Lars Eriksson", university: "MIT", department: "Physics", campaign: "MIT Physics — Spring '25", dateSent: "Apr 14, 2025", status: "Sent" },
  { id: "s4", professor: "Prof. James Moretti", university: "Columbia", department: "Astronomy", campaign: "Columbia Physics — Spring '25", dateSent: "Apr 12, 2025", status: "Negative Reply" },
  { id: "s5", professor: "Prof. Maya Okonkwo", university: "MIT", department: "Physics", campaign: "MIT Physics — Spring '25", dateSent: "Apr 14, 2025", status: "No Response" },
  { id: "s6", professor: "Prof. Anika Patel", university: "Columbia", department: "Physics", campaign: "Columbia Physics — Spring '25", dateSent: "Apr 12, 2025", status: "No Response" },
  { id: "s7", professor: "Prof. Robert Zhang", university: "MIT", department: "Physics", campaign: "MIT Physics — Spring '25", dateSent: "Apr 14, 2025", status: "Sent" },
  { id: "s8", professor: "Prof. Isabel Torres", university: "MIT", department: "Physics", campaign: "MIT Physics — Spring '25", dateSent: "Apr 14, 2025", status: "Do Not Contact" },
  { id: "s9", professor: "Prof. Wei Nakamura", university: "Princeton", department: "Physics", campaign: "Princeton Physics — Mar '25", dateSent: "Mar 28, 2025", status: "Positive Reply" },
  { id: "s10", professor: "Prof. Elena Vasquez", university: "Princeton", department: "Physics", campaign: "Princeton Physics — Mar '25", dateSent: "Mar 28, 2025", status: "No Response" },
  { id: "s11", professor: "Prof. Daniel Kim", university: "Princeton", department: "Physics", campaign: "Princeton Physics — Mar '25", dateSent: "Mar 28, 2025", status: "Negative Reply" },
  { id: "s12", professor: "Prof. Amara Nwosu", university: "Princeton", department: "Physics", campaign: "Princeton Physics — Mar '25", dateSent: "Mar 28, 2025", status: "No Response" },
];
