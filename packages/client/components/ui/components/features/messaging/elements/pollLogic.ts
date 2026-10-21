// dur.io: picking answers in a poll, and the base of its percentages
import type { API } from "stoat.js";

/**
 * Answers the user voted for
 * @param poll Poll
 * @param userId Voter
 */
export function myPicks(poll: API.Poll, userId: string): string[] {
  return poll.answers
    .filter((answer) => answer.votes?.includes(userId))
    .map((answer) => answer.id);
}

/**
 * The picks after a click on an answer: in a single-choice poll the answer (or none when
 * it was the pick already), in a multiple-choice poll the picks with the answer toggled
 * @param poll Poll
 * @param picks Current picks (not sent yet)
 * @param answerId Clicked answer
 */
export function togglePick(
  poll: API.Poll,
  picks: string[],
  answerId: string,
): string[] {
  const picked = picks.includes(answerId);

  if (!poll.multiple) return picked ? [] : [answerId];
  return picked ? picks.filter((id) => id !== answerId) : [...picks, answerId];
}

/**
 * Whether two lists of picks are the same answers
 * @param a Picks
 * @param b Picks
 */
export function samePicks(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * Users who voted at all
 * @param poll Poll
 */
export function voterCount(poll: API.Poll): number {
  const voters = new Set<string>();
  for (const answer of poll.answers) {
    for (const user of answer.votes ?? []) voters.add(user);
  }
  return voters.size;
}

/**
 * Votes on all answers (the base of the percentages, so they add up to 100 also when
 * a user picks several answers)
 * @param poll Poll
 */
export function voteCount(poll: API.Poll): number {
  return poll.answers.reduce(
    (sum, answer) => sum + (answer.votes?.length ?? 0),
    0,
  );
}
