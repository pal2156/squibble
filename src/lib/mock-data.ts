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
  experience: "Research assistant in Columbia's Applied Math Lab (Spring 2025) - numerical simulation of fluid dynamics models. Co-authored a poster presentation at the SEAS undergraduate research symposium.",
  availability: "Summer 2025, starting mid-May",
  preference: "In-person or hybrid",
};

export interface Professor {
  id: string;
  name: string;
  university: string;
  department: string;
  title?: string;
  description: string;
  email: string;
  fitScore: number;
  researchAreas: string[];
  selected?: boolean;
}

export const professors: Professor[] = [
  {
    id: "p1",
    name: "Dmitri Volkov",
    university: "Columbia University",
    department: "Physics",
    title: "Associate Professor",
    description: "Topological insulators and unconventional superconductivity in correlated electron systems.",
    email: "d.volkov@phys.columbia.edu",
    fitScore: 96,
    researchAreas: ["Topological Insulators", "Superconductivity", "Condensed Matter"],
    selected: true,
  },
  {
    id: "p2",
    name: "Sarah Chen",
    university: "Columbia University",
    department: "Applied Physics",
    title: "Assistant Professor",
    description: "Variational quantum algorithms and error mitigation for near-term quantum devices.",
    email: "s.chen@apam.columbia.edu",
    fitScore: 94,
    researchAreas: ["Quantum Computing", "NISQ Algorithms", "Quantum Error Mitigation"],
    selected: true,
  },
  {
    id: "p3",
    name: "Lars Eriksson",
    university: "MIT",
    department: "Physics",
    title: "Professor of Physics",
    description: "Exotic quantum phases in frustrated magnets and spin liquid candidates.",
    email: "l.eriksson@mit.edu",
    fitScore: 92,
    researchAreas: ["Quantum Materials", "Spin Liquids", "Frustrated Magnetism"],
    selected: true,
  },
  {
    id: "p4",
    name: "James Moretti",
    university: "Columbia University",
    department: "Astronomy",
    title: "Associate Professor",
    description: "Dark matter detection via gravitational lensing and galaxy cluster dynamics.",
    email: "j.moretti@astro.columbia.edu",
    fitScore: 89,
    researchAreas: ["Dark Matter", "Gravitational Lensing", "Cosmology"],
    selected: false,
  },
  {
    id: "p5",
    name: "Maya Okonkwo",
    university: "MIT",
    department: "Physics",
    title: "Assistant Professor",
    description: "Topological quantum error correction and fault-tolerant quantum computation.",
    email: "m.okonkwo@mit.edu",
    fitScore: 88,
    researchAreas: ["Quantum Error Correction", "Topological Codes", "Quantum Information"],
    selected: false,
  },
  {
    id: "p6",
    name: "Anika Patel",
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
    name: "Robert Zhang",
    university: "MIT",
    department: "Physics",
    title: "Professor of Physics",
    description: "Neutrino mass hierarchies and oscillation experiments at deep underground labs.",
    email: "r.zhang@mit.edu",
    fitScore: 83,
    researchAreas: ["Neutrino Physics", "Particle Astrophysics", "Underground Experiments"],
    selected: false,
  },
  {
    id: "p8",
    name: "Isabel Torres",
    university: "MIT",
    department: "Physics",
    title: "Assistant Professor",
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
    subject: "Undergraduate Research Inquiry - Topological Systems",
    body: `Dear Professor Volkov,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I came across your recent work on the interplay between topology and superconductivity in transition metal dichalcogenides - particularly the role of Berry curvature in driving unconventional pairing symmetries. I found your 2024 paper in Physical Review Letters genuinely compelling, and it's exactly the intersection of geometry and condensed matter that drew me to physics in the first place.

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
    subject: "Summer Research - Variational Quantum Algorithms",
    body: `Dear Professor Chen,

I'm a freshman at Columbia (Physics and Math) writing to ask about undergraduate research opportunities in your group this summer. Your work on noise-aware variational quantum eigensolvers - and specifically your recent results showing that symmetry-preserving ansätze meaningfully outperform hardware-efficient circuits on NISQ devices - is the kind of problem I'd really like to contribute to, even at a supporting level.

My background: I've taken the core physics sequence through Quantum I, and I've been working through Nielsen & Chuang independently since January. I have some programming experience in Python (NumPy, SciPy, a bit of Qiskit), which I've used in a numerical methods context at Columbia's Applied Math Lab last semester.

I'm available in-person starting mid-May through August. I'm not expecting to run experiments on day one - I understand quantum computing research has a steep curve - but I'm serious about climbing it and would be glad to start with literature review, simulation work, or whatever would actually be useful to your group.

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

I'm Paul, a first-year student at Columbia studying Physics and Mathematics. I'm reaching out because your group's work on quantum spin liquids - particularly the experimental signatures you've identified in candidate materials like α-RuCl₃ - sits squarely at the intersection of things I find most interesting about condensed matter: highly frustrated geometries, emergent gauge fields, and the challenge of distinguishing true spin liquid behavior from conventional ordered phases.

I'm writing to ask whether there might be room for an undergraduate researcher in your group this summer. I know MIT is a commute from New York, so I want to flag that I'm flexible - I could relocate to Cambridge for the summer if the opportunity warranted it. I've completed the standard first-year Physics sequence at Columbia, I'm comfortable with Python and numerical methods from prior lab work, and I'm a reliable, low-maintenance collaborator. My GPA is 3.47 if that's relevant to your considerations.

I recognize this is a long shot, and I don't want to oversell what I can contribute at this stage. But if your lab takes undergrads and you think there's a fit, I'd be glad to send materials or talk further.

Thank you for your time,

Paul Lacarrière
Columbia University, Class of 2028
paul.a.lacarriere@columbia.edu`,
  },
];

export type EmailStatus =
  | "Positive Reply"
  | "No Response"
  | "Negative Reply";

export interface SentEmail {
  id: string;
  professor: string;
  university: string;
  department: string;
  campaign: string;
  dateSent: string;
  status: EmailStatus;
  subject: string;
  body: string;
  reply?: {
    date: string;
    body: string;
  };
}

export const sentEmails: SentEmail[] = [
  {
    id: "s1",
    professor: "Dmitri Volkov",
    university: "Columbia",
    department: "Physics",
    campaign: "Columbia Physics - Spring '25",
    dateSent: "Apr 12, 2025",
    status: "Positive Reply",
    subject: "Undergraduate Research Inquiry - Topological Systems",
    body: `Dear Professor Volkov,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I came across your recent work on the interplay between topology and superconductivity in transition metal dichalcogenides - particularly the role of Berry curvature in driving unconventional pairing symmetries. I found your 2024 paper in Physical Review Letters genuinely compelling, and it's exactly the intersection of geometry and condensed matter that drew me to physics in the first place.

I'm writing to ask whether you have any openings for an undergraduate research assistant this summer (starting mid-May). I understand this is early and that your lab's focus demands real technical grounding, so I want to be upfront about where I am: I've completed Classical Mechanics, EM, and Quantum I, and I'm currently working through Griffiths on my own. I also spent last semester as an RA in Columbia's Applied Math Lab, running numerical simulations in Python, which I suspect translates reasonably well to the kind of tight-binding and Monte Carlo work your group does.

I'm in-person in New York all summer and am fully committed to showing up consistently. Even if a formal position isn't available, I'd genuinely value 20 minutes of your time to learn more about the lab's current direction.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028
paul.a.lacarriere@columbia.edu`,
    reply: {
      date: "Apr 15, 2025",
      body: `Dear Paul,

Thank you for the thoughtful email - it's clear you've engaged seriously with the work, and I appreciate you being upfront about where you are technically.

We do take on undergraduates occasionally, and your background is more relevant than you might think. The numerical simulation work from the Applied Math Lab translates directly to some of the phase diagram calculations we run here.

Could you come by my office during office hours next week? I'm in Pupin 936 on Tuesdays 2–4pm. I'd like to hear more about your interests and walk you through what the summer projects might look like.

Best,
Dmitri Volkov`,
    },
  },
  {
    id: "s2",
    professor: "Sarah Chen",
    university: "Columbia",
    department: "Applied Physics",
    campaign: "Columbia Physics - Spring '25",
    dateSent: "Apr 12, 2025",
    status: "No Response",
    subject: "Summer Research - Variational Quantum Algorithms",
    body: `Dear Professor Chen,

I'm a freshman at Columbia (Physics and Math) writing to ask about undergraduate research opportunities in your group this summer. Your work on noise-aware variational quantum eigensolvers - and specifically your recent results showing that symmetry-preserving ansätze meaningfully outperform hardware-efficient circuits on NISQ devices - is the kind of problem I'd really like to contribute to, even at a supporting level.

My background: I've taken the core physics sequence through Quantum I, and I've been working through Nielsen & Chuang independently since January. I have some programming experience in Python (NumPy, SciPy, a bit of Qiskit), which I've used in a numerical methods context at Columbia's Applied Math Lab last semester.

I'm available in-person starting mid-May through August. I'm not expecting to run experiments on day one - I understand quantum computing research has a steep curve - but I'm serious about climbing it and would be glad to start with literature review, simulation work, or whatever would actually be useful to your group.

If you have capacity this summer, I'd be grateful for the chance to discuss it.

Thank you,

Paul Lacarrière
Columbia University, Class of 2028`,
  },
  {
    id: "s3",
    professor: "Lars Eriksson",
    university: "MIT",
    department: "Physics",
    campaign: "MIT Physics - Spring '25",
    dateSent: "Apr 14, 2025",
    status: "No Response",
    subject: "Inquiry: Undergraduate Research, Quantum Materials (Summer 2025)",
    body: `Dear Professor Eriksson,

I'm Paul, a first-year student at Columbia studying Physics and Mathematics. I'm reaching out because your group's work on quantum spin liquids - particularly the experimental signatures you've identified in candidate materials like α-RuCl₃ - sits squarely at the intersection of things I find most interesting about condensed matter: highly frustrated geometries, emergent gauge fields, and the challenge of distinguishing true spin liquid behavior from conventional ordered phases.

I'm writing to ask whether there might be room for an undergraduate researcher in your group this summer. I know MIT is a commute from New York, so I want to flag that I'm flexible - I could relocate to Cambridge for the summer if the opportunity warranted it. I've completed the standard first-year Physics sequence at Columbia, I'm comfortable with Python and numerical methods from prior lab work, and I'm a reliable, low-maintenance collaborator. My GPA is 3.47 if that's relevant to your considerations.

I recognize this is a long shot, and I don't want to oversell what I can contribute at this stage. But if your lab takes undergrads and you think there's a fit, I'd be glad to send materials or talk further.

Thank you for your time,

Paul Lacarrière
Columbia University, Class of 2028
paul.a.lacarriere@columbia.edu`,
  },
  {
    id: "s4",
    professor: "James Moretti",
    university: "Columbia",
    department: "Astronomy",
    campaign: "Columbia Physics - Spring '25",
    dateSent: "Apr 12, 2025",
    status: "Negative Reply",
    subject: "Undergraduate Research Inquiry - Dark Matter & Gravitational Lensing",
    body: `Dear Professor Moretti,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. Your group's work on dark matter detection through strong gravitational lensing caught my attention - particularly the recent results characterizing substructure in galaxy clusters as a probe of dark matter self-interactions.

I'm writing to ask whether you have any openings for an undergraduate researcher this summer (starting mid-May). I have Python experience from a semester as an RA in Columbia's Applied Math Lab, and I'm comfortable with the kind of numerical work that seems relevant to your group's simulations.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028
paul.a.lacarriere@columbia.edu`,
    reply: {
      date: "Apr 14, 2025",
      body: `Dear Paul,

Thanks for reaching out. Unfortunately, we're at capacity this summer and won't be able to take on additional undergraduate students - our current projects have the team fully occupied.

I'd encourage you to check back in the fall; we occasionally have openings for the spring semester.

Best,
James Moretti`,
    },
  },
  {
    id: "s5",
    professor: "Maya Okonkwo",
    university: "MIT",
    department: "Physics",
    campaign: "MIT Physics - Spring '25",
    dateSent: "Apr 14, 2025",
    status: "No Response",
    subject: "Summer Research Inquiry - Topological Quantum Error Correction",
    body: `Dear Professor Okonkwo,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I'm writing to ask about undergraduate research opportunities in your group this summer. Your work on topological quantum error correction - specifically the surface code implementations on superconducting qubit arrays - is exactly the direction I want to learn more about.

I've completed the standard first-year physics sequence and have been working through Nielsen & Chuang since January. I have Python experience from research work at Columbia's Applied Math Lab, including some basic Qiskit. I could relocate to Cambridge for the summer if there's an opportunity.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028`,
  },
  {
    id: "s6",
    professor: "Anika Patel",
    university: "Columbia",
    department: "Physics",
    campaign: "Columbia Physics - Spring '25",
    dateSent: "Apr 12, 2025",
    status: "No Response",
    subject: "Undergraduate Research Inquiry - Particle Physics & LHC",
    body: `Dear Professor Patel,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I'm reaching out about the possibility of undergraduate research in your group this summer. Your work searching for beyond-Standard-Model signatures in LHC data - particularly the recent analysis constraining the parameter space for vector-like quarks - is the kind of high-stakes experimental work I'd like to contribute to, even at a peripheral level.

I'm in New York all summer, available starting mid-May. I have computational experience in Python from prior lab work and a solid first-year physics foundation. If there's room for an undergraduate in your group, I'd be glad to discuss it.

Thank you,

Paul Lacarrière
Columbia University, Class of 2028`,
  },
  {
    id: "s7",
    professor: "Robert Zhang",
    university: "MIT",
    department: "Physics",
    campaign: "MIT Physics - Spring '25",
    dateSent: "Apr 14, 2025",
    status: "No Response",
    subject: "Undergraduate Research Inquiry - Neutrino Physics",
    body: `Dear Professor Zhang,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I'm writing to ask about summer research opportunities in your group. Your work on neutrino mass hierarchies - particularly the oscillation parameter fits from the recent long-baseline data - sits at an intersection of experimental technique and fundamental physics that I find genuinely fascinating.

I'm flexible about location and could be in Cambridge for the summer. I have Python experience from numerical work in Columbia's Applied Math Lab, and a solid first-year physics background. Even a peripheral role - data processing, simulation support - would be meaningful.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028`,
  },
  {
    id: "s9",
    professor: "Wei Nakamura",
    university: "Princeton",
    department: "Physics",
    campaign: "Princeton Physics - Mar '25",
    dateSent: "Mar 28, 2025",
    status: "Positive Reply",
    subject: "Summer Research Inquiry - Moiré Systems & Correlated Phases",
    body: `Dear Professor Nakamura,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I've been following your group's work on strongly correlated phases in moiré superlattices - particularly the unconventional superconductivity you've characterized in twisted bilayer graphene near the magic angle. It's one of those problems where the experimental observations still outpace the theory, and I find that genuinely exciting.

I'm writing to ask whether there might be room for an undergraduate in your group this summer. I have Python and numerical methods experience from a semester as an RA at Columbia's Applied Math Lab, and I'm comfortable with tight-binding calculations at a basic level. My GPA is 3.47. I'm willing to travel to Princeton for the summer if there's an opportunity.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028
paul.a.lacarriere@columbia.edu`,
    reply: {
      date: "Apr 2, 2025",
      body: `Paul,

Thanks for reaching out - and for the specific reference to the magic-angle work. It's good to see a first-year paying attention to the literature.

We do have a summer opening. One of my graduate students is running tight-binding simulations of twisted TMD heterostructures and we're looking for someone who can help on the computational side - mostly Python, some data analysis. Your background sounds like a reasonable fit.

Send me your transcript when you get a chance, and let's set up a 20-minute call to see if it makes sense.

Wei Nakamura`,
    },
  },
  {
    id: "s10",
    professor: "Elena Vasquez",
    university: "Princeton",
    department: "Physics",
    campaign: "Princeton Physics - Mar '25",
    dateSent: "Mar 28, 2025",
    status: "No Response",
    subject: "Undergraduate Research Inquiry - Ultracold Atoms & Quantum Simulation",
    body: `Dear Professor Vasquez,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I'm reaching out because your group's work on quantum simulation with ultracold fermionic atoms - specifically the Hubbard model physics you've accessed in optical lattices - connects directly to what I find most interesting about condensed matter: how simple microscopic models give rise to remarkably complex emergent behavior.

I'm writing to ask whether you have any openings for an undergraduate this summer. I have computational experience from prior lab work and a solid first-year physics foundation. I'm flexible about location and would be glad to discuss even a peripheral role.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028`,
  },
  {
    id: "s11",
    professor: "Daniel Kim",
    university: "Princeton",
    department: "Physics",
    campaign: "Princeton Physics - Mar '25",
    dateSent: "Mar 28, 2025",
    status: "Negative Reply",
    subject: "Summer Research Inquiry - High-Energy Theory",
    body: `Dear Professor Kim,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I'm interested in high-energy theory and writing to ask about undergraduate research opportunities in your group this summer.

I've completed the standard first-year physics sequence and have some background in mathematical physics. I understand that theoretical high-energy research typically requires more advanced preparation, but I'd welcome the chance to contribute to literature review or computational projects if there's a fit.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028`,
    reply: {
      date: "Apr 1, 2025",
      body: `Hi Paul,

Thanks for writing. Unfortunately, we don't have capacity to take on undergraduates this summer - our group is small and the current projects are already fully staffed.

Keep working on the physics and consider applying again after you've had more coursework under your belt.

Best,
Daniel Kim`,
    },
  },
  {
    id: "s12",
    professor: "Amara Nwosu",
    university: "Princeton",
    department: "Physics",
    campaign: "Princeton Physics - Mar '25",
    dateSent: "Mar 28, 2025",
    status: "No Response",
    subject: "Undergraduate Research Inquiry - Active Matter & Biophysics",
    body: `Dear Professor Nwosu,

I'm Paul, a freshman at Columbia studying Physics and Mathematics. I came across your work on the statistical mechanics of active matter systems - particularly the theoretical framework you've developed for collective dynamics in biological cell assemblies - and found the connection between condensed matter physics and biological systems genuinely compelling.

I'm writing to ask about undergraduate research opportunities this summer. I have Python experience and a solid physics and math foundation. I'd be glad to contribute to computational or data analysis work if there's a fit in your group.

Thank you for your time.

Paul Lacarrière
Columbia University, Class of 2028`,
  },
];
