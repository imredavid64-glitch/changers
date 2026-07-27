export type Strand = "N" | "E" | "S" | "W";

export type Post = {
  id: string;
  author: string;
  role: string;
  strand: Strand;
  title: string;
  body: string;
};

export const posts: Post[] = [
  {
    id: "m1",
    author: "Amira Khalil",
    role: "Student organizer",
    strand: "S",
    title: "Neighborhood welcome kit",
    body: "Co-designing a welcome kit for new families. Looking for translation help.",
  },
  {
    id: "m2",
    author: "Kai Lindholm",
    role: "Eco-Committee lead",
    strand: "N",
    title: "River cleanup dashboard",
    body: "Mapping cleanup sites and sensors. Need a storytelling editor.",
  },
  {
    id: "m3",
    author: "Lena Torres",
    role: "Social entrepreneur",
    strand: "E",
    title: "Circular uniform exchange",
    body: "Piloting a uniform exchange. Seeking policy mentors to scale.",
  },
];

export const quickActions = [
  { label: "Start an Idea" },
  { label: "Bridge Cards" },
  { label: "Action Sprint" },
];
