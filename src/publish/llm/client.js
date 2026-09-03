// client.js — OpenAI client and high-level publish generation

const { getClubTimezone } = require("../repository");
const { normalizeDraftDetails, buildDraftFromDetails } = require("../drafts");
const { buildPrompt, buildThreadFeedbackPrompt } = require("./prompts");
const { DONUT_DETAILS_RESPONSE_FORMAT } = require("./schema");

function formatCurrentDateInTimezone(timezone) {
	const now = new Date();
	const readable = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	const parts = readable.formatToParts(now);
	const values = Object.fromEntries(
		parts.map((part) => [part.type, part.value]),
	);
	const iso = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);

	return `${iso} (${values.weekday}, ${values.month} ${values.day}, ${values.year}) in ${timezone}`;
}

function parseLLMResponse(rawText) {
	if (typeof rawText !== "string" || !rawText.trim())
		throw new Error("LLM response must be a JSON object");

	let parsed;
	try {
		parsed = JSON.parse(rawText.trim());
	} catch (error) {
		throw new Error(`LLM response was not valid JSON: ${error.message}`);
	}

	const details = normalizeDraftDetails(parsed);
	return { details, draftText: buildDraftFromDetails(details) };
}

function requireApiKey() {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey)
		throw new Error(
			"LLM not configured — set OPENAI_API_KEY to enable publishing",
		);
	return apiKey;
}

async function callOpenAI(prompt) {
	const apiKey = requireApiKey();

	const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
	const url = "https://api.openai.com/v1/chat/completions";
	const isReasoningNoTemp =
		/^(o1|o3|o4)/.test(model) ||
		(model.startsWith("gpt-5") && !model.includes("chat"));

	const body = {
		model,
		messages: [
			{
				role: "system",
				content:
					"You extract donut meetup details. Return the structured fields defined by the response schema.",
			},
			{ role: "user", content: prompt },
		],
		...(isReasoningNoTemp ? {} : { temperature: 0.7 }),
		max_completion_tokens: 8000,
		response_format: DONUT_DETAILS_RESPONSE_FORMAT,
	};

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`OpenAI error ${response.status}: ${text}`);
	}

	const data = await response.json();
	const message = data.choices?.[0]?.message;
	if (message?.refusal)
		throw new Error(`OpenAI refused the request: ${message.refusal}`);

	const finishReason = data.choices?.[0]?.finish_reason;
	if (finishReason === "length")
		throw new Error("OpenAI returned an incomplete structured response");

	const content = message?.content;
	if (typeof content !== "string" || !content.trim()) {
		console.error(
			"OpenAI returned no structured content:",
			JSON.stringify(data).slice(0, 2000),
		);
		throw new Error(
			`No structured content from OpenAI (finish_reason=${
				finishReason || "unknown"
			}). Check model ${model}`,
		);
	}

	return content;
}

async function resolveCurrentDateStr(db) {
	const timezone = await getClubTimezone(db);
	if (!timezone)
		throw new Error("Club timezone is not configured in Firestore");
	return formatCurrentDateInTimezone(timezone);
}

async function generateDonutDraft(chatHistory, participants, db) {
	requireApiKey();
	const currentDateStr = await resolveCurrentDateStr(db);
	const prompt = buildPrompt(chatHistory, participants, currentDateStr);
	const raw = await callOpenAI(prompt);

	return parseLLMResponse(raw);
}

async function generateRevisedDraft(
	originalDetails,
	originalDraft,
	feedback,
	participants,
	db,
) {
	requireApiKey();
	const currentDateStr = await resolveCurrentDateStr(db);
	const prompt = buildThreadFeedbackPrompt(
		originalDetails,
		originalDraft,
		feedback,
		participants,
		currentDateStr,
	);
	const raw = await callOpenAI(prompt);

	return parseLLMResponse(raw);
}

module.exports = {
	parseLLMResponse,
	callOpenAI,
	generateDonutDraft,
	generateRevisedDraft,
};
