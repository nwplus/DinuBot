// drafts.js — server-owned draft rules and validation

function requiredString(value, field) {
	if (typeof value !== "string" || !value.trim())
		throw new Error(`LLM response is missing ${field}`);
	return value.trim();
}

function normalizeDraftDetails(details) {
	if (!details || typeof details !== "object" || Array.isArray(details))
		throw new Error("LLM response must be a JSON object");

	return {
		dateTime: requiredString(details.dateTime, "dateTime"),
		place: requiredString(details.place, "place"),
		activity: requiredString(details.activity, "activity"),
		emojis: requiredString(details.emojis, "emojis"),
	};
}

function buildDraftFromDetails(details) {
	const { activity, emojis, dateTime, place } =
		normalizeDraftDetails(details);

	const baseActivity = activity
		.split(/\s+at\s+|\s+in\s+|\s+with\s+|\s*\+\s*|\s+and\s+/i)[0]
		.trim();
	const titleActivity = baseActivity
		? baseActivity.charAt(0).toUpperCase() + baseActivity.slice(1)
		: baseActivity;
	const hasPlace = place.toLowerCase() !== "tbd";
	const titlePlace = hasPlace
		? place.charAt(0).toUpperCase() + place.slice(1)
		: "";
	const fullTitle = hasPlace
		? `${titleActivity} at ${titlePlace}`
		: titleActivity;
	const title = `*${emojis} ${fullTitle} Donut*`;

	if (dateTime.toUpperCase() === "TBD" && place.toUpperCase() === "TBD")
		return `${title} — details TBD\nEveryone welcome! Hit “I'm in!” :wave:`;
	return `${title}\nEveryone welcome! Hit “I'm in!” to join.`;
}

function getMissingDetails(details) {
	const isTBD = (value) =>
		typeof value !== "string" ||
		!value.trim() ||
		value.trim().toUpperCase() === "TBD";

	return [
		isTBD(details?.dateTime) ? "time" : null,
		isTBD(details?.place) ? "place" : null,
	].filter(Boolean);
}

function hasRequiredDetails(details) {
	return getMissingDetails(details).length === 0;
}

module.exports = {
	requiredString,
	normalizeDraftDetails,
	buildDraftFromDetails,
	getMissingDetails,
	hasRequiredDetails,
};
