const getUserMatchings = (userIds) => {
	const getRandomIndex = (max) => Math.floor(Math.random() * max);

	let matchings = [];

	// If the number of user IDs is odd, form a group of 3 first
	if (userIds.length % 2 !== 0) {
		let group = [];
		for (let i = 0; i < 3; i++) {
			let randomIndex = getRandomIndex(userIds.length);
			group.push(userIds[randomIndex]);
			userIds.splice(randomIndex, 1); // Remove the selected user
		}
		matchings.push(group);
	}

	// Form pairs with the remaining users
	while (userIds.length > 0) {
		let pair = [];
		for (let i = 0; i < 2; i++) {
			let randomIndex = getRandomIndex(userIds.length);
			pair.push(userIds[randomIndex]);
			userIds.splice(randomIndex, 1); // Remove the selected user
		}
		matchings.push(pair);
	}
	return matchings;
};

module.exports = { getUserMatchings };
