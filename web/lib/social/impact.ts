export interface ImpactInput {
  posts: number;
  projects: number;
  documents: number;
  slideshows: number;
  eventsHosted: number;
  roomsJoined: number;
  followers: number;
}

export function computeImpactScore(input: ImpactInput) {
  const score = Math.round(
    input.posts * 4 +
    input.projects * 25 +
    input.documents * 6 +
    input.slideshows * 8 +
    input.eventsHosted * 15 +
    input.roomsJoined * 3 +
    input.followers * 2,
  );
  return Math.min(score, 9999);
}

export function impactLevel(score: number) {
  if (score >= 1000) return "Trailblazer";
  if (score >= 400) return "Changemaker";
  if (score >= 100) return "Contributor";
  if (score >= 1) return "Beginner";
  return "Just starting";
}
