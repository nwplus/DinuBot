const formatUserIds = (ids) => ids.join(",");

const convertTimeStamp = async (unix_timestamp) => {
	// Create a new JavaScript Date object based on the timestamp
	// multiplied by 1000 so that the argument is in milliseconds, not seconds.
	const date = new Date(unix_timestamp["_seconds"] * 1000);
	// Minutes part from the timestamp
	const day =
		date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
	return [day, date.getHours()];
};

module.exports = { formatUserIds, convertTimeStamp };
