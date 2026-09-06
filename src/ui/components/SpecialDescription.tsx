import type { SpecialPersonality } from '@ai/types';

/** A strength estimate is part of the description, never the Special badge. */
export default function SpecialDescription({ special, id }: { special: SpecialPersonality; id?: string }) {
  return (
    <span className="special-description" id={id}>
      <strong>{special.rule}</strong>
      <span>Estimated difficulty: {special.estimatedDifficulty}</span>
    </span>
  );
}
