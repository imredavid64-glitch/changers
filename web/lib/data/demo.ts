export type Strand = "N" | "E" | "S" | "W";

export type Post = {
  id: string;
  author: string;
  role: string;
  strand: Strand;
  title: string;
  body: string;
};

export const heroStats = [
  {
    label: "Conference 2026",
    value: "March 5-7, 2026 - Dusseldorf",
  },
  {
    label: "Host School",
    value: "International School of Dusseldorf",
  },
  {
    label: "Participating Schools",
    value: "26 schools",
  },
];

export const demoPosts: Post[] = [
  {
    id: "demo-1",
    author: "Amira Khalil",
    role: "Student organizer - Frankfurt IS",
    strand: "S",
    title: "Neighborhood welcome kit for new families",
    body:
      "We are mapping services for new arrivals and want to co-design a welcome kit with local youth councils. Looking for translation partners and a designer.",
  },
  {
    id: "demo-2",
    author: "Kai Lindholm",
    role: "Eco-Committee lead - Helsinki",
    strand: "N",
    title: "River cleanup dashboard",
    body:
      "Building a live map of cleanup sites with data from student teams. Need help connecting sensors and a storytelling editor.",
  },
  {
    id: "demo-3",
    author: "Lena Torres",
    role: "Social entrepreneur - Barcelona",
    strand: "E",
    title: "Circular uniform exchange",
    body:
      "Piloting a circular economy exchange for school uniforms. Seeking policy mentors and a partner school to scale.",
  },
  {
    id: "demo-4",
    author: "Noor Binta",
    role: "Wellbeing coach - Nairobi",
    strand: "W",
    title: "Peer support circles",
    body:
      "Designing peer support circles to reduce stress during exams. Looking for facilitators and a digital toolkit.",
  },
];

export const collabRooms = [
  {
    title: "Rhein Cleanup Collective",
    summary: "Weekly shoreline action and data collection.",
    tags: ["N Nature", "S Society"],
  },
  {
    title: "Circular Economy Lab",
    summary: "Designing exchange systems for schools.",
    tags: ["E Economy", "S Society"],
  },
  {
    title: "Wellbeing First Aid",
    summary: "Peer coaching, mental health, and support.",
    tags: ["W Wellbeing"],
  },
];

export const projects = [
  {
    title: "Bridge Toolkit",
    summary: "Open-source guides for leading changemaker teams.",
    progress: 74,
  },
  {
    title: "Impact Host Playbook",
    summary: "Transparent criteria and planning steps for host schools.",
    progress: 52,
  },
  {
    title: "Seed Library",
    summary: "Community stories and resources from student leaders.",
    progress: 38,
  },
];

export const events = [
  {
    date: "March 5-7, 2026",
    title: "Changemaker Conference 2026",
    location: "International School of Dusseldorf, Dusseldorf, Germany",
    cta: "RSVP",
    primary: true,
  },
  {
    date: "March 11-13, 2027",
    title: "Changemaker Conference 2027",
    location: "Herojus Gymnasium, Kaunas, Lithuania",
    cta: "Follow updates",
    primary: false,
  },
  {
    date: "Monthly",
    title: "Bridge to Impact Showcases",
    location: "Live student demos and community feedback.",
    cta: "Join livestream",
    primary: false,
  },
];

export const zineIssues = [
  {
    month: "Dec 2025",
    title: "Seeds of Change",
    summary: "Student voices on climate action and community care.",
  },
  {
    month: "Jan 2026",
    title: "Seeds of Change",
    summary: "Projects bridging equity, wellbeing, and sustainability.",
  },
  {
    month: "Feb 2026",
    title: "Seeds of Change",
    summary: "How student agency is reshaping school culture.",
  },
  {
    month: "Mar 2026",
    title: "Seeds of Change",
    summary: "Conference highlights and action toolkits.",
  },
];

export const mentors = [
  {
    name: "Dr. Elisa Meyer",
    focus: "Sustainability education, curriculum design",
  },
  {
    name: "Rahul Desai",
    focus: "Circular economy and social enterprise",
  },
  {
    name: "Ana Duarte",
    focus: "Youth wellbeing and community health",
  },
];

export const hostCriteria = [
  "No direct repeat hosts within two years.",
  "Capacity for 200 or more participants.",
  "Hosted in continental Europe.",
  "Prior student attendance required.",
  "Rotate host country when possible.",
];

export const impactStats = [
  {
    label: "Nature",
    value: "12 active projects",
    detail: "Ecosystems, waste, conservation",
  },
  {
    label: "Economy",
    value: "9 active projects",
    detail: "Circular systems, green jobs",
  },
  {
    label: "Society",
    value: "18 active projects",
    detail: "Community resilience, equity",
  },
  {
    label: "Wellbeing",
    value: "7 active projects",
    detail: "Health, belonging, growth",
  },
];

export const featureCards = [
  {
    title: "Idea Forge",
    summary:
      "Turn a spark into a proposal with a structured canvas, team roles, and a pitch reel.",
    bullets: [
      "Impact hypothesis and evidence tracker",
      "SDG alignment with N E S W tagging",
      "Mentor ask and collaboration map",
    ],
  },
  {
    title: "Action Sprints",
    summary:
      "Run 24-72 hour collaboration pushes with clear outcomes and micro-grants.",
    bullets: [
      "Built-in sprint rooms and daily check-ins",
      "Volunteer and partner matching",
      "Auto-generated impact recap",
    ],
  },
  {
    title: "Proof of Change",
    summary: "Showcase outcomes with evidence, testimonials, and open artifacts.",
    bullets: [
      "Impact timeline and data uploads",
      "Community feedback and endorsements",
      "Shareable case study format",
    ],
  },
];
