import { scoreFoodSafety, formatBadge } from './foodSafetyScorer.js';
import { matchDonorToRecipients } from './matchingEngine.js';

async function runSafetyScore(listing) {
  try {
    const input = {
      description:      listing.description || '',
      foodCategory:     listing.foodType    || 'cooked_meal',
      cookedOrRaw:      'cooked',
      hoursSinceCooked: 0,
      storageMethod:    'not_stated',
      condition:        listing.condition   || '',
    };
    // foodSafetyScorer expects description to include condition
    input.description = `${listing.description}. Condition: ${listing.condition}`;
    const result = await scoreFoodSafety(input);
    // Convert verdict to 0-100 score to match FoodListing.safetyScore field
    const scoreMap = { Safe: 85, Caution: 50, Unsafe: 10 };
    return {
      score:   result.safetyScore ? Math.round(result.safetyScore * 100) : scoreMap[result.verdict],
      verdict: result.verdict,
      badge:   formatBadge(result),
    };
  } catch (err) {
    console.error('[mlClient] Safety score failed:', err.message);
    return { score: null, verdict: 'Caution', badge: null };
  }
}

async function runMatching(listing, recipients) {
  try {
    const donor = {
      id:               listing._id.toString(),
      description:      listing.description,
      foodCategory:     listing.foodType || 'cooked_meal',
      cookedOrRaw:      'cooked',
      servings:         10, // default since quantity is text
      location:         {
        lat: listing.location?.coordinates?.[1] || 0,
        lng: listing.location?.coordinates?.[0] || 0,
      },
      expiryTimestamp:  new Date(listing.expiresAt).getTime(),
      deliveryOption:   'pickup_only',
    };

    const formattedRecipients = recipients.map(r => ({
      id:                  r._id.toString(),
      name:                r.name,
      type:                r.orgName ? 'ngo' : 'individual',
      location: {
        lat: r.location?.coordinates?.[1] || 0,
        lng: r.location?.coordinates?.[0] || 0,
      },
      dietaryRestrictions: [],
      dietStrictness:      3,
      peopleToFeed:        5,
      preferredDelivery:   'pickup',
    }));

    return await matchDonorToRecipients(donor, formattedRecipients);
  } catch (err) {
    console.error('[mlClient] Matching failed:', err.message);
    return { matches: [] };
  }
}

export { runSafetyScore, runMatching };
