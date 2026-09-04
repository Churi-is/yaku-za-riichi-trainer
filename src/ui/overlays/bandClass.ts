/** Shared band → CSS class mapping for overlays. Owned by Worker D. */
import type { ProbabilityBand } from '@analysis/types';

export function bandClass(band: ProbabilityBand): string {
  switch (band) {
    case 'Very high': return 'band band-vhigh';
    case 'High': return 'band band-high';
    case 'Medium': return 'band band-med';
    case 'Low': return 'band band-low';
    case 'Very low': return 'band band-vlow';
    default: return 'band band-vlow';
  }
}
