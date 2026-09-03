const {
	buildDraftFromDetails,
	buildPreviewBlocks,
	buildPublicDonutBlocks,
	buildInsufficientDetailsBlocks,
	buildAlreadyPublishedBlocks,
	buildDisabledPublishPromptBlocks,
	hasRequiredDetails,
	getPublishedByDM,
	isAlreadyPublished,
	disablePublishButtonsInDM,
	parseLLMResponse,
	formatRosterMentions,
	getPublishChannelId,
	pendingDocId,
	setPendingPublish,
	getPendingPublish,
	deletePendingPublish,
	updatePublishRecord,
	getPublishRecord,
	updatePublishRoster,
	getDonutRosterMax,
	setDonutRosterMax,
	generateDonutDraft,
} = require("../src/publish");
const {
	parseRosterMax,
	registerSettingsHandlers,
} = require("../src/publish/handlers/settings");

function createPublishDb({
	publishRecords = {},
	pendingRecords = {},
	timezone = "America/Vancouver",
	donutRosterMax = 8,
} = {}) {
	const publishStore = new Map(Object.entries(publishRecords));
	const pendingStore = new Map(Object.entries(pendingRecords));
	const publishConfig = {
		clubTimezone: timezone,
		donutRosterMax,
	};
	const makeCollection = (store) => ({
		doc: (id) => ({
			get: async () => {
				const value = store.get(id);
				return { exists: value !== undefined, data: () => value };
			},
			set: async (value) => store.set(id, value),
			update: async (value) => {
				if (!store.has(id)) throw new Error(`Missing document: ${id}`);
				const updated = { ...store.get(id) };
				for (const [field, change] of Object.entries(value)) {
					const transformName = change?.constructor?.name;
					if (transformName === "ArrayUnionTransform") {
						updated[field] = [
							...new Set([
								...(updated[field] || []),
								...change.elements,
							]),
						];
					} else if (transformName === "ArrayRemoveTransform") {
						updated[field] = (updated[field] || []).filter(
							(item) => !change.elements.includes(item),
						);
					} else {
						updated[field] = change;
					}
				}
				store.set(id, updated);
			},
			delete: async () => {
				store.delete(id);
			},
		}),
		where: (field, operator, expected) => ({
			limit: () => ({
				get: async () => {
					const matches = [...store.values()].filter(
						(value) =>
							operator === "==" && value[field] === expected,
					);
					return {
						empty: matches.length === 0,
						docs: matches.map((value) => ({ data: () => value })),
					};
				},
			}),
		}),
	});
	const root = {
		get: async () => ({
			data: () => publishConfig,
		}),
		update: async (value) => Object.assign(publishConfig, value),
		collection: (name) => {
			if (name === "publishes") return makeCollection(publishStore);
			if (name === "pendings") return makeCollection(pendingStore);
			throw new Error(`Unexpected publish collection: ${name}`);
		},
	};
	return {
		doc: (path) => {
			if (path !== "InternalProjects/DinuBot")
				throw new Error(`Unexpected publish document: ${path}`);
			return root;
		},
		runTransaction: async (callback) =>
			callback({
				get: (reference) => reference.get(),
				update: (reference, value) => reference.update(value),
			}),
	};
}

