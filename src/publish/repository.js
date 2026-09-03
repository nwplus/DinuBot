// repository.js — Firestore subcollections for publish feature (layer: repository)
const { FieldValue } = require("firebase-admin/firestore");
const ROOT_DOCUMENT = "InternalProjects/DinuBot";

function requirePublishString(value, field) {
	if (typeof value !== "string" || !value.trim())
		throw new Error(`Publish record requires ${field}`);
	return value.trim();
}

function validateDetails(details) {
	for (const field of ["dateTime", "place", "activity", "emojis"])
		requirePublishString(details?.[field], `details.${field}`);
}

function validatePending(data) {
	requirePublishString(data?.draftText, "draftText");
	validateDetails(data?.details);

	if (!Array.isArray(data.roster) || !data.roster.length)
		throw new Error("Publish pending record requires a roster");
	requirePublishString(data.previewTs, "previewTs");
	requirePublishString(data.dmChannelId, "dmChannelId");

	return data;
}

function validatePublishRecord(record) {
	requirePublishString(record?.publicChannelId, "publicChannelId");
	requirePublishString(record?.publicMessageTs, "publicMessageTs");
	requirePublishString(record?.dmChannelId, "dmChannelId");
	requirePublishString(record?.draftText, "draftText");

	validateDetails(record?.details);
	if (
		!Array.isArray(record.originalRoster) ||
		!Array.isArray(record.currentRoster)
	)
		throw new Error("Publish record requires rosters");
	return record;
}

function getPendingsCollection(db) {
	if (!db?.doc)
		throw new Error("Firestore is required for publish persistence");

	const collection = db.doc(ROOT_DOCUMENT).collection("pendings");
	if (!collection)
		throw new Error("Firestore pendings collection is unavailable");
	return collection;
}

function getPublishesCollection(db) {
	if (!db?.doc)
		throw new Error("Firestore is required for publish persistence");

	const collection = db.doc(ROOT_DOCUMENT).collection("publishes");
	if (!collection)
		throw new Error("Firestore publishes collection is unavailable");
	return collection;
}

async function getClubTimezone(db) {
	if (!db?.doc)
		throw new Error("Firestore is required for timezone configuration");

	const snap = await db.doc(ROOT_DOCUMENT).get();
	const tz = snap.data()?.clubTimezone;
	return typeof tz === "string" && tz.trim() ? tz.trim() : null;
}

async function setClubTimezone(db, timezone) {
	if (!db?.doc)
		throw new Error("Firestore is required for timezone configuration");

	if (typeof timezone !== "string") throw new Error("timezone required");
	const tz = timezone.trim();
	if (!tz) throw new Error("timezone required");
	try {
		Intl.DateTimeFormat(undefined, { timeZone: tz });
	} catch (_) {
		throw new Error(`Invalid timezone: ${tz}`);
	}

	await db.doc(ROOT_DOCUMENT).update({ clubTimezone: tz });
	return tz;
}

function validateDonutRosterMax(value) {
	if (!Number.isInteger(value) || value < 1)
		throw new Error(
			"donutRosterMax must be a positive integer in Firestore",
		);
	return value;
}

function getDonutRosterMaxFromSnapshot(snapshot) {
	const max = snapshot.data()?.donutRosterMax;
	if (max == null)
		throw new Error("Donut roster max is not configured in Firestore");
	return validateDonutRosterMax(max);
}

async function getDonutRosterMax(db) {
	if (!db?.doc)
		throw new Error("Firestore is required for roster configuration");

	const snap = await db.doc(ROOT_DOCUMENT).get();
	return getDonutRosterMaxFromSnapshot(snap);
}

async function setDonutRosterMax(db, max) {
	if (!db?.doc)
		throw new Error("Firestore is required for roster configuration");

	const validatedMax = validateDonutRosterMax(max);
	await db.doc(ROOT_DOCUMENT).update({
		donutRosterMax: validatedMax,
	});
	return validatedMax;
}

function publishesDocId(publicChannelId, publicMessageTs) {
	return `${publicChannelId}:${publicMessageTs}`;
}

