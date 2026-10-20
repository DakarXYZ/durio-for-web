// dur.io: what a click in a poll means, and the base of its percentages
import type { API } from "stoat.js";

/**
 * The picks after a click on an answer: in a single-choice poll the answer (or none when
 * it was the pick already), in a multiple-choice poll the picks with the answer toggled
 * @param poll Poll
 * @param userId Voter
 * @param answerId Clicked answer
 */
export function nextPicks(
  poll: API.Poll,
  userId: string,
  answerId: string,
): string[] {
  const mine = poll.answers
    .filter((answer) => answer.votes?.includes(userId))
    .map((answer) => answer.id);
  const picked = mine.includes(answerId);

  if (!poll.multiple) return picked ? [] : [answerId];
  return picked ? mine.filter((id) => id !== answerId) : [...mine, answerId];
}

/**
 * Users who voted at all (the base of the percentages: with several answers each,
 * shares of voters, not of votes)
 * @param poll Poll
 */
export function voterCount(poll: API.Poll): number {
  const voters = new Set<string>();
  for (const answer of poll.answers) {
    for (const user of answer.votes ?? []) voters.add(user);
  }
  return voters.size;
}
