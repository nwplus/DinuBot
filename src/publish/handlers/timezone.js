// timezone.js — club timezone command and modal
const { getClubTimezone, setClubTimezone } = require("../repository");

const TIMEZONE_OPTIONS = [
	"America/Vancouver",
	"America/Los_Angeles",
	"America/Edmonton",
	"America/Winnipeg",
	"America/Toronto",
	"America/Halifax",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"UTC",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Asia/Tokyo",
	"Asia/Kolkata",
	"Australia/Sydney",
];

function buildTimezoneOptions(currentTimezone) {
	const options = TIMEZONE_OPTIONS.map((timezone) => ({
		text: { type: "plain_text", text: timezone },
		value: timezone,
	}));
	if (currentTimezone && !TIMEZONE_OPTIONS.includes(currentTimezone)) {
		options.unshift({
			text: { type: "plain_text", text: currentTimezone },
			value: currentTimezone,
		});
	}
	return options;
}

function registerTimezoneHandlers({ slackBot, slackClient, db }) {
	slackBot.command("/set-timezone", async ({ command, ack, client }) => {
		await ack();
		const triggerId = command.trigger_id;
		const currentTimezone = await getClubTimezone(db);
		const options = buildTimezoneOptions(currentTimezone);

		try {
			await client.views.open({
				trigger_id: triggerId,
				view: {
					type: "modal",
					callback_id: "set_timezone_view",
					title: { type: "plain_text", text: "Set Club Timezone" },
					submit: { type: "plain_text", text: "Save" },
					close: { type: "plain_text", text: "Cancel" },
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: `Current: \`${
									currentTimezone ?? "not configured"
								}\`\nPick the club's timezone for resolving "tomorrow" etc.`,
							},
						},
						{
							type: "input",
							block_id: "tz_block",
							label: { type: "plain_text", text: "Timezone" },
							element: {
								type: "static_select",
								action_id: "tz_select",
								placeholder: {
									type: "plain_text",
									text: "Select timezone",
								},
								...(currentTimezone
									? {
											initial_option: options.find(
												(option) =>
													option.value ===
													currentTimezone,
											),
									  }
									: {}),
								options,
							},
						},
					],
				},
			});
		} catch (error) {
			console.error("open timezone modal failed", error);
		}
	});

	slackBot.view("set_timezone_view", async ({ ack, body, view }) => {
		await ack();
		const selected =
			view.state.values?.tz_block?.tz_select?.selected_option?.value;
		const userId = body.user?.id;
		if (!selected) return;
		try {
			await setClubTimezone(db, selected);
			const dm = await slackClient.conversations.open({
				users: userId,
				return_im: true,
			});
			if (!dm?.ok || !dm.channel?.id)
				throw new Error(
					"Slack did not return a confirmation DM channel",
				);
			await slackClient.chat.postMessage({
				channel: dm.channel.id,
				text: `:white_check_mark: Club timezone set to \`${selected}\``,
			});
		} catch (error) {
			console.error("set timezone view failed", error);
		}
	});
}

module.exports = { registerTimezoneHandlers };