function pendingDocId(dmChannelId, previewTs) {
	if (!dmChannelId || !previewTs)
		throw new Error("dmChannelId and previewTs are required");
	return `${dmChannelId}:${previewTs}`;
}

async function getPublishedByDM(dmChannelId, db) {
	const snapshot = await getPublishesCollection(db)
		.where("dmChannelId", "==", dmChannelId)
		.limit(1)
		.get();

	const record = snapshot.empty ? null : snapshot.docs[0].data();
	if (!record) return null;
	return validatePublishRecord(record);
}

async function isAlreadyPublished(dmChannelId, db) {
	return !!(await getPublishedByDM(dmChannelId, db));
}

async function getPendingPublish(dmChannelId, db, previewTs) {
	const snapshot = await getPendingsCollection(db)
		.doc(pendingDocId(dmChannelId, previewTs))
		.get();

	const pending = snapshot.exists ? snapshot.data() : null;
	if (!pending) return null;
	return validatePending(pending);
}

async function setPendingPublish(dmChannelId, data, db) {
	const pending = validatePending({ ...data, dmChannelId });
	const docId = pendingDocId(dmChannelId, pending.previewTs);
	await getPendingsCollection(db).doc(docId).set(pending);
}

async function deletePendingPublish(dmChannelId, db, previewTs) {
	await getPendingsCollection(db)
		.doc(pendingDocId(dmChannelId, previewTs))
		.delete();
}

async function updatePublishRecord(record, db) {
	const publishRecord = validatePublishRecord(record);

	const docId = publishesDocId(
		publishRecord.publicChannelId,
		publishRecord.publicMessageTs,
	);
	await getPublishesCollection(db).doc(docId).set(publishRecord);
}

async function getPublishRecord(publicChannel, publicTs, db) {
	const snapshot = await getPublishesCollection(db)
		.doc(publishesDocId(publicChannel, publicTs))
		.get();
	const record = snapshot.exists ? snapshot.data() : null;
	if (!record) return null;
	return validatePublishRecord(record);
}

async function updatePublishRoster(
	operation,
	publicChannelId,
	publicMessageTs,
	userId,
	db,
) {
	const channelId = requirePublishString(publicChannelId, "publicChannelId");
	const messageTs = requirePublishString(publicMessageTs, "publicMessageTs");
	const memberId = requirePublishString(userId, "userId");

	if (operation !== "join" && operation !== "leave")
		throw new Error(`Unknown roster operation: ${operation}`);

	const docRef = getPublishesCollection(db).doc(
		publishesDocId(channelId, messageTs),
	);

	if (typeof db.runTransaction !== "function")
		throw new Error(
			"Firestore transactions are required for roster updates",
		);

	return db.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(docRef);
		if (!snapshot.exists) return { error: "not_found" };

		const record = validatePublishRecord(snapshot.data());
		const isMember = record.currentRoster.includes(memberId);
		if (operation === "join" && isMember)
			return { error: "already_member" };
		if (operation === "leave" && !isMember) return { error: "not_member" };

		let rosterMax;
		if (operation === "join") {
			const configSnapshot = await transaction.get(db.doc(ROOT_DOCUMENT));
			rosterMax = getDonutRosterMaxFromSnapshot(configSnapshot);
		}
		if (operation === "join" && record.currentRoster.length >= rosterMax)
			return { error: "roster_full", max: rosterMax };

		const currentRoster =
			operation === "join"
				? [...record.currentRoster, memberId]
				: record.currentRoster.filter((id) => id !== memberId);
		transaction.update(docRef, {
			currentRoster:
				operation === "join"
					? FieldValue.arrayUnion(memberId)
					: FieldValue.arrayRemove(memberId),
		});

		return {
			record: validatePublishRecord({ ...record, currentRoster }),
		};
	});
}

module.exports = {
	publishesDocId,
	pendingDocId,
	getClubTimezone,
	setClubTimezone,
	getDonutRosterMax,
	setDonutRosterMax,
	getPublishedByDM,
	isAlreadyPublished,
	getPendingPublish,
	setPendingPublish,
	deletePendingPublish,
	updatePublishRecord,
	getPublishRecord,
	updatePublishRoster,
};