describe("publish helpers", () => {
	beforeEach(() => {
		delete process.env.OPENAI_API_KEY;
		delete process.env.PUBLISH_CHANNEL_ID;
	});

	test("buildDraftFromDetails creates title-only draft — iconic activity+place, bullets carry when/where/roster", () => {
		const details = {
			dateTime: "Friday 5pm",
			place: "Nest",
			activity: "bubble tea",
			emojis: "🧋✨",
		};
		const draft = buildDraftFromDetails(details);
		// draft is now "*<emojis> <activity> at <place> Donut*" — roster/when in bullets only
		expect(draft.toLowerCase()).toContain("bubble tea");
		expect(draft.toLowerCase()).toContain("everyone welcome");
		expect(draft.startsWith("*")).toBe(true);
		expect(draft).toMatch(/🧋|☕|🔥|🍩/);
		expect(draft).toContain("Donut");
		expect(draft).toContain("Nest"); // iconic place in title
		expect(draft).not.toContain("Friday 5pm"); // when not in title
		expect(draft).not.toContain("<@U01>"); // roster not in draft, in bullets
	});

	test("buildPreviewBlocks contains approve and discard actions", () => {
		const blocks = buildPreviewBlocks(
			"Test draft",
			{
				dateTime: "Friday 5pm",
				place: "Nest",
				activity: "coffee",
				roster: ["U01"],
			},
			["U01", "U02"],
			"C123",
		);
		const actions = blocks.find((b) => b.type === "actions");
		expect(actions).toBeDefined();
		const ids = actions.elements.map((e) => e.action_id);
		expect(ids).toContain("approve_publish");
		expect(ids).toContain("discard_publish_draft");
		expect(blocks[0].text.text).toContain("Test draft");
		const ctx = blocks.find((b) => b.type === "context");
		expect(JSON.stringify(ctx)).toMatch(/reply in the thread/);
	});

	test("buildPublicDonutBlocks contains roster and join/leave", () => {
		const blocks = buildPublicDonutBlocks(
			"Public draft",
			{ dateTime: "Tomorrow 3pm", place: "UBC", activity: "lunch" },
			["U01", "U02", "U03"],
		);
		const rosterField = JSON.stringify(blocks);
		expect(rosterField).toContain("<@U01>");
		expect(rosterField).toContain("Roster (3)");
		const actions = blocks.find((b) => b.type === "actions");
		expect(actions.elements.map((e) => e.action_id)).toEqual(
			expect.arrayContaining([
				"join_donut_publish",
				"leave_donut_publish",
			]),
		);
	});

	test("formatRosterMentions handles empty and multiple", () => {
		expect(formatRosterMentions([])).toMatch(/Be the first/);
		expect(formatRosterMentions(["U01"])).toBe("<@U01>");
		expect(formatRosterMentions(["U01", "U02"])).toBe("<@U01>, <@U02>");
	});

	test("getPublishChannelId requires the canonical environment variable", () => {
		delete process.env.PUBLISH_CHANNEL_ID;
		expect(() => getPublishChannelId()).toThrow(/PUBLISH_CHANNEL_ID/);
		process.env.PUBLISH_CHANNEL_ID = "C_PUBLISH";
		expect(getPublishChannelId()).toBe("C_PUBLISH");
	});

	test("donut roster max is stored with club configuration", async () => {
		const db = createPublishDb({ donutRosterMax: 6 });
		expect(await getDonutRosterMax(db)).toBe(6);
		expect(await setDonutRosterMax(db, 4)).toBe(4);
		expect(await getDonutRosterMax(db)).toBe(4);
		await expect(setDonutRosterMax(db, 0)).rejects.toThrow(
			/positive integer/,
		);
	});

	test("settings command updates the donut roster max for any user", async () => {
		const db = createPublishDb({ donutRosterMax: 8 });
		let commandHandler;
		const slackBot = {
			command: (name, handler) => {
				expect(name).toBe("/set-donut-roster-max");
				commandHandler = handler;
			},
		};
		registerSettingsHandlers({ slackBot, db });
		const ack = jest.fn();
		const respond = jest.fn();

		await commandHandler({
			command: { user_id: "U_ANYONE", text: "4" },
			ack,
			respond,
		});

		expect(ack).toHaveBeenCalled();
		expect(await getDonutRosterMax(db)).toBe(4);
		expect(respond).toHaveBeenCalledWith({
			response_type: "ephemeral",
			text: "Donut roster max set to 4.",
		});
	});

	test("settings command rejects invalid max values", async () => {
		expect(() => parseRosterMax("4.5")).toThrow(/positive integer/);
		const db = createPublishDb({ donutRosterMax: 8 });
		let commandHandler;
		registerSettingsHandlers({
			slackBot: {
				command: (name, handler) => {
					expect(name).toBe("/set-donut-roster-max");
					commandHandler = handler;
				},
			},
			db,
		});
		const respond = jest.fn();
		await commandHandler({
			command: { user_id: "U_ANYONE", text: "4.5" },
			ack: jest.fn(),
			respond,
		});

		expect(await getDonutRosterMax(db)).toBe(8);
		expect(respond).toHaveBeenCalledWith({
			response_type: "ephemeral",
			text: "Usage: /set-donut-roster-max <positive integer>",
		});
	});

	test("parseLLMResponse extracts structured details and reconstructs the draft", () => {
		const raw = JSON.stringify({
			dateTime: "Friday 5pm",
			place: "Nest",
			activity: "boba",
			emojis: "🧋✨",
		});
		const parsed = parseLLMResponse(raw);
		expect(parsed.details.dateTime).toBe("Friday 5pm");
		expect(parsed.details.place).toBe("Nest");
		// draftText is now server-reconstructed title only (activity + emojis) + invite, no roster/when/where
		expect(parsed.draftText.toLowerCase()).toContain("boba");
		expect(parsed.draftText.startsWith("*")).toBe(true);
		expect(parsed.draftText.toLowerCase()).toContain("everyone welcome");
		expect(parsed.details).not.toHaveProperty("roster");
	});

	test("parseLLMResponse rejects JSON wrapped in prose or fences", () => {
		expect(() =>
			parseLLMResponse('```json\n{"activity":"boba"}\n```'),
		).toThrow();
	});

	test("parseLLMResponse ignores non-authoritative roster fields", () => {
		const raw = JSON.stringify({
			dateTime: "Monday 3pm",
			place: "Library",
			activity: "study",
			emojis: "📚✨",
			roster: ["U999", "U888"],
		});
		const parsed = parseLLMResponse(raw);
		expect(parsed.details).not.toHaveProperty("roster");
		// server reconstructs, so draft should be bolded title, no roster
		expect(parsed.draftText.toLowerCase()).toContain("study");
		expect(parsed.draftText.startsWith("*")).toBe(true);
	});

	test("parseLLMResponse rejects missing structured fields", () => {
		expect(() =>
			parseLLMResponse(
				JSON.stringify({
					dateTime: "Friday",
					place: "Nest",
					activity: "coffee",
				}),
			),
		).toThrow(/emojis/);
	});

	test("publish record roster persists in the canonical subcollection", async () => {
		const mockDb = createPublishDb();
		const record = {
			publicChannelId: "C_PUB",
			publicMessageTs: "123.456",
			dmChannelId: "D123",
			draftText: "Hello",
			details: {
				dateTime: "Friday 5pm",
				place: "Nest",
				activity: "coffee",
				emojis: "☕",
			},
			originalRoster: ["U01", "U02"],
			currentRoster: ["U01", "U02"],
			createdAt: new Date().toISOString(),
			createdBy: "U01",
		};
		record.currentRoster.push("U03");
		await updatePublishRecord(record, mockDb);
		record.currentRoster = record.currentRoster.filter(
			(id) => id !== "U02",
		);
		await updatePublishRecord(record, mockDb);
		const fetched = await getPublishRecord("C_PUB", "123.456", mockDb);
		expect(fetched.currentRoster).toEqual(["U01", "U03"]);
		const blocks = buildPublicDonutBlocks(
			record.draftText,
			record.details,
			record.currentRoster,
		);
		const text = JSON.stringify(blocks);
		expect(text).toContain("<@U01>");
		expect(text).toContain("<@U03>");
		expect(text).not.toContain("<@U02>");
	});

	test("pending drafts use dmChannelId:previewTs document keys", async () => {
		const dm = "DMPUBLISH";
		const previewTs = "123.456";
		const db = createPublishDb();
		const pending = {
			draftText: "draft1",
			details: {
				dateTime: "now",
				place: "Nest",
				activity: "coffee",
				emojis: "☕",
			},
			roster: ["U01"],
			previewTs,
			createdAt: "2026-09-01T00:00:00.000Z",
			requester: "U01",
		};
		await setPendingPublish(dm, pending, db);
		expect(pendingDocId(dm, previewTs)).toBe("DMPUBLISH:123.456");
		expect(await getPendingPublish(dm, db, previewTs)).toEqual({
			...pending,
			dmChannelId: dm,
		});
		await deletePendingPublish(dm, db, previewTs);
		expect(await getPendingPublish(dm, db, previewTs)).toBeNull();
	});

	test("hasRequiredDetails requires both time and place", () => {
		expect(
			hasRequiredDetails({ dateTime: "Friday 5pm", place: "Nest" }),
		).toBe(true);
		expect(hasRequiredDetails({ dateTime: "TBD", place: "Nest" })).toBe(
			false,
		);
		expect(
			hasRequiredDetails({ dateTime: "Friday 5pm", place: "TBD" }),
		).toBe(false);
		expect(hasRequiredDetails({ dateTime: "TBD", place: "TBD" })).toBe(
			false,
		);
		expect(hasRequiredDetails({ dateTime: "", place: "Nest" })).toBe(false);
		expect(hasRequiredDetails(null)).toBe(false);
	});

	test("buildInsufficientDetailsBlocks shows missing time/place", () => {
		const blocksTime = buildInsufficientDetailsBlocks(["time"]);
		expect(JSON.stringify(blocksTime)).toMatch(/time/);
		expect(JSON.stringify(blocksTime)).toMatch(/Please put the time/);
		const blocksBoth = buildInsufficientDetailsBlocks(["time", "place"]);
		expect(JSON.stringify(blocksBoth)).toMatch(/time and place/);
		const blocksPlace = buildInsufficientDetailsBlocks(["place"]);
		expect(JSON.stringify(blocksPlace)).toMatch(/place/);
	});

	test("buildPreviewBlocks now mentions thread revise", () => {
		const blocks = buildPreviewBlocks(
			"draft",
			{
				dateTime: "now",
				place: "Nest",
				activity: "coffee",
				roster: ["U01"],
			},
			["U01"],
			"C123",
		);
		const ctx = blocks.find((b) => b.type === "context");
		expect(JSON.stringify(ctx)).toMatch(/reply in the thread/);
	});

	test("buildAlreadyPublishedBlocks shows already published", () => {
		const rec = {
			publicChannelId: "C_PUB",
			publicMessageTs: "111.222",
			currentRoster: ["U01"],
			originalRoster: ["U01"],
		};
		const blocks = buildAlreadyPublishedBlocks(rec);
		expect(JSON.stringify(blocks)).toMatch(/already been published/);
		expect(JSON.stringify(blocks)).toMatch(/:white_check_mark:/);
	});

	test("buildDisabledPublishPromptBlocks shows disabled", () => {
		const rec = {
			publicChannelId: "C_PUB",
			publicMessageTs: "111.222",
			currentRoster: ["U01", "U02"],
		};
		const blocks = buildDisabledPublishPromptBlocks(rec);
		expect(JSON.stringify(blocks)).toMatch(/published to/);
		expect(JSON.stringify(blocks)).toMatch(/See it/);
		expect(JSON.stringify(blocks)).toMatch(/here/);
	});

	test("getPublishedByDM idempotency per DM", async () => {
		const dm = "DMPUBLISH123";
		const db = createPublishDb();
		expect(await isAlreadyPublished(dm, db)).toBe(false);
		const rec = {
			publicChannelId: "C_PUB",
			publicMessageTs: "123.456",
			dmChannelId: dm,
			draftText: "Hello",
			details: {
				dateTime: "Friday 5pm",
				place: "Nest",
				activity: "coffee",
				emojis: "☕",
			},
			originalRoster: ["U01"],
			currentRoster: ["U01"],
			createdAt: new Date().toISOString(),
		};
		await updatePublishRecord(rec, db);
		expect(await isAlreadyPublished(dm, db)).toBe(true);
		expect(await getPublishedByDM(dm, db)).toEqual(rec);
	});

	test("getPublishedByDM reads the canonical publishes subcollection", async () => {
		const dm = "DM_FROM_DB";
		const rec = {
			publicChannelId: "C_PUB2",
			publicMessageTs: "999.000",
			dmChannelId: dm,
			draftText: "Hi",
			details: {
				dateTime: "now",
				place: "Nest",
				activity: "hangout",
				emojis: "🍩✨",
			},
			originalRoster: ["U01"],
			currentRoster: ["U01"],
		};
		const key = `${rec.publicChannelId}:${rec.publicMessageTs}`;
		const mockDb = createPublishDb({ publishRecords: { [key]: rec } });
		const fetched = await getPublishedByDM(dm, mockDb);
		expect(fetched).toEqual(rec);
	});

	test("updatePublishRecord writes the canonical publishes document", async () => {
		const mockDb = createPublishDb();
		const rec = {
			publicChannelId: "C_PUB3",
			publicMessageTs: "333.444",
			dmChannelId: "DM3",
			draftText: "test",
			details: {
				dateTime: "now",
				place: "there",
				activity: "hangout",
				emojis: "🍩✨",
			},
			originalRoster: ["U01"],
			currentRoster: ["U01"],
		};
		await updatePublishRecord(rec, mockDb);
		expect(await getPublishRecord("C_PUB3", "333.444", mockDb)).toEqual(
			rec,
		);
	});

	test("roster changes update the canonical publishes record", async () => {
		const mockDb = createPublishDb();
		const rec = {
			publicChannelId: "C_ROSTER",
			publicMessageTs: "777.888",
			dmChannelId: "DM_ROSTER",
			draftText: "Donut",
			details: {
				dateTime: "Friday 5pm",
				place: "Nest",
				activity: "coffee",
				emojis: "☕",
			},
			originalRoster: ["U01"],
			currentRoster: ["U01"],
		};
		await updatePublishRecord(rec, mockDb);
		const joined = await updatePublishRoster(
			"join",
			"C_ROSTER",
			"777.888",
			"U02",
			mockDb,
		);
		expect(joined.record.currentRoster).toEqual(["U01", "U02"]);
		const left = await updatePublishRoster(
			"leave",
			"C_ROSTER",
			"777.888",
			"U01",
			mockDb,
		);
		expect(left.record.currentRoster).toEqual(["U02"]);
	});

	test("roster joins stop at the configured Firestore max", async () => {
		const mockDb = createPublishDb({ donutRosterMax: 2 });
		const rec = {
			publicChannelId: "C_ROSTER_LIMIT",
			publicMessageTs: "888.999",
			dmChannelId: "DM_ROSTER_LIMIT",
			draftText: "Donut",
			details: {
				dateTime: "Friday 5pm",
				place: "Nest",
				activity: "coffee",
				emojis: "☕",
			},
			originalRoster: ["U01", "U02"],
			currentRoster: ["U01", "U02"],
		};
		await updatePublishRecord(rec, mockDb);

		await expect(
			updatePublishRoster(
				"join",
				"C_ROSTER_LIMIT",
				"888.999",
				"U03",
				mockDb,
			),
		).resolves.toEqual({ error: "roster_full", max: 2 });
		expect(
			(await getPublishRecord("C_ROSTER_LIMIT", "888.999", mockDb))
				.currentRoster,
		).toEqual(["U01", "U02"]);
	});
	test("disablePublishButtonsInDM updates active publish prompts", async () => {
		const dm = "DM_DISABLE";
		const rec = {
			publicChannelId: "C_PUB",
			publicMessageTs: "999.000",
			currentRoster: ["U01", "U02"],
		};
		const updates = [];
		const mockClient = {
			chat: {
				update: async (args) => {
					updates.push(args);
					return { ok: true };
				},
			},
			conversations: {
				history: async () => ({
					ok: true,
					messages: [
						{
							ts: "111.111",
							blocks: [
								{
									type: "actions",
									elements: [{ action_id: "publishDonut" }],
								},
							],
							text: "old",
						},
						{
							ts: "222.222",
							blocks: [
								{
									type: "actions",
									elements: [
										{ action_id: "approve_publish" },
									],
								},
							],
							text: "draft",
						},
						{
							ts: "444.444",
							text: "hello",
							blocks: [
								{
									type: "section",
									text: { type: "mrkdwn", text: "hi" },
								},
							],
						},
					],
				}),
			},
		};
		await disablePublishButtonsInDM(dm, mockClient, rec);
		expect(updates).toHaveLength(2);
		const updatedTs = updates.map((u) => u.ts);
		expect(updatedTs).toContain("111.111");
		expect(updatedTs).toContain("222.222");
		expect(updatedTs).not.toContain("444.444");
	});

	test("generateDonutDraft throws when LLM not configured — no heuristic fallback", async () => {
		delete process.env.OPENAI_API_KEY;
		const history = [{ text: "Friday 5pm at Nest", user: "U01" }];
		await expect(
			generateDonutDraft(history, ["U01", "U02"]),
		).rejects.toThrow(/LLM not configured/);
	});

	test("generateDonutDraft succeeds with mocked LLM", async () => {
		process.env.OPENAI_API_KEY = "sk-test";
		const originalFetch = global.fetch;
		global.fetch = async () => ({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								dateTime: "Friday 5pm",
								place: "Nest",
								activity: "boba",
								emojis: "🧋✨",
							}),
						},
					},
				],
			}),
		});
		const history = [{ text: "Friday 5pm at Nest", user: "U01" }];
		const res = await generateDonutDraft(
			history,
			["U01", "U02"],
			createPublishDb(),
		);
		expect(res.details.dateTime).toBe("Friday 5pm");
		expect(res.details.place).toBe("Nest");
		expect(res.details.emojis).toBe("🧋✨");
		global.fetch = originalFetch;
		delete process.env.OPENAI_API_KEY;
	});

	test("publishing is idempotent using the publishes subcollection", async () => {
		const dm = "DM_IDEMPOTENT";
		const db = createPublishDb();
		const rec = {
			publicChannelId: "C_PUB",
			publicMessageTs: "555.666",
			dmChannelId: dm,
			draftText: "already",
			details: {
				dateTime: "now",
				place: "there",
				activity: "hangout",
				emojis: "🍩✨",
			},
			originalRoster: ["U01"],
			currentRoster: ["U01"],
		};
		await updatePublishRecord(rec, db);
		expect(await isAlreadyPublished(dm, db)).toBe(true);
		const alreadyBlocks = buildAlreadyPublishedBlocks(rec);
		expect(JSON.stringify(alreadyBlocks)).toMatch(/already been published/);
	});
});
