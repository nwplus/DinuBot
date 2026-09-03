// settings.js — publish configuration commands
const { setDonutRosterMax } = require("../repository");

function parseRosterMax(text) {
	const max = Number((text || "").trim());
	if (!Number.isInteger(max) || max < 1)
		throw new Error("Usage: /set-donut-roster-max <positive integer>");
	return max;
}

function registerSettingsHandlers({ slackBot, db }) {
	slackBot.command(
		"/set-donut-roster-max",
		async ({ command, ack, respond }) => {
			await ack();

			try {
				const max = parseRosterMax(command.text);
				await setDonutRosterMax(db, max);
				await respond({
					response_type: "ephemeral",
					text: `Donut roster max set to ${max}.`,
				});
			} catch (error) {
				console.error("set donut roster max command failed", error);
				await respond({
					response_type: "ephemeral",
					text: error.message,
				});
			}
		},
	);
}

module.exports = { parseRosterMax, registerSettingsHandlers };
