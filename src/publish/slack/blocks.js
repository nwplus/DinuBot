// blocks.js — Slack Block Kit builders for publish feature (layer: presentation)

function formatRosterMentions(roster) {
	if (!Array.isArray(roster)) throw new Error("roster must be an array");
	if (roster.length === 0) return "Be the first to join!";
	return roster.map((id) => `<@${id}>`).join(", ");
}

const ISO_LIKE_DATE_PATTERN =
	/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?/;

function formatClockTime(hour, minute) {
	let hour12 = hour % 12;
	if (hour12 === 0) hour12 = 12;
	const ampm = hour >= 12 ? "PM" : "AM";
	const min = String(minute).padStart(2, "0");
	return `${hour12}:${min} ${ampm}`;
}

function formatCalendarDate(date, day = date.getDate()) {
	const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
	const month = date.toLocaleDateString("en-US", { month: "short" });
	return `${weekday}, ${month} ${day}`;
}

function formatDateForDisplay(
	date,
	{ day = date.getDate(), hour = null, minute = 0 } = {},
) {
	const dateText = formatCalendarDate(date, day);
	if (hour === null) return dateText;
	return `${dateText} at ${formatClockTime(hour, minute)}`;
}

function formatIsoLikeDate(raw) {
	const match = raw.match(ISO_LIKE_DATE_PATTERN);
	if (!match) return null;

	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10);
	const day = parseInt(match[3], 10);
	const hour = match[4] != null ? parseInt(match[4], 10) : null;
	const minute = match[5] != null ? parseInt(match[5], 10) : 0;
	const date = new Date(
		year,
		month - 1,
		day,
		hour != null ? hour : 12,
		minute,
	);
	if (Number.isNaN(date.getTime())) return null;
	return formatDateForDisplay(date, { day, hour, minute });
}

function formatNaturalDate(raw) {
	const date = new Date(raw);
	if (Number.isNaN(date.getTime()) || !/\d/.test(raw)) return null;

	const hasTime = /:/.test(raw) || /[AP]M/i.test(raw);
	const time = hasTime
		? { hour: date.getHours(), minute: date.getMinutes() }
		: {};
	return formatDateForDisplay(date, time);
}

function formatWhenForDisplay(dateTimeStr) {
	if (typeof dateTimeStr !== "string")
		throw new Error("dateTime must be a string");

	const raw = dateTimeStr.trim();
	if (!raw || raw.toUpperCase() === "TBD") return "TBD";

	if (/[AP]M/i.test(raw) && /[A-Za-z]{3,}/.test(raw)) return raw;

	return formatIsoLikeDate(raw) || formatNaturalDate(raw) || raw;
}

