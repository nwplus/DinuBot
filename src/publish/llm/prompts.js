// prompts.js — instructions sent to the publish LLM

function joinPromptSections(...sections) {
	return sections.filter(Boolean).join("\n\n");
}

function formatTranscript(chatHistory) {
	return chatHistory
		.map((message) => {
			const author = message.user ? `<@${message.user}>` : "unknown";
			return `${author}: ${message.text || ""}`;
		})
		.join("\n");
}

function formatParticipants(participants) {
	return participants.map((id) => `<@${id}>`).join(", ");
}

function buildDateInstruction(currentDateStr) {
	if (!currentDateStr) return "";
	return `Today is ${currentDateStr}. Use this to resolve relative dates like "tomorrow" or "next Friday" to absolute dates (YYYY-MM-DD).`;
}

const ACTIVITY_INSTRUCTION =
	'Identify the activity as a concise phrase that preserves meaningful surrounding context from the chat (for example, "hotpot with karaoke", "boba + board games", "coffee study session", or "chicken dinner"). Do not reduce a specific plan to a generic label. Keep the location in the separate place field. If no activity is mentioned, use "hangout".';

const EXTRACTION_INSTRUCTIONS = [
	'Extract date/time (for example, "Friday 5pm", "Tomorrow 3pm", or "2026-08-30 14:00"). If time is not explicitly mentioned in the transcript, use "TBD" exactly; do not hallucinate or guess a time.',
	'Extract place/location (for example, "Nest", "UBC", or "Downtown cafe"). If place is not explicitly mentioned, use "TBD" exactly; do not hallucinate or guess a place.',
	ACTIVITY_INSTRUCTION,
	'Choose 1-2 emojis that best represent the activity and return them as the "emojis" field.',
].join("\n");

const OUTPUT_INSTRUCTION =
	"The server supplies the roster and constructs the final public-post format. Return only the meetup details required by the API. Do not include draftText or roster.";

function buildPrompt(chatHistory, participants, currentDateStr) {
	return joinPromptSections(
		"You are DinuBot, a Slack bot that helps donut pairs publish their meetup.",
		buildDateInstruction(currentDateStr),
		`Read the Slack DM conversation below and distill it into structured meetup details.\n\nConversation transcript:\n${formatTranscript(
			chatHistory,
		)}`,
		`Participants (initial roster, bots already excluded): ${formatParticipants(
			participants,
		)}`,
		`Task:\n${EXTRACTION_INSTRUCTIONS}`,
		OUTPUT_INSTRUCTION,
	);
}

function buildThreadFeedbackPrompt(
	originalDetails,
	originalDraft,
	feedback,
	participants,
	currentDateStr,
) {
	return joinPromptSections(
		buildDateInstruction(currentDateStr),
		"You are DinuBot revising a donut invite draft based on thread feedback.",
		`Original structured details: ${JSON.stringify(originalDetails)}`,
		`Original draftText (server-owned format): ${originalDraft}`,
		`Participants: ${formatParticipants(participants)}`,
		`Thread feedback (user reply in thread to the draft): ${feedback}`,
		[
			"Update dateTime, place, activity, or emojis if the feedback requests it.",
			"Preserve meaningful context surrounding the activity, including combinations or adjacent plans; do not reduce a specific plan to a generic label.",
			'Keep "TBD" for missing time or place and keep emojis relevant to the activity.',
		].join("\n"),
		OUTPUT_INSTRUCTION,
	);
}

module.exports = { buildPrompt, buildThreadFeedbackPrompt };