function escapeRegExp(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseExtraDetails(activityRaw, placeRaw) {
	if (typeof activityRaw !== "string" || typeof placeRaw !== "string")
		throw new Error("activity and place are required");

	const activity = activityRaw.trim();
	const place = placeRaw.trim();
	if (
		activity.toLowerCase() === "hangout" ||
		activity.toLowerCase() === "tbd"
	)
		return "";

	let extra = "";
	const baseActRaw = activity
		.split(/\s+at\s+|\s+in\s+|\s+with\s+|\s*\+\s*|\s+and\s+/i)[0]
		.trim();
	if (!baseActRaw) throw new Error("activity has no base phrase");
	extra = activity.substring(baseActRaw.length).trim();
	if (place.toLowerCase() !== "tbd") {
		extra = extra
			.replace(
				new RegExp(`\\s*(at|in)\\s+${escapeRegExp(place)}`, "i"),
				"",
			)
			.trim();
	}

	extra = extra
		.replace(/^[+,&\s]+/, "")
		.replace(/^\s*with\s+/i, "")
		.trim();
	if (extra) extra = extra.charAt(0).toUpperCase() + extra.slice(1);
	return extra;
}

function buildMeetupDetailsText(details, roster, rosterLabel) {
	const rosterMentions = formatRosterMentions(roster);
	const extra = parseExtraDetails(details.activity, details.place);
	const detailsLine = extra ? `\n• *Details:* ${extra}` : "";
	const whenDisplay = formatWhenForDisplay(details.dateTime);
	return `• *When:* ${whenDisplay}\n• *Where:* ${details.place}${detailsLine}\n• *${rosterLabel} (${roster.length}):* ${rosterMentions}`;
}

function buildPreviewBlocks(
	draftText,
	details,
	roster,
	dmChannelId,
	previewTs = null,
) {
	const meetupDetails = buildMeetupDetailsText(details, roster, "Who");
	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Proposed donut post draft:*\n${draftText}`,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: meetupDetails,
			},
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Approve & Publish :white_check_mark:",
						emoji: true,
					},
					value: previewTs
						? `${dmChannelId}:${previewTs}`
						: dmChannelId,
					action_id: "approve_publish",
					style: "primary",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Discard :wastebasket:",
						emoji: true,
					},
					value: previewTs
						? `${dmChannelId}:${previewTs}`
						: dmChannelId,
					action_id: "discard_publish_draft",
				},
			],
		},
		{
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: "To revise, reply in the thread to this draft and mention @DinuBot — the LLM will update it.",
				},
			],
		},
	];
}

const PUBLISH_PROMPT_FALLBACK_TEXT =
	"Want to open this donut to the whole club? Hit Publish donut";

function buildPublishPromptBlocks(channelId) {
	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: "Want to open this donut to the whole club? :mega: Once you've agreed on a *time* and *place* in this DM, hit *Publish* and I'll draft an invite for the public channel.",
			},
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Publish donut :doughnut:",
						emoji: true,
					},
					value: channelId,
					action_id: "publishDonut",
					style: "primary",
				},
			],
		},
		{
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: "You can also type `/publish` or `/publish <custom draft>` anytime in this DM.",
				},
			],
		},
	];
}

function buildLLMConsentBlocks(dmChannelId) {
	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: "Let an LLM read this chat history to propose a draft message? You will review the draft before publishing.",
			},
		},
		{
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: "The history is not saved anywhere, and the provider does not use your data for training.",
				},
			],
		},
		{
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: "Want to provide your own context instead of chat history? Use `/publish Friday 5pm at Nest for boba` — the LLM will draft from that text alone.",
				},
			],
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Yes, draft it :memo:",
						emoji: true,
					},
					value: dmChannelId,
					action_id: "confirm_llm_draft",
					style: "primary",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "Cancel", emoji: true },
					value: dmChannelId,
					action_id: "cancel_llm_draft",
				},
			],
		},
	];
}

function buildPublicDonutBlocks(draftText, details, currentRoster) {
	const meetupDetails = buildMeetupDetailsText(
		details,
		currentRoster,
		"Roster",
	);
	return [
		{ type: "section", text: { type: "mrkdwn", text: draftText } },
		{ type: "divider" },
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: meetupDetails,
			},
		},
		{
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: "Want to join? Hit the button below! :point_down:",
				},
			],
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "I'm in! 🙋",
						emoji: true,
					},
					value: "join",
					action_id: "join_donut_publish",
					style: "primary",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Leave :wave:",
						emoji: true,
					},
					value: "leave",
					action_id: "leave_donut_publish",
				},
			],
		},
	];
}

function buildInsufficientDetailsBlocks(missing) {
	const missingText = missing.length
		? missing.join(" and ")
		: "time and place";
	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `:warning: Please put the ${missingText} of your donut into the chat before publishing! I need at least a *date/time* and a *location* to make an invite. :spiral_calendar_pad: :round_pushpin:`,
			},
		},
		{
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: "Add the missing details to this DM — for example, “Friday 5pm at Nest for boba?” — then hit Publish again. Or draft directly with `/publish Friday 5pm at Nest for boba`.",
				},
			],
		},
	];
}

function buildPublishedNoticeBlocks(existingRecord, wording) {
	const publicChannel = existingRecord?.publicChannelId;
	const publicTs = existingRecord?.publicMessageTs;
	if (
		typeof publicChannel !== "string" ||
		!publicChannel.trim() ||
		typeof publicTs !== "string" ||
		!publicTs.trim()
	)
		throw new Error(
			"Published record is missing its Slack message reference",
		);
	const link = `<https://slack.com/archives/${publicChannel}/p${publicTs.replace(
		".",
		"",
	)}|here>`;
	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `:white_check_mark: This donut ${wording} to <#${publicChannel}>! See it ${link}.`,
			},
		},
	];
}

function buildAlreadyPublishedBlocks(existingRecord) {
	return buildPublishedNoticeBlocks(
		existingRecord,
		"has already been published",
	);
}

function buildDisabledPublishPromptBlocks(existingRecord) {
	return buildPublishedNoticeBlocks(existingRecord, "was published");
}

module.exports = {
	formatRosterMentions,
	parseExtraDetails,
	formatWhenForDisplay,
	buildPreviewBlocks,
	buildPublicDonutBlocks,
	buildInsufficientDetailsBlocks,
	buildAlreadyPublishedBlocks,
	buildDisabledPublishPromptBlocks,
	buildPublishPromptBlocks,
	buildLLMConsentBlocks,
	PUBLISH_PROMPT_FALLBACK_TEXT,
};
